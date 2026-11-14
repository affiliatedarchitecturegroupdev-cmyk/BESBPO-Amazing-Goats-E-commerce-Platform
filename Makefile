.PHONY: bootstrap dev test lint db-migrate db-reset db-test wireframes
bootstrap:
	corepack enable && pnpm install
	pnpm test
dev:
	docker compose -f infra/docker-compose.yml up -d
test:
	pnpm test
lint:
	pnpm -r lint
db-migrate:
	./scripts/migrate.sh
db-reset:
	docker compose -f infra/docker-compose.yml down -v && docker compose -f infra/docker-compose.yml up -d && sleep 3 && ./scripts/migrate.sh
db-test:
	./scripts/test-rls.sh
wireframes:
	open docs/wireframes/index.html || xdg-open docs/wireframes/index.html
