alter table public.outreach_drafts
  add column if not exists gmass_draft_id text,
  add column if not exists gmass_campaign_id bigint,
  add column if not exists gmass_campaign_status text;

create or replace function public.claim_gmass_email_draft(p_draft_id uuid)
returns setof public.outreach_drafts
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  return query
  update public.outreach_drafts d
     set status = 'queued', error_detail = null, updated_at = now()
   where d.id = p_draft_id
     and d.channel = 'email'
     and d.status = 'approved'
     and d.approved_by = auth.uid()
     and public.is_workspace_member(d.workspace_id)
  returning d.*;
end;
$$;

revoke all on function public.claim_gmass_email_draft(uuid) from public, anon;
grant execute on function public.claim_gmass_email_draft(uuid) to authenticated;
