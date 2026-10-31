# Demo script

For the final presentation. About 5 minutes: one elevator check, one route, one mid-route alert, one report. Every step runs in demo mode, so it plays out the same way each time.

## Setup (before the room fills)

- [ ] [Smoke check](smoke-check.md) passed today on the presenting phone.
- [ ] `EXPO_PUBLIC_DEMO_MODE=true` in the app's env. On a hosted project, also run `update private.app_settings set demo_enabled = true;` (and set it back to `false` afterward).
- [ ] Signed in as the test student. The profile is set to **wheelchair**.
- [ ] Reset the dedicated demo database using the smoke-check instructions (with permission to discard its existing data). The four sample alerts and the verified Marston elevator are back, with fresh ages. Reset deletes every alert, vote, and elevator report, so on a hosted project only use it on one set aside for demos.
- [ ] Phone mirrored to the projector. Notifications silenced. Brightness up.
- [ ] Optional: VoiceOver set as the Accessibility Shortcut (triple-click the side button) for beat 6.

## Beats

| # | Say | Do | Shows |
|---|---|---|---|
| 1 | "In our interviews, students said they find out an elevator is down only when they get there. For a wheelchair user, that can mean backtracking across campus." | Open the app on the map. | I1 |
| 2 | "So before leaving, you check." | Open the **Elevators** tab. Point at Marston: **Working**, **Verified by Facilities**, 20 minutes ago. | R1, R5 |
| 3 | "The shortest route isn't always usable. ClearPath ranks routes for your profile." | Plan Library West → Marston. Point at **For you**, then at the flagged alternative and its reason. | R3 |
| 4 | "Barriers show up mid-route, so the app watches for them." | Start the route; demo mode simulates walking automatically. After a few seconds tap **Demo: add an alert ahead**. The warning appears. Tap **Reroute**. | R2 |
| 5 | "Reporting has to take almost no effort, or nobody does it." | **Report** tab, then **Blocked path** → **Send**: two taps from the report screen. Back on the map, the new pin says *Just now, no confirmations yet*. | R4, R5 |
| 6 | "And the app itself has to be accessible." | Optional: turn on VoiceOver and swipe through the elevator board. Each row is read with its status in words. | R6 |
| 7 | "Alerts expire on their own unless people confirm them, so the map stays honest." | Open the flooding alert south of Library West: its age, one confirmation, and when it expires. | R5 |

Finish on the map. After questions, reset the dedicated demo database using the smoke-check instructions.

## If something breaks

| Problem | Do this |
|---|---|
| Map is empty | Supabase isn't accepting the token. Switch to the screen recording of a rehearsal (keep one on the laptop). |
| No routes come back | The routing service is down or unreachable. Check `/healthz` from the laptop, then fall back to the recording. |
| The warning doesn't appear in beat 4 | The alert landed off the route. Tap **Demo: add an alert ahead** again once the simulated walk has moved. |
| Ages look wrong (alerts missing or hours old) | Reset the dedicated demo database using the smoke-check instructions (with permission to discard its existing data). |
