# 0005. Figtree and SVG icons from the Figma prototype

- Status: proposed
- Date: 2026-10-30
- Owner: Frontend (AGENT1)

## Context

The mobile screens now follow the ClearPath Figma prototype (R6: the app has to be clear and usable on its own).
The prototype sets every screen in Figtree and draws its icons as SVGs in its component library.
React Native renders neither on its own: it has no web fonts, and its `Image` doesn't draw SVG.

## Decision

Add three Expo SDK 58 packages, installed with `expo install` so the versions match the SDK:

- `@expo-google-fonts/figtree`: the Figtree font files (400, 600, 700, 800 weights are loaded).
- `expo-font`: loads them in the root layout before the first screen renders. A failed load falls back to the system font instead of blocking the app.
- `expo-image`: renders the exported Figma SVGs in `assets/icons/` through one `Icon` component. Metro already treats `.svg` as an asset, so no transformer or Metro config change is needed.

`expo-image` was chosen over `react-native-svg` plus a transformer because it needs no Metro or Jest config, also handles the reporters' photos on alert detail, and keeps the icon files exactly as Figma exported them.

## Consequences

- New icons come from the Figma file into `assets/icons/` and get a line in `components/Icon.tsx`. Don't hand-draw replacements.
- Colors in `lib/theme.ts` now come from the Figma variables. Status and outline colors that the design leaves below WCAG contrast (the unselected radio ring) use `colors.border` instead, for R6.
- Font loading adds a short blank frame on cold start.
