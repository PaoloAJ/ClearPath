-- ClearPath initial schema (README → Data model).
-- Users are identified by Clerk user ID (text). There is no users table.

create extension if not exists postgis with schema extensions;

-- Identity helpers ----------------------------------------------------------

-- Clerk user ID of the caller.
create or replace function public.requesting_user_id()
returns text
language sql stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- True when the caller's Clerk session token carries app_role = facilities.
-- (The JWT `role` claim is reserved: Supabase uses it to pick the Postgres role.)
create or replace function public.is_facilities()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', '') = 'facilities'
$$;

-- Tables ----------------------------------------------------------------------

create table public.profiles (
  user_id       text primary key default public.requesting_user_id(),
  mode          text not null default 'walking'
                check (mode in ('wheelchair', 'walking_aid', 'bike', 'scooter', 'skateboard', 'walking')),
  temp_mode     text
                check (temp_mode in ('wheelchair', 'walking_aid', 'bike', 'scooter', 'skateboard', 'walking')),
  temp_until    date,
  haptics_only  boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table public.nodes (
  id        bigint primary key,
  geom      extensions.geography(Point, 4326) not null,
  kind      text not null check (kind in ('entrance', 'junction', 'elevator')),
  building  text,
  floor     int
);

create table public.elevators (
  id                bigint primary key,
  building          text not null,
  name              text not null,
  node_id           bigint not null references public.nodes (id),
  status            text not null default 'unconfirmed' check (status in ('working', 'out', 'unconfirmed')),
  verified          boolean not null default false,
  last_reported_at  timestamptz
);

create table public.edges (
  id           bigint primary key,
  source       bigint not null references public.nodes (id),
  target       bigint not null references public.nodes (id),
  geom         extensions.geography(LineString, 4326) not null,
  length_m     real not null,
  slope_pct    real not null default 0,
  stairs       boolean not null default false,
  surface      text not null default 'paved' check (surface in ('paved', 'brick', 'gravel', 'grass')),
  indoor       boolean not null default false,
  bike_ok      boolean not null default true,
  elevator_id  bigint references public.elevators (id)
);

create table public.alerts (
  id           uuid primary key default gen_random_uuid(),
  type         text not null
               check (type in ('construction', 'elevator_out', 'blocked_path', 'flooding', 'broken_ramp', 'other')),
  geom         extensions.geography(Polygon, 4326) not null,
  created_by   text not null default public.requesting_user_id(),
  verified     boolean not null default false,
  photo_path   text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '4 hours',
  resolved_at  timestamptz
);

create table public.alert_votes (
  alert_id    uuid not null references public.alerts (id) on delete cascade,
  user_id     text not null default public.requesting_user_id(),
  kind        text not null check (kind in ('still_there', 'cleared')),
  created_at  timestamptz not null default now(),
  primary key (alert_id, user_id)
);

-- Elevator status history, so every status change logs its reporter (README → RLS).
create table public.elevator_reports (
  id           bigint generated always as identity primary key,
  elevator_id  bigint not null references public.elevators (id),
  status       text not null check (status in ('working', 'out', 'unconfirmed')),
  reported_by  text not null,
  verified     boolean not null,
  created_at   timestamptz not null default now()
);

create index edges_geom_idx on public.edges using gist (geom);
create index alerts_geom_idx on public.alerts using gist (geom);
create index alerts_active_idx on public.alerts (expires_at) where resolved_at is null;
create index edges_elevator_idx on public.edges (elevator_id) where elevator_id is not null;

-- Read model for the app ------------------------------------------------------
-- PostgREST returns geography as WKB, so the app reads alerts through this view.

create view public.alerts_feed
with (security_invoker = true)
as
select
  a.id,
  a.type,
  extensions.st_asgeojson(a.geom)::jsonb as geom,
  extensions.st_y(extensions.st_centroid(a.geom::extensions.geometry)) as lat,
  extensions.st_x(extensions.st_centroid(a.geom::extensions.geometry)) as lng,
  a.created_by,
  a.verified,
  a.photo_path,
  a.created_at,
  a.expires_at,
  a.resolved_at,
  count(v.*) filter (where v.kind = 'still_there')::int as confirmations,
  count(v.*) filter (where v.kind = 'cleared')::int as cleared_votes
from public.alerts a
left join public.alert_votes v on v.alert_id = a.id
where a.resolved_at is null and a.expires_at > now()
group by a.id;

-- Row Level Security ----------------------------------------------------------
-- Enabled on every table. With no policy, a table denies everything to clients.

alter table public.profiles enable row level security;
alter table public.nodes enable row level security;
alter table public.edges enable row level security;
alter table public.elevators enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_votes enable row level security;
alter table public.elevator_reports enable row level security;

-- Map data and elevator status are readable by everyone.
create policy "nodes are readable" on public.nodes for select using (true);
create policy "edges are readable" on public.edges for select using (true);
create policy "elevators are readable" on public.elevators for select using (true);

-- TODO(data): remaining policies, per README → Row Level Security:
--   profiles:     select/insert/update only where user_id = requesting_user_id()
--   alerts:       signed-in select + insert; only is_facilities() may set verified = true
--   alert_votes:  select all; insert/update only own row
--   elevators:    no direct writes; status changes go through set_elevator_status()

-- Realtime --------------------------------------------------------------------

alter publication supabase_realtime add table public.alerts, public.elevators;

-- Storage ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

-- TODO(data): storage policies: signed-in users upload to report-photos/<user_id>/*, everyone signed in can read.

-- RPCs (contract for the app; implement in a follow-up migration) -------------
-- TODO(data):
--   report_alert(type text, lat float8, lng float8, photo_path text default null) returns uuid
--       buffers the point into a polygon, expires_at = now() + 4h; facilities posts are verified, no expiry
--   vote_alert(alert_id uuid, kind text) returns void
--       upsert own vote; still_there pushes expires_at to now() + 4h; 2 distinct cleared votes resolve it
--   set_elevator_status(elevator_id bigint, status text) returns void
--       writes elevator_reports, updates elevators; verified only for facilities
--   demo_inject_alert(lat float8, lng float8) / demo_toggle_elevator(elevator_id bigint) / demo_reset()
--       demo-mode helpers (README → Demo mode)
