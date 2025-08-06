.PHONY: install dev build test clean docker-up docker-down migrate

# Install all dependencies
install:
	npm install
	npm install --workspaces

# Development
dev:
	npm run dev

dev-backend:
	npm run dev:backend

dev-bot:
	npm run dev:bot

# Build
build:
	npm run build

# Testing
test:
	npm test

test-coverage:
	npm run test:coverage --workspace=backend

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
migrate:
	npm run migrate --workspace=backend

migrate-prod:
	npm run migrate:prod --workspace=backend

db-push:
	npm run db:push --workspace=backend

db-seed:
	npm run db:seed --workspace=backend

# Clean
clean:
	rm -rf node_modules
	rm -rf backend/node_modules
	rm -rf backend/dist
	rm -rf discord-bot/node_modules
	rm -rf discord-bot/dist
	rm -rf shared/types/node_modules
	rm -rf shared/types/dist
	rm -rf shared/utils/node_modules
	rm -rf shared/utils/dist

# Setup (first time)
setup: docker-up install migrate db-seed
	@echo "Setup complete! Run 'make dev' to start development."

# Deploy Discord commands
deploy-commands:
	npm run deploy-commands --workspace=discord-bot