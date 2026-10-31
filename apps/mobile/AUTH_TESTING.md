# Email-code authentication (R6)

The sign-in and sign-up screens use the existing Clerk provider and its current
email-code APIs. Returning users go to Map; new accounts go to Profile. Map and
Profile are still placeholders owned by subsequent M1 tasks. No profile row is
created by authentication.

## Configuration

1. From the repository root, run `pnpm install --frozen-lockfile`.
2. If `apps/mobile/.env` does not exist, copy `apps/mobile/.env.example` to it.
   Keep any existing configuration. Fill in all required values locally; the
   shared environment loader requires Clerk, Supabase, and routing values even
   for the authentication screens.
3. Get the Clerk **publishable** key from the project's Clerk dashboard or Agent 4.
   Never put the Clerk secret key in the mobile app or share secrets in chat.
4. In Clerk's authentication settings, enable email address sign-up, verification
   at sign-up using an email code, and email-code sign-in. Disable required
   passwords and other required sign-up fields for this passwordless demo.
   Additional authentication factors or requirements are reported as an
   incomplete flow; this screen does not implement those steps.
5. Set Supabase URL and anon/publishable key, and the routing URL, using Agent 4's
   project configuration. Physical phones need reachable LAN or hosted URLs.
6. Run `pnpm --filter @clearpath/mobile start --clear` and open it in a compatible
   Expo Go client or Android emulator.

Clerk needs internet access. These auth screens do not query Supabase or the
routing service yet. Do not commit `.env`.

## Automated checks

From the repository root:

```powershell
pnpm --filter @clearpath/mobile lint
pnpm --filter @clearpath/mobile typecheck
pnpm --filter @clearpath/mobile test --runInBand
```

Run `make lint test` as well where Make and Go are available. Tests mock Clerk;
they do not create real accounts or prove email delivery works.

## Manual checks still required

- Create an account with a new test email, request the code, and verify it.
  Expect the Profile placeholder. Map remains available from its tab.
- For returning-user testing, use a clean app session or revoke the test session
  in Clerk and restart the app. Request a new code on Sign in, verify it, and
  expect the Map placeholder. The app's sign-out UI is a later backlog item.
- Try an incorrect or expired code, then a correct code. Check that an error
  appears and retry works. Test resend and changing the email address.
- Disable network access during a request, restore it, and retry.
- Restart the app after signing in; the existing secure token cache should keep
  the session until Clerk expires or revokes it.
- Complete both flows using VoiceOver and TalkBack. Verify labels, code-entry
  focus, spoken error/status messages, keyboard access, and navigation order.
- Check the largest font size and a small screen with the keyboard open. All
  controls should remain reachable by scrolling and text should not clip.
- Verify 48-point touch targets, contrast, and Reduce Motion. These screens add
  no animation. Capture screenshots on the device for the eventual UI PR.

The backlog item must stay unchecked until real Clerk and device accessibility
checks pass. Profile persistence and a functioning map are separate M1 work.
