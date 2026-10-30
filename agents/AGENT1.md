# AGENT1: Frontend

You build the Expo app: every screen a student touches. You are the only workstream writing UI, so the app's accessibility (R6) is yours.

Read first: [AGENTS.md](../AGENTS.md), then README sections **Features**, **Alerts and trust**, **Demo mode**, and **Accessibility**.

## You own

```
apps/mobile/**
```

Don't edit `services/`, `supabase/`, or `data/`. You consume them.

## What's already there

| File | State |
|---|---|
| `app/_layout.tsx` | Clerk provider + root stack, done |
| `app/(auth)/_layout.tsx`, `app/(tabs)/_layout.tsx` | Signed-in / signed-out redirects, done |
| `app/**` other screens | `Placeholder` stubs with a `TODO(frontend)` describing the screen |
| `lib/supabase.ts` | `useSupabase()`: client that sends the Clerk token, done |
| `lib/routing.ts` | `useRoutingApi()`: typed `getRoutes` / `checkRoute`, done |
| `lib/types.ts` | Row and API types + `effectiveMode()`, done (contract, see below) |
| `lib/format.ts` | Alert age / confirmations / distance strings, done + tested |
| `lib/theme.ts` | Colors (contrast-checked), spacing, `MIN_TAP_TARGET` |
| `lib/demo.ts` | `DemoController` interface, not implemented |
| `components/` | `BigButton`, `RouteCard`, `AlertPin` (basic), `Placeholder` (delete when done) |

## Contracts you consume

| From | What | Until it's ready |
|---|---|---|
| AGENT3 | Tables `profiles`, `elevators`, view `alerts_feed`, RPCs `report_alert`, `vote_alert`, `set_elevator_status`, `demo_*` | Use fixtures |
| AGENT3 | Storage bucket `report-photos`, upload path `<user_id>/<uuid>.jpg` | Skip the photo |
| AGENT3 | Realtime on `alerts` and `elevators` | Poll `alerts_feed` |
| AGENT2 | `POST /v1/routes`, `POST /v1/routes/check` | Use fixtures |

Put fixtures in `lib/fixtures.ts`, shaped exactly like `lib/types.ts`, and gate them behind one flag so swapping to real data is a one-line change. Don't change `lib/types.ts` on your own. It mirrors the schema and the Go API (AGENTS.md → Contracts).

## Backlog

### M1: Walking skeleton

- [ ] **Sign in / sign up** with Clerk email code (`useSignIn`, `useSignUp`). After first sign-up, go to profile setup. *Done when:* a new user can create an account and land on the map.
- [ ] **Profile setup** (R3): pick a mode (large labelled options, not a dropdown), save to `profiles` with an upsert. *Done when:* the row exists and reloads on restart.
- [ ] **Map** (R1, R5): `react-native-maps` centered on the demo zone. Read `alerts_feed` and render an `AlertPin` per row. *Done when:* the seeded sample alerts show.
- [ ] **Route request** (R3): pick a destination (start with a list of the four demo buildings), call `getRoutes` with `effectiveMode(profile)`, draw the first route's polyline. *Done when:* a route draws, against fixtures or the real API.

### M2: v1 features

- [ ] **Travel profile, full** (R3): temporary mode with an end date ("crutches for six weeks"), `haptics_only` toggle, sign out. Show the effective mode and when it switches back.
- [ ] **Live map** (R1, R5): Realtime subscription so new alerts appear without refresh. Pins show type, age, confirmations, and a verified badge, in text and not only color.
- [ ] **Map list alternative** (R6): a toggle that shows alerts and elevators as a list, for screen-reader users.
- [ ] **Alert detail** (R5): type, photo (signed URL), age, confirmations, verified badge, expiry, affected routes. **Still there** and **It's cleared** call `vote_alert`. Show the user's own current vote.
- [ ] **Two-tap report** (R4): tap 1 picks the barrier type from big buttons, tap 2 sends. Location from `expo-location`. Optional photo with `expo-image-picker`, uploaded before `report_alert`. Confirm with text and haptics. *Done when:* two taps, no typing, no map interaction required.
- [ ] **Elevator board** (R1, R5): every elevator with status written out ("Working," "Out of service," "Unconfirmed"), last-reported age, and Facilities-verified items in their own section.
- [ ] **Route options** (R3): 2–3 `RouteCard`s. The best fit is tagged **For you**. Routes that don't fit stay visible with their `notes`.
- [ ] **Navigation** (R2): follow the route with `expo-location`. On each new alert from Realtime, call `checkRoute` with the remaining `edge_ids`. If `affected`, show **Reroute** / **Keep route**. For `haptics_only` users, vibrate (`expo-haptics`) and speak (`expo-speech`), and hold the prompt until they stop moving.
- [ ] **Demo mode** (README → Demo mode): implement `lib/demo.ts`. Long-press the logo to open the panel (only when `EXPO_PUBLIC_DEMO_MODE=true`). Simulate walk, inject alert ahead, toggle elevator, reset.

### M3: Study-ready

- [ ] Run the README → Accessibility checklist on **every** screen, with VoiceOver (iOS) and TalkBack (Android). Fix everything.
- [ ] Test at the largest system font size. Nothing clips.
- [ ] Respect Reduce Motion (no animated camera moves when it's on).
- [ ] Rehearse the usability tasks in `docs/research.md` in demo mode with AGENT4.

## Rules for this lane

- **Accessibility is the acceptance test.** Every touchable thing uses `BigButton` or meets `MIN_TAP_TARGET`, and has `accessibilityLabel` (plus `accessibilityHint` when the action isn't obvious).
- **Never color alone.** Every status has words.
- **Speed matters for R4.** Don't add confirmation dialogs, required fields, or typing to the report flow.
- Component tests with React Native Testing Library for the report flow, the alert trust display, and profile switching (README → Testing).
- UI PRs include a screenshot and a line on the accessibility check.

## Hand-offs

- Need a new field or RPC? Ask AGENT3. Need a new route field? Ask AGENT2. Don't work around it in the client.
- Tell AGENT4 when a screen is ready for an accessibility review pass.

## Commands

```bash
cd apps/mobile
cp .env.example .env
pnpm expo start        # scan with Expo Go
pnpm typecheck && pnpm lint && pnpm test
```
