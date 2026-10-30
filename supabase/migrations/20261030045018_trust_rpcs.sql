-- Trust rules as RPCs (README → Alerts and trust). The app reports, votes, and changes elevator
-- status only through these functions, so a modified client can't skip the rules.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Settings -------------------------------------------------------------------------
-- README: "All of them are configurable." One row; change values with an update.

create table private.app_settings (
  id                        boolean primary key default true check (id),
  alert_ttl                 interval not null default interval '4 hours',
  cleared_votes_to_resolve  int not null default 2 check (cleared_votes_to_resolve >= 1),
  report_radius_m           real not null default 15 check (report_radius_m > 0),
  -- Reports must land within this distance of a mapped path (the demo zone).
  report_max_distance_m     real not null default 100 check (report_max_distance_m > 0)
);

alter table private.app_settings enable row level security;

insert into private.app_settings default values;

create function private.settings()
returns private.app_settings
language sql stable
set search_path = ''
as $$
  select * from private.app_settings
$$;

-- Caller's Clerk user ID, or an error for signed-out callers.
create function private.require_user()
returns text
language plpgsql stable
set search_path = ''
as $$
declare
  uid text := public.requesting_user_id();
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  return uid;
end;
$$;

-- report_alert (R4) ------------------------------------------------------------------
-- Buffers the reported point into a polygon. Student reports expire after alert_ttl;
-- facilities posts are verified and never expire.

create function public.report_alert(type text, lat float8, lng float8, photo_path text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid text := private.require_user();
  cfg private.app_settings := private.settings();
  facilities boolean := public.is_facilities();
  pt extensions.geography;
  new_id uuid;
begin
  if report_alert.lat is null or report_alert.lng is null then
    raise exception 'lat and lng are required' using errcode = '22023';
  end if;
  pt := extensions.st_setsrid(extensions.st_makepoint(report_alert.lng, report_alert.lat), 4326)::extensions.geography;

  if not exists (
    select 1 from public.edges e where extensions.st_dwithin(e.geom, pt, cfg.report_max_distance_m)
  ) then
    raise exception 'location is outside the demo zone' using errcode = '22023';
  end if;

  if report_alert.photo_path is not null and split_part(report_alert.photo_path, '/', 1) <> uid then
    raise exception 'photo must be uploaded to your own folder' using errcode = '42501';
  end if;

  insert into public.alerts (type, geom, created_by, verified, photo_path, expires_at)
  values (
    report_alert.type,
    extensions.st_buffer(pt, cfg.report_radius_m),
    uid,
    facilities,
    report_alert.photo_path,
    case when facilities then 'infinity'::timestamptz else now() + cfg.alert_ttl end
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- vote_alert (R5) --------------------------------------------------------------------
-- One vote per user per alert; voting again overwrites. On a student alert, "still there"
-- pushes expiry out by alert_ttl and enough distinct "cleared" votes resolve it. Verified
-- alerts record votes but only facilities can resolve them.

create function public.vote_alert(alert_id uuid, kind text)
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
  previous text;
  cleared int;
begin
  if vote_alert.kind is null or vote_alert.kind not in ('still_there', 'cleared') then
    raise exception 'kind must be still_there or cleared' using errcode = '22023';
  end if;

  select * into target from public.alerts a where a.id = vote_alert.alert_id for update;
  if not found or target.resolved_at is not null or target.expires_at <= now() then
    raise exception 'alert is not active' using errcode = 'P0002';
  end if;

  select v.kind into previous from public.alert_votes v
  where v.alert_id = vote_alert.alert_id and v.user_id = uid;

  insert into public.alert_votes (alert_id, user_id, kind)
  values (vote_alert.alert_id, uid, vote_alert.kind)
  on conflict on constraint alert_votes_pkey
  do update set kind = excluded.kind, created_at = now();

  if vote_alert.kind = 'still_there' then
    -- Only a new confirmation extends the alert, so one user can't keep it alive alone.
    if not target.verified and previous is distinct from 'still_there' then
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

-- set_elevator_status (R1, R5) -------------------------------------------------------
-- Latest report wins. It's verified only when facilities posts it, so the elevator board
-- can tell a Facilities status from a student report. Every change is logged.

create function public.set_elevator_status(elevator_id bigint, status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid text := private.require_user();
  facilities boolean := public.is_facilities();
begin
  if set_elevator_status.status is null or set_elevator_status.status not in ('working', 'out', 'unconfirmed') then
    raise exception 'status must be working, out, or unconfirmed' using errcode = '22023';
  end if;

  update public.elevators e
  set status = set_elevator_status.status, verified = facilities, last_reported_at = now()
  where e.id = set_elevator_status.elevator_id;

  if not found then
    raise exception 'unknown elevator %', set_elevator_status.elevator_id using errcode = 'P0002';
  end if;

  insert into public.elevator_reports (elevator_id, status, reported_by, verified)
  values (set_elevator_status.elevator_id, set_elevator_status.status, uid, facilities);
end;
$$;

-- Access -----------------------------------------------------------------------------

revoke all on function private.settings(), private.require_user() from public, anon, authenticated;

revoke all on function public.report_alert(text, float8, float8, text) from public, anon;
revoke all on function public.vote_alert(uuid, text) from public, anon;
revoke all on function public.set_elevator_status(bigint, text) from public, anon;
grant execute on function public.report_alert(text, float8, float8, text) to authenticated;
grant execute on function public.vote_alert(uuid, text) to authenticated;
grant execute on function public.set_elevator_status(bigint, text) to authenticated;

-- Reports and votes go through the RPCs only. A direct insert could skip the zone check and
-- the fixed buffer radius (a huge polygon would block every route) or skip vote resolution.
-- The insert policies stay as a second line of defense. Facilities keep direct alert updates.
revoke insert on public.alerts from authenticated;
revoke insert, update on public.alert_votes from authenticated;
