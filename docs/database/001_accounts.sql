-- Estrutura inicial para aplicar futuramente em um projeto Supabase.
-- Este arquivo não é executado pela aplicação nem pelos testes.
begin;

create table public.account_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table public.account_subscriptions (
  user_id uuid primary key references public.account_profiles(id) on delete cascade,
  status text not null default 'pending_payment_method'
    check (status in ('pending_payment_method', 'trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  check (status <> 'trialing' or (trial_started_at is not null and trial_ends_at is not null and trial_ends_at > trial_started_at)),
  check (status <> 'active' or current_period_ends_at is not null)
);

create table public.account_settings (
  user_id uuid primary key references public.account_profiles(id) on delete cascade,
  entry time not null default '09:00',
  lunch time not null default '12:00',
  return_from_lunch time not null default '13:00',
  exit time not null default '18:20',
  work_days text[] not null default array['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  excluded_dates date[] not null default '{}',
  variation boolean not null default false,
  minimum_work_minutes integer not null default 480 check (minimum_work_minutes between 15 and 1425),
  check (entry < lunch and lunch < return_from_lunch and return_from_lunch < exit),
  check (cardinality(work_days) between 1 and 7 and work_days <@ array['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
);

-- As credenciais do portal são diferentes da senha de acesso ao EasyClock.
-- A criptografia e a guarda da chave ainda serão implementadas no backend.
create table public.account_portal_credentials (
  user_id uuid primary key references public.account_profiles(id) on delete cascade,
  encrypted_payload bytea not null,
  key_version text not null,
  connected_at timestamptz
);

create table public.account_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.account_profiles(id) on delete cascade,
  execution_key text not null,
  kind text not null check (kind in ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')),
  status text not null check (status in ('iniciando', 'enviado', 'simulado', 'confirmado', 'incerto', 'erro')),
  message text not null,
  created_at timestamptz not null default now(),
  unique (user_id, execution_key)
);
create index account_punches_user_created on public.account_punches (user_id, created_at desc);

-- Eventos únicos permitem implementar o processamento idempotente do webhook.
create table public.billing_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.account_profiles enable row level security;
alter table public.account_subscriptions enable row level security;
alter table public.account_settings enable row level security;
alter table public.account_portal_credentials enable row level security;
alter table public.account_punches enable row level security;
alter table public.billing_events enable row level security;

-- Nenhum cliente pode conceder papel admin, alterar assinatura ou ler segredos.
revoke all on public.account_profiles, public.account_subscriptions, public.account_settings,
  public.account_portal_credentials, public.account_punches, public.billing_events from anon, authenticated;
grant select on public.account_profiles, public.account_subscriptions, public.account_settings, public.account_punches to authenticated;
create policy own_profile on public.account_profiles for select to authenticated using ((select auth.uid()) = id);
create policy own_subscription on public.account_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy own_settings on public.account_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy own_punches on public.account_punches for select to authenticated using ((select auth.uid()) = user_id);

commit;
