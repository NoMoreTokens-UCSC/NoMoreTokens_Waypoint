.PHONY: up down migrate seed test lint reset docs

# Start all services
up:
	docker compose up --build

# Stop all services
down:
	docker compose down

# Run DB migrations (requires running DB)
migrate:
	cd api && alembic upgrade head

# Seed the database
seed:
	cd api && python -m seed.run

# Seed with a sample plan for loader/driver demo
seed-with-plan:
	cd api && python -m seed.run --with-sample-plan

# Reset and reseed (dev only)
reset:
	cd api && python -m seed.reset

# Run all tests
test:
	cd api && pytest -v

# Lint
lint:
	cd api && ruff check .

# Generate OpenAPI JSON
docs:
	@echo "Generating OpenAPI JSON..."
	cd api && python -c "
from app.main import app
import json
with open('../docs/openapi.json', 'w') as f:
    json.dump(app.openapi(), f, indent=2)
print('Written to docs/openapi.json')
"

# Install Python deps locally (for IDE support without Docker)
install:
	cd api && pip install -r requirements.txt
