-- Zero means unlimited for browser research session post and duration limits.
alter table public.agent_sessions
  drop constraint if exists agent_sessions_max_posts_check,
  drop constraint if exists agent_sessions_max_minutes_check;

alter table public.agent_sessions
  alter column max_posts type integer,
  alter column max_posts set default 0,
  alter column max_minutes type integer,
  alter column max_minutes set default 0;

alter table public.agent_sessions
  add constraint agent_sessions_max_posts_check check (max_posts >= 0),
  add constraint agent_sessions_max_minutes_check check (max_minutes >= 0);
