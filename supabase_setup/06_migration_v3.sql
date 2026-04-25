-- ============================================================
-- BRQ – Frota Interna :: Migration v3
-- Sistema de permissões granulares (visibilidade por módulo).
--
-- Mudanças:
--   1. Adiciona coluna `cargo` em motoristas
--   2. Cria tabela `usuarios_perfis` (1 linha por user, vinculada a 1 motorista)
--   3. Helpers `current_perfil()`, `has_perm(modulo)`, `is_admin_perfil()`
--   4. RLS de todos os módulos passa a respeitar permissoes->>modulo
--   5. Trigger de signup cria usuarios_perfis automaticamente
-- Rode UMA vez no SQL editor do Supabase.
-- ============================================================

-- ---------- 1. CARGO em motoristas ----------
alter table public.motoristas
  add column if not exists cargo text;

-- ---------- 2. Enum tipo_conta ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_conta') then
    create type public.tipo_conta as enum ('admin', 'usuario');
  end if;
end $$;

-- ---------- 3. Tabela usuarios_perfis ----------
create table if not exists public.usuarios_perfis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  motorista_id uuid not null references public.motoristas(id) on delete restrict,
  tipo_conta public.tipo_conta not null default 'usuario',
  permissoes jsonb not null default '{
    "dashboard": false,
    "veiculos": false,
    "motoristas": false,
    "manutencao": false,
    "abastecimento": false,
    "agendamentos": true,
    "checklists": true,
    "multas": false,
    "alertas": false,
    "historico": false,
    "usuarios": false,
    "financeiro": false
  }'::jsonb,
  ativo boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create index if not exists usuarios_perfis_motorista_idx on public.usuarios_perfis(motorista_id);

alter table public.usuarios_perfis enable row level security;

-- ---------- 4. HELPERS ----------
create or replace function public.is_admin_perfil(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select tipo_conta = 'admin' from public.usuarios_perfis where user_id = _user_id),
    public.has_role(_user_id, 'admin')
  );
$$;

create or replace function public.has_perm(_user_id uuid, _modulo text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when public.is_admin_perfil(_user_id) then true
    else coalesce(
      (select (permissoes ->> _modulo)::boolean from public.usuarios_perfis where user_id = _user_id and ativo = true),
      false
    )
  end;
$$;

create or replace function public.current_motorista_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select motorista_id from public.usuarios_perfis where user_id = auth.uid()
  union all
  select id from public.motoristas where user_id = auth.uid()
  limit 1;
$$;

-- ---------- 5. RLS em usuarios_perfis ----------
drop policy if exists "perfis read self" on public.usuarios_perfis;
create policy "perfis read self" on public.usuarios_perfis
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_perfil(auth.uid()));

drop policy if exists "perfis admin write" on public.usuarios_perfis;
create policy "perfis admin write" on public.usuarios_perfis
  for all to authenticated
  using (public.is_admin_perfil(auth.uid()))
  with check (public.is_admin_perfil(auth.uid()));

drop policy if exists "perfis update last_login" on public.usuarios_perfis;
create policy "perfis update last_login" on public.usuarios_perfis
  for update to authenticated
  using (user_id = auth.uid());

-- ---------- 6. RLS POR MÓDULO (visibilidade granular) ----------
-- Padrão: SELECT requer has_perm(modulo). Admin tem tudo via has_perm.
-- Mantemos políticas de write existentes para admin.

-- VEÍCULOS
drop policy if exists "veiculos read" on public.veiculos;
create policy "veiculos read" on public.veiculos
  for select to authenticated using (
    public.has_perm(auth.uid(), 'veiculos')
    or public.has_perm(auth.uid(), 'agendamentos')
    or public.has_perm(auth.uid(), 'checklists')
  );

-- MOTORISTAS
drop policy if exists "motoristas read" on public.motoristas;
create policy "motoristas read" on public.motoristas
  for select to authenticated using (
    public.has_perm(auth.uid(), 'motoristas')
    or public.has_perm(auth.uid(), 'agendamentos')
    or public.has_perm(auth.uid(), 'usuarios')
    or id = public.current_motorista_id()
  );

-- AGENDAMENTOS
drop policy if exists "agendamentos read" on public.agendamentos;
create policy "agendamentos read" on public.agendamentos
  for select to authenticated using (
    public.is_admin_perfil(auth.uid())
    or (public.has_perm(auth.uid(), 'agendamentos') and motorista_id = public.current_motorista_id())
  );

-- CHECKLISTS
drop policy if exists "checklists read" on public.checklists;
create policy "checklists read" on public.checklists
  for select to authenticated using (
    public.is_admin_perfil(auth.uid())
    or (public.has_perm(auth.uid(), 'checklists') and motorista_id = public.current_motorista_id())
  );

-- MANUTENÇÕES
drop policy if exists "manutencoes read" on public.manutencoes;
drop policy if exists "manutencoes read admin" on public.manutencoes;
create policy "manutencoes read" on public.manutencoes
  for select to authenticated using (public.has_perm(auth.uid(), 'manutencao'));

-- ABASTECIMENTOS
drop policy if exists "abastecimentos read" on public.abastecimentos;
drop policy if exists "abastecimentos read admin" on public.abastecimentos;
create policy "abastecimentos read" on public.abastecimentos
  for select to authenticated using (public.has_perm(auth.uid(), 'abastecimento'));

-- MULTAS
drop policy if exists "multas read" on public.multas;
drop policy if exists "multas read admin" on public.multas;
create policy "multas read" on public.multas
  for select to authenticated using (public.has_perm(auth.uid(), 'multas'));

-- ---------- 7. TRIGGER de signup ----------
-- Novos signups (auto-cadastro pela tela /auth) NÃO criam usuarios_perfis.
-- Apenas admins criam usuários, e o fluxo de criação cria o perfil + motorista.
-- Mantemos profile/role legados.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'motorista')
  on conflict do nothing;
  return new;
end;
$$;

-- ---------- 8. Promote helper (rodar manualmente para o primeiro admin) ----------
-- Exemplo:
-- select public.promote_to_admin('seu@email.com');
create or replace function public.promote_to_admin(_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid;
  _mid uuid;
begin
  select id into _uid from auth.users where email = _email;
  if _uid is null then raise exception 'user not found'; end if;

  -- garante motorista vinculado
  select id into _mid from public.motoristas where user_id = _uid limit 1;
  if _mid is null then
    insert into public.motoristas (nome, cnh_numero, cnh_categoria, cnh_validade, email, status, user_id, cargo)
    values (split_part(_email,'@',1), '00000000000', 'B', current_date + interval '5 years', _email, 'ativo', _uid, 'Administrador')
    returning id into _mid;
  end if;

  insert into public.usuarios_perfis (user_id, motorista_id, tipo_conta, permissoes, ativo)
  values (_uid, _mid, 'admin', '{
    "dashboard":true,"veiculos":true,"motoristas":true,"manutencao":true,
    "abastecimento":true,"agendamentos":true,"checklists":true,"multas":true,
    "alertas":true,"historico":true,"usuarios":true,"financeiro":true
  }'::jsonb, true)
  on conflict (user_id) do update set tipo_conta = 'admin', ativo = true,
    permissoes = excluded.permissoes;
end;
$$;

notify pgrst, 'reload schema';
