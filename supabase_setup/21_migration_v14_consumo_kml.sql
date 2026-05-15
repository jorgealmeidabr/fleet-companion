-- ============================================================
-- Migration v14 :: Consumo médio (km/L) por utilização e por veículo
-- ============================================================

-- 1) Novas colunas em veiculos
alter table public.veiculos
  add column if not exists km_inicial int,
  add column if not exists consumo_medio_kml numeric(10,2);

-- backfill: km_inicial = km_atual atual (snapshot inicial)
update public.veiculos set km_inicial = coalesce(km_inicial, km_atual);
alter table public.veiculos alter column km_inicial set default 0;

-- 2) Novas colunas em agendamentos
alter table public.agendamentos
  add column if not exists litros_abastecidos numeric(10,2),
  add column if not exists km_l numeric(10,2);

-- 3) Trigger BEFORE: calcula km_l da utilização
create or replace function public.calc_agendamento_consumo()
returns trigger
language plpgsql
as $$
begin
  if new.km_retorno is not null
     and new.km_saida is not null
     and new.km_retorno > new.km_saida
     and new.litros_abastecidos is not null
     and new.litros_abastecidos > 0 then
    new.km_l := round(((new.km_retorno - new.km_saida)::numeric / new.litros_abastecidos)::numeric, 2);
  else
    new.km_l := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_calc_agendamento_consumo on public.agendamentos;
create trigger trg_calc_agendamento_consumo
before insert or update on public.agendamentos
for each row execute procedure public.calc_agendamento_consumo();

-- 4) Trigger AFTER: sincroniza veiculo (consumo_medio_kml + km_atual)
create or replace function public.sync_veiculo_apos_agendamento()
returns trigger
language plpgsql
as $$
declare
  vid uuid;
  media numeric(10,2);
  max_km int;
begin
  vid := coalesce(new.veiculo_id, old.veiculo_id);
  if vid is null then
    return coalesce(new, old);
  end if;

  select round(avg(km_l)::numeric, 2)
    into media
    from public.agendamentos
   where veiculo_id = vid
     and km_l is not null;

  select max(km_retorno)
    into max_km
    from public.agendamentos
   where veiculo_id = vid
     and km_retorno is not null;

  update public.veiculos v
     set consumo_medio_kml = media,
         km_atual = greatest(coalesce(v.km_atual, 0), coalesce(max_km, v.km_atual))
   where v.id = vid;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_veiculo_apos_agendamento on public.agendamentos;
create trigger trg_sync_veiculo_apos_agendamento
after insert or update or delete on public.agendamentos
for each row execute procedure public.sync_veiculo_apos_agendamento();

-- 5) Backfill inicial: roda os triggers em registros existentes (recalcula km_l)
update public.agendamentos set id = id;
