SHELL := /bin/bash

SERVICES := auth-service users-service projects-service tasks-service docs-service boards-service teams-service git-service notifications-service

.PHONY: help
help:
	@echo "Mimi backend targets:"
	@echo "  make tidy              — go mod tidy"
	@echo "  make build             — build every service binary into bin/"
	@echo "  make build-<svc>       — build one service (e.g. make build-auth-service)"
	@echo "  make run-<svc>         — run one service locally (needs .env)"
	@echo "  make test              — go test ./..."
	@echo "  make up                — docker compose up -d --build"
	@echo "  make down              — docker compose down"
	@echo "  make logs              — docker compose logs -f"
	@echo "  make psql-users        — psql shell into postgres-users"

.PHONY: tidy
tidy:
	go mod tidy

.PHONY: build
build: $(addprefix build-, $(SERVICES))

build-%:
	@mkdir -p bin
	@if [ -d "./cmd/$*" ]; then \
		echo "building $*..."; \
		go build -o bin/$* ./cmd/$*; \
	else \
		echo "skip $*: cmd/$* does not exist yet"; \
	fi

run-%:
	go run ./cmd/$*

.PHONY: test
test:
	go test ./...

.PHONY: up
up:
	docker compose up -d --build

.PHONY: down
down:
	docker compose down

.PHONY: logs
logs:
	docker compose logs -f

.PHONY: psql-users
psql-users:
	docker compose exec postgres-users psql -U mimi -d mimi_users
