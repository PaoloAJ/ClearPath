-- Demo mode (README → Demo mode). Staged alerts and elevator outages for presentations and
-- usability testing. Every demo RPC refuses to run unless app_settings.demo_enabled is true.
-- seed.sql turns it on locally. A hosted project stays off unless someone turns it on.

alter table private.app_settings add column demo_enabled boolean not null default false;

-- Sample state that demo_reset() restores. seed.sql fills these from data/campus/samples.json.
-- Times are stored relative to "now" so a reset always looks fresh.

create table private.demo_sample_alerts (
  id             uuid primary key,
  type           text not null,
  lat            float8 not null,
  lng            float8 not null,
  radius_m       real not null,
  minutes_ago    int not null check (minutes_ago >= 0),
  confirmations  int not null default 0 check (confirmations >= 0),
  verified       boolean not null default false
);

create table private.demo_sample_elevators (
  elevator_id           bigint primary key references public.elevators (id) on delete cascade,
  status                text not null,
  verified              boolean not null,
  reported_minutes_ago  int not null check (reported_minutes_ago >= 0)
);

create function private.require_demo()
returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not (private.settings()).demo_enabled then
    raise exception 'demo mode is off' using errcode = '42501';
  end if;
end;
$$;

-- Replaces all live alerts, votes, and elevator reports with the sample state. Student alerts
-- follow the trust rules: confirmations land halfway between the report and now, and expiry is
-- alert_ttl after the latest of the two. Called by seed.sql and demo_reset().
create function private.apply_demo_samples()
returns void
language plpgsql
set search_path = ''
as $$
declare
  ttl interval := (private.settings()).alert_ttl;
begin
  -- "where true": API sessions run pg_safeupdate, which rejects unqualified deletes/updates.
  delete from public.alert_votes where true;
  delete from public.alerts where true;
  delete from public.elevator_reports where true;
  update public.elevators set status = 'unconfirmed', verified = false, last_reported_at = null where true;

  update public.elevators e
  set status = s.status, verified = s.verified,
      last_reported_at = now() - make_interval(mins => s.reported_minutes_ago)
  from private.demo_sample_elevators s
  where e.id = s.elevator_id;

  insert into public.elevator_reports (elevator_id, status, reported_by, verified, created_at)
  select s.elevator_id, s.status,
         case when s.verified then 'seed_facilities' else 'seed_student_1' end,
         s.verified, now() - make_interval(mins => s.reported_minutes_ago)
  from private.demo_sample_elevators s;

  with samples as (
    select s.*,
           case when s.confirmations > 0 then s.minutes_ago / 2 else s.minutes_ago end as active_minutes_ago
    from private.demo_sample_alerts s
  ),
  inserted as (
    insert into public.alerts (id, type, geom, created_by, verified, created_at, expires_at)
    select id, type,
           extensions.st_buffer(
             extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography, radius_m),
           case when verified then 'seed_facilities' else 'seed_student_1' end,
           verified,
           now() - make_interval(mins => minutes_ago),
           case when verified then 'infinity'::timestamptz
                else now() - make_interval(mins => active_minutes_ago) + ttl end
    from samples
    returning id
  )
  insert into public.alert_votes (alert_id, user_id, kind, created_at)
  select s.id, 'seed_student_' || (n + 1), 'still_there', now() - make_interval(mins => s.active_minutes_ago)
  from samples s
  join inserted i on i.id = s.id
  cross join lateral generate_series(1, s.confirmations) as n;
end;
$$;

-- RPCs (contract in AGENTS.md → Contracts) -------------------------------------------

-- Drops a construction alert at a point, e.g. the next segment of the route (triggers R2).
create function public.demo_inject_alert(lat float8, lng float8)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid text := private.require_user();
  cfg private.app_settings := private.settings();
  new_id uuid;
begin
  perform private.require_demo();

  insert into public.alerts (type, geom, created_by, expires_at)
  values (
    'construction',
    extensions.st_buffer(
      extensions.st_setsrid(extensions.st_makepoint(demo_inject_alert.lng, demo_inject_alert.lat), 4326)::extensions.geography,
      cfg.report_radius_m),
    uid,
    now() + cfg.alert_ttl
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Flips an elevator between working and out (unconfirmed counts as working). Logged like any
-- other status change.
create function public.demo_toggle_elevator(elevator_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  current_status text;
begin
  perform private.require_user();
  perform private.require_demo();

  select e.status into current_status from public.elevators e where e.id = demo_toggle_elevator.elevator_id;
  if not found then
    raise exception 'unknown elevator %', demo_toggle_elevator.elevator_id using errcode = 'P0002';
  end if;

  perform public.set_elevator_status(
    demo_toggle_elevator.elevator_id,
    case when current_status = 'out' then 'working' else 'out' end
  );
end;
$$;

-- Restores the sample state so every presentation and usability participant starts the same.
create function public.demo_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  perform private.require_demo();
  perform private.apply_demo_samples();
end;
$$;

-- Access -----------------------------------------------------------------------------

revoke all on function private.require_demo(), private.apply_demo_samples() from public, anon, authenticated;

revoke all on function public.demo_inject_alert(float8, float8) from public, anon;
revoke all on function public.demo_toggle_elevator(bigint) from public, anon;
revoke all on function public.demo_reset() from public, anon;
grant execute on function public.demo_inject_alert(float8, float8) to authenticated;
grant execute on function public.demo_toggle_elevator(bigint) to authenticated;
grant execute on function public.demo_reset() to authenticated;
