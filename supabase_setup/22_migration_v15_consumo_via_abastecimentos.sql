-- ============================================================
-- Migration v15 :: Consumo médio (km/L) calculado via abastecimentos
-- Remove a obrigatoriedade/uso de agendamentos.litros_abastecidos.
-- A média de consumo do veículo passa a vir dos apontamentos
-- (tabela abastecimentos.consumo_km_l).
-- ============================================================

-- 1) Remover coluna km_l e litros_abastecidos de agendamentos (não usadas mais)
drop trigger if exists trg_calc_agendamento_consumo on public.agendamentos;
drop function if exists public.calc_agendamento_consumo();

alter table public.agendamentos drop column if exists km_l;
alter table public.agendamentos drop column if exists litros_abastecidos;

-- 2) Trigger AFTER em agendamentos: apenas atualiza km_atual do veículo
create or replace function public.sync_veiculo_apos_agendamento()
returns trigger
language plpgsql
as $$
declare
  vid uuid;
  max_km int;
begin
  vid := coalesce(new.veiculo_id, old.veiculo_id);
  if vid is null then return coalesce(new, old); end if;

  select greatest(
    coalesce((select max(km_retorno) from public.agendamentos
               where veiculo_id = vid and km_retorno is not null), 0),
    coalesce((select max(km_atual) from public.abastecimentos
               where veiculo_id = vid), 0)
  ) into max_km;

  update public.veiculos v
     set km_atual = greatest(coalesce(v.km_atual, 0), coalesce(max_km, v.km_atual))
   where v.id = vid;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_veiculo_apos_agendamento on public.agendamentos;
create trigger trg_sync_veiculo_apos_agendamento
after insert or update or delete on public.agendamentos
for each row execute procedure public.sync_veiculo_apos_agendamento();

-- 3) Trigger AFTER em abastecimentos: recalcula consumo_medio_kml e km_atual
create or replace function public.sync_veiculo_apos_abastecimento()
returns trigger
language plpgsql
as $$
declare
  vid uuid;
  media numeric(10,2);
  max_km int;
begin
  vid := coalesce(new.veiculo_id, old.veiculo_id);
  if vid is null then return coalesce(new, old); end if;

  select round(avg(consumo_km_l)::numeric, 2)
    into media
    from public.abastecimentos
   where veiculo_id = vid
     and consumo_km_l is not null;

  select greatest(
    coalesce((select max(km_retorno) from public.agendamentos
               where veiculo_id = vid and km_retorno is not null), 0),
    coalesce((select max(km_atual) from public.abastecimentos
               where veiculo_id = vid), 0)
  ) into max_km;

  update public.veiculos v
     set consumo_medio_kml = media,
         km_atual = greatest(coalesce(v.km_atual, 0), coalesce(max_km, v.km_atual))
   where v.id = vid;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_veiculo_apos_abastecimento on public.abastecimentos;
create trigger trg_sync_veiculo_apos_abastecimento
after insert or update or delete on public.abastecimentos
for each row execute procedure public.sync_veiculo_apos_abastecimento();

-- 4) Backfill: recalcula a média atual de cada veículo
update public.veiculos v
   set consumo_medio_kml = sub.media
  from (
    select veiculo_id, round(avg(consumo_km_l)::numeric, 2) as media
      from public.abastecimentos
     where consumo_km_l is not null
     group by veiculo_id
  ) sub
 where sub.veiculo_id = v.id;
