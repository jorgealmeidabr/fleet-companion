-- ============================================================
-- BRQ – Frota Interna :: Migration v7
-- Sistema de cadastro com aprovação por administrador.
--
-- Mudanças:
--   1. profiles ganha colunas: status, cargo_pretendido
--   2. handle_new_user passa a marcar status = 'pendente'
--   3. RLS: admin pode ler/atualizar/excluir todos os profiles;
--           usuário só lê o próprio
--   4. Função approve_user(...) cria motorista + usuarios_perfis
--      e marca o profile como ativo (transação atômica)
--   5. Função reject_user(...) marca como rejeitado
--   6. Helper is_perfil_ativo(uid)
--
-- Rodar UMA vez no SQL editor do Supabase.
-- ============================================================

-- ---------- 1. Colunas em profiles ----------
alter table public.profiles
  add column if not exists status text not null default 'ativo'
    check (status in ('pendente','ativo','rejeitado')),
  add column if not exists cargo_pretendido text;

-- Garante que perfis pré-existentes (criados antes desta migração) continuem ativos
update public.profiles set status = 'ativo' where status is null;

create index if not exists profiles_status_idx on public.profiles(status);

-- ---------- 2. Trigger de signup: novos cadastros entram como pendentes ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, cargo_pretendido, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    new.raw_user_meta_data->>'cargo_pretendido',
    'pendente'
  )
  on conflict (id) do update
    set nome             = coalesce(excluded.nome, public.profiles.nome),
        email            = coalesce(excluded.email, public.profiles.email),
        cargo_pretendido = coalesce(excluded.cargo_pretendido, public.profiles.cargo_pretendido);
  -- não cria mais user_roles automaticamente; admin define ao aprovar
  return new;
end;
$$;

-- Garante o trigger na tabela auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 3. RLS em profiles ----------
alter table public.profiles enable row level security;

drop policy if exists "profiles read self"     on public.profiles;
drop policy if exists "profiles read admin"    on public.profiles;
drop policy if exists "profiles update self"   on public.profiles;
drop policy if exists "profiles update admin"  on public.profiles;
drop policy if exists "profiles delete admin"  on public.profiles;
drop policy if exists "profiles insert self"   on public.profiles;

create policy "profiles read self" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles read admin" on public.profiles
  for select to authenticated
  using (public.is_admin_perfil(auth.uid()));

create policy "profiles update self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and status = (select status from public.profiles where id = auth.uid()));

create policy "profiles update admin" on public.profiles
  for update to authenticated
  using (public.is_admin_perfil(auth.uid()))
  with check (public.is_admin_perfil(auth.uid()));

create policy "profiles delete admin" on public.profiles
  for delete to authenticated
  using (public.is_admin_perfil(auth.uid()));

-- Insert é feito pelo trigger (security definer); usuário comum não insere.
create policy "profiles insert self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ---------- 4. Helper: perfil ativo ----------
create or replace function public.is_perfil_ativo(_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select status = 'ativo' from public.profiles where id = _uid),
    false
  );
$$;

-- ---------- 5. Aprovar usuário ----------
-- Cria motorista (se não existir) + usuarios_perfis (admin ou usuario com permissoes)
-- e marca profile como ativo.
create or replace function public.approve_user(
  _user_id     uuid,
  _tipo        public.tipo_conta default 'usuario',
  _permissoes  jsonb default null,
  _cargo       text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _email text;
  _nome  text;
  _mid   uuid;
  _final_perms jsonb;
begin
  -- somente admin pode aprovar
  if not public.is_admin_perfil(auth.uid()) then
    raise exception 'Apenas administradores podem aprovar usuários';
  end if;

  select email, nome into _email, _nome from public.profiles where id = _user_id;
  if _email is null then raise exception 'Profile não encontrado'; end if;

  -- garante motorista
  select id into _mid from public.motoristas where user_id = _user_id limit 1;
  if _mid is null then
    insert into public.motoristas (nome, cnh_numero, cnh_categoria, cnh_validade, email, status, user_id, cargo)
    values (
      coalesce(_nome, split_part(_email,'@',1)),
      '00000000000', 'B',
      current_date + interval '5 years',
      _email, 'ativo', _user_id,
      coalesce(_cargo, (select cargo_pretendido from public.profiles where id = _user_id), 'Usuário')
    )
    returning id into _mid;
  end if;

  -- permissões padrão conforme tipo
  if _tipo = 'admin' then
    _final_perms := '{
      "dashboard":true,"veiculos":true,"motoristas":true,"manutencao":true,
      "abastecimento":true,"agendamentos":true,"checklists":true,"multas":true,
      "alertas":true,"historico":true,"usuarios":true,"financeiro":true,
      "solicitacoes":true
    }'::jsonb;
  else
    _final_perms := coalesce(_permissoes, '{
      "dashboard":false,"veiculos":false,"motoristas":false,"manutencao":false,
      "abastecimento":false,"agendamentos":true,"checklists":true,"multas":false,
      "alertas":false,"historico":false,"usuarios":false,"financeiro":false,
      "solicitacoes":true
    }'::jsonb);
  end if;

  insert into public.usuarios_perfis (user_id, motorista_id, tipo_conta, permissoes, ativo)
  values (_user_id, _mid, _tipo, _final_perms, true)
  on conflict (user_id) do update
    set tipo_conta   = excluded.tipo_conta,
        permissoes   = excluded.permissoes,
        motorista_id = excluded.motorista_id,
        ativo        = true;

  insert into public.user_roles (user_id, role)
  values (_user_id, case when _tipo = 'admin' then 'admin'::app_role else 'motorista'::app_role end)
  on conflict do nothing;

  update public.profiles set status = 'ativo' where id = _user_id;
end;
$$;

-- ---------- 6. Rejeitar usuário ----------
create or replace function public.reject_user(_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin_perfil(auth.uid()) then
    raise exception 'Apenas administradores podem rejeitar usuários';
  end if;
  update public.profiles set status = 'rejeitado' where id = _user_id;
end;
$$;

notify pgrst, 'reload schema';
