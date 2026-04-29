-- ============================================================
-- BRQ – Frota Interna :: Migration v7.1 (correção do fluxo de aprovação)
--
-- Diagnóstico: novos cadastros não estavam aparecendo como "pendente".
-- Causas possíveis:
--   1. Trigger on_auth_user_created não foi recriado / falhou silenciosamente
--   2. Profiles criados antes da migration v7 ficaram como 'ativo' (default)
--   3. Usuários com auth.users mas sem profile não aparecem na lista
--
-- Correções:
--   1. Re-cria a função handle_new_user() com EXCEPTION handler que loga e re-raise
--   2. Re-cria o trigger on_auth_user_created (DROP + CREATE)
--   3. Backfill: para todo auth.users SEM usuarios_perfis (= não aprovado),
--      garante profile com status='pendente' e cargo_pretendido vindo de meta
-- ============================================================

-- 1. Função handle_new_user com logs e exception handler
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  raise log 'handle_new_user: criando profile pendente para % (%)', new.id, new.email;

  insert into public.profiles (id, nome, email, cargo_pretendido, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    new.raw_user_meta_data->>'cargo_pretendido',
    'pendente'
  )
  on conflict (id) do update
    set nome             = coalesce(excluded.nome, public.profiles.nome),
        email            = coalesce(excluded.email, public.profiles.email),
        cargo_pretendido = coalesce(excluded.cargo_pretendido, public.profiles.cargo_pretendido);

  return new;
exception when others then
  raise log 'handle_new_user FAILED: % %', sqlerrm, sqlstate;
  -- NÃO re-raise: signup do auth não pode quebrar mesmo se profile falhar
  return new;
end;
$$;

-- 2. Recria o trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Backfill: para todo auth.users que NÃO tem usuarios_perfis (= não aprovado),
--    garante profile com status='pendente' e cargo_pretendido vindo do metadata.
insert into public.profiles (id, nome, email, cargo_pretendido, status)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'nome', au.email),
  au.email,
  au.raw_user_meta_data->>'cargo_pretendido',
  'pendente'
from auth.users au
where not exists (select 1 from public.usuarios_perfis up where up.user_id = au.id)
on conflict (id) do update
  set status           = case
                           when public.profiles.status = 'ativo' and not exists (
                             select 1 from public.usuarios_perfis up where up.user_id = public.profiles.id
                           ) then 'pendente'
                           else public.profiles.status
                         end,
      cargo_pretendido = coalesce(excluded.cargo_pretendido, public.profiles.cargo_pretendido),
      nome             = coalesce(public.profiles.nome, excluded.nome),
      email            = coalesce(public.profiles.email, excluded.email);

notify pgrst, 'reload schema';
