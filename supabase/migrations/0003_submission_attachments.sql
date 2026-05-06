create table if not exists public.submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_url text not null,
  file_name text,
  file_size integer,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists submission_attachments_submission_id_idx on public.submission_attachments(submission_id);

alter table public.submission_attachments enable row level security;

create policy "submission_attachments_select_own_order" on public.submission_attachments
  for select using (
    exists (
      select 1
      from public.submissions
      join public.orders on orders.id = submissions.order_id
      where submissions.id = submission_attachments.submission_id
      and orders.user_id = auth.uid()
    )
  );
