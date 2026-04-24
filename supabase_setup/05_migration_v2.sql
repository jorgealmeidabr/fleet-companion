-- ============================================================
-- BRQ – Frota Interna :: Migration v2
-- Mudanças:
--   1. Renomeia o role 'usuario' → 'motorista' no enum app_role
--   2. Adiciona coluna user_id em motoristas (FK auth.users)
--   3. Atualiza RLS para que motoristas vejam apenas seus próprios
--      agendamentos e checklists, mas não vejam dados financeiros
--      (manutenções, multas, abastecimentos, custos)
--   4. Atualiza trigger handle_new_user para usar 'motorista'
-- Rode UMA vez no SQL editor do Supabase.
-- ============================================================

-- ---------- 1. RENOMEAR ENUM 'usuario' → 'motorista' ----------
-- PostgreSQL não permite RENAME VALUE direto se houver dependências antigas;
-- usamos alteração segura via ALTER TYPE ... RENAME VALUE (PG12+).
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'usuario'
  ) then
    alter type public.app_role rename value 'usuario' to 'motorista';
  end if;
end $$;

-- ---------- 2. COLUNA user_id em motoristas ----------
alter table public.motoristas
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists motoristas_user_id_idx on public.motoristas(user_id);

-- ---------- 3. TRIGGER de signup: novo usuário recebe 'motorista' ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'motorista');
  return new;
end;
$$;

-- ---------- 4. RLS adicionais para perfil 'motorista' ----------
-- Helper: motorista_id do usuário logado
create or replace function public.current_motorista_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.motoristas where user_id = auth.uid() limit 1;
$$;

-- AGENDAMENTOS: motorista enxerga só os seus; admin vê tudo
drop policy if exists "agendamentos read" on public.agendamentos;
create policy "agendamentos read" on public.agendamentos
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or motorista_id = public.current_motorista_id()
  );

-- Motorista pode CRIAR agendamentos para si mesmo
drop policy if exists "agendamentos insert motorista" on public.agendamentos;
create policy "agendamentos insert motorista" on public.agendamentos
  for insert to authenticated with check (
    public.has_role(auth.uid(),'admin')
    or motorista_id = public.current_motorista_id()
  );

-- Motorista pode atualizar (registrar devolução) os seus agendamentos
drop policy if exists "agendamentos update motorista" on public.agendamentos;
create policy "agendamentos update motorista" on public.agendamentos
  for update to authenticated using (
    public.has_role(auth.uid(),'admin')
    or motorista_id = public.current_motorista_id()
  );

-- Mantém a política existente de "all admin" apenas para DELETE
drop policy if exists "agendamentos write admin" on public.agendamentos;
create policy "agendamentos delete admin" on public.agendamentos
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- VEÍCULOS: motorista pode atualizar status/km (necessário no fluxo de reserva/devolução)
drop policy if exists "veiculos update motorista" on public.veiculos;
create policy "veiculos update motorista" on public.veiculos
  for update to authenticated using (
    public.has_role(auth.uid(),'admin')
    or exists (select 1 from public.motoristas where user_id = auth.uid())
  );

-- CHECKLISTS: motorista vê apenas os seus
drop policy if exists "checklists read" on public.checklists;
create policy "checklists read" on public.checklists
  for select to authenticated using (
    public.has_role(auth.uid(),'admin')
    or motorista_id = public.current_motorista_id()
  );

-- Insert de checklist permanece liberado para autenticados (já existia)

-- MANUTENÇÕES, MULTAS, ABASTECIMENTOS: motorista NÃO vê (dados financeiros)
drop policy if exists "manutencoes read" on public.manutencoes;
create policy "manutencoes read admin" on public.manutencoes
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "multas read" on public.multas;
create policy "multas read admin" on public.multas
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

drop policy if exists "abastecimentos read" on public.abastecimentos;
create policy "abastecimentos read admin" on public.abastecimentos
  for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- Pronto. Reload do schema cache:
notify pgrst, 'reload schema';
