-- =====================================================
-- v9 — Módulo de Acidentes
-- Execute UMA vez no SQL Editor do Supabase.
-- =====================================================

-- 1. Tabela acidentes
create table if not exists public.acidentes (
  id uuid primary key default gen_random_uuid(),
  protocolo text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  motorista_nome text not null,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  data_hora timestamptz not null,
  local text not null,
  descricao text not null,
  tipo text not null check (tipo in ('colisao','atropelamento','capotamento','outro')),
  culpa text not null check (culpa in ('funcionario','terceiro','falha_mecanica','desconhecido')),
  numero_bo text,
  fotos_urls text[] not null default '{}',
  status text not null default 'pendente' check (status in ('pendente','em_analise','encerrado')),
  created_at timestamptz not null default now()
);

create index if not exists idx_acidentes_user on public.acidentes(user_id);
create index if not exists idx_acidentes_status on public.acidentes(status);
create index if not exists idx_acidentes_created on public.acidentes(created_at desc);

alter table public.acidentes enable row level security;

drop policy if exists "ac_admin_all"     on public.acidentes;
drop policy if exists "ac_self_select"   on public.acidentes;
drop policy if exists "ac_self_insert"   on public.acidentes;

create policy "ac_admin_all"
  on public.acidentes for all to authenticated
  using (public.is_admin_perfil(auth.uid()))
  with check (public.is_admin_perfil(auth.uid()));

create policy "ac_self_select"
  on public.acidentes for select to authenticated
  using (user_id = auth.uid());

create policy "ac_self_insert"
  on public.acidentes for insert to authenticated
  with check (user_id = auth.uid());

-- 2. Contatos de emergência da empresa
create table if not exists public.acidentes_contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  telefone text not null,
  whatsapp text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.acidentes_contatos enable row level security;

drop policy if exists "acc_select_all" on public.acidentes_contatos;
drop policy if exists "acc_admin_all"  on public.acidentes_contatos;

create policy "acc_select_all"
  on public.acidentes_contatos for select to authenticated using (true);

create policy "acc_admin_all"
  on public.acidentes_contatos for all to authenticated
  using (public.is_admin_perfil(auth.uid()))
  with check (public.is_admin_perfil(auth.uid()));

-- Seed (apenas se vazio)
insert into public.acidentes_contatos (nome, cargo, telefone, whatsapp, ordem)
select * from (values
  ('RH BRQ',          'Recursos Humanos', '(11) 99999-0001', '5511999990001', 1),
  ('Gestor de Frota', 'Gestão de Frota',  '(11) 99999-0002', '5511999990002', 2),
  ('Diretoria',       'Diretoria',        '(11) 99999-0003', '5511999990003', 3)
) as v(nome,cargo,telefone,whatsapp,ordem)
where not exists (select 1 from public.acidentes_contatos);

-- 3. Bucket de storage
insert into storage.buckets (id, name, public)
values ('acidentes', 'acidentes', true)
on conflict (id) do nothing;

drop policy if exists "acid_read"   on storage.objects;
drop policy if exists "acid_insert" on storage.objects;
drop policy if exists "acid_admin"  on storage.objects;

create policy "acid_read"
  on storage.objects for select to public
  using (bucket_id = 'acidentes');

create policy "acid_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'acidentes');

create policy "acid_admin"
  on storage.objects for all to authenticated
  using (bucket_id = 'acidentes' and public.is_admin_perfil(auth.uid()))
  with check (bucket_id = 'acidentes' and public.is_admin_perfil(auth.uid()));
