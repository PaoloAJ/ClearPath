-- Restore the README rule (Alerts and trust): every "still there" vote on a student alert
-- pushes expires_at to now + alert_ttl, including a repeat vote from the same user.
-- 20261030045018_trust_rpcs.sql was changed to ignore repeat votes, which changed a documented
-- rule without changing the README, so that part is reverted here. RLS on app_settings from
-- the same change stays.

create or replace function public.vote_alert(alert_id uuid, kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid text := private.require_user();
  cfg private.app_settings := private.settings();
  facilities boolean := public.is_facilities();
  target public.alerts;
  cleared int;
begin
  if vote_alert.kind is null or vote_alert.kind not in ('still_there', 'cleared') then
    raise exception 'kind must be still_there or cleared' using errcode = '22023';
  end if;

  select * into target from public.alerts a where a.id = vote_alert.alert_id for update;
  if not found or target.resolved_at is not null or target.expires_at <= now() then
    raise exception 'alert is not active' using errcode = 'P0002';
  end if;

  insert into public.alert_votes (alert_id, user_id, kind)
  values (vote_alert.alert_id, uid, vote_alert.kind)
  on conflict on constraint alert_votes_pkey
  do update set kind = excluded.kind, created_at = now();

  if vote_alert.kind = 'still_there' then
    if not target.verified then
      update public.alerts a set expires_at = now() + cfg.alert_ttl where a.id = vote_alert.alert_id;
    end if;
    return;
  end if;

  select count(*) into cleared
  from public.alert_votes v
  where v.alert_id = vote_alert.alert_id and v.kind = 'cleared';

  if facilities or (not target.verified and cleared >= cfg.cleared_votes_to_resolve) then
    update public.alerts a set resolved_at = now() where a.id = vote_alert.alert_id;
  end if;
end;
$$;
