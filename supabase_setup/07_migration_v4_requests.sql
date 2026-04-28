-- ============================================================
-- BRQ – Frota Interna :: Migration v4
-- Módulo "Solicitações" (requests) — manutenção e abastecimento.
--
-- Inclui:
--   1. Tabela public.requests
--   2. Sequências por tipo/ano para protocolos (MNT/ABS)
--   3. Trigger de geração automática de protocolo
--   4. RLS (usuário vê o seu, admin vê tudo)
--   5. Bucket de storage 'requests' + políticas
--   6. Permissão 'solicitacoes' adicionada ao default das permissões
-- Rode UMA vez no SQL editor do Supabase.
-- ============================================================

-- ---------- 1. TABELA ----------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id uuid not null references public.veiculos(id) on delete restrict,
  type text not null check (type in ('maintenance', 'fuel')),
  km integer not null check (km >= 0),
  urgency text check (urgency in ('low', 'medium', 'high')),
  problem_description text,
  fuel_type text,
  liters numeric,
  observations text,
  status text not null default 'requested' check (status in ('requested', 'pending', 'completed')),
  pdf_url text,
  created_at timestamptz not null default now()
);

create index if not exists requests_user_idx on public.requests(user_id);
create index if not exists requests_status_idx on public.requests(status);
create index if not exists requests_type_idx on public.requests(type);
create index if not exists requests_created_idx on public.requests(created_at desc);

alter table public.requests enable row level security;

-- ---------- 2. PROTOCOLO SEQUENCIAL ----------
-- Tabela de contadores por (tipo, ano) para protocolos amigáveis.
create table if not exists public.request_counters (
  year integer not null,
  type text not null,
  last_number integer not null default 0,
  primary key (year, type)
);

alter table public.request_counters enable row level security;
-- Sem policies → acesso só por funções SECURITY DEFINER.

create or replace function public.generate_request_protocol(_type text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _year int := extract(year from now())::int;
  _prefix text := case _type when 'maintenance' then 'MNT' when 'fuel' then 'ABS' else 'REQ' end;
  _next int;
begin
  insert into public.request_counters (year, type, last_number)
  values (_year, _type, 1)
  on conflict (year, type) do update set last_number = public.request_counters.last_number + 1
  returning last_number into _next;
  return _prefix || '-' || _year::text || '-' || lpad(_next::text, 4, '0');
end;
$$;

-- ---------- 3. TRIGGER: preenche protocolo automaticamente ----------
create or replace function public.requests_set_protocol()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.protocol is null or new.protocol = '' then
    new.protocol := public.generate_request_protocol(new.type);
  end if;
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_set_protocol on public.requests;
create trigger trg_requests_set_protocol
  before insert on public.requests
  for each row execute function public.requests_set_protocol();

-- ---------- 4. RLS ----------
drop policy if exists "requests select own or admin" on public.requests;
create policy "requests select own or admin" on public.requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_perfil(auth.uid()));

drop policy if exists "requests insert own" on public.requests;
create policy "requests insert own" on public.requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "requests update pdf own" on public.requests;
create policy "requests update pdf own" on public.requests
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin_perfil(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin_perfil(auth.uid()));

drop policy if exists "requests delete admin" on public.requests;
create policy "requests delete admin" on public.requests
  for delete to authenticated
  using (public.is_admin_perfil(auth.uid()));

-- ---------- 5. STORAGE BUCKET ----------
insert into storage.buckets (id, name, public)
values ('requests', 'requests', true)
on conflict (id) do nothing;

drop policy if exists "requests pdf read public" on storage.objects;
create policy "requests pdf read public" on storage.objects
  for select to public
  using (bucket_id = 'requests');

drop policy if exists "requests pdf insert own" on storage.objects;
create policy "requests pdf insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'requests' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "requests pdf update own" on storage.objects;
create policy "requests pdf update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'requests' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin_perfil(auth.uid())));

drop policy if exists "requests pdf delete own or admin" on storage.objects;
create policy "requests pdf delete own or admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'requests' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin_perfil(auth.uid())));

-- ---------- 6. PERMISSÃO 'solicitacoes' NOS PERFIS ----------
-- Garante que todos os perfis existentes tenham a chave (default false).
update public.usuarios_perfis
set permissoes = permissoes || jsonb_build_object('solicitacoes', coalesce((permissoes->>'solicitacoes')::boolean, true))
where not (permissoes ? 'solicitacoes');

-- Ajusta default da coluna (para novos registros) — inclui solicitacoes: true
alter table public.usuarios_perfis
  alter column permissoes set default '{
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
    "financeiro": false,
    "solicitacoes": true
  }'::jsonb;

notify pgrst, 'reload schema';
