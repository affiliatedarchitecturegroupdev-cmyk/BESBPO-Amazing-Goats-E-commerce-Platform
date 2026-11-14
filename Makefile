.PHONY: bootstrap dev test lint db-migrate db-reset wireframes
bootstrap:
	corepack enable && pnpm install
dev:
	docker compose -f infra/docker-compose.yml up -d
test:
	pnpm -r test
lint:
	pnpm -r lint
db-migrate:
	./scripts/migrate.sh
db-reset:
	docker compose -f infra/docker-compose.yml down -v && docker compose -f infra/docker-compose.yml up -d && sleep 3 && ./scripts/migrate.sh
wireframes:
	open docs/wireframes/index.html || xdg-open docs/wireframes/index.html
