-- ============================================================
-- BRQ – Frota Interna :: Schema completo.
-- Rode na ordem: 01_schema.sql -> 02_rls.sql -> 03_storage.sql -> 04_seed.sql
-- ============================================================

-- Extensões úteis--
create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type public.app_role as enum ('admin', 'usuario');
create type public.veiculo_tipo as enum ('carro','moto','caminhao','van');
create type public.veiculo_combustivel as enum ('flex','gasolina','diesel','eletrico');
create type public.veiculo_status as enum ('disponivel','manutencao','inativo','reservado');
create type public.motorista_status as enum ('ativo','inativo');
create type public.manutencao_tipo as enum ('preventiva','corretiva');
create type public.manutencao_status as enum ('agendada','em_andamento','concluida');
create type public.checklist_status as enum ('ok','problema');
create type public.agendamento_status as enum ('agendado','em_uso','concluido','cancelado');
create type public.multa_status as enum ('pendente','pago','contestado');

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz default now()
);

-- ---------- USER ROLES (separada para evitar privilege escalation) ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- Trigger: cria profile + role 'usuario' ao signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'usuario');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------- VEÍCULOS ----------
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text unique not null,
  modelo text not null,
  marca text not null,
  ano int not null,
  tipo public.veiculo_tipo not null,
  combustivel public.veiculo_combustivel not null,
  km_atual int not null default 0,
  status public.veiculo_status not null default 'disponivel',
  foto_url text,
  created_at timestamptz default now()
);

-- ---------- MOTORISTAS ----------
create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnh_numero text not null,
  cnh_categoria text not null,
  cnh_validade date not null,
  telefone text,
  email text,
  status public.motorista_status not null default 'ativo',
  foto_url text,
  created_at timestamptz default now()
);

-- ---------- MANUTENÇÕES ----------
create table public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  tipo public.manutencao_tipo not null,
  data date not null,
  km_momento int not null,
  descricao text,
  pecas_trocadas text,
  custo_total numeric(12,2) not null default 0,
  oficina text,
  proxima_km int,
  proxima_data date,
  status public.manutencao_status not null default 'agendada',
  created_at timestamptz default now()
);
create index on public.manutencoes(veiculo_id);

-- ---------- ABASTECIMENTOS ----------
create table public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  motorista_id uuid references public.motoristas(id) on delete set null,
  data date not null,
  km_atual int not null,
  litros numeric(10,2) not null,
  valor_total numeric(12,2) not null,
  posto text,
  consumo_km_l numeric(10,2),
  custo_por_km numeric(10,4),
  created_at timestamptz default now()
);
create index on public.abastecimentos(veiculo_id);

-- Trigger para calcular consumo_km_l e custo_por_km
create or replace function public.calc_abastecimento()
returns trigger
language plpgsql
as $$
declare
  prev_km int;
  delta int;
begin
  select km_atual into prev_km
  from public.abastecimentos
  where veiculo_id = new.veiculo_id
    and (new.id is null or id <> new.id)
    and km_atual < new.km_atual
  order by km_atual desc limit 1;

  if prev_km is not null and new.litros > 0 then
    delta := new.km_atual - prev_km;
    new.consumo_km_l := round((delta::numeric / new.litros)::numeric, 2);
    if delta > 0 then
      new.custo_por_km := round((new.valor_total / delta)::numeric, 4);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_calc_abastecimento on public.abastecimentos;
create trigger trg_calc_abastecimento
before insert or update on public.abastecimentos
for each row execute procedure public.calc_abastecimento();

-- ---------- CHECKLISTS ----------
create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  motorista_id uuid references public.motoristas(id) on delete set null,
  data date not null default current_date,
  pneus_ok boolean not null default true,
  luzes_ok boolean not null default true,
  combustivel_ok boolean not null default true,
  nivel_oleo_ok boolean not null default true,
  observacoes text,
  fotos_urls text[] default '{}',
  status public.checklist_status not null default 'ok',
  created_at timestamptz default now()
);
create index on public.checklists(veiculo_id);

-- ---------- AGENDAMENTOS ----------
create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  data_saida timestamptz not null,
  data_retorno_prevista timestamptz not null,
  data_retorno_real timestamptz,
  destino text,
  km_saida int,
  km_retorno int,
  status public.agendamento_status not null default 'agendado',
  observacoes text,
  created_at timestamptz default now()
);
create index on public.agendamentos(veiculo_id);

-- ---------- MULTAS ----------
create table public.multas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  motorista_id uuid references public.motoristas(id) on delete set null,
  data_infracao date not null,
  tipo_infracao text not null,
  valor numeric(12,2) not null,
  pontos_cnh int not null default 0,
  status_pagamento public.multa_status not null default 'pendente',
  auto_infracao text,
  created_at timestamptz default now()
);
create index on public.multas(veiculo_id);
