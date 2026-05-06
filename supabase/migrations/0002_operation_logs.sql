create table if not exists public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  caichong_task_id text,
  scope text not null,
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  details jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operation_logs_created_at_idx on public.operation_logs(created_at desc);
create index if not exists operation_logs_level_created_at_idx on public.operation_logs(level, created_at desc);
create index if not exists operation_logs_task_id_idx on public.operation_logs(caichong_task_id);

alter table public.operation_logs enable row level security;
