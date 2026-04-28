-- =============================================================
-- Migration v6 — Leitura aberta de agendamentos
-- -------------------------------------------------------------
-- Objetivo: permitir que QUALQUER usuário autenticado com a
-- permissão "agendamentos" enxergue TODOS os agendamentos
-- (não apenas os próprios). Isso é necessário para que a tela
-- de "Disponibilidade por horário" mostre as reservas de todos
-- os motoristas, evitando double-booking.
--
-- Admins continuam vendo tudo.
-- Demais regras (insert/update/delete) permanecem inalteradas:
-- usuário só pode criar/editar agendamentos onde
-- motorista_id = current_motorista_id().
-- =============================================================

drop policy if exists "agendamentos read" on public.agendamentos;
create policy "agendamentos read" on public.agendamentos
  for select to authenticated using (
    public.is_admin_perfil(auth.uid())
    or public.has_perm(auth.uid(), 'agendamentos')
  );
