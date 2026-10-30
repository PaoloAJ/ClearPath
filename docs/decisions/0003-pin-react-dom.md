# 0003. Pin the React DOM peer to Expo's React version

- Status: proposed
- Date: 2026-10-30
- Owner: Frontend (AGENT1); platform review required

## Context

Expo SDK 58.0.21 specifies React and React DOM 19.3.0. React was pinned,
but pnpm automatically installed React DOM 19.3.1 for Clerk and Expo peer
dependencies. Importing Clerk threw an incompatible React versions error,
preventing the mobile screens from loading (R6).

## Decision

Declare `react-dom` as an exact `19.3.0` mobile dependency, matching the installed
Expo SDK compatibility map, and regenerate the lockfile with pnpm. Keep the
existing React, React Native, Expo, and Clerk versions.

## Consequences

Peer resolution uses the matching renderer. No screen or authentication changes
are required for this mismatch. Future Expo upgrades must keep React and React
DOM aligned. This pin does not add web-preview support.
