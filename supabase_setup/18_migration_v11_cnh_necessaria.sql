-- ============================================================
-- BRQ – Frota Interna :: Migration v11
-- Filtro de veículos por categoria de CNH
-- ============================================================

alter table public.veiculos
  add column if not exists cnh_necessaria text not null default 'B';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'veiculos_cnh_necessaria_check'
  ) then
    alter table public.veiculos
      add constraint veiculos_cnh_necessaria_check
      check (cnh_necessaria in ('A','B','AB'));
  end if;
end $$;

-- Backfill: motos -> 'A', demais -> 'B'
update public.veiculos set cnh_necessaria = 'A' where tipo = 'moto' and cnh_necessaria <> 'A';
update public.veiculos set cnh_necessaria = 'B' where tipo <> 'moto' and cnh_necessaria not in ('B','AB');

notify pgrst, 'reload schema';
