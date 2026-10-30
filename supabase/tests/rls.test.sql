-- RLS tests (README → Testing). Run with `supabase test db`.
-- Users are impersonated by switching to the authenticated role and setting the JWT claims
-- that Clerk would send (sub = Clerk user ID, app_role for facilities).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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

create function pg_temp.point_alert_geom()
returns extensions.geography
language sql
as $$
  select extensions.st_buffer('SRID=4326;POINT(-82.3433 29.6499)'::extensions.geography, 15)
$$;

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('profiles', 'nodes', 'edges', 'elevators', 'alerts', 'alert_votes', 'elevator_reports')),
  'RLS is enabled on every app table'
);

-- profiles ---------------------------------------------------------------------

select pg_temp.act_as('user_a');

select lives_ok(
  $$ insert into public.profiles (user_id, mode) values ('user_a', 'wheelchair') $$,
  'a user can create their own profile'
);

select throws_ok(
  $$ insert into public.profiles (user_id, mode) values ('user_b', 'bike') $$,
  '42501', null,
  'a user cannot create a profile for someone else'
);

select is(
  (select user_id from public.profiles),
  'user_a',
  'user_id defaults to the caller and is readable by its owner'
);

select pg_temp.act_as('user_b');

select is_empty(
  $$ select * from public.profiles where user_id = 'user_a' $$,
  'a user cannot read someone else''s profile'
);

update public.profiles set mode = 'bike' where user_id = 'user_a';

reset role;
select is(
  (select mode from public.profiles where user_id = 'user_a'),
  'wheelchair',
  'a user cannot update someone else''s profile'
);

-- alerts -----------------------------------------------------------------------

select pg_temp.act_as('user_a');

select lives_ok(
  $$ insert into public.alerts (id, type, geom)
     values ('00000000-0000-0000-0000-00000000000a', 'construction', pg_temp.point_alert_geom()) $$,
  'a student can report an alert'
);

select throws_ok(
  $$ insert into public.alerts (type, geom, verified) values ('construction', pg_temp.point_alert_geom(), true) $$,
  '42501', null,
  'a student cannot post a verified alert'
);

select throws_ok(
  $$ insert into public.alerts (type, geom, expires_at)
     values ('construction', pg_temp.point_alert_geom(), now() + interval '1 day') $$,
  '42501', null,
  'a student cannot post an alert that outlives the 4-hour expiry'
);

select throws_ok(
  $$ insert into public.alerts (type, geom, created_by) values ('construction', pg_temp.point_alert_geom(), 'user_b') $$,
  '42501', null,
  'a student cannot report an alert as someone else'
);

update public.alerts set verified = true where id = '00000000-0000-0000-0000-00000000000a';

reset role;
select is(
  (select verified from public.alerts where id = '00000000-0000-0000-0000-00000000000a'),
  false,
  'a student cannot verify an existing alert'
);

select pg_temp.act_as('facilities_1', 'facilities');

select lives_ok(
  $$ insert into public.alerts (type, geom, verified, expires_at)
     values ('elevator_out', pg_temp.point_alert_geom(), true, 'infinity') $$,
  'facilities can post a verified alert with no expiry'
);

update public.alerts set verified = true where id = '00000000-0000-0000-0000-00000000000a';

reset role;
select is(
  (select verified from public.alerts where id = '00000000-0000-0000-0000-00000000000a'),
  true,
  'facilities can verify an existing alert'
);

-- alert_votes ------------------------------------------------------------------

select pg_temp.act_as('user_a');

select lives_ok(
  $$ insert into public.alert_votes (alert_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'still_there') $$,
  'a user can vote on an alert'
);

select pg_temp.act_as('user_b');

select throws_ok(
  $$ insert into public.alert_votes (alert_id, user_id, kind)
     values ('00000000-0000-0000-0000-00000000000a', 'user_c', 'cleared') $$,
  '42501', null,
  'a user cannot vote as someone else'
);

update public.alert_votes set kind = 'cleared' where user_id = 'user_a';

reset role;
select is(
  (select kind from public.alert_votes where user_id = 'user_a'),
  'still_there',
  'a user cannot change someone else''s vote'
);

select pg_temp.act_as('user_b');

select is(
  (select confirmations from public.alerts_feed where id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'signed-in users read alerts with vote counts through alerts_feed'
);

-- read-only map data -----------------------------------------------------------

select pg_temp.act_as('user_a');

select throws_ok(
  $$ insert into public.nodes (id, geom, kind) values (999, 'SRID=4326;POINT(-82.34 29.65)', 'junction') $$,
  '42501', null,
  'clients cannot write nodes'
);

select throws_ok(
  $$ insert into public.elevator_reports (elevator_id, status, reported_by, verified)
     values (1, 'out', 'user_a', false) $$,
  '42501', null,
  'clients cannot write elevator reports directly'
);

select pg_temp.act_as('facilities_1', 'facilities');

select throws_ok(
  $$ insert into public.edges (id, source, target, geom, length_m)
     values (999, 1, 2, 'SRID=4326;LINESTRING(-82.3429 29.6516, -82.3433 29.6499)', 10) $$,
  '42501', null,
  'even facilities cannot write edges'
);

-- anonymous --------------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select * from public.alerts $$,
  '42501', null,
  'signed-out users cannot read alerts'
);

select ok(
  (select count(*) from public.nodes) > 0,
  'signed-out users can read map data'
);

select * from finish();
rollback;
