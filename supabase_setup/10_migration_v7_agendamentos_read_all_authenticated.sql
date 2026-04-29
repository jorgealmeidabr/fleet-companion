-- =============================================================
-- Migration v7 — Leitura de agendamentos para TODO autenticado
-- -------------------------------------------------------------
-- Objetivo: garantir que tanto admin quanto usuário comum
-- (motorista) consigam ver a "Disponibilidade por horário"
-- nos agendamentos. Para isso, a tela precisa enxergar TODAS
-- as reservas existentes (de qualquer motorista), evitando
-- double-booking e mostrando blocos ocupados na timeline.
--
-- A policy anterior (v6) exigia a permissão granular
-- "agendamentos" no perfil, o que bloqueava usuários sem essa
-- flag explícita. Agora basta estar autenticado para LER.
--
-- Escrita (insert/update/delete) permanece inalterada:
-- usuário comum só pode mexer em agendamentos onde
-- motorista_id = current_motorista_id(); admin faz tudo.
-- =============================================================

drop policy if exists "agendamentos read" on public.agendamentos;
create policy "agendamentos read" on public.agendamentos
  for select to authenticated using (true);
