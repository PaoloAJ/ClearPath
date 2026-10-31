# Campus map — R1, R5, R6

## Preview on an iPhone without backend credentials

From the repository root in PowerShell:

```powershell
$env:EXPO_PUBLIC_DEMO_MODE = 'true'
pnpm --filter @clearpath/mobile start --clear --go
```

Scan the terminal QR code with your iPhone on the same Wi-Fi network. Open the
ClearPath logo controls (long press or regular tap) and select **Preview campus
map**. Travel profile remains available through the same menu.

The map starts around Library West, Marston, Turlington, and the CSE Building.
Four invented alerts demonstrate construction, a blocked path, a broken ramp,
and flooding. Neither their positions nor their verification labels represent
real conditions. Fixtures use relative timestamps so they remain visible on
future demo dates. Refresh re-creates the sample scenario. No backend data is
read or written, and no location permission is requested. Basemap tiles may
still need an internet connection; the alert list works without tiles.

## Check on the phone

- See four alerts and the demo building markers. Pan and zoom the map.
- Tap an alert to see its type, age, confirmation count, and verification status
  below the map. Pins can overlap; the list provides access to every alert.
- Tap **Show alert list**. All four alerts appear in separate Facilities verified
  and student-report sections. Tap **Show map** to return.
- Use VoiceOver to read both sections and operate the view toggle and refresh.
  Starting the screen with a screen reader enabled automatically opens the list.
- Test largest system fonts and Reduce Motion. Everything outside the map can
  scroll; no camera animation or automatic recentering is introduced.
- Capture an iPhone screenshot for the eventual UI PR. TalkBack also needs a
  device review. Neither native map gestures nor manual accessibility are
  validated by the mocked-map component tests.

## Real integration and remaining work

With demo preview off, the signed-in Map tab reads `alerts_feed` through the
existing Clerk-authenticated Supabase client. Refresh reloads it. This query
still needs live Supabase/RLS testing. Resolved and expired alerts are hidden;
displayed ages and expiry filtering update every 30 seconds while mounted.

Realtime updates, elevator markers/list, full alert details and voting,
destination selection, and route drawing remain unfinished. This screen is not
the navigation feature, and the M1 map item should remain unchecked until live
sample data and device accessibility have been verified.

Automated checks from the repository root:

```powershell
pnpm lint
pnpm typecheck
pnpm test -- --runInBand
```

Full `make lint test` additionally requires Make and Go. No dependency changes
are needed for this screen.
