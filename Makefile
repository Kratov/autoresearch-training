.PHONY: setup dev build up up-gpu down logs logs-web logs-api logs-worker shell-worker test clean help gpu-check

# Colors for output
CYAN := \033[0;36m
NC := \033[0m

help: ## Show this help
	@echo "Autoresearch Platform - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(CYAN)%-15s$(NC) %s\n", $$1, $$2}'

setup: ## Initialize all projects
	@echo "Setting up Next.js frontend..."
	cd apps/web && npm install
	@echo "Setting up NestJS API..."
	cd apps/api && npm install
	@echo "Setting up Python worker..."
	cd apps/worker && pip install -e .
	@echo "Setup complete!"

dev: ## Start all services in development mode
	@echo "Starting development servers..."
	$(MAKE) -j3 dev-web dev-api dev-worker

dev-web: ## Start Next.js in dev mode
	cd apps/web && npm run dev

dev-api: ## Start NestJS in dev mode
	cd apps/api && npm run start:dev

dev-worker: ## Start Python worker in dev mode
	cd apps/worker && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

build: ## Build all Docker images
	docker-compose build

up: ## Start all services (CPU mode)
	docker-compose up -d
	@echo "Services starting..."
	@echo "Frontend: http://localhost:3000"
	@echo "API: http://localhost:4000/api"
	@echo "Worker: http://localhost:8000/docs"

up-gpu: ## Start all services with GPU support
	docker-compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
	@echo "Services starting with GPU..."
	@echo "Frontend: http://localhost:3000"
	@echo "API: http://localhost:4000/api"
	@echo "Worker: http://localhost:8000/docs (GPU enabled)"

down: ## Stop all services
	docker-compose down

logs: ## View all logs
	docker-compose logs -f

logs-web: ## View frontend logs
	docker-compose logs -f web

logs-api: ## View API logs
	docker-compose logs -f api

logs-worker: ## View Python worker logs
	docker-compose logs -f worker

logs-db: ## View database logs
	docker-compose logs -f db

shell-worker: ## Shell into Python worker container
	docker-compose exec worker /bin/bash

shell-api: ## Shell into API container
	docker-compose exec api /bin/sh

shell-db: ## Shell into database container
	docker-compose exec db psql -U autoresearch

test: ## Run all tests
	@echo "Running frontend tests..."
	cd apps/web && npm test || true
	@echo "Running API tests..."
	cd apps/api && npm test || true
	@echo "Running worker tests..."
	cd apps/worker && pytest || true

test-web: ## Run frontend tests
	cd apps/web && npm test

test-api: ## Run API tests
	cd apps/api && npm test

test-worker: ## Run worker tests
	cd apps/worker && pytest

lint: ## Run linters on all projects
	cd apps/web && npm run lint
	cd apps/api && npm run lint
	cd apps/worker && ruff check .

format: ## Format code in all projects
	cd apps/web && npm run format || true
	cd apps/api && npm run format || true
	cd apps/worker && ruff format .

clean: ## Clean up everything
	@echo "Stopping containers..."
	docker-compose down -v --remove-orphans
	@echo "Removing node_modules..."
	rm -rf apps/web/node_modules apps/api/node_modules
	@echo "Removing Python cache..."
	find apps/worker -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find apps/worker -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf apps/worker/.pytest_cache
	@echo "Clean complete!"

reset-db: ## Reset database (WARNING: destroys data)
	docker-compose down -v
	docker volume rm autoresearch_postgres_data 2>/dev/null || true
	@echo "Database reset. Run 'make up' to start fresh."

gpu-check: ## Check GPU availability
	@echo "Checking GPU availability..."
	docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi || echo "GPU not available or nvidia-container-toolkit not installed"
