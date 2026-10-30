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
//
// samples.json: demo state on top of the graph (README → Alerts and trust)
//   elevators: { elevator_id, status: "working" | "out" | "unconfirmed", verified, reported_minutes_ago }
//   alerts: { id (uuid), type, lat, lng, radius_m, minutes_ago, confirmations, verified?, note? }
//   Student alerts expire 4 h after the latest report or confirmation (confirmations are
//   placed halfway between the report and now). Verified alerts are facilities posts: no expiry.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Position = [number, number];
type Props = Record<string, unknown>;
type Feature<G> = { type: 'Feature'; properties: Props; geometry: G };
type Collection<G> = { type: 'FeatureCollection'; features: Feature<G>[] };
type Point = { type: 'Point'; coordinates: Position };
type LineString = { type: 'LineString'; coordinates: Position[] };

type ElevatorSample = { elevator_id: number; status: string; verified: boolean; reported_minutes_ago: number };
type AlertSample = {
  id: string;
  type: string;
  lat: number;
  lng: number;
  radius_m: number;
  minutes_ago: number;
  confirmations: number;
  verified?: boolean;
  note?: string;
};
type Samples = { elevators: ElevatorSample[]; alerts: AlertSample[] };

const NODE_KINDS = new Set(['entrance', 'junction', 'elevator']);
const SURFACES = new Set(['paved', 'brick', 'gravel', 'grass']);
// Edge ends must sit on their nodes. 1 m catches drawing mistakes without flagging rounding.
const ENDPOINT_TOLERANCE_M = 1;
const ELEVATOR_STATUSES = new Set(['working', 'out', 'unconfirmed']);
const ALERT_TYPES = new Set(['construction', 'elevator_out', 'blocked_path', 'flooding', 'broken_ramp', 'other']);
const ALERT_TTL_MINUTES = 4 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, '../../supabase/seed.sql');

const nodes = read<Point>('nodes.geojson');
const edges = read<LineString>('edges.geojson');
const samples = JSON.parse(readFileSync(join(here, 'samples.json'), 'utf8')) as Samples;

check();
writeFileSync(seedPath, render());
console.log(
  `wrote ${seedPath}: ${nodes.features.length} nodes, ${edges.features.length} edges, ` +
    `${samples.alerts.length} sample alerts`,
);

function read<G>(file: string): Collection<G> {
  return JSON.parse(readFileSync(join(here, file), 'utf8')) as Collection<G>;
}

/** Collects every graph problem, then fails once with the full list. */
function check() {
  const errors: string[] = [];
  const nodeById = new Map<unknown, Feature<Point>>();
  const elevatorIds = new Set<unknown>();

  for (const n of nodes.features) {
    const p = n.properties;
    if (nodeById.has(p.id)) errors.push(`node ${p.id}: duplicate id`);
    nodeById.set(p.id, n);
    if (!NODE_KINDS.has(String(p.kind))) errors.push(`node ${p.id}: unknown kind ${JSON.stringify(p.kind)}`);
    if (p.kind === 'elevator') {
      if (p.elevator_id == null || !p.elevator_name || !p.building) {
        errors.push(`node ${p.id}: elevator nodes need elevator_id, elevator_name, and building`);
      }
      if (elevatorIds.has(p.elevator_id)) errors.push(`node ${p.id}: duplicate elevator_id ${p.elevator_id}`);
      elevatorIds.add(p.elevator_id);
    }
  }

  const edgeIds = new Set<unknown>();
  const adjacency = new Map<unknown, unknown[]>();
  const link = (a: unknown, b: unknown) => adjacency.set(a, [...(adjacency.get(a) ?? []), b]);

  for (const e of edges.features) {
    const p = e.properties;
    if (edgeIds.has(p.id)) errors.push(`edge ${p.id}: duplicate id`);
    edgeIds.add(p.id);
    if (p.surface != null && !SURFACES.has(String(p.surface))) {
      errors.push(`edge ${p.id}: unknown surface ${JSON.stringify(p.surface)}`);
    }
    if (p.elevator_id != null && !elevatorIds.has(p.elevator_id)) {
      errors.push(`edge ${p.id}: elevator_id ${p.elevator_id} has no elevator node`);
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

  const [start] = nodeById.keys();
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

  const lngs = nodes.features.map((n) => n.geometry.coordinates[0]);
  const lats = nodes.features.map((n) => n.geometry.coordinates[1]);
  const inZone = (lat: number, lng: number) =>
    lat >= Math.min(...lats) && lat <= Math.max(...lats) && lng >= Math.min(...lngs) && lng <= Math.max(...lngs);

  for (const e of samples.elevators) {
    if (!elevatorIds.has(e.elevator_id)) errors.push(`samples: elevator ${e.elevator_id} has no elevator node`);
    if (!ELEVATOR_STATUSES.has(e.status)) errors.push(`samples: elevator ${e.elevator_id} has unknown status ${JSON.stringify(e.status)}`);
  }
  const alertIds = new Set<string>();
  for (const a of samples.alerts) {
    if (!UUID.test(a.id)) errors.push(`samples: alert ${a.id} is not a uuid`);
    if (alertIds.has(a.id)) errors.push(`samples: alert ${a.id} is duplicated`);
    alertIds.add(a.id);
    if (!ALERT_TYPES.has(a.type)) errors.push(`samples: alert ${a.id} has unknown type ${JSON.stringify(a.type)}`);
    if (!inZone(a.lat, a.lng)) errors.push(`samples: alert ${a.id} is outside the demo zone`);
    if (!a.verified && a.minutes_ago >= ALERT_TTL_MINUTES) {
      errors.push(`samples: alert ${a.id} would already be expired (${a.minutes_ago} min old, unverified)`);
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

  out.push('', '-- Sample demo state (samples.json)');

  for (const e of samples.elevators) {
    const reportedAt = `now() - interval '${num(e.reported_minutes_ago)} minutes'`;
    const reporter = e.verified ? 'seed_facilities' : 'seed_student_1';
    out.push(
      `update public.elevators set status = ${str(e.status)}, verified = ${bool(e.verified)}, last_reported_at = ${reportedAt} where id = ${num(e.elevator_id)};`,
      `insert into public.elevator_reports (elevator_id, status, reported_by, verified, created_at) values (${num(e.elevator_id)}, ${str(e.status)}, ${str(reporter)}, ${bool(e.verified)}, ${reportedAt});`,
    );
  }

  for (const a of samples.alerts) {
    if (a.note) out.push(`-- ${a.note}`);
    const createdAgo = a.minutes_ago;
    const lastActivityAgo = a.confirmations > 0 ? Math.floor(createdAgo / 2) : createdAgo;
    const expiresAt = a.verified
      ? `'infinity'`
      : `now() + interval '${ALERT_TTL_MINUTES - lastActivityAgo} minutes'`;
    out.push(
      `insert into public.alerts (id, type, geom, created_by, verified, created_at, expires_at) values (` +
        [
          str(a.id),
          str(a.type),
          `extensions.st_buffer(${point([a.lng, a.lat])}::extensions.geography, ${num(a.radius_m)})`,
          str(a.verified ? 'seed_facilities' : 'seed_student_1'),
          bool(a.verified),
          `now() - interval '${num(createdAgo)} minutes'`,
          expiresAt,
        ].join(', ') +
        ');',
    );
    for (let i = 1; i <= a.confirmations; i++) {
      out.push(
        `insert into public.alert_votes (alert_id, user_id, kind, created_at) values (${str(a.id)}, ${str(`seed_student_${i + 1}`)}, 'still_there', now() - interval '${lastActivityAgo} minutes');`,
      );
    }
  }

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
