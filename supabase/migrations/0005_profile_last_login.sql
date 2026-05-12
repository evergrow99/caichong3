alter table public.profiles
  add column if not exists last_login_at timestamptz;

create index if not exists profiles_last_login_at_idx on public.profiles(last_login_at desc);
