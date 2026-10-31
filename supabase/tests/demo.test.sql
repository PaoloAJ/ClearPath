-- Demo mode RPCs (README → Demo mode). Run with `supabase test db`.
-- Runs against the seeded demo zone, where seed.sql turns demo mode on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

-- What a fresh demo looks like, without the times (they're relative to when it was applied).
create function pg_temp.sample_state()
returns table (id uuid, type text, verified boolean, confirmations int)
language sql
as $$
  select id, type, verified, confirmations from public.alerts_feed order by id
$$;

create temp table seeded as select * from pg_temp.sample_state();

reset role;
select is(
  (select count(*)::int from seeded),
  4,
  'the seed loads the 4 sample alerts'
);

select results_eq(
  $$ select status, verified from public.elevators where id = 1 $$,
  $$ values ('working', true) $$,
  'the seed loads the sample elevator status'
);

-- Guard -------------------------------------------------------------------------

update private.app_settings set demo_enabled = false;
select pg_temp.act_as('presenter');

select throws_ok($$ select public.demo_reset() $$, '42501', null, 'demo_reset refuses when demo mode is off');
select throws_ok($$ select public.demo_inject_alert(29.6488, -82.3436) $$, '42501', null, 'demo_inject_alert refuses when demo mode is off');
select throws_ok($$ select public.demo_toggle_elevator(1) $$, '42501', null, 'demo_toggle_elevator refuses when demo mode is off');

reset role;
update private.app_settings set demo_enabled = true;

set local role anon;
select throws_ok($$ select public.demo_reset() $$, '42501', null, 'signed-out users cannot run demo RPCs');

-- Inject and toggle -----------------------------------------------------------------

select pg_temp.act_as('presenter');
select set_config('test.injected', public.demo_inject_alert(29.6480365, -82.3448772)::text, true);

reset role;
select results_eq(
  $$ select type, created_by, verified, expires_at = now() + interval '4 hours'
     from public.alerts where id = current_setting('test.injected')::uuid $$,
  $$ values ('construction', 'presenter', false, true) $$,
  'demo_inject_alert drops an active construction alert'
);

select pg_temp.act_as('presenter');
select public.demo_toggle_elevator(1);

reset role;
select is((select status from public.elevators where id = 1), 'out', 'demo_toggle_elevator takes a working elevator out');

select is(
  (select reported_by from public.elevator_reports where elevator_id = 1 and created_at = now()),
  'presenter',
  'the toggle is logged like any status change'
);

select pg_temp.act_as('presenter');
select public.demo_toggle_elevator(1);

reset role;
select is((select status from public.elevators where id = 1), 'working', 'toggling again brings it back');

select pg_temp.act_as('presenter');
select throws_ok($$ select public.demo_toggle_elevator(999) $$, 'P0002', null, 'toggling an unknown elevator is rejected');

-- Reset --------------------------------------------------------------------------

select public.demo_toggle_elevator(1);
select public.report_alert('flooding', 29.6488393, -82.343574);
select public.vote_alert('00000000-0000-4000-8000-000000000002', 'still_there');
select public.demo_reset();

reset role;
select results_eq(
  $$ select * from pg_temp.sample_state() $$,
  $$ select * from seeded $$,
  'demo_reset restores exactly the sample alerts and confirmations'
);

select results_eq(
  $$ select status, verified, last_reported_at = now() - interval '20 minutes' from public.elevators where id = 1 $$,
  $$ values ('working', true, true) $$,
  'demo_reset restores the sample elevator status'
);

select results_eq(
  $$ select expires_at = now() + interval '218 minutes' from public.alerts
     where id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values (true) $$,
  'demo_reset recomputes expiry from now (45 min old, confirmed 22 min ago → 218 min left)'
);

select * from finish();
rollback;
