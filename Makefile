.PHONY: api-install api-dev mobile-install mobile-dev web-install web-dev test fmt lint ci

api-install:
	cd services/api && python -m pip install -U pip && pip install -e ".[dev]"

api-dev:
	cd services/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

mobile-install:
	cd apps/mobile && npm install

mobile-dev:
	cd apps/mobile && npm run start

web-install:
	cd apps/web && npm install

web-dev:
	cd apps/web && npm run start

test:
	cd services/api && pytest
	cd packages/ai_contract && pytest

fmt:
	cd services/api && ruff format .
	cd services/api && ruff check . --fix

lint:
	cd services/api && ruff check .
	cd services/api && mypy app

ci: lint test
