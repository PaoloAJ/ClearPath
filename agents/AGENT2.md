# AGENT2: Routing service

You build the Go service that turns a travel profile and live barriers into ranked, explained routes (R2, R3).

Read first: [AGENTS.md](../AGENTS.md), then README sections **Architecture** and **Routing**.

## You own

```
services/routing/**
```

Don't edit `supabase/` or `apps/`. If you need a column or index, ask AGENT3.

## What's already there

| File | State |
|---|---|
| `cmd/server/main.go`, `config.go` | Env loading, pgx pool, graph + barrier refresh loops, graceful shutdown, done |
| `internal/auth` | Clerk JWT middleware, `UserID(ctx)`, `Role(ctx)` reading `app_role`, done |
| `internal/api` | chi router, `/healthz`, request validation, wire types, done. `/v1/routes` returns 501 |
| `internal/graph` | `Node`, `Edge`, `Graph`, DB loader (`Store`), adjacency. `Nearest` and `ShortestPath` are stubs |
| `internal/profiles` | `Mode`, `Parse`, thresholds, `Options`. `CostFunc` returns plain length for every mode |
| `internal/barriers` | `Store.Refresh` loads blocked edges from active alerts + out elevators, done. `EdgesBlockedByAlert` is a stub |
| `Dockerfile`, `.env.example` | Done |

## Contracts

**You provide** the routing API: README → Routing → API, `internal/api/types.go`. AGENT1 mirrors it in `apps/mobile/lib/types.ts`. Change both in one PR (AGENTS.md → Contracts).

**You consume** from AGENT3: tables `nodes`, `edges`, `elevators`, `alerts` (columns in README → Data model) and the GeoJSON property rules in `data/campus/import.ts`.

## Backlog

### M1: Walking skeleton (unblocks AGENT1, do this first)

- [ ] **`Graph.Nearest`**: snap a lat/lng to the nearest entrance or junction node.
- [ ] **`Graph.ShortestPath`**: A* with a haversine heuristic. Skip `blocked` edges and edges where the cost function says `ok=false`. Return edge IDs, node IDs, length, cost.
- [ ] **`POST /v1/routes`, one route**: snap, search with plain length, build the `LineString` from edge coords (flip coords when walking an edge target→source), `duration_s` from a per-mode speed. Label it "For you". *Done when:* AGENT1 can draw a real route on the seeded graph.

### M2: v1 features

- [ ] **Cost functions** (R3) in `internal/profiles`, per README → Profile rules:
  - `wheelchair`: exclude stairs and slope > 8%. Penalize slope > 5% and brick/gravel/grass. Prefer elevators and paved.
  - `walking_aid`: penalize stairs heavily, slope > 6%, and long distances.
  - `bike` / `scooter` / `skateboard`: exclude indoor, stairs, and `bike_ok = false`. Penalize brick.
  - `walking`: shortest.
  - Slope is signed in the source→target direction. Use the sign for the direction you traverse.
- [ ] **Live barriers** (R2): pass `barriers.Current().Blocked` to every search.
- [ ] **Alternatives and notes** (R3): rerun with relaxed `Options` (stairs allowed, barriers ignored). Keep 2–3 distinct routes. Mark `fits_profile`, label them ("For you," "Fastest"), and explain each difference in `notes` ("Stairs at Turlington," "Library West elevator is out of service"). Use building names from nodes and elevator names from `elevators`.
- [ ] **Elevator notes**: load elevator name, status, `verified`, and `last_reported_at` so a route can say "Uses the Marston east elevator (working, verified 20 min ago)."
- [ ] **`POST /v1/routes/check`** (R2): implement `EdgesBlockedByAlert` (edges in `remaining_edge_ids` that intersect that alert's polygon). The handler is already wired.
- [ ] **Facilities role**: nothing in routing needs it yet. Don't add role checks unless a requirement does.

### M3: Study-ready

- [ ] Tune thresholds with AGENT4 after the first usability sessions. Keep them as named constants.
- [ ] Response time under 200 ms on the demo graph. Log slow requests.

## Tests (README → Testing)

- Table-driven cost tests per mode: wheelchair never takes stairs or slope > 8%, riders never go indoor, `AllowStairs` relaxes the exclusion.
- Barrier tests: a blocked edge is avoided, and an out elevator blocks every edge with its `elevator_id`.
- Ranking: "For you" is the best fitting route, and non-fitting routes carry notes.
- Graph checks in `internal/graph`: connected, every elevator node has edges, no orphan nodes.
- API tests with `httptest` and fakes (see `handlers_test.go`). No database needed for unit tests.

## Rules for this lane

- The graph is small. Search it fresh on every request. Don't add caching or precomputation.
- Thresholds live in `internal/profiles` as named constants, never inline.
- Every route that doesn't fit the profile must say why in `notes`. A route with `fits_profile: false` and no notes is a bug.

## Commands

```bash
cd services/routing
cp .env.example .env     # needs local Supabase running (supabase start)
go run ./cmd/server      # :8080
go test ./... && go vet ./...
curl localhost:8080/healthz
```
