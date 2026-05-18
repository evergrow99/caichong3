create table if not exists public.order_sms_reminders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reminder_key text not null unique,
  reminder_type text not null check (
    reminder_type in (
      'SUBMISSION_RECEIVED',
      'SELECTION_STARTED',
      'SELECTION_DEADLINE_6H'
    )
  ),
  caichong_submission_id text,
  user_phone text not null,
  deadline_at timestamptz,
  template_code text not null,
  template_params jsonb not null default '{}'::jsonb,
  message_text text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  attempt_count integer not null default 0,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_sms_reminders_order_id_created_at_idx on public.order_sms_reminders(order_id, created_at desc);
create index if not exists order_sms_reminders_status_created_at_idx on public.order_sms_reminders(status, created_at desc);
create index if not exists order_sms_reminders_type_created_at_idx on public.order_sms_reminders(reminder_type, created_at desc);

alter table public.order_sms_reminders enable row level security;
