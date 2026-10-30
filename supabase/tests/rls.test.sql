-- RLS tests (README → Testing). Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('profiles', 'nodes', 'edges', 'elevators', 'alerts', 'alert_votes', 'elevator_reports')),
  'RLS is enabled on every app table'
);

-- TODO(data): set request.jwt.claims to two different Clerk users and assert:
--   a user can't update another user's profile or vote
--   a student can't set alerts.verified = true; a facilities user (app_role) can
--   clients can't write nodes or edges

select * from finish();
rollback;
