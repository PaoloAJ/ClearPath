# Demo readiness

Reviewed October 30, 2026. Requirements: R1–R6.

## Verified

- Docker and local Supabase are running. Studio: http://127.0.0.1:54323.
- Existing local data contains 568 nodes, 774 edges, four active alerts, and enabled demo RPCs. No reset or photo deletion was needed.
- `make lint test` passes: 64 mobile tests, ESLint, TypeScript, Go vet, and Go tests.
- `supabase test db` passes all 68 assertions against the existing database.
- Backend demo mode and development fixture preview use separate flags. Storage assertions tolerate unrelated local uploads. Elevator alert-query errors are surfaced.

## Finish before presenting

1. Fill in Clerk keys privately in `apps/mobile/.env` and `services/routing/.env`. Both files already contain local service settings on this machine. Enable the real Clerk domain in local Supabase as described in the README, then restart Supabase to apply that configuration.
2. Use current main after the demo UI PR is merged. Run `pnpm install --frozen-lockfile` if dependencies changed, then `make dev`.
3. Keep `EXPO_PUBLIC_DEMO_MODE=true` and `EXPO_PUBLIC_FIXTURE_PREVIEW=false`. The former starts simulated navigation; the latter preserves real authentication and backend screens.
4. Complete [the phone smoke check](smoke-check.md), then rehearse [the presentation script](demo-script.md). A reset deletes data, so confirm the dedicated database may be discarded before running reset commands.
5. Complete phone, largest-font, VoiceOver, and TalkBack checks. Automated checks do not establish accessibility acceptance.

## Known limits

The complete logo demo panel, elevator-toggle/reset UI, and map Realtime subscription remain pending. Navigation exposes **Demo: add an alert ahead** and has its own Realtime subscription; the map supports pull to refresh. Backend barrier refresh defaults to 15 seconds.

Route checks conservatively include all trip edges until arrival because per-edge geometry boundaries are absent from the API. Alerts behind the user may trigger warnings. This avoids discarding an unevenly sized edge still ahead.

Full authenticated phone verification remains blocked on Clerk credentials/domain. No phone rehearsal or accessibility run has been claimed.
