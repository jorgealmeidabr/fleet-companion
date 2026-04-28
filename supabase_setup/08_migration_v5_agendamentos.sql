-- ============================================================
-- BRQ – Frota Interna :: Migration v5
-- Refatoração do sistema de Agendamentos:
--   1. Novo status 'ativo' no enum agendamento_status
--   2. Migração de dados antigos (agendado/em_uso → ativo;
--      concluido/cancelado → cancelado)
--   3. Função check_agendamento_conflito (SECURITY DEFINER)
--      regra: novo_inicio < reserva_fim AND novo_fim > reserva_inicio
--   4. Trigger BEFORE INSERT/UPDATE que aplica a regra
--   5. Índice de performance (veiculo_id, status, intervalo)
-- Rode UMA vez no SQL editor do Supabase.
-- ============================================================

-- ---------- 1. NOVO STATUS 'ativo' ----------
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'agendamento_status' and e.enumlabel = 'ativo'
  ) then
    alter type public.agendamento_status add value 'ativo';
  end if;
end $$;

-- (precisa de COMMIT antes de usar o novo valor; SQL editor faz por padrão)

-- ---------- 2. MIGRAÇÃO DE DADOS ANTIGOS ----------
-- Mantemos data_retorno_real para histórico; status simplifica para ativo/cancelado.
update public.agendamentos
set status = 'ativo'
where status in ('agendado', 'em_uso');

update public.agendamentos
set status = 'cancelado'
where status = 'concluido';

-- ---------- 3. ÍNDICE DE PERFORMANCE ----------
create index if not exists agendamentos_veiculo_intervalo_idx
  on public.agendamentos (veiculo_id, status, data_saida, data_retorno_prevista);

-- ---------- 4. FUNÇÃO ANTI-CONFLITO ----------
-- Retorna true se HÁ conflito; false se livre.
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
      -- regra: novo_inicio < reserva_fim AND novo_fim > reserva_inicio
      and _inicio < data_retorno_prevista
      and _fim > data_saida
  );
$$;

-- Permissão para clientes autenticados verificarem conflito antes de inserir
grant execute on function public.check_agendamento_conflito(uuid, timestamptz, timestamptz, uuid)
  to authenticated, anon;

-- ---------- 5. TRIGGER BEFORE INSERT/UPDATE ----------
create or replace function public.agendamentos_block_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só validamos se o agendamento é/permanece ativo.
  if new.status <> 'ativo' then
    return new;
  end if;

  if new.data_retorno_prevista <= new.data_saida then
    raise exception 'Data de retorno deve ser posterior à data de saída';
  end if;

  if public.check_agendamento_conflito(
    new.veiculo_id,
    new.data_saida,
    new.data_retorno_prevista,
    case when tg_op = 'UPDATE' then new.id else null end
  ) then
    raise exception 'Conflito de horário: o veículo já possui um agendamento ativo neste intervalo'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agendamentos_block_overlap on public.agendamentos;
create trigger trg_agendamentos_block_overlap
  before insert or update on public.agendamentos
  for each row execute function public.agendamentos_block_overlap();

notify pgrst, 'reload schema';
