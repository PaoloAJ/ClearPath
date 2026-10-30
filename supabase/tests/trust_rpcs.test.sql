-- Trust rule RPCs (README → Alerts and trust). Run with `supabase test db`.
-- Runs against the seeded demo zone. now() is fixed for the whole transaction, so expiry
-- times can be compared exactly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create function pg_temp.act_as(user_id text, app_role text default null)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated', 'app_role', app_role)::text,
    true
  );
  set local role authenticated;
$$;

-- On a mapped path by Century Tower.
create function pg_temp.report(type text, photo_path text default null)
returns uuid
language sql
as $$
  select public.report_alert(type, 29.6488393, -82.343574, photo_path)
$$;

-- Stores an alert ID in a transaction-local setting so later statements can use it.
create function pg_temp.remember(name text, id uuid)
returns void
language sql
as $$
  select set_config('test.' || name, id::text, true)
$$;

create function pg_temp.recall(name text)
returns uuid
language sql
as $$
  select current_setting('test.' || name)::uuid
$$;

-- report_alert -----------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select pg_temp.report('construction') $$,
  '42501', null,
  'signed-out users cannot report'
);

select pg_temp.act_as('user_a');
select pg_temp.remember('student', pg_temp.report('construction'));

reset role;
select results_eq(
  $$ select created_by, verified, expires_at = now() + interval '4 hours', resolved_at is null
     from public.alerts where id = pg_temp.recall('student') $$,
  $$ values ('user_a', false, true, true) $$,
  'a student report is theirs, unverified, and expires in 4 hours'
);

select ok(
  (select extensions.st_area(geom) between 650 and 760 from public.alerts where id = pg_temp.recall('student')),
  'the reported point is buffered to a 15 m radius polygon'
);

select pg_temp.act_as('user_a');

select throws_ok(
  $$ select public.report_alert('construction', 29.70, -82.30) $$,
  '22023', null,
  'a report outside the demo zone is rejected'
);

select throws_ok(
  $$ select pg_temp.report('construction', 'user_b/photo.jpg') $$,
  '42501', null,
  'a report cannot point at a photo in someone else''s folder'
);

select pg_temp.remember('with_photo', pg_temp.report('blocked_path', 'user_a/photo.jpg'));

reset role;
select is(
  (select photo_path from public.alerts where id = pg_temp.recall('with_photo')),
  'user_a/photo.jpg',
  'a report can attach a photo from the reporter''s own folder'
);

select pg_temp.act_as('user_a');

select throws_ok(
  $$ select pg_temp.report('sinkhole') $$,
  '23514', null,
  'an unknown alert type is rejected'
);

select pg_temp.act_as('facilities_1', 'facilities');
select pg_temp.remember('facilities', pg_temp.report('construction'));

reset role;
select results_eq(
  $$ select verified, expires_at = 'infinity' from public.alerts where id = pg_temp.recall('facilities') $$,
  $$ values (true, true) $$,
  'a facilities post is verified and never expires'
);

-- vote_alert: student alerts ---------------------------------------------------

update public.alerts set expires_at = now() + interval '1 hour' where id = pg_temp.recall('student');

select pg_temp.act_as('user_b');
select public.vote_alert(pg_temp.recall('student'), 'still_there');

reset role;
select is(
  (select expires_at from public.alerts where id = pg_temp.recall('student')),
  now() + interval '4 hours',
  '"still there" pushes expiry to 4 hours from now'
);

select pg_temp.act_as('user_b');
select public.vote_alert(pg_temp.recall('student'), 'cleared');

reset role;
select results_eq(
  $$ select kind from public.alert_votes where alert_id = pg_temp.recall('student') and user_id = 'user_b' $$,
  $$ values ('cleared') $$,
  'voting again overwrites the earlier vote'
);

select is(
  (select resolved_at from public.alerts where id = pg_temp.recall('student')),
  null,
  'one "cleared" vote does not resolve an alert'
);

select pg_temp.act_as('user_c');
select public.vote_alert(pg_temp.recall('student'), 'cleared');

reset role;
select isnt(
  (select resolved_at from public.alerts where id = pg_temp.recall('student')),
  null,
  '"cleared" from 2 different users resolves an alert'
);

select pg_temp.act_as('user_d');

select throws_ok(
  format($$ select public.vote_alert(%L, 'still_there') $$, pg_temp.recall('student')),
  'P0002', null,
  'votes on a resolved alert are rejected'
);

select throws_ok(
  format($$ select public.vote_alert(%L, 'maybe') $$, pg_temp.recall('with_photo')),
  '22023', null,
  'an unknown vote kind is rejected'
);

-- A switched vote stops counting as "cleared".
select public.vote_alert(pg_temp.recall('with_photo'), 'cleared');
select public.vote_alert(pg_temp.recall('with_photo'), 'still_there');
select pg_temp.act_as('user_e');
select public.vote_alert(pg_temp.recall('with_photo'), 'cleared');

reset role;
select is(
  (select resolved_at from public.alerts where id = pg_temp.recall('with_photo')),
  null,
  'a vote switched from "cleared" to "still there" no longer counts toward resolving'
);

select pg_temp.act_as('facilities_1', 'facilities');
select public.vote_alert(pg_temp.recall('with_photo'), 'cleared');

reset role;
select isnt(
  (select resolved_at from public.alerts where id = pg_temp.recall('with_photo')),
  null,
  'facilities can resolve a student alert with one "cleared" vote'
);

-- vote_alert: verified alerts --------------------------------------------------

select pg_temp.act_as('user_a');
select public.vote_alert(pg_temp.recall('facilities'), 'still_there');
select public.vote_alert(pg_temp.recall('facilities'), 'cleared');
select pg_temp.act_as('user_b');
select public.vote_alert(pg_temp.recall('facilities'), 'cleared');

reset role;
select results_eq(
  $$ select resolved_at is null, expires_at = 'infinity' from public.alerts where id = pg_temp.recall('facilities') $$,
  $$ values (true, true) $$,
  'student votes neither resolve nor change the expiry of a verified alert'
);

select is(
  (select count(*)::int from public.alert_votes where alert_id = pg_temp.recall('facilities')),
  2,
  'student votes on a verified alert are still recorded'
);

select pg_temp.act_as('facilities_1', 'facilities');
select public.vote_alert(pg_temp.recall('facilities'), 'cleared');

reset role;
select isnt(
  (select resolved_at from public.alerts where id = pg_temp.recall('facilities')),
  null,
  'only facilities resolve a verified alert'
);

-- set_elevator_status ----------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.set_elevator_status(1, 'out') $$,
  '42501', null,
  'signed-out users cannot report elevator status'
);

select pg_temp.act_as('user_a');
select public.set_elevator_status(1, 'out');

reset role;
select results_eq(
  $$ select status, verified, last_reported_at = now() from public.elevators where id = 1 $$,
  $$ values ('out', false, true) $$,
  'a student report updates the elevator, unverified'
);

select results_eq(
  $$ select status, reported_by, verified from public.elevator_reports
     where elevator_id = 1 and created_at = now() $$,
  $$ values ('out', 'user_a', false) $$,
  'the change is logged with its reporter'
);

select pg_temp.act_as('facilities_1', 'facilities');
select public.set_elevator_status(1, 'working');

reset role;
select results_eq(
  $$ select status, verified from public.elevators where id = 1 $$,
  $$ values ('working', true) $$,
  'a facilities report is verified'
);

select pg_temp.act_as('user_a');

select throws_ok(
  $$ select public.set_elevator_status(999, 'out') $$,
  'P0002', null,
  'an unknown elevator is rejected'
);

select throws_ok(
  $$ select public.set_elevator_status(1, 'broken') $$,
  '22023', null,
  'an unknown status is rejected'
);

-- direct writes stay closed -----------------------------------------------------

select throws_ok(
  $$ update public.elevators set status = 'out' where id = 1 $$,
  '42501', null,
  'clients cannot update elevators directly'
);

select throws_ok(
  $$ select * from private.app_settings $$,
  '42501', null,
  'clients cannot read or change trust settings'
);

select * from finish();
rollback;
