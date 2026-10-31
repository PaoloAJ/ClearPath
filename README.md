# ClearPath

**Accessibility-first campus navigation for the University of Florida.**

ClearPath helps students who use mobility aids (wheelchairs, crutches, canes) and students who ride (bikes, scooters, skateboards) get around campus. It shows the barriers that standard maps miss, like broken elevators, construction, and blocked paths. It builds routes around how each person actually gets around, and it lets anyone report a barrier in two taps.

> Built for an HCI course at UF. Status: **in development**. The first release covers a demo zone around Library West, Marston, Turlington, and the CSE Building.

---

## Table of contents

- [Why ClearPath](#why-clearpath)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Data model](#data-model)
- [Routing](#routing)
- [Alerts and trust](#alerts-and-trust)
- [Demo mode](#demo-mode)
- [Accessibility](#accessibility)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scope and roadmap](#scope-and-roadmap)
- [Contributing](#contributing)

---

## Why ClearPath

The design comes from 8 interviews with UF students: 4 riders and 4 mobility-aid users. Three findings came out of them.

| | Finding |
|---|---|
| **I1** | **Elevator status is invisible.** Students find out an elevator is down only when they reach it. For a wheelchair user, that can mean backtracking across campus. |
| **I2** | **The shortest route isn't always usable.** Maps optimize for distance, so the fastest path can include stairs, steep grades, or blocked paths. Riders and mobility-aid users need different routes. |
| **I3** | **Reporting has to be fast and trustworthy.** People will flag barriers only if it takes almost no effort, and they'll act on other people's reports only if they trust them. |

Those findings became six requirements, and every feature traces back to one of them.

| | Requirement | Comes from |
|---|---|---|
| **R1** | Check elevator and barrier status before leaving | I1 |
| **R2** | Get warned about new barriers mid-route, with a one-tap reroute | I1 |
| **R3** | Routes based on a personal travel profile, including temporary conditions | I2 |
| **R4** | Report a barrier in two taps | I3 |
| **R5** | Every alert shows recency, confirmations, and verification, and stale alerts expire | I3 |
| **R6** | The app itself is fully accessible | Report |

---

## Features

| Feature | What it does | Req. |
|---|---|---|
| **Travel profile** | Set how you get around: wheelchair, walking aid, bike, scooter, or skateboard. Temporary modes take an end date (for example, crutches for six weeks) and switch back on their own. | R3 |
| **Live alert map** | Campus map with active alerts. Each pin shows its age, its confirmation count, and whether it's verified. | R1, R5 |
| **Alert detail** | Type, photo, confidence, the routes it affects, and when it expires. **Still there** and **It's cleared** buttons keep it accurate. | R5 |
| **Route options** | 2–3 routes ranked for your profile. The best fit is tagged **For you**. Routes that don't fit are still shown, along with the reason ("uses stairs at Turlington"). | R3 |
| **Navigation with rerouting** | If a new alert lands on the rest of your route, you're warned before you reach it and can reroute with one tap. Riders get haptic and audio cues instead of a pop-up. | R2 |
| **Two-tap reporting** | Tap 1: choose the barrier type. Tap 2: send. GPS fills in the location, and a photo is optional. | R4 |
| **Elevator board** | Every elevator in the zone, marked working, out of service, or unconfirmed. Verified Facilities posts are kept separate from student reports. | R1, R5 |
| **Demo mode** | Simulates a walk and injects alerts on cue, for presentations and usability testing. | n/a |

---

## Architecture

```mermaid
flowchart LR
    subgraph Client
        A[Expo app<br/>iOS / Android]
    end

    subgraph Auth
        C[Clerk]
    end

    subgraph Supabase
        DB[(Postgres + PostGIS)]
        RT[Realtime]
        ST[Storage<br/>report photos]
    end

    subgraph Routing
        G[Go routing API<br/>in-memory campus graph]
    end

    A -- sign in / session token --> C
    A -- queries + writes<br/>Clerk JWT --> DB
    A -- subscribe to alerts,<br/>elevator status --> RT
    A -- upload photo --> ST
    A -- POST /v1/routes<br/>Clerk JWT --> G
    G -- verify JWT --> C
    G -- read edges, active alerts,<br/>elevator status --> DB
```

**Who does what**

- **Clerk** handles sign-up, sign-in, and sessions. It's the only identity provider. Supabase and the Go service both trust Clerk-issued session tokens.
- **Supabase** stores all app data (profiles, alerts, votes, elevators, the campus graph). It enforces Row Level Security using the Clerk user ID, pushes alert and elevator changes over Realtime, and stores report photos.
- **The Go routing API** loads the campus graph into memory, applies profile-specific costs and live barriers, and returns ranked routes with reasons. It also checks whether a new alert affects a route in progress (R2).

---

## Tech stack

| Layer | Choice |
|---|---|
| Mobile app | [Expo](https://expo.dev) SDK 58 (React Native, TypeScript), Expo Router |
| Auth | [Clerk](https://clerk.com) (`@clerk/expo`, `clerk-sdk-go/v2`) |
| Map | `react-native-maps` (pins and route polylines) |
| Database | Supabase Postgres with PostGIS |
| Realtime | Supabase Realtime (Postgres changes) |
| File storage | Supabase Storage |
| Routing service | Go 1.25+, `chi`, `pgx`, A* over an in-memory graph |
| Location and haptics | `expo-location`, `expo-haptics`, `expo-speech` |
| Data authoring | GeoJSON (campus graph), drawn in [geojson.io](https://geojson.io) or QGIS |
| Tooling | pnpm, Supabase CLI, Docker, GitHub Actions |

---

## Repository structure

```
clearpath/
├── apps/
│   └── mobile/                 # Expo app
│       ├── app/                # Expo Router screens
│       │   ├── (auth)/         # sign-in, sign-up (Clerk)
│       │   ├── (tabs)/         # map, elevators, report, profile
│       │   ├── alert/[id].tsx  # alert detail
│       │   ├── routes.tsx      # route options
│       │   └── navigate.tsx    # active navigation
│       ├── components/         # shared UI (AlertPin, RouteCard, BigButton, ...)
│       ├── lib/
│       │   ├── supabase.ts     # Supabase client wired to Clerk tokens
│       │   ├── routing.ts      # Go routing API client
│       │   └── demo.ts         # demo-mode controller
│       └── app.config.ts
├── services/
│   └── routing/                # Go routing API
│       ├── cmd/server/         # main.go
│       ├── internal/
│       │   ├── graph/          # graph loading, A*, edge filtering
│       │   ├── profiles/       # cost function per travel mode
│       │   ├── barriers/       # active alerts + elevator status → blocked edges
│       │   ├── auth/           # Clerk JWT middleware
│       │   └── api/            # HTTP handlers
│       ├── Dockerfile
│       └── go.mod
├── supabase/
│   ├── config.toml
│   ├── migrations/             # schema, PostGIS, RLS policies
│   └── seed.sql                # demo zone, elevators, sample alerts
├── data/
│   └── campus/
│       ├── nodes.geojson       # entrances, junctions, elevators
│       ├── edges.geojson       # paths with stairs/slope/surface/indoor tags
│       └── import.ts           # GeoJSON → seed.sql
├── docs/
│   ├── research.md             # interview findings, requirements
│   ├── smoke-check.md          # end-to-end check: phone → Supabase → routing → DB
│   └── decisions/              # short architecture decision records
├── agents/                     # team guide + one file per workstream (AGENT1–4)
├── .github/workflows/          # CI: lint, typecheck, go test
├── AGENTS.md                   # shared rules, contracts, definition of done
├── Makefile
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js 20+ and pnpm
- Go 1.25+
- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Expo Go on your phone, or an iOS Simulator / Android Emulator
- A free [Clerk](https://clerk.com) application

### 1. Clone and install

```bash
git clone https://github.com/PaoloAJ/ClearPath.git
cd ClearPath
pnpm install
```

### 2. Set up Clerk

1. Create a Clerk application and enable email sign-in. You can also enable Google sign-in with UF accounts.
2. Copy the **publishable key** and **secret key**.
3. In Clerk, go to **Sessions → Customize session token** and add the user's role so Supabase and the Go service can read it:

   ```json
   {
     "app_role": "{{user.public_metadata.role}}"
   }
   ```

   Name the claim `app_role`, not `role`. Supabase reads the `role` claim to choose the Postgres role, and the Clerk integration already sets it to `authenticated`.

   Set `public_metadata.role = "facilities"` on accounts that are allowed to post **verified** alerts and elevator statuses.

4. Connect Clerk to Supabase as a third-party auth provider. In the Supabase dashboard, go to **Authentication → Third-party auth → Clerk**. For local development, enable it in `supabase/config.toml`:

   ```toml
   [auth.third_party.clerk]
   enabled = true
   domain = "<your-clerk-frontend-api-domain>"
   ```

### 3. Start Supabase locally

```bash
supabase start          # starts Postgres, Realtime, Storage in Docker
supabase db reset       # applies migrations and seed.sql (demo zone + sample data)
```

### 4. Run the routing service

```bash
cp services/routing/.env.example services/routing/.env    # fill in values (see below)
make routing
# → graph loaded nodes=568 edges=774
# → listening addr=:8080
```

Go doesn't read `.env` files on its own. `make routing` (and `make dev`) export `services/routing/.env` first. To run it by hand, do the same in a subshell so your own shell isn't changed: `(cd services/routing && set -a && . ./.env && set +a && go run ./cmd/server)`.

### 5. Run the app

```bash
cd apps/mobile
cp .env.example .env    # fill in values (see below)
pnpm expo start
```

Scan the QR code with Expo Go. On a physical phone, set `EXPO_PUBLIC_ROUTING_API_URL` to your computer's LAN IP, not `localhost`.

### Makefile shortcuts

```bash
make dev        # supabase start + routing service + expo, together
make seed       # rebuild seed.sql from data/campus and reset the DB
make test       # go test ./... and pnpm test
make lint       # eslint, tsc --noEmit, go vet
```

---

## Environment variables

### `apps/mobile/.env`

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API URL (local: `http://<lan-ip>:54321`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `EXPO_PUBLIC_ROUTING_API_URL` | Go routing API base URL (local: `http://<lan-ip>:8080`) |
| `EXPO_PUBLIC_DEMO_MODE` | `true` to simulate navigation and enable alert injection with the real backend |
| `EXPO_PUBLIC_FIXTURE_PREVIEW` | `true` for a development-only profile/map fixture preview without sign-in; keep `false` for backend demos |

### `services/routing/.env`

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default `8080`) |
| `DATABASE_URL` | Postgres connection string (local: `postgresql://postgres:postgres@localhost:54322/postgres`) |
| `CLERK_SECRET_KEY` | Clerk secret key, used to verify session tokens |
| `GRAPH_RELOAD_INTERVAL` | How often to reload the graph from the DB (default `5m`) |
| `BARRIER_REFRESH_INTERVAL` | How often to refresh active alerts and elevator status (default `15s`) |

Never commit `.env` files. Only the `.env.example` files are checked in.

---

## Data model

Users are identified by their **Clerk user ID** (`text`, for example `user_2abc...`). Supabase has no users table of its own. RLS policies read the ID from `auth.jwt() ->> 'sub'`.

```
profiles
  user_id        text  PK              -- Clerk user ID
  mode           text                  -- wheelchair | walking_aid | bike | scooter | skateboard | walking
  temp_mode      text  NULL            -- temporary override, e.g. walking_aid
  temp_until     date  NULL            -- temp_mode expires after this date
  haptics_only   bool  DEFAULT false   -- no pop-ups while moving
  updated_at     timestamptz

nodes
  id             bigint PK
  geom           geography(Point)
  kind           text                  -- entrance | junction | elevator
  building       text  NULL
  floor          int   NULL

edges
  id             bigint PK
  source, target bigint → nodes
  geom           geography(LineString)
  length_m       real
  slope_pct      real                  -- signed grade
  stairs         bool
  surface        text                  -- paved | brick | gravel | grass
  indoor         bool
  bike_ok        bool
  elevator_id    bigint NULL → elevators   -- set when the edge rides an elevator

elevators
  id             bigint PK
  building       text
  name           text                  -- "Marston, east elevator"
  node_id        bigint → nodes
  status         text                  -- working | out | unconfirmed
  verified       bool                  -- set by a facilities-role user
  last_reported_at timestamptz

elevator_reports                       -- history of elevator status changes
  id             bigint PK
  elevator_id    bigint → elevators
  status         text                  -- working | out | unconfirmed
  reported_by    text                  -- Clerk user ID
  verified       bool                  -- true when posted by a facilities-role user
  created_at     timestamptz

alerts
  id             uuid PK
  type           text                  -- construction | elevator_out | blocked_path | flooding | broken_ramp | other
  geom           geography(Polygon)    -- buffered around the reported point
  created_by     text                  -- Clerk user ID
  verified       bool DEFAULT false
  photo_path     text NULL             -- Supabase Storage key
  created_at     timestamptz
  expires_at     timestamptz
  resolved_at    timestamptz NULL

alert_votes
  alert_id       uuid → alerts
  user_id        text
  kind           text                  -- still_there | cleared
  created_at     timestamptz
  PRIMARY KEY (alert_id, user_id)      -- one vote per user per alert; changing it overwrites
```

**Row Level Security, at a glance**

- `profiles`: users can read and write only their own row.
- `alerts`: any signed-in user can read. Reports go through `report_alert()`, never a direct insert. Only a `facilities` role can set `verified = true`.
- `alert_votes`: votes go through `vote_alert()`, one per user per alert.
- `elevators`: readable by everyone. Status changes go through a function that logs the reporter to `elevator_reports`.
- `nodes` and `edges`: read-only for clients, written only by migrations and seed.

---

## Routing

The Go service holds the demo-zone graph in memory and runs A* with a **cost function for each travel mode**. The graph is small (hundreds of edges), so every request filters and searches the whole graph fresh, and results always reflect current barriers.

### Profile rules

| Mode | Excluded edges | Penalized | Preferred |
|---|---|---|---|
| `wheelchair` | stairs, slope > 8% | slope > 5%, brick/gravel/grass surfaces | elevators, paved paths |
| `walking_aid` | none | stairs (heavy), slope > 6%, long distances | short routes with few level changes |
| `bike` / `scooter` / `skateboard` | indoor, stairs, `bike_ok = false` | brick surfaces | bikeable paths |
| `walking` | none | none | shortest |

When `temp_until` is in the future, `temp_mode` replaces `mode`. All thresholds live in `internal/profiles` and are meant to be tuned through usability testing.

### Live barriers

Every `BARRIER_REFRESH_INTERVAL`, the service loads:

- **Active alerts** (`resolved_at IS NULL AND expires_at > now()`). Any edge that intersects an alert polygon is blocked.
- **Elevators with `status = 'out'`.** Every edge with that `elevator_id` is blocked.

### API

All endpoints except `/healthz` require `Authorization: Bearer <Clerk session token>`.

**`POST /v1/routes`**

```json
// request
{
  "from": { "lat": 29.6516, "lng": -82.3429 },
  "to":   { "lat": 29.6481, "lng": -82.3437 },
  "profile": "wheelchair"
}

// response
{
  "routes": [
    {
      "id": "r1",
      "label": "For you",
      "fits_profile": true,
      "distance_m": 640,
      "duration_s": 540,
      "geometry": { "type": "LineString", "coordinates": [[-82.3429, 29.6516], ...] },
      "edge_ids": [12, 13, 47, 48],
      "notes": ["Uses the Marston east elevator (working, verified 20 min ago)"]
    },
    {
      "id": "r2",
      "label": "Fastest",
      "fits_profile": false,
      "distance_m": 410,
      "duration_s": 330,
      "geometry": { "type": "LineString", "coordinates": [...] },
      "edge_ids": [12, 19, 20],
      "notes": ["Stairs at Turlington", "Library West elevator is out of service"]
    }
  ]
}
```

Errors come back as `{ "error": "..." }`: `400` for a bad body, an unknown profile, or an `alert_id` that is not a UUID, and `422` when the start or destination is more than 1 km from the campus graph (outside the demo zone) or no route connects them.

To produce routes that don't fit the profile, the service runs the search again with relaxed constraints (stairs allowed, barriers ignored) and explains each difference in `notes`. That's how the fastest route can still be shown with a warning (R3).

**`POST /v1/routes/check`**: used during navigation (R2).

```json
// request
{ "remaining_edge_ids": [47, 48, 52], "alert_id": "6f1c..." }

// response
{ "affected": true, "blocked_edge_ids": [48], "reroute_suggested": true }
```

**`GET /healthz`**: liveness check.

---

## Alerts and trust

Rules for R4 and R5. All of them are configurable in `private.app_settings`, and they're enforced in the database by `report_alert()` and `vote_alert()`.

| Event | Effect |
|---|---|
| Student report | Alert created as *Just now, no confirmations yet* with `expires_at = now + 4h` |
| **Still there** vote | `expires_at` pushed to `now + 4h`, confirmation count goes up |
| **It's cleared** votes from 2 different users | Alert resolved |
| Facilities-role post | `verified = true`, no automatic expiry, resolved only by facilities |
| `expires_at` passes | Alert hidden from the map and ignored by routing |

Each alert pin and detail screen shows **age**, **confirmations**, and a **verified** badge. Verified items are listed separately from student reports.

**Realtime flow:** the app subscribes to inserts and updates on `alerts` and `elevators`. During navigation, each new alert triggers `POST /v1/routes/check`. If the alert affects the route, the app shows **Reroute** or **Keep route**. Users with `haptics_only` get a vibration and a spoken cue instead, and the prompt appears once they stop moving.

---

## Demo mode

Set `EXPO_PUBLIC_DEMO_MODE=true` and keep `EXPO_PUBLIC_FIXTURE_PREVIEW=false` for a demo connected to Clerk, Supabase, and the routing service. Starting navigation automatically simulates a walk. Tap **Demo: add an alert ahead** on the navigation screen to stage the R2 warning and reroute flow.

The controller also provides elevator-toggle and reset functions, but their UI controls and the full logo panel remain pending. Use a dedicated demo database and the setup/reset instructions in [the smoke check](docs/smoke-check.md). Reset deletes alerts, votes, and elevator history.

For a profile/map preview without authentication or backend access, set `EXPO_PUBLIC_FIXTURE_PREVIEW=true` in development. This is separate from backend demo mode and does not exercise reporting, routing, or navigation.

On the database side, the demo RPCs (`demo_inject_alert`, `demo_toggle_elevator`, `demo_reset`) only run when `private.app_settings.demo_enabled` is true. `make seed` turns it on locally. On a hosted project, turn it on for a presentation with `update private.app_settings set demo_enabled = true;` and off again afterward. The sample state comes from `data/campus/samples.json`.

---

## Accessibility

R6 is an acceptance criterion for every screen, not a polish pass at the end. A screen isn't done until all of these are true:

- [ ] Every tap target is at least 48×48 pt.
- [ ] Every icon, pin, and button has an `accessibilityLabel`, and an `accessibilityHint` where the action isn't obvious.
- [ ] Status is never shown by color alone. Write out "Out of service," not just a red dot.
- [ ] Text scales with system font size (Dynamic Type or Android font scale) without clipping.
- [ ] Contrast is at least 4.5:1 for body text and 3:1 for large text and icons.
- [ ] The screen's main task can be completed start to finish with **VoiceOver** and with **TalkBack**.
- [ ] The map has a list alternative (alerts and elevators as a list) for screen-reader users.
- [ ] Motion and auto-advancing content respect Reduce Motion.
- [ ] Navigation cues can be spoken (`expo-speech`) and felt (`expo-haptics`), not only seen.

---

## Testing

| Area | Tooling | Focus |
|---|---|---|
| Routing service | `go test ./...` | Cost functions per profile, barrier filtering, route ranking, `/routes/check` |
| Graph data | `go test ./internal/graph` + import script checks | Connected graph, every elevator node has edges, no orphan nodes |
| Mobile app | Jest + React Native Testing Library | Report flow, alert trust display, profile switching |
| RLS | SQL tests under `supabase/tests` | Users can't edit others' rows, students can't set `verified` |
| Accessibility | Manual VoiceOver/TalkBack pass per PR touching UI | Checklist above |
| Usability | Scripted tasks in demo mode | Plan a route, react to a mid-route alert, report a barrier |

CI runs on every pull request: lint, typecheck, `go test`, `pnpm test`, a check that `seed.sql` matches `data/campus`, and the pgTAP suites against a fresh database. All of it must pass before merging to `main`.

---

## Deployment

| Piece | Target |
|---|---|
| Database, Realtime, Storage | Supabase hosted project (`supabase db push` for migrations) |
| Routing service | Docker image on Fly.io or Render, or any container host |
| Mobile app | Expo Go for class demos. EAS Build and TestFlight / internal testing for wider testing. |
| Auth | Clerk production instance |

Production environment variables match the tables above, with hosted URLs and production keys.

---

## Scope and roadmap

**v1, the demo zone (current)**

- [ ] Graph for Library West, Marston, Turlington, CSE, and the paths between them (traced from OpenStreetMap, verified in person)
- [ ] Clerk sign-in + travel profile
- [ ] Alert map, alert detail, voting, expiry
- [ ] Route options with "For you" and flagged alternatives
- [ ] Navigation with mid-route reroute
- [ ] Two-tap reporting with optional photo
- [ ] Elevator board
- [ ] Demo mode
- [ ] Accessibility checklist passing on all screens

**Out of scope for v1**

- Indoor floor-by-floor maps
- A live feed from UF Facilities (a `facilities` role stands in for it)
- Areas of campus outside the demo zone
- Push notifications when the app is closed


**Later**

- Expand the graph across campus, possibly bootstrapped from OpenStreetMap
- Reputation weighting for frequent, accurate reporters
- Saved places and recurring routes (for example, a daily class schedule)

---

## Contributing

Start with [AGENTS.md](AGENTS.md) and the [team guide](agents/README.md). They cover workstream ownership, contracts, and the definition of done.

1. Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, or `data/<short-name>` for graph edits.
2. Keep pull requests small, and link the requirement they serve (`R1`–`R6`) in the description.
3. UI pull requests include a screenshot and a note on the accessibility check.
4. Graph edits go in `data/campus/*.geojson`, followed by `make seed`. Never edit `seed.sql` by hand.
5. Get one approving review before merging.

Write a short decision record in `docs/decisions/` whenever you change something structural, such as a new service, a new dependency, or a schema change.

---

## Team

| Name | Role |
|---|---|
| Anilov Villanueva | Data & Supabase ([AGENT3](agents/AGENT3.md)), frontend ([AGENT1](agents/AGENT1.md)) |
| Alvin Cabe | Routing service ([AGENT2](agents/AGENT2.md)) |
| Lucas Romero-Wyhnanskyj | Platform, auth & Clerk ([AGENT4](agents/AGENT4.md)) |
| Waleed Freija | Early frontend: auth, travel profile, and map screens |

Built for an HCI course at the University of Florida.
