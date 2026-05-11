-- ============================================================
-- BRQ – Frota Interna :: Migration v10
-- Liberar novos agendamentos após 30 minutos da janela estimada
-- do condutor anterior (mesmo sem devolução física).
--
-- Substitui check_agendamento_conflito para usar:
--   reserva_fim = COALESCE(data_retorno_real, data_saida + 30min)
-- O trigger continua chamando essa função.
-- ============================================================

create or replace function public.check_agendamento_conflito(
  _veiculo_id uuid,
  _inicio timestamptz,
  _fim timestamptz,
  _ignore_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agendamentos
    where veiculo_id = _veiculo_id
      and status = 'ativo'
      and (_ignore_id is null or id <> _ignore_id)
      and _inicio < coalesce(data_retorno_real, data_saida + interval '30 minutes')
      and _fim > data_saida
  );
$$;

grant execute on function public.check_agendamento_conflito(uuid, timestamptz, timestamptz, uuid)
  to authenticated, anon;

notify pgrst, 'reload schema';
