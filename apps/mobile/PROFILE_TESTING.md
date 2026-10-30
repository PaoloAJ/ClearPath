# Travel profile preview — R3, R6

## Preview without credentials

From the repository root in PowerShell:

```powershell
$env:EXPO_PUBLIC_DEMO_MODE = 'true'
pnpm --filter @clearpath/mobile start --clear
```

This overrides the existing demo setting for this terminal only. It does not
change `.env` or any shared Clerk settings. No Clerk, Supabase, or routing
credentials are needed for this preview. Scan Expo's QR code on your iPhone
with a compatible Expo Go client on the same Wi-Fi network.

Long-press **ClearPath** (a regular tap also works for accessibility), then tap
**Preview travel profile**. Choose a mode and save. Change modes and verify only
one is selected. Restart the app and reopen the screen to check the selection
reloads. Open the logo controls and choose **Reset sample profile** to restore
Walking. Reset only touches the local sample profile, not backend/demo tables.

All six travel modes are available as large labelled options. Selected options
have both written status and screen-reader checked state. Save confirmation
explicitly says this is sample data. Local sample storage uses the existing
Expo SecureStore package and is separate from Clerk tokens and real profiles.

To return to the real authentication flow, stop Expo, then run:

```powershell
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
pnpm --filter @clearpath/mobile start --clear
```

Real authentication still requires the configuration described in AUTH_TESTING.md.
Release builds always use real authentication even with the demo flag enabled.
The development preview replaces the app entry screen while active; it does not
create a fake Clerk session or grant access to backend data.

## Integration status

- The real Profile tab loads the signed-in user's `profiles` row and upserts the
  selected mode, preserving existing temporary mode and notification preferences.
- Those Supabase calls are implemented but still need live Clerk/Supabase/RLS
  verification, including restart persistence. Sample saves do not verify them.
- Map, routing, temporary mode editing, notification preferences, and sign-out
  remain later backlog work. The sample reset is not the full demo controller.
- The M1 task stays unchecked until live persistence and accessibility pass.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test -- --runInBand
```

Make and Go are also needed for the repository-wide `make lint test` command.
Before calling the screen done, manually test on VoiceOver and TalkBack, at the
largest font size, in Reduce Motion, and on a small screen. Check all controls
remain reachable and save/error announcements are spoken. Capture a device
screenshot for the eventual UI PR. Device accessibility and live backend tests
have not been completed by automated component tests.
