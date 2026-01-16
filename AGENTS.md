# AI Agent Operating Manual

This repo is designed for a team of AI software engineering agents.

## Canonical sources of truth

1. docs/PRD.md
2. docs/API.md
3. supabase/migrations/001_init.sql
4. packages/ai_contract/schema/*.json
5. packages/ai_contract/fixtures/golden/*

If anything conflicts, update the docs and migrations first, then update code.

## Required workflow

1. Contract first
   - Any change to extraction or output shape must start by editing JSON Schemas in packages/ai_contract/schema.
   - Then update fixtures or add a new fixture.

2. API second
   - Update docs/API.md and Pydantic models.
   - Keep response shapes stable.

3. DB third
   - Update supabase/migrations with forward only SQL.
   - Add RLS policy changes explicitly.

4. Code last
   - Implement smallest possible change that satisfies acceptance criteria.
   - Add tests for negative cases.

## Hard rules

- Do not introduce a second backend, second frontend, or native Swift app.
- Do not rename DB columns casually.
- Do not change AI schemas without updating fixtures.
- No untracked prompt edits. Prompts live in packages/ai_contract/prompts.

## Branching tasks

Recommended agent roles:
- Product Agent: maintains PRD acceptance criteria
- Backend Agent: FastAPI routes and pipeline
- Data Agent: Supabase migrations and RLS
- AI Quality Agent: golden fixtures, contract tests, prompt tuning
- Frontend Agent: Expo screens and UX polish

## What makes this 10 out of 10 for agents

- Single stack, no branching architecture choices.
- Machine readable schemas plus golden fixtures prevent silent regressions.
- Runnable scaffold prevents blank page paralysis.
