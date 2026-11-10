-- Extend the workspace lead record with structured qualification data.
-- Existing rows remain valid; new fields are nullable or have safe defaults.
alter table public.opportunities
  add column if not exists business_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists pain_point text not null default '',
  add column if not exists service_needed text not null default '',
  add column if not exists buying_intent text not null default 'unknown',
  add column if not exists published_at timestamptz,
  add column if not exists discovered_at timestamptz not null default now(),
  add column if not exists field_evidence jsonb not null default '{}'::jsonb;

alter table public.opportunities
  drop constraint if exists opportunities_buying_intent_check;
alter table public.opportunities
  add constraint opportunities_buying_intent_check
  check (buying_intent in ('high', 'medium', 'low', 'unknown'));

alter table public.search_settings
  add column if not exists score_thresholds smallint[] not null default array[90, 75, 60, 40]::smallint[];
alter table public.search_settings
  drop constraint if exists search_settings_score_thresholds_check;
alter table public.search_settings
  add constraint search_settings_score_thresholds_check
  check (
    cardinality(score_thresholds) = 4
    and score_thresholds[1] between 1 and 100
    and score_thresholds[2] between 1 and 99
    and score_thresholds[3] between 1 and 98
    and score_thresholds[4] between 1 and 97
    and score_thresholds[1] > score_thresholds[2]
    and score_thresholds[2] > score_thresholds[3]
    and score_thresholds[3] > score_thresholds[4]
  );

create index if not exists opportunities_workspace_intent_idx
  on public.opportunities (workspace_id, buying_intent, discovered_at desc);
