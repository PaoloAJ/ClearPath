# ClearPath: local setup and presentation

Use this guide to run the real app against a **local Supabase database**. It covers R1–R6. You need internet for Clerk sign-in, dependencies, and map tiles; the database and routing service run on your laptop.

## What you need from Paolo

Get these privately before starting:

- Clerk **publishable key**, **secret key**, and **Frontend API domain**, all from the same Clerk application.
- A working test student account. A facilities test account is useful for checking verified posts; the seeded elevator already demonstrates verification.
- Confirmation that the local database is dedicated to this demo and may be reset when you want fresh sample data.

Credentials are not included in git. A fresh clone will not inherit the `.env` files or running database from Paolo's laptop. As of the October 30 handoff, automated checks passed, but authenticated phone and screen-reader rehearsals still needed to be completed.

## 1. Get the code and tools

Install Node.js 20+, pnpm **10.29.2**, Go **1.25+**, Docker Desktop, the Supabase CLI, and Expo Go on the presenting phone. The app currently uses Expo SDK 58; Expo Go must support that SDK.

For a new clone:

```bash
git clone https://github.com/PaoloAJ/ClearPath.git
cd ClearPath
pnpm install --frozen-lockfile
```

For an existing clone, check `git status` first and preserve any local work, then:

```bash
git switch main
git pull --ff-only origin main
pnpm install --frozen-lockfile
```

Run all remaining commands from the repository root unless stated otherwise. Use current `main`; the complete mobile UI and demo fixes were merged in PR #23.

## 2. Configure Clerk

The same Clerk application must serve the phone, Supabase, and routing service.

1. Enable email sign-in in Clerk and confirm you can receive any required email verification codes.
2. Enable the Clerk Supabase integration. Follow [README → Set up Clerk](README.md#2-set-up-clerk) for the project's authentication contract.
3. In Clerk's session-token customization, include:

   ```json
   {
     "app_role": "{{user.public_metadata.role}}"
   }
   ```

4. For the optional facilities account, set its public metadata to `{"role":"facilities"}`. The student account must not have that value. Our custom claim is `app_role`; do not overwrite the JWT's `role` claim.
5. Edit the existing block in `supabase/config.toml` locally:

   ```toml
   [auth.third_party.clerk]
   enabled = true
   domain = "YOUR_REAL_FRONTEND_API_DOMAIN"
   ```

Use a hostname such as `your-app.clerk.accounts.dev`, without `https://` or a trailing path. Do not add a second Clerk block. A placeholder domain prevents Supabase from starting. Keep machine-specific configuration edits out of shared commits.

## 3. Start local Supabase

Open Docker Desktop and wait for its engine to be ready, then run:

```bash
docker info
supabase start
supabase status
```

On first startup, Supabase applies the migrations and seed. On later starts it restores existing local data. The first start can take several minutes while images download.

Local endpoints:

| Service | Laptop URL |
|---|---|
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase API | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Routing, after startup below | http://127.0.0.1:8080/healthz |

If you changed the Clerk domain after Supabase was already running, apply the configuration with `supabase stop` followed by `supabase start`. Normal stop preserves local data; do not use `--no-backup`.

## 4. Create the two environment files

Copy the templates only if you do not already have real environment files:

```bash
[ -f apps/mobile/.env ] || cp apps/mobile/.env.example apps/mobile/.env
[ -f services/routing/.env ] || cp services/routing/.env.example services/routing/.env
```

Find the laptop's Wi-Fi IPv4 address in network settings. On macOS, `ipconfig getifaddr en0` usually prints it. Put the phone and laptop on the same network. Use **your laptop's address**, not Paolo's address or the example below.

Edit `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_SUPABASE_URL=http://YOUR_LAPTOP_IP:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_LOCAL_SUPABASE_ANON_KEY
EXPO_PUBLIC_ROUTING_API_URL=http://YOUR_LAPTOP_IP:8080
EXPO_PUBLIC_DEMO_MODE=true
EXPO_PUBLIC_FIXTURE_PREVIEW=false
```

Copy the **anon** key from `supabase status`. Never put a Supabase service-role/secret key or Clerk secret key in the mobile environment. `localhost` on a physical phone refers to the phone, so it cannot reach your laptop's services.

Edit `services/routing/.env`:

```dotenv
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
CLERK_SECRET_KEY=YOUR_CLERK_SECRET_KEY
GRAPH_RELOAD_INTERVAL=5m
BARRIER_REFRESH_INTERVAL=15s
```

The two demo flags have different purposes:

| Setting | Result |
|---|---|
| `DEMO_MODE=true`, `FIXTURE_PREVIEW=false` | Real sign-in and backend; simulated campus location, walk, and alert injection. Use this for the presentation. |
| `FIXTURE_PREVIEW=true` in development | Profile/map fixtures without sign-in or backend access. This does not test the full demo. |

These rows abbreviate the `EXPO_PUBLIC_` variable names. Save the files locally; never commit or paste their contents into a ticket, PR, or chat. Restart Expo after changing them.

## 5. Verify and launch

```bash
make lint test
supabase test db
```

At handoff, all 64 mobile tests and 68 database assertions passed, along with lint, TypeScript, Go vet, and Go tests.

For a fresh presentation state, **only after confirming existing local data may be discarded**, run:

```bash
make seed
```

This rebuilds the seed and resets the local database, deleting existing local app data. Supabase must already be running. It restores four sample alerts, the campus graph, the Marston elevator, and the database demo flag. Do not run it on data you need to preserve.

Start everything:

```bash
make dev
```

Keep that terminal open. Expect a routing `listening` message on port 8080 and an Expo QR code. For separate logs, use `make routing` in one terminal and `make mobile` in another, with Supabase already running. Use these targets instead of plain `go run`: the Makefile loads the routing `.env` file.

In a second terminal:

```bash
curl -fsS http://127.0.0.1:8080/healthz
```

Expect `{"status":"ok"}`. Also open `http://YOUR_LAPTOP_IP:8080/healthz` in the **phone's browser**. If it cannot connect, fix the network/firewall before opening the app. An Expo tunnel only tunnels Expo; it does not expose the separate Supabase and routing ports.

Open the Expo QR code on the phone, sign in as the test student, and save a wheelchair travel profile. Check that the map shows sample alerts and the elevator board shows Marston as working and verified. Complete one route and report before presenting. Run the main tasks with VoiceOver/TalkBack and large text; record what actually passed.

## 6. The five-minute demo

Rehearse on the exact phone and network used for the presentation. Mirror the phone, silence notifications, and keep a recording of a successful rehearsal available.

| Step | Action | Explain |
|---|---|---|
| 1 | Open **Elevators** and show Marston's status, verification, and age. | Students can check before leaving; verification and recency help them judge reports. R1, R5. |
| 2 | On **Profile**, select wheelchair and save. On **Map**, tap **Where to?**, choose **Marston Science Library**. | Demo mode starts at Library West even if you are off campus. Routes reflect the travel profile. R3. |
| 3 | Show the recommended route and any flagged alternatives returned, then start the recommended route. | Explain the reasons shown on the actual route cards; do not promise a fixed number of alternatives. |
| 4 | Watch the simulated position move. Tap **Demo: add an alert ahead** once. When the warning appears, inspect the proposed alternative and tap **Reroute**, if offered. | New barriers can affect a trip in progress. R2. Confirm during rehearsal that the new route actually avoids the injected barrier. |
| 5 | End navigation. Open **Report**, select **Blocked path**, then **Send report**. | Two taps from the report screen; no photo or typing required. Demo mode supplies an on-campus location. R4. |
| 6 | Open the new alert from the map/list and show its age, confirmation count, and voting controls. | Reports are refreshed by confirmations and expire when stale. R5. |
| 7 | If rehearsed, demonstrate the elevator list with the screen reader. | Accessible controls and text statuses are part of the demo. R6. |

There is no complete demo-control panel yet. Simulation begins automatically during navigation; the alert button is on that screen. Elevator-toggle and reset controls are not wired into the UI. Do not spend presentation time searching for them.

The map supports pull to refresh and refreshes after your own report; it does not yet subscribe to live updates. Navigation has its own Realtime subscription. Route checks conservatively include all trip edges until arrival, so an alert behind the user can still produce a warning.

The routing barrier cache refreshes every 15 seconds by default. A reroute requested immediately after injection can still reflect earlier barrier state. Verify the full sequence in rehearsal; if the proposed route has not changed, wait for a refresh and request routes again. Do not describe an unchanged route as a successful reroute.

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| Docker daemon unavailable | Open Docker Desktop and wait until `docker info` succeeds. |
| Supabase fails fetching OpenID configuration | Use the real Clerk hostname in the existing provider block; check internet connectivity. |
| Missing environment variable error | Fill both `.env` files, use the same Clerk app's keys, and restart the affected service. |
| Preview controls instead of sign-in | Set `EXPO_PUBLIC_FIXTURE_PREVIEW=false`; restart Expo. |
| Expo Go reports an incompatible SDK | Use an Expo Go version that supports the repository's SDK, or a compatible development build. Do not upgrade dependencies during the presentation. |
| Phone cannot reach the routing health URL | Recheck laptop IP, shared Wi-Fi, firewall, VPN, and network client isolation. Try a network that allows devices to communicate. Update both mobile URLs if the IP changes. |
| Map empty or queries fail | Check Clerk provider configuration and session. Check errors and refresh; ordinary sample alerts also expire after several hours. Reseed only with permission to discard local data. |
| Route request gets 403 | Confirm the routing secret and mobile publishable key belong to the same Clerk app; sign in again. |
| No route from your real location | Check `EXPO_PUBLIC_DEMO_MODE=true`; demo trips start at Library West. |
| Alert injection fails | Check that local `private.app_settings.demo_enabled` is true and you are signed in. Fresh demo seed enables it. |
| Warning or reroute does not behave as rehearsed | Inspect routing logs, Realtime connectivity, and the cache delay above. Repeated injection can block more paths, so avoid repeatedly tapping it. Use the rehearsal recording if necessary. |
| New pin or cleared alert not reflected | Pull down the map list to refresh. |

For deeper diagnosis, see [the smoke check](docs/smoke-check.md), [presentation script](docs/demo-script.md), and [readiness record](docs/demo-readiness.md).

## 8. Stop and repeat

Stop Expo/routing with Ctrl-C in their terminals. If finished for the day, run `supabase stop` to stop local containers while preserving data. Start again with `make dev`.

Between participants, stop navigation and reset only the dedicated demo database after confirming data may be discarded. After `make seed`, restart the routing service to reload the graph/barriers immediately and reload the app so it drops the previous in-memory trip. Check the four sample alerts and elevator again.

## Setup handoff

Copy this task when handing setup to someone else:

> Read `AGENTS.md`, `agents/AGENT4.md`, and `DEMO_README.md` first. Work from current main and preserve existing changes. Configure local Supabase and the real authenticated mobile demo. Ask for Clerk keys/domain privately if missing; never invent credentials, print secrets, or bypass authentication. Keep fixture preview off and backend demo mode on. Start Docker/Supabase, configure ignored environment files, run `make lint test` and `supabase test db`, and verify routing health from the laptop and phone. Do not reset existing data without explicit permission. Do not edit merged migrations or seed SQL by hand. Before cross-workstream code or contract changes, follow the repository's ownership rules. Rehearse sign-in, elevator check, Library West → Marston, injected alert/reroute, and two-tap reporting on the phone. Report checks actually run, remaining blockers, and accessibility/device results. Do not claim the full demo panel or map Realtime exists.
