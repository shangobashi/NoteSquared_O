# Note^2 (Note squared)

Note^2 (Note squared) is a cross platform MVP for music teachers that records a lesson, transcribes it, and generates three editable outputs:
- Student recap
- Practice plan
- Parent email

This is the core workflow described in the idea document.  

## Stack decisions

Single stack only, to keep AI agents from hallucinating architecture:
- Mobile plus web: Expo React Native
- Backend: FastAPI Python
- DB plus auth plus storage: Supabase Postgres plus Supabase Auth plus Supabase Storage
- AI: OpenAI Whisper for transcription plus an LLM for extraction and generation

Why this is non negotiable:
- Agents ship faster with one canonical stack and one source of truth.
- The AI layer must be treated like a component with a contract, not magic text generation.

## Monorepo layout

- apps/mobile: Expo mobile app
- apps/web: Expo web app
- services/api: FastAPI API and pipeline orchestrator
- packages/ai_contract: schema first AI contract, prompts, fixtures, deterministic runner

## Quick start

Prereqs:
- Node 20+
- Python 3.12+
- Supabase project created

1. Copy env template
   cp .env.example .env

2. Install Python deps and run API
   make api-install
   make api-dev

3. Install mobile deps and run Expo
   make mobile-install
   make mobile-dev

## Commands

- make test: run all tests and contract checks
- make fmt: format Python and TypeScript
- make lint: lint Python and TypeScript
- make ci: run the same checks as GitHub Actions

## Definition of Done

A feature is Done only if:
- It matches acceptance criteria in docs/PRD.md
- API and DB changes are reflected in docs/API.md and docs/DB_SCHEMA.sql
- Contract tests and golden fixtures remain green
- Coverage stays at or above 80 percent for Python

See AGENTS.md for the multi agent workflow.
