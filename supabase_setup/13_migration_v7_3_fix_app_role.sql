-- ============================================================
-- BRQ – Frota Interna :: Migration v7.3
-- Corrige approve_user para usar 'usuario' (não 'motorista'),
-- pois o enum app_role só aceita ('admin','usuario').
-- ============================================================

-- Garante que o valor 'usuario' existe no enum (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'app_role' and e.enumlabel = 'usuario'
  ) then
    alter type public.app_role add value 'usuario';
  end if;
end$$;

create or replace function public.approve_user(
  _user_id     uuid,
  _tipo        public.tipo_conta default 'usuario',
  _permissoes  jsonb default null,
  _cargo       text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _email text;
  _nome  text;
  _cargo_final text;
  _mid   uuid;
  _final_perms jsonb;
begin
  if not public.is_admin_perfil(auth.uid()) then
    raise exception 'Apenas administradores podem aprovar usuários';
  end if;

  select email, nome, coalesce(_cargo, cargo_pretendido, case when _tipo='admin' then 'Administrador' else 'Usuário' end)
    into _email, _nome, _cargo_final
  from public.profiles where id = _user_id;

  if _email is null then
    raise exception 'Profile não encontrado para user_id=%', _user_id;
  end if;

  select id into _mid from public.motoristas where user_id = _user_id limit 1;
  if _mid is null then
    select id into _mid from public.motoristas where email = _email limit 1;
    if _mid is not null then
      update public.motoristas set user_id = _user_id, cargo = coalesce(cargo, _cargo_final) where id = _mid;
    else
      insert into public.motoristas (nome, cnh_numero, cnh_categoria, cnh_validade, email, status, user_id, cargo)
      values (
        coalesce(_nome, split_part(_email,'@',1)),
        '00000000000', 'B',
        current_date + interval '5 years',
        _email, 'ativo', _user_id, _cargo_final
      )
      returning id into _mid;
    end if;
  else
    update public.motoristas set cargo = coalesce(cargo, _cargo_final), status = 'ativo' where id = _mid;
  end if;

  if _tipo = 'admin' then
    _final_perms := '{
      "dashboard":true,"veiculos":true,"motoristas":true,"manutencao":true,
      "abastecimento":true,"agendamentos":true,"checklists":true,"multas":true,
      "alertas":true,"historico":true,"usuarios":true,"financeiro":true,
      "solicitacoes":true
    }'::jsonb;
  else
    _final_perms := coalesce(_permissoes, '{
      "dashboard":false,"veiculos":false,"motoristas":false,"manutencao":false,
      "abastecimento":false,"agendamentos":true,"checklists":true,"multas":false,
      "alertas":false,"historico":false,"usuarios":false,"financeiro":false,
      "solicitacoes":true
    }'::jsonb);
  end if;

  insert into public.usuarios_perfis (user_id, motorista_id, tipo_conta, permissoes, ativo)
  values (_user_id, _mid, _tipo, _final_perms, true)
  on conflict (user_id) do update
    set tipo_conta   = excluded.tipo_conta,
        permissoes   = excluded.permissoes,
        motorista_id = excluded.motorista_id,
        ativo        = true;

  -- IMPORTANTE: enum app_role só aceita 'admin' e 'usuario'
  insert into public.user_roles (user_id, role)
  values (_user_id, case when _tipo = 'admin' then 'admin'::app_role else 'usuario'::app_role end)
  on conflict do nothing;

  update public.profiles set status = 'ativo' where id = _user_id;
end;
$$;

-- Também corrige o trigger handle_new_user (caso ainda referencie 'motorista' em user_roles)
-- Aqui mantemos a versão da v7.1 (não insere user_roles no signup), só garante presença.

notify pgrst, 'reload schema';
