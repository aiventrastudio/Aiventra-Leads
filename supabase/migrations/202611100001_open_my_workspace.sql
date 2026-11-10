-- Create or reopen the authenticated user's workspace without trusting a
-- client-supplied owner_id. The function is idempotent for concurrent logins.
create or replace function public.open_my_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requesting_user_id uuid := auth.uid();
  existing_workspace_id uuid;
  new_workspace_id uuid;
begin
  if requesting_user_id is null then
    raise exception 'Authentication is required to open a workspace.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requesting_user_id::text, 0));

  select wm.workspace_id
    into existing_workspace_id
    from public.workspace_members wm
   where wm.user_id = requesting_user_id
   order by wm.created_at
   limit 1;

  if existing_workspace_id is not null then
    return existing_workspace_id;
  end if;

  insert into public.workspaces (name, owner_id)
  values (coalesce(nullif(trim(workspace_name), ''), 'My Workspace'), requesting_user_id)
  returning id into new_workspace_id;

  return new_workspace_id;
end;
$$;

revoke all on function public.open_my_workspace(text) from public, anon;
grant execute on function public.open_my_workspace(text) to authenticated;
