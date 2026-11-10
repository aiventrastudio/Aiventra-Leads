-- Preserve the author profile URL and AI's short qualification rationale for
-- opportunities collected from source APIs. Existing opportunities remain valid.
alter table public.opportunities
  add column if not exists profile_url text not null default '',
  add column if not exists qualification_reason text not null default '';
