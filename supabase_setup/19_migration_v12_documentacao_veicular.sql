-- ============================================================
-- Migration v12 — Documentação Veicular
-- Adiciona campos de documentos (CRLV, IPVA, seguro, inspeção,
-- rastreador) e identificadores (renavam, chassi, motor) à
-- tabela public.veiculos.
-- ============================================================

alter table public.veiculos
  add column if not exists renavam text,
  add column if not exists chassi text,
  add column if not exists numero_motor text,
  add column if not exists crlv_vencimento date,
  add column if not exists ipva_valor numeric(12,2),
  add column if not exists ipva_status text default 'pendente',
  add column if not exists ipva_vencimento date,
  add column if not exists seguro_seguradora text,
  add column if not exists seguro_apolice text,
  add column if not exists seguro_inicio date,
  add column if not exists seguro_fim date,
  add column if not exists seguro_cobertura text,
  add column if not exists inspecao_data date,
  add column if not exists inspecao_proxima date,
  add column if not exists rastreador_instalado boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'veiculos_ipva_status_check'
  ) then
    alter table public.veiculos
      add constraint veiculos_ipva_status_check
      check (ipva_status in ('pago','pendente'));
  end if;
end $$;
