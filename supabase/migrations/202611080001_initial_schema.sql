-- Aiventra Leads initial schema.
-- Apply in Supabase SQL Editor after reviewing. All application tables use RLS.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (allowed_roles)
  );
$$;

create or replace function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

drop trigger if exists workspaces_add_owner on public.workspaces;
create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner();

create table if not exists public.search_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  service_categories text[] not null default '{}',
  keywords text not null default '',
  excluded_phrases text not null default '',
  minimum_budget text not null default '',
  source_preferences text[] not null default '{}',
  monitoring_enabled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  source text not null default 'Manual entry',
  source_url text,
  contact text not null default '',
  email text not null default '',
  detail text not null default '',
  budget text not null default '',
  status text not null default 'New'
    check (status in ('New', 'Review', 'Draft ready', 'Contacted', 'Replied')),
  match_score smallint check (match_score between 0 and 100),
  replied boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_workspace_created_idx
  on public.opportunities (workspace_id, created_at desc);
create index if not exists opportunities_workspace_status_idx
  on public.opportunities (workspace_id, status);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  detail text not null default '',
  kind text not null default 'system'
    check (kind in ('setup', 'capture', 'message', 'system')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_workspace_created_idx
  on public.activity_events (workspace_id, created_at desc);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  channel text not null check (channel in ('email', 'social')),
  recipient_name text not null default '',
  recipient_email text not null default '',
  recipient_handle text not null default '',
  subject text not null default '',
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'queued', 'sent', 'failed', 'cancelled')),
  requires_approval boolean not null default true,
  scheduled_for timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  error_detail text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_drafts_workspace_created_idx
  on public.outreach_drafts (workspace_id, created_at desc);
create index if not exists outreach_drafts_due_idx
  on public.outreach_drafts (scheduled_for)
  where status = 'queued';

create table if not exists public.sequence_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  follow_up_days smallint[] not null default array[1, 3, 7]::smallint[],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  step_number smallint not null check (step_number > 0),
  delay_days smallint not null check (delay_days between 1 and 365),
  subject text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, step_number)
);

create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  draft_id uuid references public.outreach_drafts(id) on delete set null,
  channel text not null check (channel in ('email', 'social')),
  external_message_id text,
  body text not null default '',
  received_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists replies_workspace_received_idx
  on public.replies (workspace_id, received_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists search_settings_set_updated_at on public.search_settings;
create trigger search_settings_set_updated_at
  before update on public.search_settings
  for each row execute function public.set_updated_at();

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists outreach_drafts_set_updated_at on public.outreach_drafts;
create trigger outreach_drafts_set_updated_at
  before update on public.outreach_drafts
  for each row execute function public.set_updated_at();

drop trigger if exists sequence_settings_set_updated_at on public.sequence_settings;
create trigger sequence_settings_set_updated_at
  before update on public.sequence_settings
  for each row execute function public.set_updated_at();

drop trigger if exists sequence_steps_set_updated_at on public.sequence_steps;
create trigger sequence_steps_set_updated_at
  before update on public.sequence_steps
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.search_settings enable row level security;
alter table public.opportunities enable row level security;
alter table public.activity_events enable row level security;
alter table public.outreach_drafts enable row level security;
alter table public.sequence_settings enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.replies enable row level security;

drop policy if exists "workspace members can read workspaces" on public.workspaces;
create policy "workspace members can read workspaces"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
drop policy if exists "authenticated users can create own workspaces" on public.workspaces;
create policy "authenticated users can create own workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
drop policy if exists "workspace admins can update workspaces" on public.workspaces;
create policy "workspace admins can update workspaces"
  on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, array['owner', 'admin']))
  with check (public.has_workspace_role(id, array['owner', 'admin']));
drop policy if exists "workspace owners can delete workspaces" on public.workspaces;
create policy "workspace owners can delete workspaces"
  on public.workspaces for delete to authenticated
  using (public.has_workspace_role(id, array['owner']));

drop policy if exists "members can read workspace membership" on public.workspace_members;
create policy "members can read workspace membership"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "admins can add workspace members" on public.workspace_members;
create policy "admins can add workspace members"
  on public.workspace_members for insert to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "admins can remove workspace members" on public.workspace_members;
create policy "admins can remove workspace members"
  on public.workspace_members for delete to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "members can read search settings" on public.search_settings;
create policy "members can read search settings" on public.search_settings
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "members can create search settings" on public.search_settings;
create policy "members can create search settings" on public.search_settings
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can update search settings" on public.search_settings;
create policy "members can update search settings" on public.search_settings
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
drop policy if exists "admins can delete search settings" on public.search_settings;
create policy "admins can delete search settings" on public.search_settings
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "members can read opportunities" on public.opportunities;
create policy "members can read opportunities" on public.opportunities
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "members can create opportunities" on public.opportunities;
create policy "members can create opportunities" on public.opportunities
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can update opportunities" on public.opportunities;
create policy "members can update opportunities" on public.opportunities
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
drop policy if exists "admins can delete opportunities" on public.opportunities;
create policy "admins can delete opportunities" on public.opportunities
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "members can read activity" on public.activity_events;
create policy "members can read activity" on public.activity_events
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "members can add activity" on public.activity_events;
create policy "members can add activity" on public.activity_events
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can read outreach drafts" on public.outreach_drafts;
create policy "members can read outreach drafts" on public.outreach_drafts
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "members can create outreach drafts" on public.outreach_drafts;
create policy "members can create outreach drafts" on public.outreach_drafts
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can update outreach drafts" on public.outreach_drafts;
create policy "members can update outreach drafts" on public.outreach_drafts
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
drop policy if exists "admins can delete outreach drafts" on public.outreach_drafts;
create policy "admins can delete outreach drafts" on public.outreach_drafts
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "members can read sequence settings" on public.sequence_settings;
create policy "members can read sequence settings" on public.sequence_settings
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "admins can create sequence settings" on public.sequence_settings;
create policy "admins can create sequence settings" on public.sequence_settings
  for insert to authenticated with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "admins can update sequence settings" on public.sequence_settings;
create policy "admins can update sequence settings" on public.sequence_settings
  for update to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "admins can delete sequence settings" on public.sequence_settings;
create policy "admins can delete sequence settings" on public.sequence_settings
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "members can read sequence steps" on public.sequence_steps;
create policy "members can read sequence steps" on public.sequence_steps
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "admins can create sequence steps" on public.sequence_steps;
create policy "admins can create sequence steps" on public.sequence_steps
  for insert to authenticated with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "admins can update sequence steps" on public.sequence_steps;
create policy "admins can update sequence steps" on public.sequence_steps
  for update to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));
drop policy if exists "admins can delete sequence steps" on public.sequence_steps;
create policy "admins can delete sequence steps" on public.sequence_steps
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "members can read replies" on public.replies;
create policy "members can read replies" on public.replies
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "members can add replies" on public.replies;
create policy "members can add replies" on public.replies
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can update replies" on public.replies;
create policy "members can update replies" on public.replies
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
