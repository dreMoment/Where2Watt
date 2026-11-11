.PHONY: setup backend frontend down logs test test-frontend test-backend

DOCKER ?= $(shell if docker info >/dev/null 2>&1; then echo docker; elif sudo -n docker info >/dev/null 2>&1; then echo "sudo -n docker"; else echo docker; fi)

setup:
	@test -f backend/.env || cp backend/.env.example backend/.env
	@test -f frontend/.env.local || cp frontend/.env.local.example frontend/.env.local
	npm --prefix frontend ci --no-audit --no-fund

backend:
	$(DOCKER) compose --env-file backend/.env -f backend/docker-compose.yml up --build

frontend:
	npm run dev --prefix frontend

down:
	$(DOCKER) compose --env-file backend/.env -f backend/docker-compose.yml down

logs:
	$(DOCKER) compose --env-file backend/.env -f backend/docker-compose.yml logs -f

test: test-frontend test-backend

test-frontend:
	npm test --prefix frontend -- --runInBand
	npm run lint --prefix frontend

test-backend:
	@status=0; \
	$(DOCKER) compose -f backend/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-test || status=$$?; \
	$(DOCKER) compose -f backend/docker-compose.test.yml down --volumes; \
	exit $$status
