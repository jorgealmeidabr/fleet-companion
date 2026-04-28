-- ============================================================
-- BRQ – Frota Interna :: Migration v7.4
-- Corrige cadastro público: cria/garante profile pendente via RPC
-- SECURITY DEFINER, sem depender de INSERT direto bloqueado por RLS.
-- ============================================================

create or replace function public.create_pending_profile(
  _user_id uuid,
  _nome text,
  _email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _auth_email text;
  _auth_nome text;
  _current_status text;
begin
  select au.email, au.raw_user_meta_data->>'nome'
    into _auth_email, _auth_nome
  from auth.users au
  where au.id = _user_id;

  if _auth_email is null then
    raise exception 'Usuário de autenticação não encontrado';
  end if;

  if lower(_auth_email) <> lower(_email) then
    raise exception 'E-mail não corresponde ao usuário criado';
  end if;

  select status into _current_status
  from public.profiles
  where id = _user_id;

  insert into public.profiles (id, nome, email, cargo_pretendido, status)
  values (
    _user_id,
    coalesce(nullif(trim(_nome), ''), nullif(trim(_auth_nome), ''), _auth_email),
    _auth_email,
    null,
    'pendente'
  )
  on conflict (id) do update
    set nome = coalesce(nullif(trim(excluded.nome), ''), public.profiles.nome),
        email = coalesce(excluded.email, public.profiles.email),
        cargo_pretendido = null,
        status = case
          when public.profiles.status = 'ativo' then 'ativo'
          else 'pendente'
        end;
end;
$$;

grant execute on function public.create_pending_profile(uuid, text, text) to anon, authenticated;

-- Mantém o trigger também corrigido para novos signups criarem o profile automaticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, cargo_pretendido, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email,
    null,
    'pendente'
  )
  on conflict (id) do update
    set nome = coalesce(excluded.nome, public.profiles.nome),
        email = coalesce(excluded.email, public.profiles.email),
        cargo_pretendido = null,
        status = case
          when public.profiles.status = 'ativo' then 'ativo'
          else 'pendente'
        end;

  return new;
exception when others then
  raise log 'handle_new_user FAILED: % %', sqlerrm, sqlstate;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Recupera usuários já cadastrados que ainda não possuem perfil/perfil aprovado.
insert into public.profiles (id, nome, email, cargo_pretendido, status)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'nome', au.email),
  au.email,
  null,
  'pendente'
from auth.users au
where not exists (select 1 from public.usuarios_perfis up where up.user_id = au.id)
on conflict (id) do update
  set nome = coalesce(public.profiles.nome, excluded.nome),
      email = coalesce(public.profiles.email, excluded.email),
      cargo_pretendido = null,
      status = case
        when public.profiles.status = 'ativo' and not exists (
          select 1 from public.usuarios_perfis up where up.user_id = public.profiles.id
        ) then 'pendente'
        else public.profiles.status
      end;

notify pgrst, 'reload schema';
