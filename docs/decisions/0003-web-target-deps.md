# 0003. Add react-native-web and react-dom for the Expo web target

- Status: accepted
- Date: 2026-10-30
- Owner: frontend

## Context

`expo start --web` and `expo export --platform web` fail without `react-native-web`
and `react-dom` installed; Expo only bundles them on request, it doesn't vendor
them. Nothing else in `apps/mobile` changes platform targets.

## Decision

Add `react-native-web` and `react-dom` as dependencies, pinned with the same `~`
range Expo's other SDK-aligned packages use (`react-native-web: ~0.21.4`), so web
bundling and simulator/device testing both work from a clean checkout.

## Consequences

- One more platform (web) to keep bundling, though nothing in-app targets it
  specifically yet; `react-native-maps` and other native-only modules still need
  their usual web fallbacks if a screen is ever rendered there for real.
- `react-dom` version must track `react`'s major version on every Expo SDK bump.
