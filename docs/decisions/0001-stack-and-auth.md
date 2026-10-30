# 0001. Stack: Expo, Clerk, Supabase, Go routing service

- Status: accepted
- Date: 2026-10-29
- Owner: platform

## Context

ClearPath needs a cross-platform mobile app, sign-in, a database with geospatial queries and realtime updates (R1, R2, R5), photo uploads (R4), and profile-aware routing over a small campus graph (R3).

## Decision

- **Expo SDK 58** (React Native, TypeScript, Expo Router) for the app.
- **Clerk** is the only identity provider. Supabase trusts it as a third-party auth provider and the Go service verifies its session tokens. The custom claim is `app_role`, because Supabase reserves `role` for the Postgres role.
- **Supabase** (Postgres + PostGIS, Realtime, Storage) holds all app data. RLS keys off `auth.jwt() ->> 'sub'`.
- **Go routing service** keeps the graph in memory and runs A* per request. The graph is hundreds of edges, so there's no need for pgRouting or a precomputed index.

## Consequences

- No Supabase users table. Every user-owned row stores the Clerk user ID as `text`.
- The app reads alerts through the `alerts_feed` view, since PostgREST returns geography as WKB.
- Two places verify the same token (Supabase and Go), so a Clerk session-token change affects both.
