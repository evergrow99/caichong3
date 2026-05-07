create table if not exists public.sms_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sms_verifications_phone_created_at_idx on public.sms_verifications(phone, created_at desc);

alter table public.sms_verifications enable row level security;
