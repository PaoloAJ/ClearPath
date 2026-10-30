// GeoJSON → supabase/seed.sql. Run with `make seed` (or `pnpm seed:build` to only rebuild the file).
//
// nodes.geojson: Point features
//   id: number, kind: "entrance" | "junction" | "elevator", building?: string, floor?: number
//   elevator nodes also carry elevator_id: number, elevator_name: string ("Marston, east elevator")
// edges.geojson: LineString features, coordinates running from source to target
//   id, source, target: number, slope_pct: number (signed), stairs, indoor, bike_ok: boolean,
//   surface: "paved" | "brick" | "gravel" | "grass", elevator_id?: number
// length_m is computed here from the geometry.
//
// Ignored by the import, kept for provenance (see data/campus/README.md):
//   osm_node / osm_way: the OpenStreetMap feature it was traced from
//   osm_wheelchair: the OSM wheelchair tag on an entrance ("yes" | "limited" | "no")
//   needs_survey: fields not yet checked in person, e.g. ["slope", "surface"]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Position = [number, number];
type Props = Record<string, unknown>;
type Feature<G> = { type: 'Feature'; properties: Props; geometry: G };
type Collection<G> = { type: 'FeatureCollection'; features: Feature<G>[] };
type Point = { type: 'Point'; coordinates: Position };
type LineString = { type: 'LineString'; coordinates: Position[] };

const NODE_KINDS = new Set(['entrance', 'junction', 'elevator']);
const SURFACES = new Set(['paved', 'brick', 'gravel', 'grass']);
// Edge ends must sit on their nodes. 1 m catches drawing mistakes without flagging rounding.
const ENDPOINT_TOLERANCE_M = 1;

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, '../../supabase/seed.sql');

const nodes = read<Point>('nodes.geojson');
const edges = read<LineString>('edges.geojson');

check();
writeFileSync(seedPath, render());
console.log(`wrote ${seedPath}: ${nodes.features.length} nodes, ${edges.features.length} edges`);

function read<G>(file: string): Collection<G> {
  return JSON.parse(readFileSync(join(here, file), 'utf8')) as Collection<G>;
}

/** Collects every graph problem, then fails once with the full list. */
function check() {
  const errors: string[] = [];
  const nodeById = new Map<unknown, Feature<Point>>();
  const elevatorIds = new Set<unknown>();
  const elevatorNode = new Map<unknown, unknown>(); // elevator_id → node id

  for (const n of nodes.features) {
    const p = n.properties;
    if (nodeById.has(p.id)) errors.push(`node ${p.id}: duplicate id`);
    nodeById.set(p.id, n);
    if (!NODE_KINDS.has(String(p.kind))) errors.push(`node ${p.id}: unknown kind ${JSON.stringify(p.kind)}`);
    if (p.kind === 'elevator') {
      if (p.elevator_id == null || !p.elevator_name || !p.building) {
        errors.push(`node ${p.id}: elevator nodes need elevator_id, elevator_name, and building`);
      }
      if (p.elevator_id != null) {
        if (elevatorIds.has(p.elevator_id)) errors.push(`node ${p.id}: duplicate elevator_id ${p.elevator_id}`);
        elevatorIds.add(p.elevator_id);
        elevatorNode.set(p.elevator_id, p.id);
      }
    }
  }

  const edgeIds = new Set<unknown>();
  const adjacency = new Map<unknown, unknown[]>();
  const link = (a: unknown, b: unknown) => {
    const list = adjacency.get(a);
    if (list) list.push(b);
    else adjacency.set(a, [b]);
  };

  for (const e of edges.features) {
    const p = e.properties;
    if (edgeIds.has(p.id)) errors.push(`edge ${p.id}: duplicate id`);
    edgeIds.add(p.id);
    if (p.surface != null && !SURFACES.has(String(p.surface))) {
      errors.push(`edge ${p.id}: unknown surface ${JSON.stringify(p.surface)}`);
    }
    for (const key of ['stairs', 'indoor', 'bike_ok'] as const) {
      if (typeof p[key] !== 'boolean') errors.push(`edge ${p.id}: ${key} must be true or false, got ${JSON.stringify(p[key])}`);
    }
    if (typeof p.slope_pct !== 'number') errors.push(`edge ${p.id}: slope_pct must be a number`);
    if (p.elevator_id != null) {
      const at = elevatorNode.get(p.elevator_id);
      if (at === undefined) {
        errors.push(`edge ${p.id}: elevator_id ${p.elevator_id} has no elevator node`);
      } else if (p.source !== at && p.target !== at) {
        errors.push(`edge ${p.id}: elevator_id ${p.elevator_id} but doesn't touch elevator node ${at}`);
      }
    }

    const coords = e.geometry.coordinates;
    const ends = [
      ['source', coords[0]],
      ['target', coords[coords.length - 1]],
    ] as const;
    for (const [end, at] of ends) {
      const node = nodeById.get(p[end]);
      if (!node) {
        errors.push(`edge ${p.id}: ${end} ${p[end]} is not a node`);
      } else if (!at || haversine(at, node.geometry.coordinates) > ENDPOINT_TOLERANCE_M) {
        errors.push(`edge ${p.id}: geometry doesn't start/end at its ${end} node ${p[end]}`);
      }
    }
    link(p.source, p.target);
    link(p.target, p.source);
  }

  for (const [id, n] of nodeById) {
    if (!adjacency.has(id)) {
      errors.push(`node ${id}: orphan (no edges)${n.properties.kind === 'elevator' ? ', elevator is unreachable' : ''}`);
    }
  }

  // Start from a node with edges, so one orphan doesn't make the whole graph look disconnected.
  const start = [...nodeById.keys()].find((id) => adjacency.has(id));
  if (start !== undefined) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const next of adjacency.get(queue.pop()) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    const unreachable = [...nodeById.keys()].filter((id) => !seen.has(id) && adjacency.has(id));
    if (unreachable.length) {
      errors.push(`graph is disconnected: ${unreachable.length} nodes unreachable from node ${start} (e.g. ${unreachable.slice(0, 5).join(', ')})`);
    }
  }

  if (errors.length) {
    console.error(`campus graph has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
}

function render(): string {
  const out = [
    '-- Generated by data/campus/import.ts. Do not edit by hand; edit the GeoJSON and run `make seed`.',
    '',
    'truncate public.alert_votes, public.alerts, public.elevator_reports, public.edges, public.elevators, public.nodes restart identity cascade;',
    '',
  ];

  for (const f of nodes.features) {
    const p = f.properties;
    out.push(
      `insert into public.nodes (id, geom, kind, building, floor) values (${num(p.id)}, ${point(f.geometry.coordinates)}, ${str(p.kind)}, ${str(p.building)}, ${num(p.floor)});`,
    );
  }

  for (const f of nodes.features.filter((n) => n.properties.kind === 'elevator')) {
    const p = f.properties;
    out.push(
      `insert into public.elevators (id, building, name, node_id) values (${num(p.elevator_id)}, ${str(p.building)}, ${str(p.elevator_name)}, ${num(p.id)});`,
    );
  }

  for (const f of edges.features) {
    const p = f.properties;
    const coords = f.geometry.coordinates;
    out.push(
      `insert into public.edges (id, source, target, geom, length_m, slope_pct, stairs, surface, indoor, bike_ok, elevator_id) values (` +
        [
          num(p.id),
          num(p.source),
          num(p.target),
          line(coords),
          lengthMeters(coords).toFixed(1),
          num(p.slope_pct ?? 0),
          bool(p.stairs),
          str(p.surface ?? 'paved'),
          bool(p.indoor),
          bool(p.bike_ok ?? true),
          num(p.elevator_id),
        ].join(', ') +
        ');',
    );
  }

  // TODO(data): sample alerts and elevator statuses for the demo zone.
  return out.join('\n') + '\n';
}

function str(v: unknown): string {
  return v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`;
}

function num(v: unknown): string {
  if (v == null) return 'null';
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`expected a number, got ${JSON.stringify(v)}`);
  return String(v);
}

function bool(v: unknown): string {
  return v ? 'true' : 'false';
}

function point([lng, lat]: Position): string {
  return `'SRID=4326;POINT(${lng} ${lat})'`;
}

function line(coords: Position[]): string {
  return `'SRID=4326;LINESTRING(${coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ')})'`;
}

function lengthMeters(coords: Position[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1]!, coords[i]!);
  return total;
}

function haversine([lng1, lat1]: Position, [lng2, lat2]: Position): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
