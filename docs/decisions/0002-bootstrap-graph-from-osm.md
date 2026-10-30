# 0002. Bootstrap the demo-zone graph from OpenStreetMap

- Status: accepted
- Date: 2026-10-30
- Owner: data

## Context

v1 called for a hand-mapped graph of the demo zone (README → Scope and roadmap), and listed bootstrapping from OpenStreetMap as a "Later" item for the rest of campus. Drawing hundreds of edges by hand in geojson.io is slow, and routing (AGENT2) and the map (AGENT1) need a realistic graph early to build against (R3).

OSM already maps this part of campus in detail: footways with `incline`, `surface`, `wheelchair`, and `bicycle` tags, mapped steps, building entrances with levels, and Marston's elevator bank.

## Decision

Trace the demo-zone graph from OSM once, then treat `data/campus/*.geojson` as ours. There's no live sync with OSM. In-person survey corrections go into the GeoJSON.

- Every feature keeps its `osm_node` / `osm_way` ID for traceability.
- Fields OSM didn't provide are flagged with `needs_survey` instead of guessed.
- The Marston elevator connection is added by hand and flagged.
- The graph data is under ODbL, with attribution in `data/campus/README.md`.

## Consequences

- AGENT2 gets a 568-node, 774-edge graph with real stairs, brick surfaces, and an elevator alternative now, instead of after a survey.
- The survey becomes a verification pass over flagged features instead of drawing from scratch.
- Slopes default to 0% where OSM has no `incline` (190 edges). Until they're surveyed, wheelchair routing may underrate steep paths. Usability testing shouldn't rely on slope penalties in those areas.
- ODbL share-alike applies to the graph data in `data/campus/`, but not to the app's code.
