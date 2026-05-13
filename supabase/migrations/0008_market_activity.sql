create table if not exists public.market_observed_tasks (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  description text not null,
  price numeric(10, 2) not null default 0,
  total_price numeric(10, 2) not null default 0,
  status text not null,
  submission_count integer not null default 0,
  caichong_created_at timestamptz,
  activity_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create index if not exists market_observed_tasks_activity_at_idx on public.market_observed_tasks(activity_at desc);
create index if not exists market_observed_tasks_first_seen_at_idx on public.market_observed_tasks(first_seen_at desc);

create table if not exists public.market_activity_baselines (
  id text primary key,
  task_count_base integer not null default 0,
  amount_base numeric(12, 2) not null default 0,
  month_task_count_base integer not null default 0,
  month_amount_base numeric(12, 2) not null default 0,
  note text,
  effective_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_activity_baselines
  add column if not exists month_task_count_base integer not null default 0,
  add column if not exists month_amount_base numeric(12, 2) not null default 0;

create table if not exists public.market_activity_state (
  id text primary key,
  last_synced_at timestamptz,
  last_observed_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.market_observed_tasks enable row level security;
alter table public.market_activity_baselines enable row level security;
alter table public.market_activity_state enable row level security;
