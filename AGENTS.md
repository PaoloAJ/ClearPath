# AGENTS.md

Shared rules for everyone working on ClearPath, people and coding agents alike. Read this before you touch code, then read your workstream file in [`agents/`](agents/).

## 1. What we're building

ClearPath is accessibility-first campus navigation for UF. v1 covers the demo zone around Library West, Marston, Turlington, and the CSE Building. Full product spec: [README.md](README.md).

**The goal of v1 is a working demo and a usability study, not a production launch.** When you're choosing between "complete" and "demoable and accessible," choose demoable and accessible.

Every feature traces to a requirement. If what you're building doesn't serve one of these, stop and ask.

| | Requirement |
|---|---|
| **R1** | Check elevator and barrier status before leaving |
| **R2** | Get warned about new barriers mid-route, with a one-tap reroute |
| **R3** | Routes based on a personal travel profile, including temporary conditions |
| **R4** | Report a barrier in two taps |
| **R5** | Every alert shows recency, confirmations, and verification, and stale alerts expire |
| **R6** | The app itself is fully accessible |

## 2. Source of truth

When documents disagree, the higher one wins:

1. **README.md**: product, data model, API, trust rules, env vars.
2. **AGENTS.md** (this file): how we work together.
3. **agents/AGENTn.md**: your lane and your backlog.
4. Code.

If code and README disagree, fix one of them in the same PR. Never leave them out of sync.

## 3. Workstreams

| Agent | Workstream | `TODO` tag | Owns |
|---|---|---|---|
| [AGENT1](agents/AGENT1.md) | Frontend | `TODO(frontend)` | `apps/mobile/**` |
| [AGENT2](agents/AGENT2.md) | Routing service | `TODO(routing)` | `services/routing/**` |
| [AGENT3](agents/AGENT3.md) | Data & Supabase | `TODO(data)` | `supabase/**`, `data/campus/**` |
| [AGENT4](agents/AGENT4.md) | Platform, auth & quality | `TODO(platform)` | `.github/**`, `Makefile`, root config, `docs/**`, Clerk + hosting setup |

**Stay in your lane.** Edit only files your workstream owns. If you need a change somewhere else, either ask the owner or open a small PR and request their review. The exception is a contract change (section 4), which touches both sides on purpose.

Find your open work with `grep -rn "TODO(<tag>)" .`.

## 4. Contracts

These are the seams between workstreams. They let all four lanes work in parallel. Change them only as described below.

| Contract | Lives in | Owner | Used by |
|---|---|---|---|
| DB schema, `alerts_feed` view | `supabase/migrations/` + README → Data model | AGENT3 | AGENT1, AGENT2 |
| Supabase RPCs (below) | `supabase/migrations/` | AGENT3 | AGENT1 |
| Routing API | README → Routing → API, `services/routing/internal/api/types.go`, `apps/mobile/lib/types.ts` | AGENT2 | AGENT1 |
| Campus GeoJSON properties | header of `data/campus/import.ts` | AGENT3 | AGENT2 |
| Auth claims (`sub`, `app_role`) | README → Set up Clerk, `internal/auth`, `public.is_facilities()` | AGENT4 | everyone |
| Env vars | README → Environment variables, `.env.example` files | AGENT4 | everyone |

**Supabase RPCs** the app calls (signatures are fixed, implementation is AGENT3's):

```sql
report_alert(type text, lat float8, lng float8, photo_path text default null) returns uuid
vote_alert(alert_id uuid, kind text) returns void            -- 'still_there' | 'cleared'
set_elevator_status(elevator_id bigint, status text) returns void
demo_inject_alert(lat float8, lng float8) returns uuid
demo_toggle_elevator(elevator_id bigint) returns void
demo_reset() returns void
```

**To change a contract:**

1. Update both sides in one PR, for example `internal/api/types.go` and `lib/types.ts` together.
2. Update the README section that documents it.
3. Add a decision record in `docs/decisions/` if the change is structural (new table, new endpoint, renamed field).
4. Request review from every workstream in the "Used by" column.

Adding an optional field is cheap. Renaming or removing a field breaks someone, so coordinate first.

## 5. Rules

### Always

- Link the requirement (`R1`–`R6`) in every PR description.
- Run `make lint test` before opening a PR. CI runs the same checks.
- Write tests with the feature, not after. README → Testing says what each area needs.
- Keep PRs small: one feature or one fix.
- Use the branch names from the README: `feat/<short-name>`, `fix/<short-name>`, `data/<short-name>`.
- Leave a `TODO(<tag>)` with a one-line reason when you stub something. Don't leave a silent stub.

### Never

- Commit `.env` files, keys, or tokens. Only `.env.example` is checked in.
- Hand-edit `supabase/seed.sql`. Edit `data/campus/*.geojson` and run `make seed`.
- Edit a migration that has already been merged. Add a new migration file.
- Add a dependency without a decision record.
- Build anything on the README's "Out of scope for v1" list (indoor maps, a live Facilities feed, areas outside the demo zone, push notifications).
- Show status by color alone (R6).
- Name a JWT claim `role`. Supabase reserves it; ours is `app_role`.

### Stop and ask a human when

- A requirement is ambiguous, or two requirements conflict.
- You need to change a contract owned by another workstream.
- A task looks out of scope.
- You're about to delete data, drop a table, or force-push.
- Tests fail in code you don't own.

## 6. Definition of done

A task is done when:

- [ ] It does what the backlog item's acceptance criteria say.
- [ ] Tests cover it, and `make lint test` passes.
- [ ] For UI: every item in README → Accessibility is checked, including a VoiceOver or TalkBack run of the screen's main task. The PR includes a screenshot and a note on the accessibility check.
- [ ] README and contracts still match the code.
- [ ] The `TODO(<tag>)` it resolves is deleted.

## 7. Code conventions

**TypeScript (app, scripts).** Strict mode, no `any`. Function components and hooks. Import with `@/` paths. Shared types go in `lib/types.ts`. Format and lint with the Expo ESLint config.

**Go (routing).** `gofmt`, `go vet` clean. Return errors and wrap them with context (`fmt.Errorf("load edges: %w", err)`). No package-level state except what `cmd/server` wires up. Table-driven tests.

**SQL (migrations).** Lowercase keywords, `snake_case`, schema-qualified names (`public.alerts`). Every new table gets `enable row level security` in the same migration.

**Comments.** Explain why, not what. Keep them short.

## 8. Milestones

| Milestone | Done when |
|---|---|
| **M0: Boilerplate** (done) | Repo scaffolded, CI config, contracts stubbed, `go test` and `pnpm test` pass |
| **M1: Walking skeleton** | Sign in → map shows seeded alerts and elevators → request a route → a walking route draws on the map |
| **M2: v1 features** | Every README → Scope and roadmap v1 item works end to end in the demo zone |
| **M3: Study-ready** | Accessibility checklist passes on every screen, demo mode is reliable, usability tasks run start to finish |

Each workstream file lists its tasks by milestone. Unblock others first: M1 tasks that someone else depends on come before your own M2 work.

## 9. Working in parallel

- **Mock until the real thing lands.** AGENT1 builds against fixtures in `apps/mobile/lib/fixtures.ts` until AGENT2's endpoints and AGENT3's RPCs are ready, then swaps them out.
- **Contracts first.** If you own a contract, ship its shape (even with a fake implementation) before its logic.
- **Hand-offs go in the PR.** When your PR unblocks someone, say so in its description: "Unblocks AGENT1: `vote_alert` is live."
- **Structural changes get a decision record** in `docs/decisions/`, using `0000-template.md`.
