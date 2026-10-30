-- Row Level Security policies (README → Row Level Security).
-- nodes, edges, and elevators already have read policies in the init migration and no write
-- policies, so clients can't write them. Elevator status changes will go through
-- set_elevator_status(); votes and reports will also get RPCs, which run as definer.

-- Grants ---------------------------------------------------------------------------
-- Grants say which operations a role may attempt at all; the policies below decide which
-- rows. Supabase versions differ on default grants (some give anon and authenticated
-- everything, newer ones give nothing), so start from nothing and grant only what we mean.
-- Anything not granted here (deletes, writes to map data and elevators) is denied before
-- RLS is even checked.

revoke all on all tables in schema public from anon, authenticated;
-- Tables from later migrations start with no API access either. Grant them explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.nodes, public.edges, public.elevators to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.alerts to authenticated;
grant select, insert, update on public.alert_votes to authenticated;
grant select on public.elevator_reports to authenticated;
grant select on public.alerts_feed to authenticated;

grant execute on function public.requesting_user_id(), public.is_facilities() to anon, authenticated;

-- profiles: users read and write only their own row -----------------------------

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (user_id = public.requesting_user_id());

create policy "profiles: insert own" on public.profiles
  for insert to authenticated
  with check (user_id = public.requesting_user_id());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- alerts: signed-in users read and report; only facilities verify ---------------
-- A student report must be their own, unverified, unresolved, and expire within the
-- standard 4 hours (README → Alerts and trust), so a modified client can't post a
-- permanent or pre-verified alert.

create policy "alerts: signed-in read" on public.alerts
  for select to authenticated
  using (true);

create policy "alerts: report" on public.alerts
  for insert to authenticated
  with check (
    created_by = public.requesting_user_id()
    and resolved_at is null
    and (
      public.is_facilities()
      or (not verified and expires_at <= now() + interval '4 hours')
    )
  );

-- Facilities can verify and resolve alerts directly. Students change alerts only by voting.
create policy "alerts: facilities update" on public.alerts
  for update to authenticated
  using (public.is_facilities())
  with check (public.is_facilities());

-- alert_votes: everyone signed in sees votes; each user writes only their own -----

create policy "alert_votes: signed-in read" on public.alert_votes
  for select to authenticated
  using (true);

create policy "alert_votes: insert own" on public.alert_votes
  for insert to authenticated
  with check (user_id = public.requesting_user_id());

create policy "alert_votes: update own" on public.alert_votes
  for update to authenticated
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

-- elevator_reports: history is readable; writes only through set_elevator_status() --

create policy "elevator_reports: signed-in read" on public.elevator_reports
  for select to authenticated
  using (true);
