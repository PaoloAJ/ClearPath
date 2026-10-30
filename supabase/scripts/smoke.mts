// API smoke test: calls the database the way the app does (PostgREST + Storage over HTTP) and
// checks the contracts in AGENTS.md → Contracts. See supabase/README.md → Smoke test.
//
// Local (signs test tokens with the local JWT secret):
//   eval "$(supabase status -o env)" && pnpm tsx supabase/scripts/smoke.mts
// Hosted (uses a real Clerk session token; read-only unless --write):
//   API_URL=https://<ref>.supabase.co ANON_KEY=... TOKEN=<clerk session token> pnpm tsx supabase/scripts/smoke.mts
//
// --write runs the checks that create data: a report, a vote, an elevator status change, a
// photo upload, and the demo RPCs, ending with demo_reset(), which REPLACES ALL ALERTS with the
// sample state. It's on by default only for a local API.

import { createHmac, randomUUID } from 'node:crypto';

const API_URL = required('API_URL');
const ANON_KEY = required('ANON_KEY');
const TOKEN = process.env.TOKEN;
const JWT_SECRET = process.env.JWT_SECRET;
const isLocal = ['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname);
const write = isLocal || process.argv.includes('--write');

if (!TOKEN && !(isLocal && JWT_SECRET)) {
  fail('Set TOKEN to a Clerk session token, or run against a local API with JWT_SECRET set.');
}

// On a local API we can act as several users; with a real token every check runs as that user.
function tokenFor(sub: string): string {
  if (TOKEN) return TOKEN;
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 600 })}`;
  return `${body}.${createHmac('sha256', JWT_SECRET!).update(body).digest('base64url')}`;
}

type Response = { status: number; body: unknown };

async function call(method: string, path: string, opts: { as?: string; json?: unknown; raw?: Buffer; type?: string } = {}): Promise<Response> {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${opts.as ? tokenFor(opts.as) : ANON_KEY}`,
      'Content-Type': opts.type ?? 'application/json',
    },
    body: opts.raw ? new Uint8Array(opts.raw) : opts.json === undefined ? undefined : JSON.stringify(opts.json),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep the raw text
  }
  return { status: res.status, body };
}

let failures = 0;
function check(label: string, ok: boolean, got: Response) {
  if (ok) console.log(`PASS ${label}`);
  else {
    failures++;
    console.log(`FAIL ${label}  [${got.status} ${JSON.stringify(got.body).slice(0, 160)}]`);
  }
}
const okStatus = (r: Response) => r.status >= 200 && r.status < 300;
const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);

// Read checks (safe anywhere) ------------------------------------------------------

let r = await call('GET', '/rest/v1/nodes?select=id&limit=1');
check('signed-out request can read map data', okStatus(r) && Array.isArray(r.body) && r.body.length === 1, r);

r = await call('GET', '/rest/v1/alerts_feed?select=id');
check('signed-out request cannot read alerts', r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0), r);

r = await call('GET', '/rest/v1/alerts_feed?select=id,type,confirmations,verified,lat,lng', { as: 'smoke_student' });
check('signed-in user reads alerts_feed', okStatus(r) && Array.isArray(r.body), r);
const feedBefore = r.body;

r = await call('GET', '/rest/v1/elevators?select=id,name,status,verified', { as: 'smoke_student' });
check('signed-in user reads elevators', okStatus(r) && Array.isArray(r.body) && r.body.length > 0, r);

r = await call('POST', '/rest/v1/alerts', {
  as: 'smoke_student',
  json: { type: 'construction', geom: 'SRID=4326;POLYGON((-82.4 29.6,-82.3 29.6,-82.3 29.7,-82.4 29.6))' },
});
check('direct insert into alerts is refused', r.status === 401 || r.status === 403, r);

// Write checks -------------------------------------------------------------------

if (!write) {
  console.log('\nSkipped write checks (pass --write to run them; see the warning at the top of this file).');
} else {
  const onPath = { lat: 29.6488393, lng: -82.343574 }; // mapped path by Century Tower

  r = await call('POST', '/rest/v1/rpc/report_alert', { as: 'smoke_student', json: { type: 'flooding', ...onPath } });
  check('report_alert returns an alert id', r.status === 200 && isUuid(r.body), r);
  const reported = r.body;

  r = await call('POST', '/rest/v1/rpc/report_alert', { as: 'smoke_student', json: { type: 'flooding', lat: 29.7, lng: -82.3 } });
  check('report_alert refuses a point outside the demo zone', r.status === 400, r);

  r = await call('POST', '/rest/v1/rpc/vote_alert', { as: 'smoke_voter', json: { alert_id: reported, kind: 'still_there' } });
  check('vote_alert accepts a vote', okStatus(r), r);

  r = await call('POST', '/rest/v1/rpc/set_elevator_status', { as: 'smoke_student', json: { elevator_id: 1, status: 'out' } });
  check('set_elevator_status records a report', okStatus(r), r);

  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1000)]);
  const photo = `smoke_student/${randomUUID()}.jpg`;
  if (!TOKEN) {
    r = await call('POST', `/storage/v1/object/report-photos/${photo}`, { as: 'smoke_student', raw: jpeg, type: 'image/jpeg' });
    check('photo upload into your own folder succeeds', r.status === 200, r);

    r = await call('POST', `/storage/v1/object/report-photos/someone_else/${randomUUID()}.jpg`, { as: 'smoke_student', raw: jpeg, type: 'image/jpeg' });
    check("photo upload into someone else's folder is refused", r.status === 400 || r.status === 403, r);

    r = await call('POST', `/storage/v1/object/report-photos/smoke_student/${randomUUID()}.txt`, { as: 'smoke_student', raw: Buffer.from('hi'), type: 'text/plain' });
    check('non-image upload is refused', r.status === 400 || r.status === 415, r);

    r = await call('POST', `/storage/v1/object/report-photos/smoke_student/${randomUUID()}.jpg`, {
      as: 'smoke_student',
      raw: Buffer.concat([jpeg, Buffer.alloc(6 * 1024 * 1024)]),
      type: 'image/jpeg',
    });
    check('upload over 5 MB is refused', r.status === 400 || r.status === 413, r);

    r = await call('POST', '/rest/v1/rpc/report_alert', { as: 'smoke_student', json: { type: 'blocked_path', ...onPath, photo_path: photo } });
    check('report_alert accepts an uploaded photo path', r.status === 200 && isUuid(r.body), r);
  } else {
    console.log('(storage checks skipped with TOKEN: they need two users)');
  }

  r = await call('POST', '/rest/v1/rpc/demo_inject_alert', { as: 'smoke_student', json: onPath });
  if (r.status === 403 && JSON.stringify(r.body).includes('demo mode is off')) {
    console.log('(demo checks skipped: demo mode is off on this project)');
  } else {
    check('demo_inject_alert returns an alert id', r.status === 200 && isUuid(r.body), r);

    r = await call('POST', '/rest/v1/rpc/demo_toggle_elevator', { as: 'smoke_student', json: { elevator_id: 1 } });
    check('demo_toggle_elevator succeeds', okStatus(r), r);

    r = await call('POST', '/rest/v1/rpc/demo_reset', { as: 'smoke_student', json: {} });
    check('demo_reset succeeds through the API', okStatus(r), r);

    r = await call('GET', '/rest/v1/alerts_feed?select=id,type,confirmations,verified,lat,lng', { as: 'smoke_student' });
    const sameAs = (a: unknown, b: unknown) =>
      JSON.stringify([...(a as object[])].map((x) => JSON.stringify(x)).sort()) ===
      JSON.stringify([...(b as object[])].map((x) => JSON.stringify(x)).sort());
    check('after demo_reset the sample alerts are back', okStatus(r) && Array.isArray(r.body) && r.body.length === 4, r);
    if (isLocal && Array.isArray(feedBefore) && feedBefore.length === 4) {
      check('after demo_reset the feed matches a fresh seed', sameAs(r.body, feedBefore), r);
    }
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);

function required(name: string): string {
  const v = process.env[name];
  if (!v) fail(`Missing ${name}.`);
  return v!;
}

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}
