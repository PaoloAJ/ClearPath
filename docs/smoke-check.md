# End-to-end smoke check

A repeatable check that every piece talks to the next one: sign in on a phone → the map loads from Supabase → a route request reaches the Go service with a valid Clerk token → the Go service reads the database. Run it after setup changes, before a demo, and before each usability session.

It takes about 10 minutes. Record each run in the log at the bottom.

## Before you start

- `apps/mobile/.env` and `services/routing/.env` filled in (README → Environment variables). On a phone, the Supabase and routing URLs use your computer's LAN IP, not `localhost`.
- The Clerk app exists, and you have the test student account and the test `facilities` account.
- `[auth.third_party.clerk]` is enabled in `supabase/config.toml` with the real domain. Without it, local Supabase rejects Clerk tokens and step 3 fails with an empty map.
- `psql` installed, or replace `psql "$DB"` below with `docker exec -i supabase_db_clearpath psql -U postgres`.

```bash
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## 1. Start everything

```bash
supabase start   # make seed resets the database, so the stack has to be running first
make seed        # fresh sample state, so alert ages look right
make dev
```

**Pass:** the routing log shows `graph loaded nodes=568 edges=774` and `listening addr=:8080`, and Expo prints a QR code.

**If the routing service exits with `DATABASE_URL is required`:** `services/routing/.env` is missing. Copy it from `.env.example`.

## 2. Check the server side without a phone

```bash
curl -s localhost:8080/healthz
# {"status":"ok"}

curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8080/v1/routes -d '{}'
# 403: requests without a Clerk token are refused

psql "$DB" -c "select count(*) from public.alerts_feed"
# 4: the sample alerts from data/campus/samples.json
```

## 3. Sign in and load the map

1. Open the app in Expo Go and sign in as the test student.
2. The map tab opens on the demo zone.

**Pass:** four alert pins show up (Century Tower, west of CSE, south of Library West, south of Marston), each with its age and confirmation count. The elevator board lists the Marston elevator as working and verified.

**If the map is empty:** Supabase didn't accept the Clerk token. Check the Clerk block in `supabase/config.toml`, then run `supabase stop && supabase start`.

## 4. Request a route

1. Set the travel profile to **wheelchair**.
2. Plan a route from Library West to Marston.

**Pass:** at least one route draws on the map, and the routing log shows `POST /v1/routes ... 200`.

**If the log shows `403`:** the Go service rejected the token. Check that `CLERK_SECRET_KEY` in `services/routing/.env` comes from the same Clerk app as the publishable key in `apps/mobile/.env`.

## 5. Confirm the Go service reads live data

Note the route from step 4, then put a blocking alert in the database, bypassing the app. This one covers the walkway in front of Library West's south entrance:

```bash
psql "$DB" -c "insert into public.alerts (type, geom, created_by, expires_at)
  values ('blocked_path',
          extensions.st_buffer('SRID=4326;POINT(-82.3432 29.6505)'::extensions.geography, 25),
          'smoke_check', now() + interval '1 hour')"
```

Wait 15 seconds (`BARRIER_REFRESH_INTERVAL`) and request the same route again.

**Pass:** the route changes, or it's still shown but no longer tagged "For you" and its notes mention the blocked path. If it's identical, the alert didn't land on your route. Move the point onto a segment the route uses and try again.

## 6. Reset

```bash
make seed
```

## Log

| Date | Who | Phone and OS | Result | Notes |
|---|---|---|---|---|
| | | | | |
