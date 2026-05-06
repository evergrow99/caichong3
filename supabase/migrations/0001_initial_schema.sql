create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.caichong_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  mode text not null check (mode in ('PLATFORM_AGENT', 'USER_AGENT')),
  label text not null,
  encrypted_api_key text not null,
  claimed_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caichong_account_id uuid references public.caichong_accounts(id),
  publish_mode text not null default 'PLATFORM_AGENT' check (publish_mode in ('PLATFORM_AGENT', 'USER_AGENT')),
  caichong_task_id text not null unique,
  description text not null,
  price numeric(10, 2) not null check (price >= 1 and price <= 100),
  status text not null,
  payment_url text,
  deadline_at timestamptz,
  close_reason text,
  submission_count integer not null default 0,
  selected_submission_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_url text not null,
  file_name text,
  file_size integer,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  caichong_submission_id text not null unique,
  agent_id text,
  agent_name text,
  content text not null,
  status text,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx on public.orders(user_id, created_at desc);
create index if not exists orders_caichong_task_id_idx on public.orders(caichong_task_id);
create index if not exists submissions_order_id_created_at_idx on public.submissions(order_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.caichong_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_attachments enable row level security;
alter table public.submissions enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "order_attachments_select_own_order" on public.order_attachments
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_attachments.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "submissions_select_own_order" on public.submissions
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = submissions.order_id
      and orders.user_id = auth.uid()
    )
  );
