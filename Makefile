.PHONY: dev seed test lint routing mobile

# Go doesn't read .env files, so export services/routing/.env (when present) before starting.
# The braces keep the `&&` chain intact around it.
ROUTING_ENV = { set -a; [ ! -f .env ] || . ./.env; set +a; }

# supabase start + routing service + expo, together. Ctrl-C stops the routing service and expo.
dev:
	supabase start
	trap 'kill 0' INT TERM EXIT; \
	(cd services/routing && $(ROUTING_ENV) && go run ./cmd/server) & \
	(cd apps/mobile && pnpm expo start) & \
	wait

# Rebuild seed.sql from data/campus and reset the DB.
seed:
	pnpm seed:build
	supabase db reset

test:
	cd services/routing && go test ./...
	pnpm test

lint:
	pnpm lint
	pnpm typecheck
	cd services/routing && go vet ./...

routing:
	cd services/routing && $(ROUTING_ENV) && go run ./cmd/server

mobile:
	cd apps/mobile && pnpm expo start
