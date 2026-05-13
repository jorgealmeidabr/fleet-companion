-- ============================================================
-- Migration v13 — Expansão Manutenções
-- Adiciona subtipo, prioridade, km_atual, próxima manutenção
-- (km/data dedicados), tempo parado e peças (jsonb).
-- O tipo já existente fica compatível: 'preventiva' | 'corretiva'
-- e agora aceita 'preditiva'.
-- ============================================================

-- 1) Tipo: aceitar 'preditiva' (enum manutencao_tipo)
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'manutencao_tipo' and e.enumlabel = 'preditiva'
  ) then
    alter type public.manutencao_tipo add value 'preditiva';
  end if;
end $$;

-- 2) Novas colunas
alter table public.manutencoes
  add column if not exists subtipo text,
  add column if not exists km_atual int,
  add column if not exists km_proxima_manutencao int,
  add column if not exists data_proxima_manutencao date,
  add column if not exists tempo_parado_horas numeric(10,2),
  add column if not exists prioridade text default 'media',
  add column if not exists pecas jsonb default '[]'::jsonb;

-- 3) Constraints
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manutencoes_subtipo_check') then
    alter table public.manutencoes
      add constraint manutencoes_subtipo_check
      check (subtipo is null or subtipo in (
        'troca_oleo','filtro','correia','freio','pneu','alinhamento','revisao_geral','outro'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'manutencoes_prioridade_check') then
    alter table public.manutencoes
      add constraint manutencoes_prioridade_check
      check (prioridade in ('baixa','media','alta','urgente'));
  end if;
end $$;
