# AGENT4: Platform, auth & quality

You keep the other three unblocked and make sure the whole thing works together. You own identity (Clerk), environments and deployment, CI, and quality: accessibility review, end-to-end checks, and the usability study this course is graded on.

Read first: [AGENTS.md](../AGENTS.md), then README sections **Getting started**, **Environment variables**, **Testing**, **Deployment**, and **Accessibility**.

## You own

```
.github/**
Makefile
package.json, pnpm-workspace.yaml, .gitignore   (repo root)
docs/**
README.md                                       (shared, but you're its editor)
```

Plus the things that aren't in git: the Clerk application, the hosted Supabase project, and the routing service deployment.

## What's already there

| File | State |
|---|---|
| `.github/workflows/ci.yml` | Mobile (lint, typecheck, test), routing (vet, test), database (seed.sql is current, reset, pgTAP) jobs. All three are required checks on `main` |
| `Makefile` | `dev`, `seed`, `test`, `lint`, done |
| `.env.example` × 2 | Match README → Environment variables |
| `docs/research.md` | Findings and requirements tables. Participant evidence and usability results are empty |
| `docs/decisions/` | Template plus 0001 (stack and auth), 0002 (graph from OSM), 0003 (web target deps) |

## Contracts

**You provide:**

- **Auth claims.** Clerk session tokens carry `sub` (user ID) and `app_role` (`facilities` for verified posters). Never `role`: Supabase reserves it.
- **Environments.** The env var names in README and both `.env.example` files. Real values go to teammates through a private channel, never git.

## Backlog

### M0.5: Unblock everyone (do this first)

- [ ] **Clerk app**: create it, enable email sign-in (optionally Google for UF accounts), add the session token claim `{"app_role": "{{user.public_metadata.role}}"}`, and activate the Supabase integration. Create one test student and one test `facilities` account.
- [ ] **Clerk domain** in `supabase/config.toml`: set `[auth.third_party.clerk] enabled = true` and the real `domain` together, so local Supabase accepts Clerk tokens. The CLI fetches the domain's OpenID config at startup, so a placeholder breaks `supabase start` and CI.
- [ ] **Share keys** privately with the team: Clerk publishable + secret keys, the test accounts.
- [x] **GitHub**: push the repo, protect `main` (1 approving review, CI must pass), add PR template with an `R1`–`R6` line and an accessibility checkbox.
- [x] **CI green** on the first PR. Commit `pnpm-lock.yaml` and `go.sum`.

### M1: Walking skeleton

- [ ] **`make dev` works from a clean clone** on at least two teammates' machines. Fix whatever breaks and update README → Getting started. *Works on one Mac after the `.env` fix (the routing service never read `services/routing/.env`). Still needs a second machine.*
- [ ] **End-to-end smoke check**: sign in on a phone → map loads → route request reaches Go with a valid token → Go reads the DB. Write the steps in `docs/` so anyone can repeat it. *Steps are in [`docs/smoke-check.md`](../docs/smoke-check.md). The first full run waits on the Clerk app.*

### M2: v1 features

- [ ] **Hosted environment**: Supabase project (`supabase db push`), Clerk third-party auth in the Supabase dashboard, routing service on Fly.io or Render from `services/routing/Dockerfile`, `/healthz` monitored.
- [ ] **Accessibility review**: for every UI PR, run the screen's main task with VoiceOver and TalkBack and review against README → Accessibility. Request changes when it fails.
- [ ] **Integration reviews**: review every contract-change PR (AGENTS.md → Contracts) and check both sides changed together.
- [ ] **Decision records** for anything structural that lands.

### M3: Study-ready

- [ ] **Usability study plan** in `docs/research.md`: tasks, success criteria, consent script, what you'll measure (task success, time, errors, SUS or similar).
- [ ] **Run the sessions** in demo mode with AGENT1, resetting with `demo_reset` between participants. Record results.
- [ ] **Turn findings into issues** tagged with the requirement they affect, and feed threshold tuning to AGENT2.
- [ ] **Demo script** for the final presentation: one route, one mid-route alert, one report, one elevator check.
- [ ] **README pass**: Team table, Scope checkboxes, and anything that drifted.

## Rules for this lane

- Never commit secrets. If one leaks, rotate it in Clerk or Supabase first, then clean up.
- CI must stay green on `main`. A red `main` is everyone's blocker and your top priority.
- Keep the README honest. If setup steps changed, the README changes in the same PR.
- **Load balancing.** AGENT1 has the largest backlog. Once your M1 work is done, offer to take M2 frontend items (the elevator board is a good self-contained one), coordinating with AGENT1 so you don't edit the same files.

## Commands

```bash
make dev        # everything, locally
make lint test  # what CI runs
make seed
```
