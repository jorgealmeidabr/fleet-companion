-- =====================================================
-- v8 — Restrição de uso por veículo
-- Execute este SQL UMA vez no SQL Editor do Supabase.
-- =====================================================

-- 1. Coluna "restricted" em veiculos
alter table public.veiculos
  add column if not exists restricted boolean not null default false;

-- 2. Tabela de usuários autorizados por veículo
create table if not exists public.vehicle_allowed_users (
  vehicle_id uuid not null references public.veiculos(id) on delete cascade,
  user_id    uuid not null references auth.users(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);

create index if not exists idx_vau_user on public.vehicle_allowed_users(user_id);

-- 3. RLS
alter table public.vehicle_allowed_users enable row level security;

-- Admin: tudo. Usuário comum: lê apenas suas próprias linhas.
drop policy if exists "vau_admin_all"   on public.vehicle_allowed_users;
drop policy if exists "vau_self_select" on public.vehicle_allowed_users;

create policy "vau_admin_all"
  on public.vehicle_allowed_users
  for all
  to authenticated
  using (public.is_admin_perfil(auth.uid()))
  with check (public.is_admin_perfil(auth.uid()));

create policy "vau_self_select"
  on public.vehicle_allowed_users
  for select
  to authenticated
  using (user_id = auth.uid());
