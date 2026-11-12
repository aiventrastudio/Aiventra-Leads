-- Extend supervised browser research to Instagram, TikTok, and YouTube.
alter table public.agent_sessions
  drop constraint if exists agent_sessions_platform_check;

alter table public.agent_sessions
  add constraint agent_sessions_platform_check
  check (platform in ('Reddit', 'X', 'Facebook', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube'));
