-- Supervised local browser research sessions. Browser credentials remain local;
-- only session metadata, event logs, and qualified opportunity data are stored.
create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('Reddit', 'X', 'Facebook', 'LinkedIn')),
  queries jsonb not null default '[]'::jsonb check (jsonb_typeof(queries) = 'array'),
  max_posts smallint not null default 30 check (max_posts between 1 and 100),
  max_minutes smallint not null default 15 check (max_minutes between 1 and 60),
  minimum_score smallint not null default 60 check (minimum_score between 1 and 100),
  voice_instructions text not null default '',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'paused', 'needs_user', 'completed', 'stopped')),
  control_mode text not null default 'agent' check (control_mode in ('agent', 'user')),
  started_at timestamptz,
  ended_at timestamptz,
  posts_seen integer not null default 0 check (posts_seen >= 0),
  opportunities_added integer not null default 0 check (opportunities_added >= 0),
  sign_in_confirmed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_sessions_workspace_created_idx
  on public.agent_sessions (workspace_id, created_at desc);
create index if not exists agent_sessions_queued_idx
  on public.agent_sessions (created_at)
  where status = 'queued';

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions(id) on delete cascade,
  event_at timestamptz not null default now(),
  type text not null check (type in ('search', 'scroll', 'open_post', 'extracted', 'paused', 'error', 'status')),
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists agent_events_session_time_idx
  on public.agent_events (session_id, event_at desc);

alter table public.opportunities
  add column if not exists source_platform text not null default '',
  add column if not exists agent_session_id uuid references public.agent_sessions(id) on delete set null;

create index if not exists opportunities_workspace_source_platform_idx
  on public.opportunities (workspace_id, source_platform, created_at desc);
create index if not exists opportunities_workspace_source_url_idx
  on public.opportunities (workspace_id, source_url)
  where source_url is not null and source_url <> '';

alter table public.search_settings
  add column if not exists voice_instructions text not null default '';

alter table public.agent_sessions enable row level security;
alter table public.agent_events enable row level security;

drop policy if exists "members can read agent sessions" on public.agent_sessions;
create policy "members can read agent sessions" on public.agent_sessions
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "members can create agent sessions" on public.agent_sessions;
create policy "members can create agent sessions" on public.agent_sessions
  for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
drop policy if exists "members can control agent sessions" on public.agent_sessions;
create policy "members can control agent sessions" on public.agent_sessions
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can read agent events" on public.agent_events;
create policy "members can read agent events" on public.agent_events
  for select to authenticated using (
    exists (select 1 from public.agent_sessions s
      where s.id = session_id and public.is_workspace_member(s.workspace_id))
  );
drop policy if exists "members can add agent events" on public.agent_events;
create policy "members can add agent events" on public.agent_events
  for insert to authenticated with check (
    exists (select 1 from public.agent_sessions s
      where s.id = session_id and public.is_workspace_member(s.workspace_id))
  );

drop trigger if exists agent_sessions_set_updated_at on public.agent_sessions;
create trigger agent_sessions_set_updated_at before update on public.agent_sessions
  for each row execute function public.set_updated_at();

grant select, insert, update on public.agent_sessions to authenticated;
grant select, insert on public.agent_events to authenticated;
