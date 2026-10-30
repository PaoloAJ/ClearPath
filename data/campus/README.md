# Campus graph

`nodes.geojson` and `edges.geojson` are the demo-zone graph that routing runs on. `import.ts` turns them into `supabase/seed.sql`. Never edit `seed.sql` by hand. Edit the GeoJSON, then run `make seed`.

## Where the data came from

The walkable paths were traced from [OpenStreetMap](https://www.openstreetmap.org/) on 2026-10-30 (see [decision 0002](../../docs/decisions/0002-bootstrap-graph-from-osm.md)):

- Public footways, paths, steps, and cycleways in the box 29.6474–29.6522 N, 82.3452–82.3418 W (Library West to Marston and CSE, including Turlington).
- Split at every intersection and building entrance, keeping only the connected network.
- OSM tags mapped to our fields: `highway=steps` → `stairs`, `incline=N%` → `slope_pct`, `surface` → `paved` / `brick` / `gravel` / `grass`, `bicycle=no|dismount` → `bike_ok=false`.
- Every feature keeps `osm_node` or `osm_way`, so you can look it up at `openstreetmap.org/node/<id>` or `/way/<id>`.

The Marston elevator node and its two edges were added by hand. OSM has the elevator bank but doesn't connect it to the entrances.

**License.** Map data © OpenStreetMap contributors, available under the [Open Database License](https://opendatacommons.org/licenses/odbl/). Because this graph is derived from OSM, the graph data in this folder is also under ODbL. Keep this notice.

## What still needs a walk

OSM is a starting point, not ground truth. Anything with `needs_survey` hasn't been checked in person:

| Flag | Meaning | Count |
|---|---|---|
| `slope` | No `incline` tag in OSM, so `slope_pct` defaulted to 0 | 190 edges |
| `surface` | No `surface` tag in OSM, so it defaulted to `paved` | 23 edges |
| `elevator_connection` | The Marston elevator's links to the level −1 and level 0 entrances are a best guess | 1 node, 2 edges |

Also worth checking on the walk:

- **Curb cuts and ramps.** OSM rarely marks a missing curb cut. A missing one should become `stairs: true` on that edge.
- **Steep segments.** For anything that feels steep, measure the grade (a phone level app works) and set `slope_pct`. Positive means uphill from `source` to `target`.
- **Entrances.** `osm_wheelchair` on entrance nodes is OSM's claim. Confirm it.
- **Library West's raised plaza** (`floor: 1` entrances). Check which approaches are step-free.

When you verify a feature, fix its fields and remove the flag from `needs_survey` (or the whole property when it's empty).

## Sample demo state

`samples.json` holds the elevator statuses and alerts that `make seed` loads on top of the graph: four alerts covering the trust states the app has to show (fresh with no confirmations, confirmed, older, and a verified Facilities post) and the Marston elevator as working and verified 20 minutes ago. Ages and expiry times are relative to when you run `make seed`, so reseed if local alerts have expired. Alert IDs are fixed (`00000000-0000-4000-8000-00000000000N`), so tests and demo scripts can refer to them.

## Editing

Open the GeoJSON in [geojson.io](https://geojson.io) or QGIS. Each feature sits on its own line, so diffs stay readable. Keep that format when you save. `make seed` fails with a list of problems if an edit breaks the graph: duplicate IDs, unknown enum values, edge ends that don't sit on their nodes, orphan nodes, a disconnected graph, or elevator edges without an elevator.
