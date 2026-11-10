create table if not exists public.gmass_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  draft_id uuid references public.outreach_drafts(id) on delete set null,
  campaign_id bigint,
  recipient_email text not null default '',
  event_type text not null check (event_type in ('Sends', 'Opens', 'Clicks', 'Replies', 'Unsubscribes', 'Bounces')),
  event_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists gmass_events_workspace_received_idx
  on public.gmass_events (workspace_id, received_at desc);
create index if not exists gmass_events_campaign_recipient_idx
  on public.gmass_events (campaign_id, lower(recipient_email));
create unique index if not exists replies_external_message_id_uniq
  on public.replies (external_message_id);

create table if not exists public.email_suppressions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_email text not null,
  reason text not null check (reason in ('bounce', 'unsubscribe')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, recipient_email)
);

alter table public.gmass_events enable row level security;
alter table public.email_suppressions enable row level security;

drop policy if exists "members can read GMass events" on public.gmass_events;
create policy "members can read GMass events" on public.gmass_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "members can read email suppressions" on public.email_suppressions;
create policy "members can read email suppressions" on public.email_suppressions
  for select to authenticated using (public.is_workspace_member(workspace_id));
