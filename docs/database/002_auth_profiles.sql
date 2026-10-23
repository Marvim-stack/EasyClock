-- Aplicar após 001_accounts.sql no SQL Editor do Supabase.
begin;

create or replace function public.create_account_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text := left(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), 100);
begin
  if char_length(profile_name) < 2 then profile_name := 'Usuário'; end if;
  -- Metadados enviados pelo cadastro nunca escolhem o papel administrativo.
  insert into public.account_profiles (id, name, role)
    values (new.id, profile_name, 'user') on conflict (id) do nothing;
  insert into public.account_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_account_profile() from public, anon, authenticated;

create trigger easyclock_user_created after insert on auth.users
  for each row execute function public.create_account_profile();

-- Também prepara usuários cadastrados antes da instalação do trigger.
insert into public.account_profiles (id, name)
  select id, case when char_length(trim(coalesce(raw_user_meta_data ->> 'name', ''))) >= 2
    then left(trim(raw_user_meta_data ->> 'name'), 100) else 'Usuário' end from auth.users
  on conflict (id) do nothing;
insert into public.account_settings (user_id)
  select id from public.account_profiles on conflict (user_id) do nothing;

commit;
