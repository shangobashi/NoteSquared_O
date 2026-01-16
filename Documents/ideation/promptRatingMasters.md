<prompt>
<instruction>

'''
Rate these 4 Documents repo created in order to enable a Software Engineering team made of AI Agents to create an MVP for an App. The idea of the app is provided in @idea.pdf for you to check. Rate on a scale of 10. Explain the reasoning behind your ratings. 
'''

</instruction>
<example1>

Gemini Master Docs
==================

Master Context: Note By Note (MVP)

1. Project Mission

Note By Note is an AI-powered automated documentation tool for music teachers.
Core Loop: Record Lesson (Mobile) -> Transcribe (Whisper) -> Extract Musical Data (LLM) -> Generate 3 Outputs (Recap, Plan, Email) -> Teacher Edits & Sends.

2. The Rules of Engagement (For AI Agents)

Strict Adherence: Do not deviate from the 01_DATA_CONTRACTS.md schema. If a column isn't there, do not create it.

Pattern Matching: Use the coding style defined in 03_SCAFFOLD_PATTERNS.md.

Regression Safety: All LLM prompts must pass the validation checks in 02_INTELLIGENCE_LAYER.md.

Monorepo Structure:

/apps/mobile (React Native/Expo)

/backend (Python FastAPI)

/infra (Supabase config)

3. Product Requirements (MVP)

3.1 Personas & Pricing

Solo Teacher ($49/mo): Single user, needs speed.

Studio Owner ($99/mo): Multi-user management (future-proofing required in DB schema).

3.2 User Flows

Auth: Login via Supabase Auth.

Session: Select Student -> Tap "Record" -> Tap "Stop".

Processing: App uploads audio -> Backend processes (Whisper + GPT-4o).

Review: Teacher sees 3 text blocks (Recap, Plan, Email). Teacher edits text.

Action: Teacher clicks "Copy to Clipboard" or "Send".

3.3 Tech Stack Constraints

Frontend: React Native (Expo) + Tamagui (UI Kit).

Backend: Python FastAPI (deployed on Fly.io or similar).

Database/Auth: Supabase (PostgreSQL).

AI: OpenAI Whisper (Audio) + GPT-4o (Reasoning - JSON Mode strict).

3.4 Integration Stubs (Future Proofing)

Payments: Stripe Customer ID field required in User table.

Email: SendGrid/Resend API key placeholder required in backend env.


Data Contracts & API Specification

CRITICAL INSTRUCTION: This file is the Source of Truth. AI Agents must strictly implement this Schema and API surface.

1. Database Schema (Prisma / PostgreSQL)

// This schema handles the "Solo" vs "Studio" logic and the "3 Output" requirement.

model User {
  id              String   @id @default(uuid())
  email           String   @unique
  full_name       String?
  studio_name     String?  // Nullable for Solo teachers
  plan_tier       PlanTier @default(SOLO) 
  stripe_cust_id  String?  // For future payments
  created_at      DateTime @default(now())
  
  students        Student[]
  lessons         Lesson[]
}

enum PlanTier {
  SOLO
  STUDIO
}

model Student {
  id              String   @id @default(uuid())
  teacher_id      String
  teacher         User     @relation(fields: [teacher_id], references: [id])
  full_name       String
  instrument      String   // e.g., "Piano", "Violin"
  parent_email    String?  // Optional for adult students
  created_at      DateTime @default(now())
  
  lessons         Lesson[]
}

model Lesson {
  id              String       @id @default(uuid())
  student_id      String
  student         Student      @relation(fields: [student_id], references: [id])
  teacher_id      String
  teacher         User         @relation(fields: [teacher_id], references: [id])
  
  // Audio Handling
  audio_url       String       // Supabase Storage path
  duration_sec    Int
  
  // State Machine
  status          LessonStatus @default(UPLOADING)
  
  // The Core AI Outputs (Stored as text for easy editing)
  transcript_text String?      @db.Text
  student_recap   String?      @db.Text
  practice_plan   String?      @db.Text // Markdown list
  parent_email    String?      @db.Text
  
  created_at      DateTime     @default(now())
}

enum LessonStatus {
  UPLOADING
  PROCESSING   // Whisper + LLM running
  READY_REVIEW // Teacher can edit
  COMPLETED    // Sent/Archived
  FAILED
}


2. API Contract (FastAPI)

POST /lessons/process

Input (Multipart): file (audio/m4a), student_id (uuid), teacher_id (uuid).

Output (JSON):

{
  "lesson_id": "uuid",
  "status": "PROCESSING"
}


GET /lessons/{lesson_id}

Output (JSON):

{
  "id": "uuid",
  "status": "READY_REVIEW",
  "outputs": {
    "student_recap": "Great work on the C Major scale...",
    "practice_plan": "- Mon: Scale 10m\n- Tue: Arpeggios...",
    "parent_email": "Dear Mrs. Smith..."
  }
}


PATCH /lessons/{lesson_id}

Purpose: Save teacher edits.

Input (JSON): {"student_recap": "...", "practice_plan": "...", "parent_email": "..."}


Intelligence Layer: Prompts & Quality Assurance

CRITICAL INSTRUCTION: The LLM is not a creative writer; it is a data extractor. Use strictly structured outputs (JSON Mode) to prevent UI breakage.

1. The Extraction Prompt (System Prompt)

Role: You are an expert music teacher assistant.
Task: Analyze the provided lesson transcript.
Constraint: Output valid JSON only. Do not include markdown formatting like ```json.

JSON Schema Enforced:

{
  "student_recap": "String. Tone: Encouraging but specific. Max 100 words.",
  "practice_plan": "String. Markdown bullet points. Broken down by days (Mon-Sun) or generic 'Day 1'. Specific assignments only.",
  "parent_email": "String. Professional summary. Max 150 words. Focus on progress."
}


Context Variables:

Student Name: {student_name}

Instrument: {instrument}

2. Golden Fixture (Regression Testing)

Input Transcript (Fixture):
"Okay, Sarah. Let's look at that G Major scale again. You're rushing the turn. Play it at 60bpm this week. Also, for the recital piece, memorize measures 4 through 8. Good job keeping your wrists up today."

Expected Output (Truth):

{
  "student_recap": "Great job keeping your wrists up today, Sarah! We need to focus on controlling the tempo in the G Major scale.",
  "practice_plan": "- **G Major Scale**: Play at 60bpm. Focus on the turn. (10 mins)\n- **Recital Piece**: Memorize measures 4-8. (15 mins)",
  "parent_email": "Hi, Sarah had a good lesson. Her posture is improving (wrists were great!). This week she needs to practice her G Major scale at a slower tempo (60bpm) and memorize a specific section of her recital song."
}


3. Testing Strategy

Unit Test: Mock OpenAI response with the Expected Output above. Ensure Backend parses it correctly.

Integration Test: Upload a 10-second dummy audio file -> Verify Status moves from PROCESSING to READY_REVIEW.


Scaffold Patterns: Implementation Guide

CRITICAL INSTRUCTION: Use these exact code patterns. Do not re-invent the wheel.

1. Backend Pattern (FastAPI + Async AI)

File: backend/main.py

from fastapi import FastAPI, UploadFile, BackgroundTasks
from pydantic import BaseModel
import openai
import json

app = FastAPI()

class LessonDraft(BaseModel):
    student_recap: str
    practice_plan: str
    parent_email: str

async def process_ai_job(lesson_id: str, audio_path: str):
    # 1. Transcribe (Whisper)
    transcript = client.audio.transcriptions.create(
        model="whisper-1", file=open(audio_path, "rb")
    )
    
    # 2. Extract (GPT-4o JSON Mode)
    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript.text}
        ]
    )
    
    # 3. Save to DB (Pseudo-code)
    data = json.loads(response.choices[0].message.content)
    db.update_lesson(lesson_id, status="READY_REVIEW", **data)

@app.post("/lessons/process")
async def upload_lesson(file: UploadFile, background_tasks: BackgroundTasks):
    # Pattern: Immediate ID return, Async processing
    lesson_id = db.create_lesson(status="PROCESSING")
    save_path = f"tmp/{lesson_id}.m4a"
    
    with open(save_path, "wb") as f:
        f.write(file.file.read())
        
    background_tasks.add_task(process_ai_job, lesson_id, save_path)
    return {"lesson_id": lesson_id, "status": "PROCESSING"}


2. Frontend Pattern (Expo Audio Recording)

File: mobile/components/Recorder.tsx

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export const Recorder = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const startRecording = async () => {
    // Pattern: Request permissions first
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    
    const { recording } = await Audio.Recording.createAsync(
       Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(recording);
  };

  const stopAndUpload = async () => {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    // Pattern: Upload via FormData
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: 'upload.m4a',
    } as any);

    await fetch(`${API_URL}/lessons/process`, {
      method: 'POST',
      body: formData
    });
  };
  
  // UI Implementation...
};



This Document System is ready for ingestion.

Context provides the business logic and constraints.

Contracts provides the rigid skeleton to prevent errors.

Intelligence provides the brain and the testing harness.

Scaffold provides the hands-on code to start the build immediately.

Execute the build in the order: Contracts -> Scaffold -> Intelligence -> Context.

</example1>
<example2>

OAI Master Docs
===============

```text
notebynote/
  README.md
  AGENTS.md
  Makefile
  .env.example
  .gitignore
  .github/workflows/ci.yml

  docs/
    INDEX.md
    PRD.md
    ARCHITECTURE.md
    API.md
    DB_SCHEMA.sql
    AI_CONTRACT.md
    DEPLOYMENT.md
    RUNBOOK.md
    SECURITY_PRIVACY.md
    PAYMENTS.md

  supabase/
    migrations/
      001_init.sql

  packages/
    ai_contract/
      README.md
      schema/
        lesson_extraction.schema.json
        outputs.schema.json
      prompts/
        extraction.md
        student_recap.md
        practice_plan.md
        parent_email.md
      fixtures/
        golden/
          fixture_0001/
            transcript.txt
            expected_extraction.json
            expected_outputs.json
      src/
        __init__.py
        adapters.py
        runner.py
        validate.py
      tests/
        test_golden_fixtures.py

  services/
    api/
      pyproject.toml
      app/
        __init__.py
        main.py
        settings.py
        auth.py
        errors.py
        db.py
        models.py
        routes/
          __init__.py
          health.py
          students.py
          lessons.py
          outputs.py
        services/
          __init__.py
          openai_client.py
          ai_pipeline.py
          emailer.py
          storage.py
      tests/
        test_health.py
        test_pipeline_contract.py

  apps/
    mobile/
      package.json
      app.json
      tsconfig.json
      src/
        App.tsx
        lib/
          api.ts
          supabase.ts
        screens/
          RecordScreen.tsx
          ReviewScreen.tsx
```

---

```markdown
===== FILE: README.md =====
# Note By Note

Note By Note is a cross platform MVP for music teachers that records a lesson, transcribes it, and generates three editable outputs:
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

- apps/mobile: Expo app
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
```

---

```markdown
===== FILE: AGENTS.md =====
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
```

---

```markdown
===== FILE: docs/INDEX.md =====
# Docs index

- PRD: docs/PRD.md
- Architecture: docs/ARCHITECTURE.md
- API contract: docs/API.md
- Database schema reference: docs/DB_SCHEMA.sql
- AI contract and tuning: docs/AI_CONTRACT.md
- Security and privacy: docs/SECURITY_PRIVACY.md
- Deployment: docs/DEPLOYMENT.md
- Runbook: docs/RUNBOOK.md
- Payments strategy: docs/PAYMENTS.md
```

---

```markdown
===== FILE: docs/PRD.md =====
# Product Requirements Document

## Problem

Music teachers spend unpaid time after lessons writing lesson notes, practice plans, and parent updates.

## MVP goal

After a lesson, the teacher can:
1. Record or upload audio
2. Generate three editable outputs
3. Save them to a student timeline
4. Copy or send the parent email

## Personas

- Solo Teacher
  - Wants speed and minimal admin
  - Pricing target 49 per month

- Studio Owner
  - Needs multiple students and staff
  - Pricing target 99 per month

## MVP scope

In scope:
- Email magic link sign in
- Student CRUD
- Record or upload audio
- Async processing job with status
- Transcript stored
- AI extraction and three outputs stored
- Edit outputs and mark as sent
- History list per student
- Basic analytics: time to generate, edits made

Out of scope for MVP:
- Stripe paywall enforcement in app
- Multi teacher organization roles
- iPad specific layout
- Multi language

## Non functional requirements

- Sleek and clean UI
- Dark mode first
- Latency target under 60 seconds for a standard segment
- Minimum 80 percent test coverage for backend and contract suite

## Feature requirements with IDs

### Auth

AUTH-001 Magic link sign in
Acceptance criteria:
- User can request a magic link
- User can sign in and get a valid session
- API endpoints reject missing or invalid auth token

### Students

STU-001 Create student
Acceptance criteria:
- Create student with name and optional parent email
- Student belongs to current user

STU-002 List students
Acceptance criteria:
- Lists only students owned by current user
- Sorted by most recent lesson

### Recording and upload

REC-001 Start recording
Acceptance criteria:
- Recording starts within 500 ms on device
- Shows elapsed time and stop button

REC-002 Stop and upload
Acceptance criteria:
- A single action stops recording and starts upload
- Upload progress visible

### Processing

JOB-001 Create processing job
Acceptance criteria:
- After upload, lesson status becomes TRANSCRIBING then GENERATING then READY
- Status endpoint returns progress and error message if failed

TRX-001 Transcription
Acceptance criteria:
- Transcript stored with timestamps when available
- Failure is retryable

### AI generation

GEN-001 Student recap
Acceptance criteria:
- 150 to 300 words
- Includes what went well and focus areas

GEN-002 Practice plan
Acceptance criteria:
- 7 day plan with specific assignments
- Includes measurable targets

GEN-003 Parent email
Acceptance criteria:
- Professional tone
- Ready to paste or send

### Output editing

OUT-001 Edit output
Acceptance criteria:
- User can edit content and save
- Original content remains stored

OUT-002 Mark as sent
Acceptance criteria:
- Output can be marked sent with method clipboard or email
- Timestamp recorded
```

---

```markdown
===== FILE: docs/ARCHITECTURE.md =====
# Architecture

## High level flow

1. Mobile app uploads audio to Supabase Storage
2. Mobile app calls API to start processing for a lesson
3. API creates a job record and runs pipeline
4. Pipeline steps:
   - Transcribe audio with Whisper
   - Extract structured lesson facts using JSON Schema
   - Generate three outputs using constrained prompts
   - Store outputs and mark lesson READY

## Core principle

Treat the LLM like a component with a contract:
- Schema first extraction
- Template constrained generation
- Golden fixtures plus CI gates

## Components

- Expo app
  - Auth and data reads through Supabase client
  - Calls API only for processing and email send

- FastAPI service
  - Verifies Supabase user token
  - Orchestrates AI pipeline and writes results to DB

- Supabase
  - Postgres tables
  - Storage bucket for audio
  - Auth for sessions

## Error model

- Every pipeline step can fail with a typed error code
- Retries are allowed for transcription and generation
- If generation fails after retries, lesson becomes FAILED and UI shows retry

## Why not edge functions only

Edge functions can work, but FastAPI keeps AI libs and test harness straightforward for agents and supports the contract suite cleanly.
```

---

```markdown
===== FILE: docs/API.md =====
# API contract

Base URL:
- Local: http://localhost:8000

Auth:
- Bearer token from Supabase session access token

Common response envelope:
{
  "success": true,
  "data": ...
}

Errors:
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID",
    "message": "..."
  }
}

## Health

GET /health
Response:
{ "success": true, "data": { "status": "ok" } }

## Students

GET /v1/students
POST /v1/students
PATCH /v1/students/{student_id}
DELETE /v1/students/{student_id}

## Lessons and processing

POST /v1/lessons
Body:
{
  "studentId": "uuid",
  "title": "Optional title",
  "audioStoragePath": "storage key in Supabase"
}

Response:
{
  "success": true,
  "data": {
    "lessonId": "uuid",
    "status": "QUEUED"
  }
}

GET /v1/lessons/{lesson_id}
GET /v1/lessons/{lesson_id}/status

POST /v1/lessons/{lesson_id}/retry
Body:
{ "fromStep": "TRANSCRIBE" | "EXTRACT" | "GENERATE" }

## Outputs

GET /v1/outputs/{output_id}
PATCH /v1/outputs/{output_id}
Body:
{ "editedContent": "..." }

POST /v1/outputs/{output_id}/sent
Body:
{ "sentTo": "email", "sentVia": "clipboard" | "email" }

POST /v1/outputs/{output_id}/send-email
Body:
{ "to": "email" }
Notes:
- Uses Resend if configured
- Falls back to returning a mailto payload
```

---

```sql
===== FILE: docs/DB_SCHEMA.sql =====
-- Reference schema, actual source of truth is supabase/migrations/001_init.sql

-- profiles: 1 per auth user
-- students: belongs to profile
-- lessons: belongs to student plus profile
-- outputs: 3 per lesson
-- jobs: pipeline status and retry tracking
```

---

```markdown
===== FILE: docs/AI_CONTRACT.md =====
# AI contract

Goal:
- Convert transcript into structured lesson extraction JSON
- Generate three outputs using that JSON, not raw transcript

This reduces hallucination and makes outputs testable.

## Extraction schema

Canonical schema:
- packages/ai_contract/schema/lesson_extraction.schema.json

Evidence requirement:
- Every extracted claim must include a short supporting quote from transcript where possible.
- Confidence must be a float 0 to 1.

## Output schema

Canonical schema:
- packages/ai_contract/schema/outputs.schema.json

## Golden fixtures

Folder:
- packages/ai_contract/fixtures/golden

Each fixture contains:
- transcript.txt
- expected_extraction.json
- expected_outputs.json

Rule:
- If prompts change, fixtures must be updated intentionally.
- CI runs the deterministic adapter for fixture validation and schema checks.

## Tuning loop

1. Run pilot with real teachers
2. Capture transcript and teacher edited outputs
3. Create a fixture from the transcript and final teacher approved outputs
4. Adjust prompts to reduce edit distance
5. Keep fixtures growing over time to prevent regression
```

---

```markdown
===== FILE: docs/SECURITY_PRIVACY.md =====
# Security and privacy

## Data classification

- Audio and transcripts are sensitive
- Parent emails are personal data

## Controls in MVP

- Supabase RLS ensures users only see their own rows
- API verifies Supabase JWT and uses service role only server side
- Storage paths are per user namespace
- Encrypt in transit by default via HTTPS in production

## MVP limitations

- No formal GDPR DPA automation
- No enterprise compliance

## Immediate guardrails

- Default retention policy: delete audio after 30 days, configurable later
- Provide a delete lesson endpoint that also deletes storage object
```

---

```markdown
===== FILE: docs/DEPLOYMENT.md =====
# Deployment

## Supabase

- Create project
- Run migrations in supabase/migrations
- Create storage bucket: lesson-audio
- Configure RLS policies included in migration

## API

Recommended for MVP:
- Fly.io or Render
- Set env vars from .env.example
- Enable auto deploy from main branch

## Mobile

- Expo EAS build for iOS
- Store config in apps/mobile/app.json
- Set Supabase URL and anon key in app config

## Observability

- Optional Sentry DSN in API and mobile
- Log job durations and errors in jobs table
```

---

```markdown
===== FILE: docs/RUNBOOK.md =====
# Runbook

## Common failures

1. Whisper errors
- Symptom: job status FAILED at TRANSCRIBING
- Action: retry from TRANSCRIBE
- Check: file size and format

2. Schema validation errors
- Symptom: job FAILED at EXTRACT
- Action: inspect raw model output in job metadata
- Fix: prompt or schema mismatch

3. Output quality regressions
- Symptom: teachers report wrong plan
- Action: add a new golden fixture and tune prompts
- Confirm: CI is green on fixtures
```

---

```markdown
===== FILE: docs/PAYMENTS.md =====
# Payments strategy

The idea includes pricing tiers, but MVP should not block pilots behind Stripe until core quality is proven.

MVP approach:
- Invite code onboarding
- Plan is stored in profiles.plan with SOLO default
- Studio limits enforced by app and DB constraints

Post MVP:
- Stripe subscription
- Webhook updates profiles.plan and profiles.plan_status
```

---

```env
===== FILE: .env.example =====
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=
OPENAI_TRANSCRIBE_MODEL=whisper-1
OPENAI_LLM_MODEL=gpt-4o-mini

# Email
RESEND_API_KEY=
EMAIL_FROM=notes@notebynote.app

# API
API_HOST=0.0.0.0
API_PORT=8000
```

---

```makefile
===== FILE: Makefile =====
.PHONY: api-install api-dev mobile-install mobile-dev test fmt lint ci

api-install:
	cd services/api && python -m pip install -U pip && pip install -e ".[dev]"

api-dev:
	cd services/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

mobile-install:
	cd apps/mobile && npm install

mobile-dev:
	cd apps/mobile && npm run start

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
```

---

```yaml
===== FILE: .github/workflows/ci.yml =====
name: CI

on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install
        run: |
          python -m pip install -U pip
          pip install -e "services/api[dev]"
          pip install -e "packages/ai_contract[dev]"
      - name: Lint
        run: |
          cd services/api
          ruff check .
      - name: Tests
        run: |
          cd services/api
          pytest
          cd ../../packages/ai_contract
          pytest
```

---

```gitignore
===== FILE: .gitignore =====
.env
__pycache__/
*.pyc
.coverage
.coverage.*
dist/
node_modules/
.expo/
.DS_Store
```

---

```sql
===== FILE: supabase/migrations/001_init.sql =====
-- Extensions
create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  plan text not null default 'SOLO',
  plan_status text not null default 'ACTIVE'
);

-- Students
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  instrument text null,
  parent_email text null
);

-- Lessons
create table if not exists public.lessons (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text null,
  status text not null default 'QUEUED',
  audio_path text not null,
  transcript text null,
  error_code text null,
  error_message text null
);

-- Outputs
create table if not exists public.outputs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  type text not null,
  content text not null,
  edited_content text null,
  sent_at timestamptz null,
  sent_to text null,
  sent_via text null
);

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  step text not null default 'QUEUED',
  progress int not null default 0,
  last_error text null,
  attempts int not null default 0
);

-- Simple updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_outputs_updated_at on public.outputs;
create trigger trg_outputs_updated_at
before update on public.outputs
for each row execute function public.set_updated_at();

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.outputs enable row level security;
alter table public.jobs enable row level security;

-- Policies
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "students_crud_own" on public.students
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "lessons_crud_own" on public.lessons
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "outputs_crud_own" on public.outputs
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "jobs_crud_own" on public.jobs
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

---

```markdown
===== FILE: packages/ai_contract/README.md =====
# AI contract package

This package is the contract and regression harness for the AI layer.

What it guarantees:
- Extraction output matches a JSON schema
- Generation outputs match a JSON schema
- Golden fixtures prevent drift

Run:
- pytest
```

---

```json
===== FILE: packages/ai_contract/schema/lesson_extraction.schema.json =====
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LessonExtraction",
  "type": "object",
  "additionalProperties": false,
  "required": ["student", "instrument", "highlights", "focus_areas", "assignments", "evidence"],
  "properties": {
    "student": { "type": "string", "minLength": 1 },
    "instrument": { "type": "string", "minLength": 1 },
    "highlights": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "focus_areas": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "assignments": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["task", "target", "confidence"],
        "properties": {
          "task": { "type": "string", "minLength": 1 },
          "target": { "type": "string", "minLength": 1 },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["claim", "quote"],
        "properties": {
          "claim": { "type": "string", "minLength": 1 },
          "quote": { "type": "string", "minLength": 1 }
        }
      }
    }
  }
}
```

---

```json
===== FILE: packages/ai_contract/schema/outputs.schema.json =====
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LessonOutputs",
  "type": "object",
  "additionalProperties": false,
  "required": ["student_recap", "practice_plan", "parent_email"],
  "properties": {
    "student_recap": { "type": "string", "minLength": 50 },
    "practice_plan": { "type": "string", "minLength": 100 },
    "parent_email": { "type": "string", "minLength": 50 }
  }
}
```

---

```markdown
===== FILE: packages/ai_contract/prompts/extraction.md =====
You are extracting structured lesson facts from a transcript of a music lesson.

Return only valid JSON that matches the provided JSON Schema.

Rules:
- Use evidence quotes directly from transcript where possible.
- If a field is unknown, infer conservatively and keep confidence low.
- Do not hallucinate repertoire names unless mentioned.

JSON Schema:
{{SCHEMA_JSON}}
```

---

```markdown
===== FILE: packages/ai_contract/prompts/student_recap.md =====
Write a student recap for the teacher to share with the student.

Constraints:
- 150 to 300 words
- Encouraging and specific
- Refer only to facts in the extraction JSON

Input:
{{EXTRACTION_JSON}}
```

---

```markdown
===== FILE: packages/ai_contract/prompts/practice_plan.md =====
Write a 7 day practice plan.

Constraints:
- Day 1 to Day 7 headings
- Each day includes time estimate and 2 to 4 concrete tasks
- Measurable targets when possible
- Refer only to facts in the extraction JSON

Input:
{{EXTRACTION_JSON}}
```

---

```markdown
===== FILE: packages/ai_contract/prompts/parent_email.md =====
Write a parent email that the teacher can send.

Constraints:
- Professional, warm, concise
- One subject line suggestion at top
- Mention highlights and next steps
- Refer only to facts in the extraction JSON

Input:
{{EXTRACTION_JSON}}
```

---

```text
===== FILE: packages/ai_contract/fixtures/golden/fixture_0001/transcript.txt =====
Teacher: Great work on the C major scale today, nice even tone.
Student: I keep rushing the left hand in the Bach piece.
Teacher: This week I want 10 minutes hands separate, slow tempo with metronome at 60.
Teacher: Also practice the G major arpeggio, two octaves.
```

---

```json
===== FILE: packages/ai_contract/fixtures/golden/fixture_0001/expected_extraction.json =====
{
  "student": "Unknown",
  "instrument": "Piano",
  "highlights": ["C major scale with even tone"],
  "focus_areas": ["Do not rush the left hand in the Bach piece"],
  "assignments": [
    { "task": "Hands separate practice on Bach passage", "target": "10 minutes daily at metronome 60", "confidence": 0.8 },
    { "task": "G major arpeggio", "target": "Two octaves daily", "confidence": 0.7 }
  ],
  "evidence": [
    { "claim": "Practice hands separate at tempo 60", "quote": "10 minutes hands separate, slow tempo with metronome at 60" },
    { "claim": "Practice G major arpeggio two octaves", "quote": "practice the G major arpeggio, two octaves" }
  ]
}
```

---

```json
===== FILE: packages/ai_contract/fixtures/golden/fixture_0001/expected_outputs.json =====
{
  "student_recap": "Placeholder recap used for deterministic tests.",
  "practice_plan": "Placeholder plan used for deterministic tests.",
  "parent_email": "Placeholder email used for deterministic tests."
}
```

---

```python
===== FILE: packages/ai_contract/src/adapters.py =====
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AdapterResult:
    text: str


class LLMAdapter(Protocol):
    def complete(self, prompt: str) -> AdapterResult: ...


class DeterministicAdapter:
    """
    Used in CI and fixture tests.
    Returns deterministic outputs so golden fixtures can validate shape and plumbing.
    """

    def __init__(self, mapping: dict[str, str]) -> None:
        self.mapping = mapping

    def complete(self, prompt: str) -> AdapterResult:
        for key, value in self.mapping.items():
            if key in prompt:
                return AdapterResult(text=value)
        return AdapterResult(text='{}')
```

---

```python
===== FILE: packages/ai_contract/src/validate.py =====
from __future__ import annotations

import json
from pathlib import Path

import jsonschema


def load_schema(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_json(instance: dict, schema: dict) -> None:
    jsonschema.validate(instance=instance, schema=schema)
```

---

```python
===== FILE: packages/ai_contract/src/runner.py =====
from __future__ import annotations

import json
from pathlib import Path

from .adapters import LLMAdapter
from .validate import load_schema, validate_json


ROOT = Path(__file__).resolve().parents[1]


def render_prompt(template_path: Path, replacements: dict[str, str]) -> str:
    text = template_path.read_text(encoding="utf-8")
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text


def extract(adapter: LLMAdapter, transcript: str) -> dict:
    schema_path = ROOT / "schema" / "lesson_extraction.schema.json"
    prompt_path = ROOT / "prompts" / "extraction.md"
    schema_json = schema_path.read_text(encoding="utf-8")

    prompt = render_prompt(
        prompt_path,
        {
            "{{SCHEMA_JSON}}": schema_json,
        },
    ) + "\n\nTRANSCRIPT:\n" + transcript

    raw = adapter.complete(prompt).text
    data = json.loads(raw)

    validate_json(data, load_schema(schema_path))
    return data


def generate(adapter: LLMAdapter, extraction_json: dict) -> dict:
    schema_path = ROOT / "schema" / "outputs.schema.json"
    schema = load_schema(schema_path)
    extraction_str = json.dumps(extraction_json, ensure_ascii=False)

    def gen_one(prompt_file: str) -> str:
        p = ROOT / "prompts" / prompt_file
        prompt = render_prompt(p, {"{{EXTRACTION_JSON}}": extraction_str})
        return adapter.complete(prompt).text

    outputs = {
        "student_recap": gen_one("student_recap.md"),
        "practice_plan": gen_one("practice_plan.md"),
        "parent_email": gen_one("parent_email.md"),
    }

    validate_json(outputs, schema)
    return outputs
```

---

```python
===== FILE: packages/ai_contract/tests/test_golden_fixtures.py =====
from __future__ import annotations

import json
from pathlib import Path

from ai_contract.src.adapters import DeterministicAdapter
from ai_contract.src.runner import extract, generate


ROOT = Path(__file__).resolve().parents[1]


def test_fixture_0001_shapes() -> None:
    fixture = ROOT / "fixtures" / "golden" / "fixture_0001"
    transcript = (fixture / "transcript.txt").read_text(encoding="utf-8")

    expected_extraction = json.loads((fixture / "expected_extraction.json").read_text(encoding="utf-8"))
    expected_outputs = json.loads((fixture / "expected_outputs.json").read_text(encoding="utf-8"))

    adapter = DeterministicAdapter(
        mapping={
            "TRANSCRIPT:": json.dumps(expected_extraction),
            "Write a student recap": expected_outputs["student_recap"],
            "Write a 7 day practice plan": expected_outputs["practice_plan"],
            "Write a parent email": expected_outputs["parent_email"],
        }
    )

    got_extraction = extract(adapter, transcript)
    got_outputs = generate(adapter, got_extraction)

    assert set(got_extraction.keys()) == set(expected_extraction.keys())
    assert set(got_outputs.keys()) == set(expected_outputs.keys())
```

---

```toml
===== FILE: services/api/pyproject.toml =====
[project]
name = "notebynote-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.110",
  "uvicorn[standard]>=0.30",
  "pydantic>=2.7",
  "pydantic-settings>=2.2",
  "requests>=2.32",
  "supabase>=2.4.0",
  "openai>=1.30.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.0",
  "ruff>=0.5",
  "mypy>=1.10",
]

[tool.ruff]
line-length = 100

[tool.mypy]
python_version = "3.12"
strict = true
```

---

```python
===== FILE: services/api/app/settings.py =====
from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    openai_api_key: str
    openai_transcribe_model: str = "whisper-1"
    openai_llm_model: str = "gpt-4o-mini"

    resend_api_key: str | None = None
    email_from: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
```

---

```python
===== FILE: services/api/app/auth.py =====
from __future__ import annotations

import requests

from .errors import AppError
from .settings import settings


def verify_supabase_token(access_token: str) -> str:
    """
    Minimal MVP verification:
    - Call Supabase auth user endpoint with the bearer token
    - Return user id
    """
    url = f"{settings.supabase_url}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "apikey": settings.supabase_anon_key,
    }
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise AppError(code="AUTH_INVALID", message="Invalid or expired token")
    data = resp.json()
    user_id = data.get("id")
    if not user_id:
        raise AppError(code="AUTH_INVALID", message="Missing user id")
    return user_id
```

---

```python
===== FILE: services/api/app/errors.py =====
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AppError(Exception):
    code: str
    message: str
```

---

```python
===== FILE: services/api/app/db.py =====
from __future__ import annotations

from supabase import create_client, Client

from .settings import settings


def supabase_service() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
```

---

```python
===== FILE: services/api/app/models.py =====
from __future__ import annotations

from pydantic import BaseModel, Field


class Envelope(BaseModel):
    success: bool = True
    data: dict


class ErrorEnvelope(BaseModel):
    success: bool = False
    error: dict


class CreateLessonRequest(BaseModel):
    studentId: str
    title: str | None = None
    audioStoragePath: str = Field(min_length=1)


class LessonStatusResponse(BaseModel):
    lessonId: str
    status: str
    step: str
    progress: int
    lastError: str | None = None
```

---

```python
===== FILE: services/api/app/services/openai_client.py =====
from __future__ import annotations

from openai import OpenAI

from ..settings import settings


def client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)
```

---

```python
===== FILE: services/api/app/services/ai_pipeline.py =====
from __future__ import annotations

import json
from pathlib import Path

from openai import OpenAI

from packages.ai_contract.src.validate import validate_json, load_schema

AI_ROOT = Path(__file__).resolve().parents[3] / "packages" / "ai_contract"


def _load_prompt(name: str) -> str:
    return (AI_ROOT / "prompts" / name).read_text(encoding="utf-8")


def transcribe(oai: OpenAI, audio_file_path: str) -> str:
    with open(audio_file_path, "rb") as f:
        result = oai.audio.transcriptions.create(
            model="whisper-1",
            file=f,
        )
    return result.text


def extract(oai: OpenAI, transcript: str) -> dict:
    schema_path = AI_ROOT / "schema" / "lesson_extraction.schema.json"
    prompt = _load_prompt("extraction.md").replace(
        "{{SCHEMA_JSON}}", schema_path.read_text(encoding="utf-8")
    )
    prompt = prompt + "\n\nTRANSCRIPT:\n" + transcript

    res = oai.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    raw = res.choices[0].message.content or "{}"
    data = json.loads(raw)

    validate_json(data, load_schema(schema_path))
    return data


def generate(oai: OpenAI, extraction_json: dict) -> dict:
    schema_path = AI_ROOT / "schema" / "outputs.schema.json"
    schema = load_schema(schema_path)
    extraction_str = json.dumps(extraction_json, ensure_ascii=False)

    def run_one(prompt_name: str) -> str:
        prompt = _load_prompt(prompt_name).replace("{{EXTRACTION_JSON}}", extraction_str)
        res = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return (res.choices[0].message.content or "").strip()

    outputs = {
        "student_recap": run_one("student_recap.md"),
        "practice_plan": run_one("practice_plan.md"),
        "parent_email": run_one("parent_email.md"),
    }
    validate_json(outputs, schema)
    return outputs
```

---

```python
===== FILE: services/api/app/services/emailer.py =====
from __future__ import annotations

from ..settings import settings


def can_send() -> bool:
    return bool(settings.resend_api_key and settings.email_from)


def build_mailto(to: str, subject: str, body: str) -> str:
    import urllib.parse
    return f"mailto:{urllib.parse.quote(to)}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote(body)}"
```

---

```python
===== FILE: services/api/app/routes/health.py =====
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"success": True, "data": {"status": "ok"}}
```

---

```python
===== FILE: services/api/app/routes/students.py =====
from __future__ import annotations

from fastapi import APIRouter, Header

from ..auth import verify_supabase_token
from ..db import supabase_service
from ..errors import AppError

router = APIRouter(prefix="/v1/students", tags=["students"])


@router.get("")
def list_students(authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    sb = supabase_service()
    res = sb.table("students").select("*").eq("owner_id", user_id).order("created_at", desc=True).execute()
    return {"success": True, "data": {"students": res.data}}


@router.post("")
def create_student(payload: dict, authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    name = (payload.get("name") or "").strip()
    if not name:
        raise AppError(code="VALIDATION", message="Student name required")

    sb = supabase_service()
    res = sb.table("students").insert(
        {
            "owner_id": user_id,
            "name": name,
            "instrument": payload.get("instrument"),
            "parent_email": payload.get("parent_email"),
        }
    ).execute()
    return {"success": True, "data": {"student": res.data[0]}}
```

---

```python
===== FILE: services/api/app/routes/lessons.py =====
from __future__ import annotations

import tempfile
from fastapi import APIRouter, Header

from ..auth import verify_supabase_token
from ..db import supabase_service
from ..errors import AppError
from ..models import CreateLessonRequest
from ..services.openai_client import client as openai_client
from ..services.ai_pipeline import transcribe, extract, generate

router = APIRouter(prefix="/v1/lessons", tags=["lessons"])


@router.post("")
def create_lesson(req: CreateLessonRequest, authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    sb = supabase_service()

    lesson = sb.table("lessons").insert(
        {
            "owner_id": user_id,
            "student_id": req.studentId,
            "title": req.title,
            "status": "TRANSCRIBING",
            "audio_path": req.audioStoragePath,
        }
    ).execute().data[0]

    job = sb.table("jobs").insert(
        {"owner_id": user_id, "lesson_id": lesson["id"], "step": "TRANSCRIBING", "progress": 5}
    ).execute().data[0]

    # MVP pipeline runs inline for simplicity.
    # For longer audio, migrate this to a worker without changing API contract.

    try:
        oai = openai_client()

        # Downloading audio from storage is environment specific.
        # In MVP, expect the client to also upload a short proxy file to the API in a later iteration.
        # For now, we fail fast if we cannot access the file.
        raise AppError(code="NOT_IMPLEMENTED", message="Audio fetch from storage not wired yet")

    except AppError as e:
        sb.table("lessons").update({"status": "FAILED", "error_code": e.code, "error_message": e.message}).eq(
            "id", lesson["id"]
        ).execute()
        sb.table("jobs").update({"step": "FAILED", "progress": 100, "last_error": e.message}).eq("id", job["id"]).execute()
        return {"success": False, "error": {"code": e.code, "message": e.message}}

    except Exception as e:
        msg = str(e)
        sb.table("lessons").update({"status": "FAILED", "error_code": "UNKNOWN", "error_message": msg}).eq(
            "id", lesson["id"]
        ).execute()
        sb.table("jobs").update({"step": "FAILED", "progress": 100, "last_error": msg}).eq("id", job["id"]).execute()
        return {"success": False, "error": {"code": "UNKNOWN", "message": msg}}


@router.get("/{lesson_id}/status")
def lesson_status(lesson_id: str, authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    sb = supabase_service()
    lesson = sb.table("lessons").select("*").eq("id", lesson_id).eq("owner_id", user_id).single().execute().data
    job = sb.table("jobs").select("*").eq("lesson_id", lesson_id).eq("owner_id", user_id).single().execute().data

    return {
        "success": True,
        "data": {
            "lessonId": lesson_id,
            "status": lesson["status"],
            "step": job["step"],
            "progress": job["progress"],
            "lastError": job.get("last_error"),
        },
    }
```

---

```python
===== FILE: services/api/app/routes/outputs.py =====
from __future__ import annotations

from fastapi import APIRouter, Header

from ..auth import verify_supabase_token
from ..db import supabase_service
from ..services.emailer import can_send, build_mailto

router = APIRouter(prefix="/v1/outputs", tags=["outputs"])


@router.patch("/{output_id}")
def update_output(output_id: str, payload: dict, authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    edited = payload.get("editedContent")
    sb = supabase_service()
    res = sb.table("outputs").update({"edited_content": edited}).eq("id", output_id).eq("owner_id", user_id).execute()
    return {"success": True, "data": {"output": res.data[0]}}


@router.post("/{output_id}/sent")
def mark_sent(output_id: str, payload: dict, authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    sb = supabase_service()
    res = sb.table("outputs").update(
        {"sent_to": payload.get("sentTo"), "sent_via": payload.get("sentVia"), "sent_at": "now()"}
    ).eq("id", output_id).eq("owner_id", user_id).execute()
    return {"success": True, "data": {"output": res.data[0]}}


@router.post("/{output_id}/send-email")
def send_email(output_id: str, payload: dict, authorization: str = Header(...)) -> dict:
    """
    MVP behavior:
    - If Resend configured, later implement real send.
    - Otherwise return a mailto link the app can open.
    """
    token = authorization.replace("Bearer ", "")
    user_id = verify_supabase_token(token)

    sb = supabase_service()
    out = sb.table("outputs").select("*").eq("id", output_id).eq("owner_id", user_id).single().execute().data

    to = payload.get("to") or out.get("sent_to")
    subject = "Lesson summary"
    body = (out.get("edited_content") or out.get("content") or "").strip()

    if not can_send():
        return {"success": True, "data": {"method": "mailto", "mailto": build_mailto(to, subject, body)}}

    return {"success": False, "error": {"code": "NOT_IMPLEMENTED", "message": "Resend integration stub"}}
```

---

```python
===== FILE: services/api/app/main.py =====
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .errors import AppError
from .routes.health import router as health_router
from .routes.students import router as students_router
from .routes.lessons import router as lessons_router
from .routes.outputs import router as outputs_router

app = FastAPI(title="Note By Note API", version="0.1.0")

app.include_router(health_router)
app.include_router(students_router)
app.include_router(lessons_router)
app.include_router(outputs_router)


@app.exception_handler(AppError)
def app_error_handler(_, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"success": False, "error": {"code": exc.code, "message": exc.message}})
```

---

```python
===== FILE: services/api/tests/test_health.py =====
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ok"
```

---

```python
===== FILE: services/api/tests/test_pipeline_contract.py =====
from __future__ import annotations

import json

from packages.ai_contract.src.validate import validate_json, load_schema


def test_outputs_schema_validates() -> None:
    schema = load_schema(__import__("pathlib").Path("packages/ai_contract/schema/outputs.schema.json"))
    sample = {
        "student_recap": "x" * 60,
        "practice_plan": "y" * 120,
        "parent_email": "z" * 60,
    }
    validate_json(sample, schema)
```

---

```json
===== FILE: apps/mobile/package.json =====
{
  "name": "notebynote-mobile",
  "private": true,
  "version": "0.1.0",
  "main": "src/App.tsx",
  "scripts": {
    "start": "expo start",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "expo": "^51.0.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

---

```json
===== FILE: apps/mobile/app.json =====
{
  "expo": {
    "name": "Note By Note",
    "slug": "notebynote",
    "scheme": "notebynote",
    "platforms": ["ios", "android", "web"]
  }
}
```

---

```json
===== FILE: apps/mobile/tsconfig.json =====
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react",
    "strict": true,
    "skipLibCheck": true
  }
}
```

---

```tsx
===== FILE: apps/mobile/src/App.tsx =====
import React, { useState } from "react";
import { SafeAreaView, View, Button, Text } from "react-native";
import RecordScreen from "./screens/RecordScreen";
import ReviewScreen from "./screens/ReviewScreen";

export default function App() {
  const [screen, setScreen] = useState<"record" | "review">("record");
  const [lessonId, setLessonId] = useState<string | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      {screen === "record" && (
        <RecordScreen
          onCreated={(id) => {
            setLessonId(id);
            setScreen("review");
          }}
        />
      )}
      {screen === "review" && lessonId && (
        <ReviewScreen
          lessonId={lessonId}
          onBack={() => setScreen("record")}
        />
      )}
      <View style={{ padding: 12 }}>
        <Text style={{ color: "#888" }}>MVP navigation placeholder</Text>
      </View>
    </SafeAreaView>
  );
}
```

---

```ts
===== FILE: apps/mobile/src/lib/api.ts =====
export async function apiGet(path: string, token: string) {
  const res = await fetch(`http://localhost:8000${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function apiPost(path: string, token: string, body: any) {
  const res = await fetch(`http://localhost:8000${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return res.json();
}
```

---

```ts
===== FILE: apps/mobile/src/lib/supabase.ts =====
import { createClient } from "@supabase/supabase-js";

// In MVP, inject via env or app config.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

```tsx
===== FILE: apps/mobile/src/screens/RecordScreen.tsx =====
import React, { useState } from "react";
import { View, Button, Text } from "react-native";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";

export default function RecordScreen(props: { onCreated: (lessonId: string) => void }) {
  const [status, setStatus] = useState<string>("idle");

  async function createLessonStub() {
    setStatus("creating");

    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      setStatus("auth required");
      return;
    }

    // MVP stub: audio upload wiring comes next.
    const resp = await apiPost("/v1/lessons", session.access_token, {
      studentId: "REPLACE_ME",
      title: "Lesson",
      audioStoragePath: "REPLACE_ME"
    });

    if (!resp.success) {
      setStatus(resp.error?.message || "error");
      return;
    }

    props.onCreated(resp.data.lessonId);
  }

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 22, marginBottom: 12 }}>Record</Text>
      <Button title="Create lesson and process (stub)" onPress={createLessonStub} />
      <Text style={{ color: "#888", marginTop: 12 }}>{status}</Text>
    </View>
  );
}
```

---

```tsx
===== FILE: apps/mobile/src/screens/ReviewScreen.tsx =====
import React, { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { supabase } from "../lib/supabase";
import { apiGet } from "../lib/api";

export default function ReviewScreen(props: { lessonId: string; onBack: () => void }) {
  const [status, setStatus] = useState<any>(null);

  async function refresh() {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const resp = await apiGet(`/v1/lessons/${props.lessonId}/status`, session.access_token);
    setStatus(resp);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: "#fff", fontSize: 22, marginBottom: 12 }}>Review</Text>
      <Button title="Refresh status" onPress={refresh} />
      <Text style={{ color: "#888", marginTop: 12 }}>
        {JSON.stringify(status, null, 2)}
      </Text>
      <Button title="Back" onPress={props.onBack} />
    </View>
  );
}
```



</example2>
<example3>

Grok Master Docs

==============


# Note By Note - AI Practice Plan Generator for Music Teachers

## Overview
An AI-powered mobile and web app for music teachers to record lessons and automatically generate student recaps, practice plans, and parent emails. This MVP focuses on efficiency, reducing admin time from hours to seconds, with a sleek dark-mode UI. Built for solo teachers ($49/month) and studios ($99/month), targeting 100,000+ US private music instructors.

**Core Features**:
- Audio Recording: Simple one-tap interface.
- AI Processing: Whisper for transcription + LLM for extraction and generation.
- 3-Output Generation: Student Recap, Practice Plan, Parent Email.
- Review Mode: Edit outputs before sending.
- Historical Storage: Database of past lessons and students.

**Tech Stack** (Pragmatic for MVP - Unified codebase, serverless where possible):
| Component | Technology | Reasoning |
|-----------|------------|-----------|
| Frontend (Mobile + Web) | React Native (via Expo) | Single codebase for iOS and Web; Expo for easy deployment and navigation. |
| UI Library | Tamagui (Tailwind for RN) | Sleek, minimalist styling with dark mode support. |
| Backend API | FastAPI (Python) | High performance, native AI library support. |
| Database | PostgreSQL (via Supabase) | Managed DB with auth, storage, and realtime; handles user tiers and lesson history. |
| AI Services | OpenAI Whisper (Transcription) + GPT-4o (Generation) | Aligns with PDF: Tuned templates for teacher-like outputs. |
| Testing | Pytest (Backend), Jest (Frontend) | 80%+ coverage with mocks and golden fixtures. |
| CI/CD | GitHub Actions | Automated testing, coverage enforcement. |
| DevOps | Supabase CLI, Expo EAS | Quick setup, no infra management. |

**Development Standards**:
- Testing: >80% coverage; all PRs must pass.
- UI: Dark mode default; minimalist typography (e.g., Inter font, 16px base).
- Code Style: PEP8 (Python), Prettier (JS/TS).
- Latency: Transcription + Generation <60s for standard lessons.
- Security: Supabase Row Level Security (RLS) for user data isolation.

**Monorepo Structure** (For AI Agents - Extend this scaffold):
```
note-by-note/
├── backend/                  # FastAPI service
│   ├── main.py               # Core app with endpoints
│   ├── test_main.py          # Tests with mocks
│   ├── requirements.txt      # Dependencies
│   └── prompts/              # LLM system prompts
├── frontend/                 # React Native app
│   ├── App.js                # Entry point
│   ├── screens/              # RecordScreen.js, ReviewScreen.js
│   ├── services/             # api.js for backend calls
│   └── package.json          # Dependencies
├── shared/                   # Shared types, schemas
│   ├── database.ts           # Prisma-like TypeScript types
│   └── lesson.schema.json    # JSON Schema for outputs
├── tests/                    # Golden fixtures and runners
│   ├── golden/               # Fixture files (transcript + expected)
│   └── run_regression.py     # Pipeline tester
├── prisma/                   # Database schema
│   └── schema.prisma         # Models and enums
├── .github/workflows/        # CI/CD YAML
├── README.md                 # This file
└── Makefile                  # Quick commands (e.g., make test)
```

**Setup Instructions** (For Agents - Run Locally):
1. Clone repo.
2. Backend: `cd backend; pip install -r requirements.txt; uvicorn main:app --reload`.
3. Frontend: `cd frontend; yarn install; expo start`.
4. Database: `supabase start` (local) or deploy to Supabase.
5. Env: Add `.env` with `OPENAI_API_KEY` and `SUPABASE_URL/KEY`.
6. Test: `make test` (Runs backend/frontend tests + regression).

## Product Requirements Document (PRD)

### Problem Statement
Music teachers spend hours post-lesson writing notes, plans, and emails, leading to burnout. The PDF describes a teacher at 9pm still planning for 23 students, emailing parents by 11pm.

### Solution Overview
Mobile/web app: Record lesson → AI transcribes → Extracts musical details → Generates 3 editable outputs → Send/store.

### User Personas
- **Solo Teacher (Sarah)**: Independent instructor; needs quick efficiency; $49/month.
- **Studio Owner (Michael)**: Manages multiple teachers/students; needs multi-user support; $99/month.

### Core Functional Requirements (MVP)
| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|----------------------|
| REC-001 | Audio Capture | One-tap recording on mobile/web. | Starts in <500ms; handles up to 60min; saves as .m4a. |
| TRX-001 | AI Transcription | Upload audio to backend; use Whisper. | Returns text transcript; <30s for 10min audio. |
| GEN-001 | Intelligence Layer | LLM extracts: mistakes, techniques, pieces, tempos. | Outputs JSON with extracted fields; accuracy >90% on test fixtures. |
| GEN-002 | Output Generation | Generate 3 docs: Recap (encouraging wins/areas), Plan (daily breakdowns), Email (progress summary). | Matches teacher tone; editable; uses templates. |
| REV-001 | Review Flow | Display/edit outputs before send. | UI shows 3 sections; saves edits to DB. |
| STO-001 | Historical Storage | Store lessons, students, outputs. | Queryable by user; soft deletes. |
| AUT-001 | User Auth | Supabase auth for sign-up/login. | Supports tiers; limits lessons/month (e.g., 100 for Solo). |

### Non-Functional Requirements
- UI/UX: Dark mode; minimalist (e.g., hex #1A1A1A background, #FFFFFF text).
- Performance: End-to-end <60s.
- Security: RLS on DB; encrypt audio in storage.
- Accessibility: WCAG 2.1 compliant.
- Scalability: Handle 850 users (per PDF target for $500K ARR).

### User Flows (ASCII Diagram)
```
Home → Student List → Select Student → Record Screen (Tap Record)
          ↓ (Stop Recording)
Upload → Process (Transcription → Extraction → Generation)
          ↓
Review Screen (Edit Recap/Plan/Email) → Send/Store
          ↓
History View (Past Lessons)
```

## System Architecture
High-Level Flow:
```
Frontend (Expo) → API (FastAPI) → AI (OpenAI) → DB (Supabase)
- Audio upload via multipart.
- Async processing if >10min (MVP: sync).
- Realtime updates via Supabase subscriptions.
```

## Database Schema (Prisma Format - Use with Supabase)
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Plan {
  SOLO
  STUDIO
}

enum Instrument {
  PIANO
  VIOLIN
  // ... (full list from Epsilon)
}

enum LessonStatus {
  CREATED
  RECORDING
  UPLOADING
  TRANSCRIBING
  GENERATING
  COMPLETED
  FAILED
}

enum OutputType {
  STUDENT_RECAP
  PRACTICE_PLAN
  PARENT_EMAIL
}

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  firstName       String?
  lastName        String?
  plan            Plan      @default(SOLO)
  lessonsThisMonth Int      @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  students        Student[]
  lessons         Lesson[]
  settings        Settings?
}

model Student {
  id            String      @id @default(uuid())
  userId        String
  firstName     String
  lastName      String
  parentEmail   String
  instrument    Instrument
  // ... (full fields from Epsilon)
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessons       Lesson[]
}

model Lesson {
  id            String        @id @default(uuid())
  userId        String
  studentId     String
  audioUrl      String?
  status        LessonStatus  @default(CREATED)
  // ... (full fields)
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  student       Student       @relation(fields: [studentId], references: [id], onDelete: Cascade)
  transcript    Transcript?
  outputs       Output[]
}

model Transcript {
  id          String    @id @default(uuid())
  lessonId    String    @unique
  fullText    String
  // ... (segments, etc.)
  lesson      Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}

model Output {
  id            String      @id @default(uuid())
  lessonId      String
  type          OutputType
  content       String
  editedContent String?
  // ... 
  lesson        Lesson      @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}

// Additional models: Settings, AuditLog (from Epsilon)
```

**Migrations & Seed**: Include SQL for full-text search (from Epsilon). Seed with demo user/students.

## API Specs (OpenAPI Style)
Endpoint: POST /process-lesson
- Request: Multipart file (audio).
- Response: JSON { transcript: str, outputs: { recap: str, plan: str, email: str } }
- Errors: 500 on failure; include codes.

Other Endpoints: /users, /students, /lessons (CRUD with auth).

## AI Prompts & Schemas
**JSON Schema (lesson.schema.json - For Validation)**:
```json
{
  "type": "object",
  "properties": {
    "student_recap": { "type": "string" },
    "practice_plan": { "type": "string" },
    "parent_email": { "type": "string" }
  },
  "required": ["student_recap", "practice_plan", "parent_email"]
}
```

**System Prompt (prompts/music_teacher_generation.txt)**:
```
ROLE: Expert music teacher assistant.
INPUT: Lesson transcript.
TASK: Extract mistakes, techniques, pieces, tempos. Generate:
1. STUDENT_RECAP: Encouraging, specific wins/areas.
2. PRACTICE_PLAN: Daily format e.g., "Monday: C major scales, 10min."
3. PARENT_EMAIL: Professional summary, nudges.
CONSTRAINT: Human-like tone; JSON output.
```

## Code Scaffolds
### Backend (backend/main.py)
```python
from fastapi import FastAPI, UploadFile, HTTPException
from openai import OpenAI
import os, tempfile, shutil
from pydantic import BaseModel

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class LessonOutputs(BaseModel):
    student_recap: str
    practice_plan: str
    parent_email: str

def transcribe_audio(file_path: str) -> str:
    with open(file_path, "rb") as f:
        return client.audio.transcriptions.create(model="whisper-1", file=f).text

def generate_outputs(transcript: str) -> LessonOutputs:
    # Use prompt above; parse JSON response
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": transcript}],
        response_format={"type": "json_object"}
    )
    content = response.choices[0].message.content
    return LessonOutputs.parse_raw(content)  # Validate with schema

@app.post("/process-lesson")
async def process_lesson(file: UploadFile):
    with tempfile.NamedTemporaryFile(suffix=".m4a") as temp:
        shutil.copyfileobj(file.file, temp)
        transcript = transcribe_audio(temp.name)
        outputs = generate_outputs(transcript)
    return {"transcript": transcript, "outputs": outputs}
```

### Frontend (frontend/screens/RecordScreen.js)
```javascript
import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Audio } from 'expo-av';
import { processLessonAudio } from '../services/api';

export default function RecordScreen({ navigation }) {
  const [recording, setRecording] = useState(null);

  async function startRecording() {
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(recording);
  }

  async function stopRecording() {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const result = await processLessonAudio(uri);
    navigation.navigate('Review', { data: result });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1A', justifyContent: 'center' }}>
      <TouchableOpacity onPress={recording ? stopRecording : startRecording}>
        <Text style={{ color: '#FFF', fontSize: 24 }}>{recording ? 'Stop' : 'Record'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

// Additional: ReviewScreen.js with editable text areas.

## Testing Strategy
- **Unit/Integration**: Pytest for backend (mocks OpenAI); Jest for frontend.
- **Golden Fixtures**: From Beta - transcripts + expected outputs; run_regression.py validates pipeline.
- **Coverage**: .coveragerc enforces 80%.
- **E2E**: Simulate upload → process → validate schema.

**Example Test (test_main.py)**:
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)

@patch('main.client.audio.transcriptions.create')
@patch('main.client.chat.completions.create')
def test_process_lesson(mock_chat, mock_whisper):
    mock_whisper.return_value.text = "Mock transcript"
    mock_chat.return_value.choices[0].message.content = '{"student_recap": "Win!", "practice_plan": "Monday: Scales", "parent_email": "Progress!"}'
    response = client.post("/process-lesson", files={'file': ('test.m4a', b'fake', 'audio/m4a')})
    assert response.status_code == 200
    assert 'outputs' in response.json()
```

## CI/CD ( .github/workflows/ci.yml )
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Backend Tests
        run: cd backend; pip install -r requirements.txt; pytest --cov=. --cov-fail-under=80
      - name: Frontend Tests
        run: cd frontend; yarn install; yarn test
      - name: Regression
        run: python tests/run_regression.py
```

## AI Agent Implementation Steps
1. **Database Agent**: Deploy Prisma schema to Supabase; add RLS.
2. **Backend Agent**: Extend main.py with DB integration (prisma-py or SQLAlchemy).
3. **Frontend Agent**: Add student list, history screens; wire to API.
4. **QA Agent**: Generate more golden fixtures; tune prompts until 95% match on real lessons.
5. **Tune & Validate**: Compare outputs to manual teacher notes (per PDF); iterate.

This consolidated system provides executable scaffolds, strict contracts, comprehensive specs, and quality gates for a perfect MVP build.

</example3>
<example4>

# Note By Note — AI Practice Plan Generator for Music Teachers

[![CI](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-80%25+-blue)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

> **Mission**: Transform a 2-hour nightly admin burden into 20 seconds of review.

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [01_PRD.md](./01_PRD.md) | Product Requirements (personas, features, acceptance criteria) |
| [02_ARCHITECTURE.md](./02_ARCHITECTURE.md) | System architecture, tech stack, data flow |
| [03_DATABASE_SCHEMA.md](./03_DATABASE_SCHEMA.md) | Complete Prisma schema with TypeScript interfaces |
| [04_API_CONTRACT.md](./04_API_CONTRACT.md) | REST API endpoints with request/response schemas |
| [05_AI_CONTRACTS.md](./05_AI_CONTRACTS.md) | JSON Schemas for LLM extraction/generation |
| [06_PROMPTS.md](./06_PROMPTS.md) | System prompts for transcription analysis and output generation |
| [07_GOLDEN_FIXTURES.md](./07_GOLDEN_FIXTURES.md) | Regression test fixtures for AI pipeline |
| [08_CODE_PATTERNS.md](./08_CODE_PATTERNS.md) | Reference implementations (Backend + Frontend) |
| [09_TESTING.md](./09_TESTING.md) | Test strategy, CI/CD pipeline, coverage requirements |
| [10_DESIGN_SYSTEM.md](./10_DESIGN_SYSTEM.md) | UI/UX guidelines, color tokens, typography |

---

## The Problem

```
It's 9pm. The piano teacher finished her last student three hours ago.
She's still at the kitchen table.

Monday: C major scales, 10 minutes.
Tuesday: measures 5-8 of the recital piece.
Wednesday: the chord transition that keeps tripping him up.

Same instructions, slightly different words. Twenty-three students.
Then come the parent emails. Progress updates. Encouragement.
Gentle nudges about practice.

By 11pm she's done. Thursday she does it all again.
```

## The Solution

**Note By Note** listens so teachers don't have to write.

1. **Record** — Hit record on your phone. Teach the lesson like normal.
2. **Transcribe** — AI transcribes everything said using OpenAI Whisper.
3. **Generate** — LLM identifies what matters and generates three outputs:
   - **Student Recap**: Highlights wins and areas to work on
   - **Practice Plan**: Daily assignments with specific exercises
   - **Parent Email**: Professional summary of progress
4. **Review & Send** — Each output is editable before sending.

*Twenty minutes of typing becomes twenty seconds of review.*

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React Native + Expo | Single codebase for iOS + Web |
| **UI Framework** | NativeWind (Tailwind) | Sleek, dark-mode-first styling |
| **Backend API** | Python FastAPI | Native AI library support, high performance |
| **Database** | PostgreSQL (Supabase) | Auth, storage, realtime — zero server management |
| **Transcription** | OpenAI Whisper API | Best-in-class speech-to-text |
| **Generation** | OpenAI GPT-4o | Structured extraction and generation |
| **Testing** | Pytest + Jest + Golden Fixtures | 80%+ coverage with regression protection |
| **CI/CD** | GitHub Actions | Automated testing and deployment |

---

## Project Structure

```
note-by-note/
├── docs/                           # This specification
│   ├── 00_README.md
│   ├── 01_PRD.md
│   ├── ...
│   └── 10_DESIGN_SYSTEM.md
├── backend/                        # FastAPI service
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── services/
│   │   └── schemas/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_integration.py
│   │   └── golden/                 # Golden fixture tests
│   ├── requirements.txt
│   └── .env.example
├── mobile/                         # React Native Expo app
│   ├── app/
│   │   ├── (tabs)/
│   │   ├── record/
│   │   └── review/
│   ├── components/
│   ├── services/
│   ├── __tests__/
│   └── package.json
├── schemas/                        # Shared JSON Schemas
│   └── lesson_instruction.schema.json
├── fixtures/                       # Golden regression fixtures
│   └── golden/
│       ├── transcript.segments.json
│       ├── schema.expected.json
│       ├── recap.expected.md
│       ├── practice_plan.expected.md
│       └── parent_email.expected.md
├── .github/
│   └── workflows/
│       └── ci.yml
└── README.md
```

---

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env with your API key
echo "OPENAI_API_KEY=sk-..." > .env
echo "SUPABASE_URL=https://..." >> .env
echo "SUPABASE_KEY=..." >> .env

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest tests/ -v --cov=app --cov-fail-under=80
```

### Frontend Setup

```bash
cd mobile
npm install

# Update services/api.ts with your backend URL
npx expo start
```

---

## Development Standards

### For AI Agents

1. **Read the contracts first**: Before writing code, read `05_AI_CONTRACTS.md` and `04_API_CONTRACT.md`
2. **Match the patterns**: Reference `08_CODE_PATTERNS.md` for implementation style
3. **Test against golden fixtures**: All AI outputs must pass `07_GOLDEN_FIXTURES.md` regression tests
4. **Maintain 80% coverage**: All PRs must pass coverage threshold

### Code Style

- **Python**: PEP8, Black formatter, type hints required
- **TypeScript**: Prettier, ESLint, strict mode enabled
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`)

---

## Business Context

| Metric | Value |
|--------|-------|
| **Target Market** | 100,000+ private music instructors in the US |
| **Primary Pain** | Teachers spend 2-3 hours nightly on admin |
| **Pricing** | $49/month (Solo) · $99/month (Studio) |
| **MVP Goal** | 850 teachers = $500K ARR |
| **Timeline** | 12-18 months to target |

---

## MVP Scope

### In Scope (P0)
- [x] Audio recording (iOS + Web)
- [x] AI transcription via Whisper
- [x] LLM extraction of musical instruction
- [x] Three-output generation (Recap, Plan, Email)
- [x] Editable review screen
- [x] Student management
- [x] Lesson history
- [x] Dark mode UI
- [x] 80% test coverage

### Out of Scope (Post-MVP)
- [ ] Payment integration (Stripe)
- [ ] Email delivery (SendGrid/Resend)
- [ ] Parent portal
- [ ] Analytics dashboard
- [ ] Android app
- [ ] Offline recording
- [ ] Multi-language support

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time Saved | 90% reduction | User surveys |
| Output Quality | 85% sent without edits | Edit rate analytics |
| User Retention | 80% month-over-month | Subscription renewals |
| Test Coverage | 80%+ maintained | CI enforcement |

---

*Built with ❤️ for music teachers everywhere.*

# Product Requirements Document (PRD)

**Version**: 1.0.0-MVP  
**Status**: Ready for Development  
**Last Updated**: January 2025

---

## 1. Executive Summary

### 1.1 Product Vision

Note By Note transforms music lesson recordings into actionable practice plans, student recaps, and parent communications using AI. The platform eliminates the 2-3 hours teachers spend daily on administrative tasks.

### 1.2 Problem Statement

Private music teachers face a critical administrative bottleneck:

| Pain Point | Impact |
|------------|--------|
| **Time sink** | Teachers with 20+ students spend 2-3 hours nightly writing |
| **Inconsistency** | Manual notes vary in quality based on energy and time |
| **Delayed communication** | Parents often receive updates days after lessons |
| **No leverage** | Same content written repeatedly with slight variations |
| **Burnout** | Leads to unpaid labor late into the night |

### 1.3 Solution

An AI-powered mobile and web application that:

1. Records lesson audio with a single tap
2. Transcribes and analyzes the lesson using AI
3. Generates three outputs: Student Recap, Practice Plan, Parent Email
4. Allows quick editing before sending
5. Maintains a searchable history of all lessons

---

## 2. User Personas

### 2.1 Primary: Sarah the Solo Teacher

**Demographics**
- Age: 35-55
- Location: Suburban USA
- Income: $40,000-80,000/year from teaching
- Technical proficiency: Moderate

**Profile**

Sarah is a piano teacher with 25 weekly students ranging from beginners to advanced. She teaches from her home studio. After lessons end at 6pm, she spends 2-3 hours writing practice plans and parent emails.

**Goals**
- Reduce administrative time without sacrificing quality
- Send professional communications to parents
- Track student progress over time
- Maintain work-life balance

**Pain Points**
- Spends more time writing than teaching
- Forgets lesson details when writing later
- Inconsistent quality of notes when tired
- No searchable history of past lessons

**Quote**: *"I love teaching, but the paperwork is killing me."*

### 2.2 Secondary: Michael the Studio Owner

**Demographics**
- Age: 40-60
- Location: Urban/Suburban USA
- Income: $100,000-200,000/year from studio
- Technical proficiency: High

**Profile**

Michael owns a music studio with 5 teachers and 150 students. He needs consistent communication standards across all teachers.

**Goals**
- Standardize communications across all teachers
- Monitor teacher-parent communications
- Scale the studio without administrative overhead

**Pain Points**
- Inconsistent communication quality between teachers
- No visibility into lesson content
- High teacher turnover due to admin burden

---

## 3. Feature Requirements

### 3.1 Priority Matrix

| Priority | Feature | User Value | Complexity |
|----------|---------|------------|------------|
| **P0** | Audio Recording | Critical | Low |
| **P0** | AI Transcription | Critical | Medium |
| **P0** | Practice Plan Generation | Critical | High |
| **P0** | Student Recap Generation | Critical | High |
| **P0** | Parent Email Generation | Critical | High |
| **P0** | Output Editing | Critical | Low |
| **P1** | Student Management | High | Medium |
| **P1** | User Authentication | Critical | Low |
| **P1** | Lesson History | High | Low |
| **P2** | Template Customization | Medium | Medium |
| **P2** | Progress Tracking | Medium | High |
| **P3** | Email Integration | Low | Medium |
| **P3** | Analytics Dashboard | Low | High |

---

### 3.2 Core Features (P0 — MVP Required)

#### 3.2.1 Audio Recording

**Description**: One-tap lesson recording with background-capable audio capture.

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REC-001 | Single tap to start recording | Recording starts within 500ms of button press |
| REC-002 | Visual recording indicator | Pulsing red dot visible at all times during recording |
| REC-003 | Recording timer display | Shows elapsed time in MM:SS format |
| REC-004 | Background recording support | Recording continues when app is backgrounded |
| REC-005 | Pause/Resume functionality | User can pause and resume without creating new files |
| REC-006 | Auto-save on interruption | Recording saved if call received or app crashes |
| REC-007 | Audio quality settings | Minimum 16kHz sample rate, mono, AAC codec |
| REC-008 | Maximum recording length | Support recordings up to 90 minutes |
| REC-009 | Storage indication | Show estimated storage remaining |
| REC-010 | Stop and process action | Single action to stop recording and initiate processing |

**Technical Specifications**
- Audio format: AAC, 64kbps, mono, 16kHz minimum
- Maximum file size: ~100MB (90 minutes)
- Local storage with background upload
- Waveform visualization during recording

---

#### 3.2.2 AI Transcription

**Description**: Convert recorded audio to text using OpenAI Whisper API.

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| TRX-001 | Automatic transcription | Transcription begins automatically after recording stops |
| TRX-002 | Processing indicator | Show progress with status messages |
| TRX-003 | Speaker identification | Distinguish between teacher and student speech |
| TRX-004 | Music terminology accuracy | 95%+ accuracy on common music terms |
| TRX-005 | Timestamp alignment | Transcript segments aligned to audio timestamps |
| TRX-006 | Error handling | Clear error messages with retry option |
| TRX-007 | Transcript viewing | Full transcript viewable after processing |
| TRX-008 | Processing time | Complete within 2x audio length |

**Technical Specifications**
- API: OpenAI Whisper API (whisper-1)
- Chunking: Split audio into 25MB chunks if needed
- Language: English (expandable)
- Response format: Verbose JSON with timestamps

---

#### 3.2.3 AI Content Generation

**Description**: Generate three outputs from the transcription using LLM.

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| GEN-001 | Generate Student Recap | 150-180 words, encouraging tone, specific wins and focus areas |
| GEN-002 | Generate Practice Plan | 6-day breakdown with daily assignments, specific exercises |
| GEN-003 | Generate Parent Email | Professional summary, 180-220 words, clear expectations |
| GEN-004 | Music-domain accuracy | Correctly identify techniques, pieces, and terminology |
| GEN-005 | Personalization | Include student name and specific details from lesson |
| GEN-006 | Tone consistency | Maintain encouraging, professional tone |
| GEN-007 | Actionable items | Practice items are specific and measurable |
| GEN-008 | Generation time | All three outputs generated within 30 seconds |
| GEN-009 | Evidence grounding | All extracted items must cite transcript evidence |

**Output Specifications**

**Student Recap Structure**
```
- Title: "Lesson Recap"
- Sections:
  - Wins (2-3 items)
  - Focus areas (2-4 items)
  - Next lesson preview
- Length: 150-180 words
- Tone: Positive, specific, actionable
```

**Practice Plan Structure**
```
- Title: "Practice Plan"
- Days: Day 1 through Day 6
- Per day: 3 tasks
- Per task: (minutes) category: specific instruction
- Total: ~25 minutes per day
- Include: Tempo targets when mentioned
```

**Parent Email Structure**
```
- Greeting
- Short positive opener
- 2-4 bullet highlights
- Practice expectations for the week
- Friendly closing
- Length: 180-220 words
- Tone: Warm, confident, professional
```

---

#### 3.2.4 Output Editing

**Description**: Teachers can edit generated content before finalizing.

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| EDT-001 | Inline editing | All three outputs editable in place |
| EDT-002 | Auto-save drafts | Changes saved automatically |
| EDT-003 | Regenerate option | Can regenerate individual outputs |
| EDT-004 | Copy to clipboard | One-tap copy for any output |
| EDT-005 | Share sheet integration | Native share to email, messages, etc. |
| EDT-006 | Undo/redo | Support for reverting changes |

---

### 3.3 Essential Features (P1)

#### 3.3.1 Student Management

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| STU-001 | Add student | Name, instrument, parent email required |
| STU-002 | Edit student | All fields editable |
| STU-003 | Delete student | Soft delete with confirmation |
| STU-004 | Student list | Searchable, sortable list |
| STU-005 | Skill level | Track beginner/intermediate/advanced |

#### 3.3.2 User Authentication

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| AUTH-001 | Email/password signup | Standard registration flow |
| AUTH-002 | OAuth support | Google and Apple sign-in |
| AUTH-003 | Session persistence | Stay logged in across app restarts |
| AUTH-004 | Password reset | Email-based recovery |

#### 3.3.3 Lesson History

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| HIS-001 | View past lessons | List view with date and student |
| HIS-002 | Re-access outputs | View/copy previous recaps, plans, emails |
| HIS-003 | Filter by student | View lessons for specific student |
| HIS-004 | Search transcripts | Full-text search across all transcripts |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Requirement | Target |
|-------------|--------|
| App launch time | < 2 seconds |
| Recording start latency | < 500ms |
| Transcription speed | < 2x audio length |
| Generation speed | < 30 seconds for all outputs |
| Upload speed | Background, resumable |

### 4.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Data encryption | TLS 1.3 in transit, AES-256 at rest |
| Authentication | JWT with short expiry, refresh tokens |
| Audio storage | Encrypted, access-controlled |
| API security | Rate limiting, input validation |
| GDPR compliance | Data export, deletion on request |

### 4.3 Accessibility

| Requirement | Target |
|-------------|--------|
| WCAG compliance | Level AA |
| Screen reader support | Full VoiceOver/TalkBack compatibility |
| Font scaling | Support system font size settings |
| Color contrast | Minimum 4.5:1 ratio |

### 4.4 Quality

| Requirement | Target |
|-------------|--------|
| Test coverage | ≥80% unit + integration |
| Crash-free rate | ≥99.5% |
| Error logging | All errors tracked with context |
| Golden fixture regression | 100% pass rate |

---

## 5. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time Saved | 90% reduction in admin time | User surveys, time tracking |
| User Adoption | 500 paying users in 6 months | Subscription count |
| Output Quality | 85% sent without edits | Edit rate analytics |
| User Retention | 80% month-over-month | Subscription renewals |
| NPS Score | 50+ | Quarterly surveys |
| Test Coverage | 80%+ maintained | CI enforcement |

---

## 6. Out of Scope (Post-MVP)

- Payment/subscription management (Stripe)
- Email delivery service integration
- Parent portal / viewer accounts
- Analytics dashboard
- Android app (MVP is iOS + Web)
- Offline recording
- Multi-language support
- Integration with music notation software
- Calendar integration

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Lesson | A recorded teaching session with one student |
| Output | Any of the three generated documents (recap, plan, email) |
| Transcript | Text version of recorded audio |
| Golden Fixture | Reference test data for regression testing |
| Evidence | Transcript quote supporting an extracted item |

---

## Appendix B: References

- OpenAI Whisper API Documentation
- OpenAI GPT-4 API Documentation
- React Native + Expo Documentation
- Supabase Documentation
- WCAG 2.1 Guidelines

# System Architecture

**Version**: 1.0.0-MVP  
**Status**: Ready for Development

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER DEVICES                                 │
│                     (iOS App via Expo / Web Browser)                     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    Auth     │  │   Storage   │  │  Database   │  │    Realtime     │  │
│  │  (Clerk/    │  │  (Audio     │  │ (PostgreSQL)│  │  (WebSockets)   │  │
│  │  Supabase)  │  │   Files)    │  │             │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Internal
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI BACKEND                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        API ENDPOINTS                                 │ │
│  │   POST /lessons           POST /lessons/{id}/process                 │ │
│  │   GET  /lessons           GET  /lessons/{id}                         │ │
│  │   GET  /students          POST /students                             │ │
│  │   PUT  /outputs/{id}      GET  /health                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                       AI PROCESSING PIPELINE                         │ │
│  │                                                                       │ │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │ │
│  │   │  Audio   │───▶│ Whisper  │───▶│  Schema  │───▶│  Output  │      │ │
│  │   │  Input   │    │   API    │    │ Extract  │    │ Generate │      │ │
│  │   └──────────┘    └──────────┘    └──────────┘    └──────────┘      │ │
│  │                                         │              │              │ │
│  │                                         ▼              ▼              │ │
│  │                              ┌─────────────────────────────┐         │ │
│  │                              │    JSON Schema Validation   │         │ │
│  │                              │    (lesson_instruction)     │         │ │
│  │                              └─────────────────────────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         OPENAI APIs                                  │ │
│  │            whisper-1 (Transcription)  │  gpt-4o (Generation)        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack Details

### 2.1 Frontend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React Native | 0.73+ | Cross-platform mobile |
| Build Tool | Expo | 50+ | Development, builds, OTA updates |
| Navigation | Expo Router | 3.0+ | File-based routing |
| Styling | NativeWind | 4.0+ | Tailwind CSS for React Native |
| State | Zustand | 4.0+ | Lightweight state management |
| Audio | expo-av | 14+ | Recording and playback |
| HTTP | axios | 1.6+ | API communication |

### 2.2 Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | 0.109+ | High-performance async API |
| Runtime | Python | 3.11+ | Type hints, performance |
| Validation | Pydantic | 2.0+ | Request/response validation |
| Database | Prisma | 5.0+ | Type-safe ORM |
| Testing | Pytest | 8.0+ | Unit and integration tests |
| Coverage | coverage.py | 7.0+ | Code coverage reporting |

### 2.3 Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | Supabase PostgreSQL | Relational data storage |
| Auth | Supabase Auth / Clerk | User authentication |
| Storage | Supabase Storage | Audio file storage |
| Realtime | Supabase Realtime | WebSocket status updates |
| AI - Transcription | OpenAI Whisper API | Speech-to-text |
| AI - Generation | OpenAI GPT-4o | Content generation |
| CI/CD | GitHub Actions | Automated testing and deployment |

---

## 3. Core Data Flows

### 3.1 Record and Process Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RECORD AND PROCESS FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

[1. USER ACTION]
    │
    ▼
┌─────────────────┐
│  Select Student │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Tap Record     │──▶ Recording starts, timer visible
└─────────────────┘
    │
    │ (lesson in progress)
    │
    ▼
┌─────────────────┐
│  Tap Stop       │
└─────────────────┘
    │
    ▼
[2. UPLOAD PHASE]
    │
    ├──▶ Status: "Uploading audio..."
    │
    ├──▶ Audio saved to Supabase Storage
    │
    ├──▶ Lesson record created (status: UPLOADING)
    │
    ▼
[3. TRANSCRIPTION PHASE]
    │
    ├──▶ Status: "Transcribing lesson..."
    │
    ├──▶ Lesson status → TRANSCRIBING
    │
    ├──▶ Audio sent to Whisper API
    │
    ├──▶ Transcript segments returned with timestamps
    │
    ├──▶ Transcript saved to database
    │
    ▼
[4. EXTRACTION PHASE]
    │
    ├──▶ Status: "Analyzing content..."
    │
    ├──▶ Lesson status → EXTRACTING
    │
    ├──▶ Transcript + context sent to GPT-4o
    │
    ├──▶ LessonInstruction JSON extracted
    │
    ├──▶ Validated against JSON Schema
    │
    ├──▶ Extraction saved to database
    │
    ▼
[5. GENERATION PHASE]
    │
    ├──▶ Status: "Generating outputs..."
    │
    ├──▶ Lesson status → GENERATING
    │
    ├──▶ LessonInstruction → Student Recap
    │
    ├──▶ LessonInstruction → Practice Plan
    │
    ├──▶ LessonInstruction → Parent Email
    │
    ├──▶ Outputs saved to database
    │
    ├──▶ Lesson status → COMPLETED
    │
    ▼
[6. REVIEW PHASE]
    │
    ├──▶ User sees three editable outputs
    │
    ├──▶ User can edit any output
    │
    ├──▶ User can copy/share outputs
    │
    └──▶ Lesson saved with any edits
```

### 3.2 Status State Machine

```
UPLOADING ──▶ TRANSCRIBING ──▶ EXTRACTING ──▶ GENERATING ──▶ COMPLETED
     │              │               │               │
     └──────────────┴───────────────┴───────────────┴──────▶ FAILED
```

| Status | Description | User Message |
|--------|-------------|--------------|
| `UPLOADING` | Audio file being uploaded | "Uploading audio..." |
| `TRANSCRIBING` | Whisper API processing | "Transcribing lesson..." |
| `EXTRACTING` | LLM extracting structured data | "Analyzing content..." |
| `GENERATING` | LLM generating outputs | "Generating outputs..." |
| `COMPLETED` | All processing finished | (shows results) |
| `FAILED` | Error occurred | "Processing failed. Tap to retry." |

---

## 4. API Design Principles

### 4.1 RESTful Conventions

| Method | Path Pattern | Purpose |
|--------|--------------|---------|
| `GET` | `/resources` | List all resources |
| `GET` | `/resources/{id}` | Get single resource |
| `POST` | `/resources` | Create new resource |
| `PUT` | `/resources/{id}` | Update resource |
| `DELETE` | `/resources/{id}` | Delete resource |

### 4.2 Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Student ID is required",
    "details": { ... }
  }
}
```

### 4.3 Authentication

All endpoints except `/health` require authentication via Bearer token:

```http
Authorization: Bearer <jwt_token>
```

---

## 5. AI Pipeline Architecture

### 5.1 Two-Stage Processing

The AI pipeline uses a **two-stage architecture** to ensure reliability:

**Stage 1: Extraction**
- Input: Transcript segments with timestamps
- Output: Structured `LessonInstruction` JSON
- Validation: JSON Schema validation
- Purpose: Extract facts from transcript with evidence

**Stage 2: Generation**
- Input: Validated `LessonInstruction` JSON
- Output: Three text outputs (recap, plan, email)
- Validation: Word count limits, required markers
- Purpose: Generate human-readable content

### 5.2 Why Two Stages?

| Concern | One-Stage | Two-Stage |
|---------|-----------|-----------|
| Hallucination | High risk | Low risk (evidence required) |
| Debugging | Hard (black box) | Easy (inspect intermediate JSON) |
| Regression testing | Difficult | Easy (golden fixtures) |
| Output consistency | Variable | Controlled by schema |
| Retries | Must redo everything | Can retry just failed stage |

### 5.3 Contract-Driven Design

The `LessonInstruction` JSON Schema is the **contract** between:
- Extraction prompt and validation
- Generation prompts and outputs
- Golden fixture regression tests
- Frontend display logic

See `05_AI_CONTRACTS.md` for the complete schema.

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

[User Login]
     │
     ▼
┌─────────────────┐
│  Supabase Auth  │──▶ Returns JWT (access_token + refresh_token)
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Store Tokens   │──▶ Secure storage on device
└─────────────────┘
     │
     ▼
[API Request]
     │
     ▼
┌─────────────────┐
│  Attach Bearer  │──▶ Authorization: Bearer <access_token>
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Backend        │──▶ Verify JWT signature, extract user_id
│  Middleware     │
└─────────────────┘
     │
     ▼
[Process Request with user context]
```

### 6.2 Data Access Control

| Resource | Access Rule |
|----------|-------------|
| Students | User can only access their own students |
| Lessons | User can only access their own lessons |
| Audio files | Signed URLs with expiry, user-scoped |
| Transcripts | User can only view their own |
| Outputs | User can only view/edit their own |

### 6.3 API Security

| Measure | Implementation |
|---------|----------------|
| Rate limiting | 100 requests/minute per user |
| Input validation | Pydantic models for all inputs |
| SQL injection | Parameterized queries via Prisma |
| XSS prevention | Content-type headers, no HTML in API |
| CORS | Restricted to known origins |

---

## 7. Scalability Considerations

### 7.1 Current Architecture (MVP)

- Single FastAPI instance
- Supabase managed PostgreSQL
- Synchronous OpenAI API calls
- File storage in Supabase Storage

### 7.2 Future Scaling Path

| Bottleneck | Solution |
|------------|----------|
| API throughput | Horizontal scaling with load balancer |
| Database | Supabase managed scaling / read replicas |
| AI processing | Background job queue (Celery/Redis) |
| File storage | CDN for audio delivery |
| Long recordings | Chunked processing with progress |

---

## 8. Error Handling Strategy

### 8.1 Error Categories

| Category | Example | User Action | Backend Action |
|----------|---------|-------------|----------------|
| **Transient** | Network timeout | Auto-retry | Log, retry with backoff |
| **Client** | Invalid input | Show validation error | Return 400 |
| **Server** | Database connection | Show "Try again" | Log, alert, return 500 |
| **External** | OpenAI rate limit | Show "Processing delayed" | Queue, retry |

### 8.2 Retry Strategy

```python
# OpenAI API retry configuration
RETRY_CONFIG = {
    "max_attempts": 3,
    "initial_delay": 1.0,
    "backoff_multiplier": 2.0,
    "max_delay": 10.0,
    "retryable_errors": [
        "rate_limit_exceeded",
        "server_error",
        "timeout"
    ]
}
```

---

## 9. Monitoring and Observability

### 9.1 Logging

| Level | Use Case | Example |
|-------|----------|---------|
| `DEBUG` | Development tracing | Request/response bodies |
| `INFO` | Normal operations | Lesson created, processing started |
| `WARNING` | Recoverable issues | Retry attempted |
| `ERROR` | Failures | API error, validation failure |

### 9.2 Metrics (Post-MVP)

| Metric | Purpose |
|--------|---------|
| `lesson_processing_duration` | Track AI pipeline performance |
| `api_request_duration` | Monitor endpoint latency |
| `error_rate` | Track system health |
| `active_users` | Monitor usage |

---

## 10. Development Environment

### 10.1 Local Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload

# Frontend
cd mobile
npm install
npx expo start
```

### 10.2 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for Whisper + GPT-4o |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon/service key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT verification |
| `ENV` | No | `development` / `production` |


# Database Schema

**Version**: 1.0.0-MVP  
**ORM**: Prisma  
**Database**: PostgreSQL (Supabase)

---

## 1. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ENTITY RELATIONSHIP DIAGRAM                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │──────<│    Student   │──────<│    Lesson    │
│              │ 1   N │              │ 1   N │              │
│ id           │       │ id           │       │ id           │
│ email        │       │ userId       │       │ userId       │
│ firstName    │       │ firstName    │       │ studentId    │
│ lastName     │       │ lastName     │       │ audioUrl     │
│ plan         │       │ instrument   │       │ status       │
│ ...          │       │ skillLevel   │       │ duration     │
└──────────────┘       │ parentEmail  │       │ ...          │
       │               │ ...          │       └──────────────┘
       │               └──────────────┘              │
       │                                             │
       │                                    ┌────────┴────────┐
       │                                    │                 │
       ▼                               ┌────▼─────┐    ┌──────▼─────┐
┌──────────────┐                       │Transcript│    │   Output   │
│   Settings   │                       │          │    │            │
│              │                       │ id       │    │ id         │
│ id           │                       │ lessonId │    │ lessonId   │
│ userId       │                       │ segments │    │ type       │
│ notifications│                       │ fullText │    │ content    │
│ defaults     │                       │ ...      │    │ edited     │
│ preferences  │                       └──────────┘    │ ...        │
└──────────────┘                                       └────────────┘
```

---

## 2. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum Plan {
  SOLO    // $49/month - individual teacher
  STUDIO  // $99/month - multi-teacher studio
}

enum Instrument {
  PIANO
  VIOLIN
  VIOLA
  CELLO
  GUITAR
  VOICE
  FLUTE
  CLARINET
  DRUMS
  OTHER
}

enum SkillLevel {
  BEGINNER
  EARLY_INTERMEDIATE
  INTERMEDIATE
  LATE_INTERMEDIATE
  ADVANCED
}

enum LessonDay {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

enum LessonStatus {
  UPLOADING      // Audio file being uploaded
  TRANSCRIBING   // Whisper API processing
  EXTRACTING     // LLM extracting structured data
  GENERATING     // LLM generating outputs
  COMPLETED      // All processing finished
  FAILED         // Error occurred
}

enum OutputType {
  RECAP          // Student recap summary
  PRACTICE_PLAN  // Daily practice assignments
  PARENT_EMAIL   // Email to parent/guardian
}

// ============================================================================
// MODELS
// ============================================================================

model User {
  id          String   @id @default(uuid())
  clerkId     String   @unique  // External auth provider ID
  email       String   @unique
  firstName   String
  lastName    String
  studioName  String?  // For Studio plan users
  plan        Plan     @default(SOLO)
  
  // Usage tracking
  lessonsThisMonth Int      @default(0)
  monthlyResetAt   DateTime @default(now())
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  students    Student[]
  lessons     Lesson[]
  settings    Settings?
  auditLogs   AuditLog[]
  
  @@map("users")
}

model Student {
  id              String      @id @default(uuid())
  userId          String
  
  // Student info
  firstName       String
  lastName        String
  email           String?     // Student's email (optional, for older students)
  
  // Parent/guardian info
  parentFirstName String?
  parentLastName  String?
  parentEmail     String      // Required for communications
  
  // Lesson details
  instrument      Instrument
  skillLevel      SkillLevel  @default(BEGINNER)
  lessonDay       LessonDay?
  lessonTime      String?     // Format: "HH:MM"
  notes           String?     // Teacher's notes about student
  
  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  deletedAt       DateTime?   // Soft delete
  
  // Relations
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessons         Lesson[]
  
  @@index([userId])
  @@index([userId, deletedAt])
  @@map("students")
}

model Lesson {
  id          String       @id @default(uuid())
  userId      String
  studentId   String
  
  // Audio
  audioUrl    String?      // Supabase storage path
  audioDuration Int?       // Duration in seconds
  
  // Processing state
  status      LessonStatus @default(UPLOADING)
  errorMessage String?     // Error details if FAILED
  
  // Timestamps
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  processedAt DateTime?    // When processing completed
  
  // Relations
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  student     Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  transcript  Transcript?
  extraction  Extraction?
  outputs     Output[]
  
  @@index([userId])
  @@index([userId, createdAt])
  @@index([studentId])
  @@map("lessons")
}

model Transcript {
  id          String   @id @default(uuid())
  lessonId    String   @unique
  
  // Content
  segments    Json     // Array of {start_time_sec, end_time_sec, speaker, text}
  fullText    String   // Concatenated text for search
  wordCount   Int
  
  // Metadata
  language    String   @default("en")
  confidence  Float?   // Average confidence from Whisper
  
  // Search optimization
  searchVector Unsupported("tsvector")?
  
  // AI usage tracking
  model       String?  // "whisper-1"
  promptTokens Int?
  completionTokens Int?
  
  // Timestamps
  createdAt   DateTime @default(now())
  
  // Relations
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  
  @@index([searchVector], type: Gin)
  @@map("transcripts")
}

model Extraction {
  id          String   @id @default(uuid())
  lessonId    String   @unique
  
  // Structured extraction (LessonInstruction JSON)
  data        Json     // Conforms to lesson_instruction.schema.json
  
  // Validation
  schemaVersion String @default("1.0.0")
  isValid     Boolean  @default(true)
  
  // AI usage tracking
  model       String?  // "gpt-4o"
  promptTokens Int?
  completionTokens Int?
  
  // Timestamps
  createdAt   DateTime @default(now())
  
  // Relations
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  
  @@map("extractions")
}

model Output {
  id          String     @id @default(uuid())
  lessonId    String
  
  // Content
  type        OutputType
  content     String     // Generated content
  editedContent String?  // User's edited version (null = no edits)
  
  // Metadata
  wordCount   Int
  wasEdited   Boolean    @default(false)
  
  // AI usage tracking
  model       String?    // "gpt-4o"
  promptTokens Int?
  completionTokens Int?
  
  // Timestamps
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  
  // Relations
  lesson      Lesson     @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  
  @@unique([lessonId, type])
  @@index([lessonId])
  @@map("outputs")
}

model Settings {
  id          String   @id @default(uuid())
  userId      String   @unique
  
  // Notification preferences
  notifications Json   // {emailOnComplete: bool, pushOnComplete: bool}
  
  // Default settings for new lessons
  defaults    Json     // {practiceDaysPerWeek: int, practiceMinutesPerDay: int}
  
  // User preferences
  preferences Json     // {timezone: string, language: string, dateFormat?: string}
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("settings")
}

model AuditLog {
  id          String   @id @default(uuid())
  userId      String
  
  // Action details
  action      String   // "lesson.created", "output.edited", etc.
  entityType  String   // "lesson", "student", "output"
  entityId    String
  metadata    Json?    // Additional context
  
  // Request info
  ipAddress   String?
  userAgent   String?
  
  // Timestamps
  createdAt   DateTime @default(now())
  
  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## 3. TypeScript Interfaces

```typescript
// types/database.ts

// ============================================================================
// ENUMS
// ============================================================================

export type Plan = 'SOLO' | 'STUDIO';

export type Instrument = 
  | 'PIANO' 
  | 'VIOLIN' 
  | 'VIOLA' 
  | 'CELLO' 
  | 'GUITAR' 
  | 'VOICE' 
  | 'FLUTE' 
  | 'CLARINET' 
  | 'DRUMS' 
  | 'OTHER';

export type SkillLevel = 
  | 'BEGINNER' 
  | 'EARLY_INTERMEDIATE' 
  | 'INTERMEDIATE' 
  | 'LATE_INTERMEDIATE' 
  | 'ADVANCED';

export type LessonDay = 
  | 'MONDAY' 
  | 'TUESDAY' 
  | 'WEDNESDAY' 
  | 'THURSDAY' 
  | 'FRIDAY' 
  | 'SATURDAY' 
  | 'SUNDAY';

export type LessonStatus = 
  | 'UPLOADING' 
  | 'TRANSCRIBING' 
  | 'EXTRACTING' 
  | 'GENERATING' 
  | 'COMPLETED' 
  | 'FAILED';

export type OutputType = 'RECAP' | 'PRACTICE_PLAN' | 'PARENT_EMAIL';

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  studioName: string | null;
  plan: Plan;
  lessonsThisMonth: number;
  monthlyResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  parentFirstName: string | null;
  parentLastName: string | null;
  parentEmail: string;
  instrument: Instrument;
  skillLevel: SkillLevel;
  lessonDay: LessonDay | null;
  lessonTime: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Lesson {
  id: string;
  userId: string;
  studentId: string;
  audioUrl: string | null;
  audioDuration: number | null;
  status: LessonStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}

export interface TranscriptSegment {
  start_time_sec: number;
  end_time_sec: number;
  speaker: 'Teacher' | 'Student' | 'Unknown';
  text: string;
}

export interface Transcript {
  id: string;
  lessonId: string;
  segments: TranscriptSegment[];
  fullText: string;
  wordCount: number;
  language: string;
  confidence: number | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: Date;
}

export interface Extraction {
  id: string;
  lessonId: string;
  data: LessonInstruction; // See 05_AI_CONTRACTS.md
  schemaVersion: string;
  isValid: boolean;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: Date;
}

export interface Output {
  id: string;
  lessonId: string;
  type: OutputType;
  content: string;
  editedContent: string | null;
  wordCount: number;
  wasEdited: boolean;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSettings {
  emailOnComplete: boolean;
  pushOnComplete: boolean;
}

export interface DefaultSettings {
  practiceDaysPerWeek: number;
  practiceMinutesPerDay: number;
  emailTemplate?: string;
}

export interface UserPreferences {
  timezone: string;
  language: string;
  dateFormat?: string;
}

export interface Settings {
  id: string;
  userId: string;
  notifications: NotificationSettings;
  defaults: DefaultSettings;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EXTENDED INTERFACES (with relations)
// ============================================================================

export interface StudentWithStats extends Student {
  lessonCount: number;
  lastLessonAt: Date | null;
}

export interface LessonWithRelations extends Lesson {
  student: Pick<Student, 'id' | 'firstName' | 'lastName' | 'instrument' | 'skillLevel'>;
  transcript?: Transcript;
  extraction?: Extraction;
  outputs: Output[];
}

export interface UserWithUsage extends User {
  usage: {
    lessonsThisMonth: number;
    lessonsLimit: number;
    resetDate: Date;
  };
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  email?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail: string;
  instrument: Instrument;
  skillLevel?: SkillLevel;
  lessonDay?: LessonDay;
  lessonTime?: string;
  notes?: string;
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  instrument?: Instrument;
  skillLevel?: SkillLevel;
  lessonDay?: LessonDay | null;
  lessonTime?: string | null;
  notes?: string | null;
}

export interface CreateLessonInput {
  studentId: string;
}

export interface UpdateOutputInput {
  editedContent: string;
}
```

---

## 4. Database Migrations

### 4.1 Initial Migration

```sql
-- migrations/001_initial.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enums
CREATE TYPE plan AS ENUM ('SOLO', 'STUDIO');
CREATE TYPE instrument AS ENUM ('PIANO', 'VIOLIN', 'VIOLA', 'CELLO', 'GUITAR', 'VOICE', 'FLUTE', 'CLARINET', 'DRUMS', 'OTHER');
CREATE TYPE skill_level AS ENUM ('BEGINNER', 'EARLY_INTERMEDIATE', 'INTERMEDIATE', 'LATE_INTERMEDIATE', 'ADVANCED');
CREATE TYPE lesson_day AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
CREATE TYPE lesson_status AS ENUM ('UPLOADING', 'TRANSCRIBING', 'EXTRACTING', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE output_type AS ENUM ('RECAP', 'PRACTICE_PLAN', 'PARENT_EMAIL');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  studio_name VARCHAR(255),
  plan plan DEFAULT 'SOLO',
  lessons_this_month INTEGER DEFAULT 0,
  monthly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  parent_first_name VARCHAR(100),
  parent_last_name VARCHAR(100),
  parent_email VARCHAR(255) NOT NULL,
  instrument instrument NOT NULL,
  skill_level skill_level DEFAULT 'BEGINNER',
  lesson_day lesson_day,
  lesson_time VARCHAR(5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_user_deleted ON students(user_id, deleted_at);

-- Lessons table
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  audio_url TEXT,
  audio_duration INTEGER,
  status lesson_status DEFAULT 'UPLOADING',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_lessons_user_id ON lessons(user_id);
CREATE INDEX idx_lessons_user_created ON lessons(user_id, created_at);
CREATE INDEX idx_lessons_student_id ON lessons(student_id);

-- Transcripts table
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  segments JSONB NOT NULL,
  full_text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  confidence FLOAT,
  search_vector TSVECTOR,
  model VARCHAR(50),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transcripts_search ON transcripts USING GIN(search_vector);

-- Extractions table
CREATE TABLE extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  schema_version VARCHAR(20) DEFAULT '1.0.0',
  is_valid BOOLEAN DEFAULT TRUE,
  model VARCHAR(50),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outputs table
CREATE TABLE outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type output_type NOT NULL,
  content TEXT NOT NULL,
  edited_content TEXT,
  word_count INTEGER NOT NULL,
  was_edited BOOLEAN DEFAULT FALSE,
  model VARCHAR(50),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lesson_id, type)
);

CREATE INDEX idx_outputs_lesson_id ON outputs(lesson_id);

-- Settings table
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notifications JSONB NOT NULL DEFAULT '{"emailOnComplete": true, "pushOnComplete": true}',
  defaults JSONB NOT NULL DEFAULT '{"practiceDaysPerWeek": 6, "practiceMinutesPerDay": 25}',
  preferences JSONB NOT NULL DEFAULT '{"timezone": "America/New_York", "language": "en"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_transcript_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.full_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcript_search_update
  BEFORE INSERT OR UPDATE ON transcripts
  FOR EACH ROW EXECUTE FUNCTION update_transcript_search_vector();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_outputs_updated_at BEFORE UPDATE ON outputs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 5. Common Queries

```typescript
// Common database queries for reference

// Get all students for a user (excluding soft-deleted)
const students = await prisma.student.findMany({
  where: {
    userId: user.id,
    deletedAt: null,
  },
  orderBy: { firstName: 'asc' },
});

// Get student with lesson count
const studentWithStats = await prisma.student.findUnique({
  where: { id: studentId },
  include: {
    _count: {
      select: { lessons: true },
    },
  },
});

// Get lessons with related data
const lessons = await prisma.lesson.findMany({
  where: { userId: user.id },
  include: {
    student: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        instrument: true,
      },
    },
    transcript: true,
    outputs: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
});

// Full-text search in transcripts
const searchResults = await prisma.$queryRaw`
  SELECT t.*, l."studentId"
  FROM "transcripts" t
  JOIN "lessons" l ON t."lessonId" = l.id
  WHERE l."userId" = ${userId}
  AND t."searchVector" @@ plainto_tsquery('english', ${searchQuery})
  ORDER BY ts_rank(t."searchVector", plainto_tsquery('english', ${searchQuery})) DESC
  LIMIT 10
`;

// Get dashboard summary
const [studentCount, lessonStats] = await prisma.$transaction([
  prisma.student.count({
    where: { userId: user.id, deletedAt: null },
  }),
  prisma.lesson.groupBy({
    by: ['status'],
    where: { userId: user.id },
    _count: true,
  }),
]);
```

---

## 6. Seed Data

```typescript
// prisma/seed.ts

import { PrismaClient, Plan, Instrument, SkillLevel, LessonDay } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@notebynote.com' },
    update: {},
    create: {
      clerkId: 'demo_clerk_id',
      email: 'demo@notebynote.com',
      firstName: 'Demo',
      lastName: 'Teacher',
      studioName: 'Demo Music Studio',
      plan: Plan.SOLO,
      settings: {
        create: {
          notifications: { emailOnComplete: true, pushOnComplete: true },
          defaults: { practiceDaysPerWeek: 6, practiceMinutesPerDay: 25 },
          preferences: { timezone: 'America/New_York', language: 'en' },
        },
      },
    },
  });

  // Create demo students
  const students = await Promise.all([
    prisma.student.create({
      data: {
        userId: user.id,
        firstName: 'Emma',
        lastName: 'Wilson',
        parentFirstName: 'Sarah',
        parentLastName: 'Wilson',
        parentEmail: 'sarah.wilson@example.com',
        instrument: Instrument.PIANO,
        skillLevel: SkillLevel.INTERMEDIATE,
        lessonDay: LessonDay.WEDNESDAY,
        lessonTime: '16:00',
        notes: 'Working on ABRSM Grade 5. Excellent sight-reading skills.',
      },
    }),
    prisma.student.create({
      data: {
        userId: user.id,
        firstName: 'James',
        lastName: 'Chen',
        parentFirstName: 'Michael',
        parentLastName: 'Chen',
        parentEmail: 'michael.chen@example.com',
        instrument: Instrument.VIOLIN,
        skillLevel: SkillLevel.BEGINNER,
        lessonDay: LessonDay.THURSDAY,
        lessonTime: '15:00',
        notes: 'Started lessons 2 months ago. Very enthusiastic.',
      },
    }),
  ]);

  console.log('Seeded database with:');
  console.log(`- 1 user: ${user.email}`);
  console.log(`- ${students.length} students`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```


# 04. API Contract

> REST API specification for Note By Note MVP

---

## Base Configuration

```
Base URL (Development): http://localhost:8000/api/v1
Base URL (Production):  https://api.notebynote.app/api/v1
Content-Type:           application/json
Authentication:         Bearer token (Supabase JWT)
```

---

## Authentication

All endpoints except `/health` require authentication via Supabase JWT.

### Headers

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

### Error Response (401 Unauthorized)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/users/me` | Get current user profile |
| PATCH | `/users/me` | Update user settings |
| GET | `/students` | List all students |
| POST | `/students` | Create new student |
| GET | `/students/{id}` | Get student details |
| PATCH | `/students/{id}` | Update student |
| DELETE | `/students/{id}` | Archive student |
| GET | `/lessons` | List lessons |
| POST | `/lessons` | Create new lesson |
| GET | `/lessons/{id}` | Get lesson details |
| POST | `/lessons/{id}/upload` | Upload audio file |
| POST | `/lessons/{id}/process` | Start AI processing |
| GET | `/lessons/{id}/status` | Get processing status |
| GET | `/lessons/{id}/outputs` | Get generated outputs |
| PATCH | `/lessons/{id}/outputs/{type}` | Update output content |
| POST | `/lessons/{id}/share` | Share outputs |

---

## Endpoint Specifications

### Health Check

```http
GET /health
```

**Response 200:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Users

#### Get Current User

```http
GET /users/me
```

**Response 200:**
```json
{
  "id": "uuid",
  "email": "teacher@example.com",
  "name": "Sarah Chen",
  "created_at": "2024-01-01T00:00:00Z",
  "settings": {
    "default_lesson_duration_minutes": 30,
    "default_practice_days": 6,
    "include_parent_email": true,
    "studio_name": "Chen Music Studio",
    "signature_name": "Ms. Sarah"
  }
}
```

#### Update User Settings

```http
PATCH /users/me
```

**Request Body:**
```json
{
  "name": "Sarah Chen",
  "settings": {
    "default_lesson_duration_minutes": 45,
    "studio_name": "Chen Music Academy"
  }
}
```

**Response 200:** Updated user object

---

### Students

#### List Students

```http
GET /students
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `search` | string | - | Search by name |
| `instrument` | string | - | Filter by instrument |
| `active` | boolean | true | Include archived |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Leo Martinez",
      "instrument": "PIANO",
      "skill_level": "INTERMEDIATE",
      "parent_email": "parent@example.com",
      "parent_name": "Maria Martinez",
      "notes": "Preparing for spring recital",
      "lesson_count": 12,
      "last_lesson_at": "2024-01-10T15:00:00Z",
      "created_at": "2023-09-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

#### Create Student

```http
POST /students
```

**Request Body:**
```json
{
  "name": "Leo Martinez",
  "instrument": "PIANO",
  "skill_level": "INTERMEDIATE",
  "parent_email": "parent@example.com",
  "parent_name": "Maria Martinez",
  "notes": "Preparing for spring recital"
}
```

**Validation:**
- `name`: required, 1-100 characters
- `instrument`: required, enum (PIANO, VIOLIN, GUITAR, VOICE, DRUMS, FLUTE, OTHER)
- `skill_level`: required, enum (BEGINNER, INTERMEDIATE, ADVANCED)
- `parent_email`: optional, valid email format
- `parent_name`: optional, 1-100 characters

**Response 201:** Created student object

#### Get Student

```http
GET /students/{id}
```

**Response 200:** Student object with recent lessons

```json
{
  "id": "uuid",
  "name": "Leo Martinez",
  "instrument": "PIANO",
  "skill_level": "INTERMEDIATE",
  "parent_email": "parent@example.com",
  "parent_name": "Maria Martinez",
  "notes": "Preparing for spring recital",
  "created_at": "2023-09-01T00:00:00Z",
  "recent_lessons": [
    {
      "id": "uuid",
      "date": "2024-01-10",
      "status": "COMPLETED",
      "duration_minutes": 30
    }
  ]
}
```

#### Update Student

```http
PATCH /students/{id}
```

**Request Body:** Partial student object

**Response 200:** Updated student object

#### Archive Student

```http
DELETE /students/{id}
```

**Response 204:** No content (soft delete)

---

### Lessons

#### List Lessons

```http
GET /lessons
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Max results (1-100) |
| `offset` | integer | 0 | Pagination offset |
| `student_id` | uuid | - | Filter by student |
| `status` | string | - | Filter by status |
| `date_from` | date | - | Start date filter |
| `date_to` | date | - | End date filter |

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "student": {
        "id": "uuid",
        "name": "Leo Martinez"
      },
      "date": "2024-01-10",
      "status": "COMPLETED",
      "duration_minutes": 30,
      "has_outputs": true,
      "created_at": "2024-01-10T15:00:00Z"
    }
  ],
  "pagination": {
    "total": 120,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

#### Create Lesson

```http
POST /lessons
```

**Request Body:**
```json
{
  "student_id": "uuid",
  "date": "2024-01-15",
  "duration_minutes": 30,
  "notes": "Focus on dynamics today"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "student_id": "uuid",
  "date": "2024-01-15",
  "status": "CREATED",
  "duration_minutes": 30,
  "notes": "Focus on dynamics today",
  "upload_url": "https://storage.supabase.co/...",
  "created_at": "2024-01-15T10:00:00Z"
}
```

#### Get Lesson

```http
GET /lessons/{id}
```

**Response 200:**
```json
{
  "id": "uuid",
  "student": {
    "id": "uuid",
    "name": "Leo Martinez",
    "instrument": "PIANO",
    "skill_level": "INTERMEDIATE"
  },
  "date": "2024-01-10",
  "status": "COMPLETED",
  "duration_minutes": 30,
  "notes": "Focus on dynamics",
  "audio_url": "https://storage.supabase.co/...",
  "transcript": {
    "id": "uuid",
    "segments": [...],
    "word_count": 1250
  },
  "extraction": {
    "id": "uuid",
    "data": {...}
  },
  "outputs": [
    {
      "type": "RECAP",
      "content": "...",
      "is_edited": false,
      "updated_at": "2024-01-10T16:00:00Z"
    }
  ],
  "created_at": "2024-01-10T15:00:00Z"
}
```

#### Upload Audio

```http
POST /lessons/{id}/upload
Content-Type: multipart/form-data
```

**Request Body:**
- `file`: Audio file (m4a, mp3, wav, webm)

**Constraints:**
- Max file size: 100MB
- Max duration: 90 minutes
- Supported formats: m4a, mp3, wav, webm

**Response 200:**
```json
{
  "id": "uuid",
  "status": "UPLOADED",
  "audio_url": "https://storage.supabase.co/...",
  "file_size_bytes": 15000000,
  "duration_seconds": 1800
}
```

**Error 413 (File Too Large):**
```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File exceeds maximum size of 100MB"
  }
}
```

#### Start Processing

```http
POST /lessons/{id}/process
```

**Request Body (optional):**
```json
{
  "regenerate": false,
  "output_types": ["RECAP", "PRACTICE_PLAN", "PARENT_EMAIL"]
}
```

**Response 202:**
```json
{
  "id": "uuid",
  "status": "TRANSCRIBING",
  "job_id": "uuid",
  "estimated_seconds": 120
}
```

#### Get Processing Status

```http
GET /lessons/{id}/status
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "GENERATING",
  "progress": {
    "stage": "GENERATING",
    "percent": 75,
    "current_step": "Generating practice plan",
    "steps_completed": ["upload", "transcribe", "extract", "recap"],
    "steps_remaining": ["practice_plan", "parent_email"]
  },
  "timestamps": {
    "started_at": "2024-01-10T15:30:00Z",
    "transcribed_at": "2024-01-10T15:31:00Z",
    "extracted_at": "2024-01-10T15:31:30Z"
  }
}
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `CREATED` | Lesson created, no audio |
| `UPLOADING` | Audio upload in progress |
| `UPLOADED` | Audio received, awaiting processing |
| `TRANSCRIBING` | Whisper transcription running |
| `EXTRACTING` | LessonInstruction extraction running |
| `GENERATING` | Output generation running |
| `COMPLETED` | All outputs ready |
| `FAILED` | Processing error occurred |

#### Get Outputs

```http
GET /lessons/{id}/outputs
```

**Response 200:**
```json
{
  "lesson_id": "uuid",
  "outputs": [
    {
      "type": "RECAP",
      "content": "# Lesson Recap for Leo\n\n## What Went Well\n...",
      "word_count": 175,
      "is_edited": false,
      "created_at": "2024-01-10T15:32:00Z",
      "updated_at": "2024-01-10T15:32:00Z"
    },
    {
      "type": "PRACTICE_PLAN",
      "content": "# Practice Plan: January 10-16\n\n## Day 1...",
      "word_count": 320,
      "is_edited": true,
      "created_at": "2024-01-10T15:32:00Z",
      "updated_at": "2024-01-10T16:00:00Z"
    },
    {
      "type": "PARENT_EMAIL",
      "content": "Dear Maria,\n\nLeo had a wonderful lesson...",
      "word_count": 210,
      "is_edited": false,
      "created_at": "2024-01-10T15:32:00Z",
      "updated_at": "2024-01-10T15:32:00Z"
    }
  ]
}
```

#### Update Output

```http
PATCH /lessons/{id}/outputs/{type}
```

**Path Parameters:**
- `type`: RECAP | PRACTICE_PLAN | PARENT_EMAIL

**Request Body:**
```json
{
  "content": "# Updated Lesson Recap for Leo\n\n..."
}
```

**Response 200:**
```json
{
  "type": "RECAP",
  "content": "# Updated Lesson Recap for Leo\n\n...",
  "word_count": 180,
  "is_edited": true,
  "updated_at": "2024-01-10T16:30:00Z"
}
```

#### Share Outputs

```http
POST /lessons/{id}/share
```

**Request Body:**
```json
{
  "output_types": ["RECAP", "PRACTICE_PLAN"],
  "share_method": "EMAIL",
  "recipients": [
    {
      "email": "parent@example.com",
      "name": "Maria Martinez"
    }
  ],
  "message": "Here are Leo's materials from today's lesson!"
}
```

**Response 200:**
```json
{
  "shared": true,
  "method": "EMAIL",
  "recipients": ["parent@example.com"],
  "shared_at": "2024-01-10T17:00:00Z"
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid/expired token |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request body |
| `FILE_TOO_LARGE` | 413 | Upload exceeds limit |
| `UNSUPPORTED_FORMAT` | 415 | Invalid file type |
| `PROCESSING_FAILED` | 500 | AI pipeline error |
| `RATE_LIMITED` | 429 | Too many requests |

### Validation Error Example

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "fields": [
        {
          "field": "student_id",
          "message": "Required field"
        },
        {
          "field": "date",
          "message": "Must be valid ISO date"
        }
      ]
    }
  }
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| General API | 100 requests/minute |
| Audio Upload | 10 uploads/hour |
| AI Processing | 20 lessons/hour |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705320000
```

---

## Webhooks (Future)

For real-time processing updates, clients can poll `/lessons/{id}/status` or use Supabase Realtime subscriptions on the `lessons` table.

```typescript
// Supabase Realtime subscription
supabase
  .channel('lesson-updates')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'lessons',
      filter: `id=eq.${lessonId}`
    },
    (payload) => {
      console.log('Lesson updated:', payload.new.status)
    }
  )
  .subscribe()
```

---

## OpenAPI Specification

Full OpenAPI 3.0 spec available at:
- Development: `http://localhost:8000/openapi.json`
- Documentation: `http://localhost:8000/docs` (Swagger UI)
- Alternative: `http://localhost:8000/redoc` (ReDoc)


# AI Contracts

**Version**: 1.0.0  
**Purpose**: Define strict contracts for AI extraction and generation

---

## 1. Overview

The AI pipeline uses a **contract-driven** approach to ensure consistency and prevent hallucination:

1. **Extraction Phase**: Transcript → `LessonInstruction` JSON (validated against schema)
2. **Generation Phase**: `LessonInstruction` JSON → Three text outputs

The `LessonInstruction` JSON Schema is the **single source of truth** that:
- Prevents AI hallucination (every extracted item requires evidence)
- Enables regression testing (golden fixtures validate against schema)
- Ensures frontend/backend agreement on data shape
- Allows debugging intermediate state

---

## 2. LessonInstruction JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://notebynote.com/schemas/lesson_instruction.schema.json",
  "title": "LessonInstruction",
  "description": "Structured extraction of music lesson content with evidence grounding",
  "type": "object",
  "additionalProperties": false,
  "required": ["meta", "praise_wins", "pieces_assigned", "techniques", "corrections", "practice_items"],

  "properties": {
    "meta": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lesson_id", "student_id", "student_name", "instrument"],
      "properties": {
        "lesson_id": { "type": "string", "minLength": 1 },
        "student_id": { "type": "string", "minLength": 1 },
        "student_name": { "type": "string", "minLength": 1 },
        "instrument": { "type": "string", "minLength": 1 },
        "level": { "type": "string" },
        "lesson_date_iso": { "type": "string", "format": "date" },
        "timezone": { "type": "string" },
        "extraction_version": { "type": "string" },
        "notes": { "type": "string" }
      }
    },

    "praise_wins": {
      "description": "Positive moments and achievements from the lesson",
      "type": "array",
      "items": { "$ref": "#/definitions/EvidencedText" }
    },

    "pieces_assigned": {
      "description": "Pieces or exercises assigned with specific sections and goals",
      "type": "array",
      "items": { "$ref": "#/definitions/PieceAssignment" }
    },

    "techniques": {
      "description": "Techniques introduced or reinforced during the lesson",
      "type": "array",
      "items": { "$ref": "#/definitions/Technique" }
    },

    "corrections": {
      "description": "Specific corrections made during the lesson",
      "type": "array",
      "items": { "$ref": "#/definitions/Correction" }
    },

    "tempo_targets": {
      "description": "Tempo goals mentioned for pieces or exercises",
      "type": "array",
      "items": { "$ref": "#/definitions/TempoTarget" }
    },

    "weekly_focus": {
      "description": "Overall focus areas for the week's practice",
      "type": "array",
      "items": { "$ref": "#/definitions/EvidencedText" }
    },

    "practice_items": {
      "description": "Specific practice tasks with duration and priority",
      "type": "array",
      "items": { "$ref": "#/definitions/PracticeItem" }
    },

    "concerns": {
      "description": "Ongoing issues or areas needing attention",
      "type": "array",
      "items": { "$ref": "#/definitions/EvidencedText" }
    },

    "admin_notes": {
      "description": "Administrative notes (practice time, scheduling, etc.)",
      "type": "array",
      "items": { "$ref": "#/definitions/EvidencedText" }
    }
  },

  "definitions": {
    "Evidence": {
      "description": "A verbatim quote from the transcript with timestamp",
      "type": "object",
      "additionalProperties": false,
      "required": ["quote", "start_time_sec", "end_time_sec"],
      "properties": {
        "quote": { 
          "type": "string", 
          "minLength": 1, 
          "maxLength": 240,
          "description": "Short verbatim snippet from transcript"
        },
        "start_time_sec": { 
          "type": "number", 
          "minimum": 0,
          "description": "Start timestamp in seconds"
        },
        "end_time_sec": { 
          "type": "number", 
          "minimum": 0,
          "description": "End timestamp in seconds"
        },
        "speaker": { 
          "type": "string", 
          "enum": ["Teacher", "Student", "Unknown"],
          "description": "Who said this"
        }
      }
    },

    "Confidence": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Extraction confidence level"
    },

    "EvidencedText": {
      "description": "A text item with required evidence and confidence",
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "evidence", "confidence"],
      "properties": {
        "text": { 
          "type": "string", 
          "minLength": 1,
          "description": "The extracted information"
        },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/Evidence" },
          "description": "Transcript quotes supporting this item"
        },
        "confidence": { "$ref": "#/definitions/Confidence" }
      }
    },

    "PieceAssignment": {
      "description": "A piece or exercise assigned with section and goal",
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "section", "goal", "evidence", "confidence"],
      "properties": {
        "title": { 
          "type": "string", 
          "minLength": 1,
          "description": "Name of the piece or exercise"
        },
        "composer": { 
          "type": "string",
          "description": "Composer name if mentioned"
        },
        "section": { 
          "type": "string", 
          "minLength": 1,
          "description": "Specific section (e.g., 'measures 5-8')"
        },
        "goal": { 
          "type": "string", 
          "minLength": 1,
          "description": "What the student should achieve"
        },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/Evidence" }
        },
        "confidence": { "$ref": "#/definitions/Confidence" }
      }
    },

    "Technique": {
      "description": "A technique introduced or reinforced",
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "description", "evidence", "confidence"],
      "properties": {
        "name": { 
          "type": "string", 
          "minLength": 1,
          "description": "Name of the technique"
        },
        "description": { 
          "type": "string", 
          "minLength": 1,
          "description": "How to perform the technique"
        },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/Evidence" }
        },
        "confidence": { "$ref": "#/definitions/Confidence" }
      }
    },

    "Correction": {
      "description": "A specific correction made during the lesson",
      "type": "object",
      "additionalProperties": false,
      "required": ["issue", "fix", "where", "evidence", "confidence"],
      "properties": {
        "issue": { 
          "type": "string", 
          "minLength": 1,
          "description": "What was wrong"
        },
        "fix": { 
          "type": "string", 
          "minLength": 1,
          "description": "How to correct it"
        },
        "where": { 
          "type": "string", 
          "minLength": 1,
          "description": "Where in the music this applies"
        },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/Evidence" }
        },
        "confidence": { "$ref": "#/definitions/Confidence" }
      }
    },

    "TempoTarget": {
      "description": "A tempo target mentioned for a piece",
      "type": "object",
      "additionalProperties": false,
      "required": ["piece", "bpm", "context", "evidence", "confidence"],
      "properties": {
        "piece": { 
          "type": "string", 
          "minLength": 1,
          "description": "Which piece or exercise"
        },
        "bpm": { 
          "type": "integer", 
          "minimum": 20, 
          "maximum": 240,
          "description": "Beats per minute target"
        },
        "context": { 
          "type": "string", 
          "minLength": 1,
          "description": "Context (current tempo, goal tempo, etc.)"
        },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/Evidence" }
        },
        "confidence": { "$ref": "#/definitions/Confidence" }
      }
    },

    "PracticeItem": {
      "description": "A specific practice task with duration and priority",
      "type": "object",
      "additionalProperties": false,
      "required": ["category", "instruction", "duration_minutes", "priority", "evidence", "confidence"],
      "properties": {
        "category": {
          "type": "string",
          "enum": ["scales", "technique", "repertoire", "rhythm", "sight_reading", "other"],
          "description": "Type of practice activity"
        },
        "instruction": { 
          "type": "string", 
          "minLength": 1,
          "description": "Specific instruction for this task"
        },
        "duration_minutes": { 
          "type": "integer", 
          "minimum": 1, 
          "maximum": 90,
          "description": "Suggested duration in minutes"
        },
        "priority": { 
          "type": "integer", 
          "minimum": 1, 
          "maximum": 5,
          "description": "Priority level (5 = highest)"
        },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/Evidence" }
        },
        "confidence": { "$ref": "#/definitions/Confidence" }
      }
    }
  }
}
```

---

## 3. TypeScript Interface

```typescript
// types/lesson_instruction.ts

export interface Evidence {
  quote: string;           // Verbatim snippet (max 240 chars)
  start_time_sec: number;  // Start timestamp
  end_time_sec: number;    // End timestamp
  speaker?: 'Teacher' | 'Student' | 'Unknown';
}

export type Confidence = 'high' | 'medium' | 'low';

export interface EvidencedText {
  text: string;
  evidence: Evidence[];
  confidence: Confidence;
}

export interface PieceAssignment {
  title: string;
  composer?: string;
  section: string;
  goal: string;
  evidence: Evidence[];
  confidence: Confidence;
}

export interface Technique {
  name: string;
  description: string;
  evidence: Evidence[];
  confidence: Confidence;
}

export interface Correction {
  issue: string;
  fix: string;
  where: string;
  evidence: Evidence[];
  confidence: Confidence;
}

export interface TempoTarget {
  piece: string;
  bpm: number;
  context: string;
  evidence: Evidence[];
  confidence: Confidence;
}

export type PracticeCategory = 
  | 'scales' 
  | 'technique' 
  | 'repertoire' 
  | 'rhythm' 
  | 'sight_reading' 
  | 'other';

export interface PracticeItem {
  category: PracticeCategory;
  instruction: string;
  duration_minutes: number;
  priority: number;  // 1-5, higher = more important
  evidence: Evidence[];
  confidence: Confidence;
}

export interface LessonInstructionMeta {
  lesson_id: string;
  student_id: string;
  student_name: string;
  instrument: string;
  level?: string;
  lesson_date_iso?: string;
  timezone?: string;
  extraction_version?: string;
  notes?: string;
}

export interface LessonInstruction {
  meta: LessonInstructionMeta;
  praise_wins: EvidencedText[];
  pieces_assigned: PieceAssignment[];
  techniques: Technique[];
  corrections: Correction[];
  tempo_targets?: TempoTarget[];
  weekly_focus?: EvidencedText[];
  practice_items: PracticeItem[];
  concerns?: EvidencedText[];
  admin_notes?: EvidencedText[];
}
```

---

## 4. Output Contracts

### 4.1 Student Recap Contract

```typescript
interface RecapContract {
  maxWords: 180;
  requiredSections: ['Wins', 'Focus'];
  tone: 'encouraging, specific, actionable';
  structure: {
    title: 'Lesson Recap';
    sections: {
      wins: { minItems: 1, maxItems: 3 };
      focus: { minItems: 2, maxItems: 4 };
      nextLesson: { optional: true };
    };
  };
}
```

### 4.2 Practice Plan Contract

```typescript
interface PracticePlanContract {
  days: 6;  // Day 1 through Day 6
  tasksPerDay: 3;
  minutesPerDay: 25;
  requiredMarkers: ['Day 1', 'Day 2'] | ['Monday', 'Tuesday'];
  structure: {
    title: 'Practice Plan';
    perDay: {
      format: '(minutes) category: instruction';
      totalMinutes: 25;
    };
  };
}
```

### 4.3 Parent Email Contract

```typescript
interface ParentEmailContract {
  maxWords: 220;
  tone: 'warm, confident, professional';
  structure: {
    greeting: true;
    positiveOpener: true;
    bulletHighlights: { minItems: 2, maxItems: 4 };
    practiceExpectations: true;
    friendlyClosing: true;
  };
  forbidden: ['marketing language', 'sales pitch'];
}
```

---

## 5. Validation Functions

```python
# tools/validate_schema.py

import json
from pathlib import Path
from jsonschema import Draft202012Validator

SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "lesson_instruction.schema.json"

def load_schema():
    """Load the LessonInstruction JSON Schema."""
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

def get_validator():
    """Get a schema validator instance."""
    schema = load_schema()
    return Draft202012Validator(schema)

def validate(instance: dict) -> None:
    """Validate a LessonInstruction against the schema.
    
    Raises jsonschema.ValidationError on failure.
    """
    validator = get_validator()
    validator.validate(instance)

def is_valid(instance: dict) -> bool:
    """Check if a LessonInstruction is valid (no exception)."""
    try:
        validate(instance)
        return True
    except Exception:
        return False
```

```python
# tools/text_checks.py

import re
from typing import List

def word_count(s: str) -> int:
    """Count words as runs of letters/numbers/apostrophes."""
    return len(re.findall(r"[A-Za-z0-9']+", s))

def assert_max_words(s: str, limit: int, label: str) -> None:
    """Assert text doesn't exceed word limit."""
    wc = word_count(s)
    assert wc <= limit, f"{label} too long: {wc} words (limit {limit})"

def assert_contains_any(s: str, needles: List[str], label: str) -> None:
    """Assert text contains at least one of the needles."""
    hay = s.lower()
    assert any(n.lower() in hay for n in needles), \
        f"{label} missing expected markers: {needles}"

def validate_recap(text: str) -> None:
    """Validate a student recap meets contract."""
    assert_max_words(text, 180, "Recap")
    assert_contains_any(text, ["wins", "focus", "lesson recap"], "Recap")

def validate_practice_plan(text: str) -> None:
    """Validate a practice plan meets contract."""
    assert_contains_any(text, ["Day 1", "Day 2", "Monday", "Tuesday"], "Practice plan")

def validate_parent_email(text: str) -> None:
    """Validate a parent email meets contract."""
    assert_max_words(text, 220, "Parent email")
```

---

## 6. Contract Enforcement

### 6.1 In Pipeline

```python
# services/ai_pipeline.py

async def process_lesson(lesson_id: str) -> LessonWithOutputs:
    """Process a lesson through the AI pipeline."""
    
    # Stage 1: Extract with validation
    extraction = await extract_lesson_instruction(transcript)
    validate(extraction)  # Raises if invalid
    
    # Stage 2: Generate with validation
    recap = await generate_recap(extraction)
    validate_recap(recap)
    
    plan = await generate_practice_plan(extraction)
    validate_practice_plan(plan)
    
    email = await generate_parent_email(extraction)
    validate_parent_email(email)
    
    return LessonWithOutputs(
        extraction=extraction,
        recap=recap,
        practice_plan=plan,
        parent_email=email,
    )
```

### 6.2 In Tests

```python
# tests/test_golden_fixture.py

def test_extraction_conforms_to_schema():
    """Golden fixture extraction must pass schema validation."""
    expected = load_json(GOLDEN_DIR / "schema.expected.json")
    validate(expected)  # No exception = pass

def test_outputs_meet_contracts():
    """Golden fixture outputs must meet word/structure contracts."""
    recap = (GOLDEN_DIR / "recap.expected.md").read_text()
    plan = (GOLDEN_DIR / "practice_plan.expected.md").read_text()
    email = (GOLDEN_DIR / "parent_email.expected.md").read_text()
    
    validate_recap(recap)
    validate_practice_plan(plan)
    validate_parent_email(email)
```

---

## 7. Why Contracts Matter

| Without Contracts | With Contracts |
|-------------------|----------------|
| AI outputs vary randomly | Outputs conform to schema |
| Frontend breaks on new fields | Frontend knows exact shape |
| Bugs hide in production | Bugs caught in CI |
| "It worked last week" | Golden fixtures catch regression |
| Debugging is guesswork | Inspect intermediate JSON |
| Hallucination goes unnoticed | Evidence required for every item |

**The contract is the agreement between AI and code.**


# AI Prompts

**Version**: 1.0.0  
**Purpose**: System prompts for extraction and generation phases

---

## 1. System Policy

This policy is prepended to all AI prompts:

```markdown
# System Policy

You are an assistant that produces reliable, teacher-grade outputs for music lesson documentation.

RULES:
1. You must NOT invent details that are not in the transcript.
2. You must ground every extracted item in transcript evidence.
3. If something is not present, omit it or mark confidence "low" with a reason.
4. You must output EXACTLY what is requested, in the required format.
5. Prefer fewer high-confidence items over many speculative items.
```

---

## 2. Extraction Prompt

**Purpose**: Extract structured `LessonInstruction` JSON from transcript.

```markdown
# Extraction Prompt: Transcript → LessonInstruction JSON

## System
(Include System Policy above)

## Developer Instructions

You are extracting structured lesson instructions from a music lesson transcript.

Return ONLY valid JSON that conforms to the provided JSON Schema.

CRITICAL RULES:
- Every extracted item MUST include evidence entries
- Evidence quote must be a short verbatim snippet from the transcript (max 240 chars)
- Use timestamps from the transcript segments
- Do NOT fabricate piece names, measure numbers, tempo targets, or techniques
- If unsure, mark confidence as "medium" or "low"
- Prefer fewer high-confidence items over many speculative items

## User Input

**Context:**
- student_name: {{student_name}}
- instrument: {{instrument}}
- level: {{level}}
- lesson_date_iso: {{lesson_date_iso}}
- lesson_id: {{lesson_id}}
- student_id: {{student_id}}

**JSON Schema:**
{{lesson_instruction_json_schema}}

**Transcript (JSON segments):**
```json
{{transcript_segments_json}}
```

## Task

Extract a LessonInstruction JSON object from the transcript.
Return ONLY the JSON, no explanation or markdown.
```

### 2.1 Extraction Example

**Input Transcript Segments:**
```json
[
  {"start_time_sec": 0, "end_time_sec": 12, "speaker": "Teacher", "text": "Hi Leo. Let's start with your C major scale. Two octaves, hands together."},
  {"start_time_sec": 12, "end_time_sec": 28, "speaker": "Teacher", "text": "Good. Keep your fingers curved and land on the tips, not flat."},
  {"start_time_sec": 28, "end_time_sec": 45, "speaker": "Teacher", "text": "Metronome at 72 today. By Friday I want you at 84 if it stays clean."}
]
```

**Expected Output (partial):**
```json
{
  "meta": {
    "lesson_id": "lesson_001",
    "student_id": "student_leo",
    "student_name": "Leo",
    "instrument": "piano",
    "level": "early intermediate"
  },
  "corrections": [
    {
      "issue": "Flattened fingers during scales.",
      "fix": "Keep fingers curved and play on the fingertips.",
      "where": "C major scale",
      "evidence": [
        {
          "quote": "Keep your fingers curved and land on the tips, not flat",
          "start_time_sec": 12,
          "end_time_sec": 28,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "tempo_targets": [
    {
      "piece": "C major scale",
      "bpm": 72,
      "context": "Current metronome setting for clean playing.",
      "evidence": [
        {
          "quote": "Metronome at 72 today",
          "start_time_sec": 28,
          "end_time_sec": 45,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "piece": "C major scale",
      "bpm": 84,
      "context": "Goal tempo by Friday if clean.",
      "evidence": [
        {
          "quote": "By Friday I want you at 84 if it stays clean",
          "start_time_sec": 28,
          "end_time_sec": 45,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ]
}
```

---

## 3. Generation Prompts

### 3.1 Student Recap Prompt

```markdown
# Generation Prompt: Student Recap

## System
(Include System Policy above)

## Developer Instructions

Write a concise student recap based ONLY on the LessonInstruction JSON.

RULES:
- Do NOT add details that are not supported by the schema
- Tone: teacher-to-student, supportive, clear, professional
- Length limit: 180 words maximum

FORMAT:
- Title line: "Lesson Recap"
- Sections with bullets:
  - **Wins** (2-3 items from praise_wins)
  - **Focus** (2-4 items from corrections, techniques, pieces_assigned)
  - **Next lesson** (optional, brief preview)

## User Input

**Student:** {{student_name}}
**Instrument:** {{instrument}}
**Level:** {{level}}

**LessonInstruction JSON:**
```json
{{lesson_instruction_json}}
```

## Task

Return the recap text only. No JSON, no explanation.
```

### 3.2 Practice Plan Prompt

```markdown
# Generation Prompt: Weekly Practice Plan

## System
(Include System Policy above)

## Developer Instructions

Create a 6-day practice plan broken into daily assignments.

RULES:
- Use ONLY items from the LessonInstruction JSON
- Total per day: approximately 25 minutes
- Each day: 3 tasks
- Include tempo targets when provided
- Avoid vague phrases like "practice more" or "work on it"

FORMAT:
- Title line: "Practice Plan"
- For each day: "Day 1" through "Day 6"
  - Task bullets: "(minutes) category: specific instruction"
- Distribute practice items across days logically
- Higher priority items should appear more frequently

## User Input

**Student:** {{student_name}}
**Instrument:** {{instrument}}

**LessonInstruction JSON:**
```json
{{lesson_instruction_json}}
```

## Task

Return the practice plan text only. No JSON, no explanation.
```

### 3.3 Parent Email Prompt

```markdown
# Generation Prompt: Parent Email

## System
(Include System Policy above)

## Developer Instructions

Draft a parent email summarizing progress and practice expectations.

RULES:
- Use ONLY information from the LessonInstruction JSON
- Tone: warm, confident, not overly long
- Length limit: 220 words maximum
- NO marketing language or sales pitch

INCLUDE:
- Short positive opener
- 2-4 bullet highlights (from praise_wins and pieces_assigned)
- Clear practice expectations for the week (from admin_notes or practice_items)
- Friendly closing

## User Input

**Parent recipient names (optional):** {{parent_names}}
**Student:** {{student_name}}

**LessonInstruction JSON:**
```json
{{lesson_instruction_json}}
```

## Task

Return the email body only. No JSON, no subject line, no explanation.
```

---

## 4. Prompt Template Implementation

```python
# services/prompts.py

from pathlib import Path
from typing import Dict, Any
import json

PROMPTS_DIR = Path(__file__).parent / "prompts"

def load_system_policy() -> str:
    """Load the system policy that applies to all prompts."""
    return (PROMPTS_DIR / "00_system_policy.md").read_text()

def load_prompt_template(name: str) -> str:
    """Load a prompt template by name."""
    path = PROMPTS_DIR / f"{name}.md"
    return path.read_text()

def render_extraction_prompt(
    student_name: str,
    instrument: str,
    level: str,
    lesson_date_iso: str,
    lesson_id: str,
    student_id: str,
    transcript_segments: list,
    schema: dict,
) -> str:
    """Render the extraction prompt with variables."""
    template = load_prompt_template("10_extract_lesson_schema.prompt")
    
    return template.format(
        student_name=student_name,
        instrument=instrument,
        level=level,
        lesson_date_iso=lesson_date_iso,
        lesson_id=lesson_id,
        student_id=student_id,
        transcript_segments_json=json.dumps(transcript_segments, indent=2),
        lesson_instruction_json_schema=json.dumps(schema, indent=2),
    )

def render_recap_prompt(
    student_name: str,
    instrument: str,
    level: str,
    lesson_instruction: dict,
) -> str:
    """Render the student recap generation prompt."""
    template = load_prompt_template("20_generate_recap.prompt")
    
    return template.format(
        student_name=student_name,
        instrument=instrument,
        level=level,
        lesson_instruction_json=json.dumps(lesson_instruction, indent=2),
    )

def render_practice_plan_prompt(
    student_name: str,
    instrument: str,
    lesson_instruction: dict,
) -> str:
    """Render the practice plan generation prompt."""
    template = load_prompt_template("21_generate_practice_plan.prompt")
    
    return template.format(
        student_name=student_name,
        instrument=instrument,
        lesson_instruction_json=json.dumps(lesson_instruction, indent=2),
    )

def render_parent_email_prompt(
    student_name: str,
    parent_names: str,
    lesson_instruction: dict,
) -> str:
    """Render the parent email generation prompt."""
    template = load_prompt_template("22_generate_parent_email.prompt")
    
    return template.format(
        student_name=student_name,
        parent_names=parent_names or "Parent/Guardian",
        lesson_instruction_json=json.dumps(lesson_instruction, indent=2),
    )
```

---

## 5. API Call Implementation

```python
# services/ai_client.py

import json
from openai import OpenAI
from typing import Dict, Any

client = OpenAI()

SYSTEM_POLICY = """
You are an assistant that produces reliable, teacher-grade outputs for music lesson documentation.
You must not invent details. You must ground every extracted item in transcript evidence.
If something is not present, omit it or mark confidence low.
You must output exactly what is requested, in the required format.
"""

async def extract_lesson_instruction(
    transcript_segments: list,
    context: Dict[str, Any],
    schema: dict,
) -> dict:
    """Extract LessonInstruction from transcript using GPT-4o."""
    
    prompt = render_extraction_prompt(
        student_name=context["student_name"],
        instrument=context["instrument"],
        level=context.get("level", ""),
        lesson_date_iso=context.get("lesson_date_iso", ""),
        lesson_id=context["lesson_id"],
        student_id=context["student_id"],
        transcript_segments=transcript_segments,
        schema=schema,
    )
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_POLICY},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,  # Lower temperature for more consistent extraction
    )
    
    content = response.choices[0].message.content
    return json.loads(content)

async def generate_recap(
    lesson_instruction: dict,
    context: Dict[str, Any],
) -> str:
    """Generate student recap from LessonInstruction."""
    
    prompt = render_recap_prompt(
        student_name=context["student_name"],
        instrument=context["instrument"],
        level=context.get("level", ""),
        lesson_instruction=lesson_instruction,
    )
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_POLICY},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5,
    )
    
    return response.choices[0].message.content.strip()

async def generate_practice_plan(
    lesson_instruction: dict,
    context: Dict[str, Any],
) -> str:
    """Generate practice plan from LessonInstruction."""
    
    prompt = render_practice_plan_prompt(
        student_name=context["student_name"],
        instrument=context["instrument"],
        lesson_instruction=lesson_instruction,
    )
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_POLICY},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5,
    )
    
    return response.choices[0].message.content.strip()

async def generate_parent_email(
    lesson_instruction: dict,
    context: Dict[str, Any],
) -> str:
    """Generate parent email from LessonInstruction."""
    
    prompt = render_parent_email_prompt(
        student_name=context["student_name"],
        parent_names=context.get("parent_names", ""),
        lesson_instruction=lesson_instruction,
    )
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_POLICY},
            {"role": "user", "content": prompt}
        ],
        temperature=0.5,
    )
    
    return response.choices[0].message.content.strip()
```

---

## 6. Prompt Engineering Guidelines

### 6.1 Do's

| Guideline | Example |
|-----------|---------|
| Be specific about format | "Return ONLY the JSON, no explanation" |
| Provide constraints | "Length limit: 180 words maximum" |
| Give examples | Include few-shot examples in prompts |
| Set temperature appropriately | 0.3 for extraction, 0.5 for generation |
| Require evidence | "Every item MUST include evidence entries" |

### 6.2 Don'ts

| Avoid | Why |
|-------|-----|
| Vague instructions | "Write a nice summary" |
| Unbounded outputs | No length or structure constraints |
| Allowing fabrication | "Be creative" encourages hallucination |
| Multiple tasks in one prompt | Hard to validate, debug |
| Long context without structure | Model gets confused |

### 6.3 Prompt Versioning

Each prompt should include a version comment for tracking:

```markdown
<!-- Prompt Version: 1.0.0 -->
<!-- Last Updated: 2025-01-15 -->
<!-- Author: AI Engineering Team -->
```

When modifying prompts, always run the golden fixture tests to verify no regression.


# Golden Fixtures

**Version**: 1.0.0  
**Purpose**: Regression testing for AI pipeline

---

## 1. Overview

Golden fixtures are **known-good** input/output pairs that prevent AI regression. When prompts or models change, the fixture tests ensure outputs remain consistent.

**Philosophy**: If it worked before, it should work now.

---

## 2. Fixture Structure

```
fixtures/
└── golden/
    ├── transcript.segments.json    # Input: Whisper output
    ├── schema.expected.json        # Output: LessonInstruction
    ├── schema.snapshot.json        # Snapshot for drift detection
    ├── recap.expected.md           # Output: Student recap
    ├── practice_plan.expected.md   # Output: Practice plan
    └── parent_email.expected.md    # Output: Parent email
```

---

## 3. Golden Transcript

A realistic piano lesson transcript with clear pedagogical content:

```json
// fixtures/golden/transcript.segments.json

[
  {
    "start_time_sec": 0,
    "end_time_sec": 12,
    "speaker": "Teacher",
    "text": "Hi Leo. Let's start with your C major scale. Two octaves, hands together."
  },
  {
    "start_time_sec": 12,
    "end_time_sec": 28,
    "speaker": "Teacher",
    "text": "Good. Keep your fingers curved and land on the tips, not flat."
  },
  {
    "start_time_sec": 28,
    "end_time_sec": 45,
    "speaker": "Teacher",
    "text": "Metronome at 72 today. By Friday I want you at 84 if it stays clean."
  },
  {
    "start_time_sec": 45,
    "end_time_sec": 62,
    "speaker": "Teacher",
    "text": "Add the C major arpeggio too. Slow, even sound, no rushing at the top."
  },
  {
    "start_time_sec": 62,
    "end_time_sec": 78,
    "speaker": "Teacher",
    "text": "Your posture is much better this week. Shoulders relaxed. Nice."
  },
  {
    "start_time_sec": 78,
    "end_time_sec": 102,
    "speaker": "Teacher",
    "text": "Now Minuet in G. Let's focus on measures 9 to 16. The left hand needs lighter staccato."
  },
  {
    "start_time_sec": 102,
    "end_time_sec": 120,
    "speaker": "Teacher",
    "text": "For staccato, lift from the wrist, not the fingers. Think bounce, not poke."
  },
  {
    "start_time_sec": 120,
    "end_time_sec": 138,
    "speaker": "Teacher",
    "text": "Great dynamic contrast in the phrase. Keep that."
  },
  {
    "start_time_sec": 138,
    "end_time_sec": 160,
    "speaker": "Teacher",
    "text": "Your recital piece is Moonlight Sonata. This week do measures 5 to 8 hands separate first."
  },
  {
    "start_time_sec": 160,
    "end_time_sec": 184,
    "speaker": "Teacher",
    "text": "The chord change in measure 12 is still tripping you. Practice just that transition ten times slowly."
  },
  {
    "start_time_sec": 184,
    "end_time_sec": 204,
    "speaker": "Teacher",
    "text": "Count out loud: one e and a, two e and a. It fixes the rhythm."
  },
  {
    "start_time_sec": 204,
    "end_time_sec": 226,
    "speaker": "Teacher",
    "text": "This week I want steady tempo and clean staccato in the left hand. Quality over speed."
  },
  {
    "start_time_sec": 226,
    "end_time_sec": 248,
    "speaker": "Teacher",
    "text": "Aim for about 25 minutes a day, six days this week. Short and focused."
  },
  {
    "start_time_sec": 248,
    "end_time_sec": 270,
    "speaker": "Teacher",
    "text": "Tell your mom you did great today. The main thing is to slow down before the tricky spots."
  }
]
```

---

## 4. Golden Extraction

The expected `LessonInstruction` JSON from the transcript above:

```json
// fixtures/golden/schema.expected.json

{
  "meta": {
    "lesson_id": "lesson_golden_001",
    "student_id": "student_golden_leo",
    "student_name": "Leo",
    "instrument": "piano",
    "level": "early intermediate",
    "lesson_date_iso": "2025-01-15",
    "extraction_version": "golden-fixture-v1",
    "notes": "Golden regression fixture"
  },
  "praise_wins": [
    {
      "text": "Improved posture with relaxed shoulders.",
      "evidence": [
        {
          "quote": "Your posture is much better this week. Shoulders relaxed",
          "start_time_sec": 62,
          "end_time_sec": 78,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "text": "Good dynamic contrast in the phrase.",
      "evidence": [
        {
          "quote": "Great dynamic contrast in the phrase",
          "start_time_sec": 120,
          "end_time_sec": 138,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "pieces_assigned": [
    {
      "title": "Minuet in G",
      "composer": "",
      "section": "measures 9 to 16",
      "goal": "Lighter left-hand staccato and keep dynamic contrast.",
      "evidence": [
        {
          "quote": "Minuet in G. Let's focus on measures 9 to 16",
          "start_time_sec": 78,
          "end_time_sec": 102,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "title": "Moonlight Sonata",
      "composer": "",
      "section": "measures 5 to 8 hands separate; chord transition in measure 12",
      "goal": "Hands separate first, then drill the measure 12 chord transition slowly.",
      "evidence": [
        {
          "quote": "Your recital piece is Moonlight Sonata. This week do measures 5 to 8",
          "start_time_sec": 138,
          "end_time_sec": 160,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "techniques": [
    {
      "name": "Curved fingers",
      "description": "Keep fingers curved and play on the fingertips rather than flat fingers.",
      "evidence": [
        {
          "quote": "Keep your fingers curved and land on the tips, not flat",
          "start_time_sec": 12,
          "end_time_sec": 28,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "name": "Wrist-led staccato",
      "description": "Lift from the wrist for staccato instead of isolated finger motion.",
      "evidence": [
        {
          "quote": "For staccato, lift from the wrist, not the fingers",
          "start_time_sec": 102,
          "end_time_sec": 120,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "name": "Subdivision counting",
      "description": "Count subdivisions out loud to stabilize rhythm.",
      "evidence": [
        {
          "quote": "Count out loud: one e and a, two e and a",
          "start_time_sec": 184,
          "end_time_sec": 204,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "corrections": [
    {
      "issue": "Flattened fingers during scales.",
      "fix": "Keep fingers curved and play on the fingertips.",
      "where": "C major scale",
      "evidence": [
        {
          "quote": "Keep your fingers curved and land on the tips, not flat",
          "start_time_sec": 12,
          "end_time_sec": 28,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "issue": "Rushing at the top of the arpeggio.",
      "fix": "Play slowly with even sound and avoid rushing at the top.",
      "where": "C major arpeggio",
      "evidence": [
        {
          "quote": "no rushing at the top",
          "start_time_sec": 45,
          "end_time_sec": 62,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "issue": "Chord transition is inconsistent.",
      "fix": "Repeat the transition ten times slowly.",
      "where": "Moonlight Sonata measure 12",
      "evidence": [
        {
          "quote": "Practice just that transition ten times slowly",
          "start_time_sec": 160,
          "end_time_sec": 184,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "tempo_targets": [
    {
      "piece": "C major scale",
      "bpm": 72,
      "context": "Current metronome setting for clean playing.",
      "evidence": [
        {
          "quote": "Metronome at 72 today",
          "start_time_sec": 28,
          "end_time_sec": 45,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "piece": "C major scale",
      "bpm": 84,
      "context": "Goal tempo by Friday if clean.",
      "evidence": [
        {
          "quote": "By Friday I want you at 84 if it stays clean",
          "start_time_sec": 28,
          "end_time_sec": 45,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "weekly_focus": [
    {
      "text": "Steady tempo and clean left-hand staccato, prioritizing quality over speed.",
      "evidence": [
        {
          "quote": "steady tempo and clean staccato in the left hand. Quality over speed",
          "start_time_sec": 204,
          "end_time_sec": 226,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "practice_items": [
    {
      "category": "scales",
      "instruction": "C major scale, two octaves, hands together. Start at 72 bpm and work toward 84 bpm if clean.",
      "duration_minutes": 10,
      "priority": 5,
      "evidence": [
        {
          "quote": "C major scale. Two octaves, hands together",
          "start_time_sec": 0,
          "end_time_sec": 12,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "category": "technique",
      "instruction": "C major arpeggio, slow and even. Do not rush at the top.",
      "duration_minutes": 5,
      "priority": 4,
      "evidence": [
        {
          "quote": "Add the C major arpeggio too. Slow, even sound",
          "start_time_sec": 45,
          "end_time_sec": 62,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "category": "repertoire",
      "instruction": "Minuet in G, measures 9 to 16. Left hand staccato should come from the wrist.",
      "duration_minutes": 8,
      "priority": 4,
      "evidence": [
        {
          "quote": "Minuet in G. Let's focus on measures 9 to 16",
          "start_time_sec": 78,
          "end_time_sec": 102,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "category": "repertoire",
      "instruction": "Moonlight Sonata, measures 5 to 8 hands separate first.",
      "duration_minutes": 7,
      "priority": 5,
      "evidence": [
        {
          "quote": "do measures 5 to 8 hands separate first",
          "start_time_sec": 138,
          "end_time_sec": 160,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    },
    {
      "category": "technique",
      "instruction": "Moonlight Sonata measure 12 chord transition. Repeat 10 times slowly.",
      "duration_minutes": 5,
      "priority": 5,
      "evidence": [
        {
          "quote": "Practice just that transition ten times slowly",
          "start_time_sec": 160,
          "end_time_sec": 184,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ],
  "admin_notes": [
    {
      "text": "Practice target: about 25 minutes per day, six days this week.",
      "evidence": [
        {
          "quote": "Aim for about 25 minutes a day, six days this week",
          "start_time_sec": 226,
          "end_time_sec": 248,
          "speaker": "Teacher"
        }
      ],
      "confidence": "high"
    }
  ]
}
```

---

## 5. Golden Outputs

### 5.1 Student Recap

```markdown
// fixtures/golden/recap.expected.md

Lesson Recap

Wins
- Better posture this week with relaxed shoulders.
- Strong dynamic contrast in the phrase.

Focus
- C major scale: keep fingers curved and play on the fingertips.
- C major arpeggio: keep it even and do not rush at the top.
- Minuet in G measures 9 to 16: lighter left-hand staccato led by the wrist.
- Moonlight Sonata: measures 5 to 8 hands separate, then drill the measure 12 chord transition slowly.

Next lesson
- We will check scale tempo progress and whether the Moonlight transition feels reliable.
```

### 5.2 Practice Plan

```markdown
// fixtures/golden/practice_plan.expected.md

Practice Plan

Day 1
- (10) scales: C major scale, two octaves, hands together at 72 bpm. Curved fingers on fingertips.
- (8) repertoire: Minuet in G measures 9 to 16. Left-hand staccato from the wrist.
- (7) repertoire: Moonlight Sonata measures 5 to 8 hands separate, slow and steady.

Day 2
- (10) scales: C major scale at 72 bpm, then one clean attempt slightly faster.
- (5) technique: C major arpeggio, slow and even, no rushing at the top.
- (10) technique: Moonlight Sonata measure 12 chord transition, 10 slow reps.

Day 3
- (10) scales: C major scale, aim for clean playing and stable tempo.
- (8) repertoire: Minuet in G measures 9 to 16. Light wrist staccato in left hand.
- (7) rhythm: Count out loud one e and a, two e and a during tricky spots.

Day 4
- (10) scales: C major scale, target 76 to 80 bpm only if clean.
- (5) technique: C major arpeggio, even tone, no rushing.
- (10) repertoire: Moonlight Sonata measures 5 to 8 hands separate, then one careful hands-together try.

Day 5
- (10) scales: C major scale, push toward 84 bpm only if clean.
- (8) repertoire: Minuet in G measures 9 to 16, keep dynamics and light staccato.
- (7) technique: Moonlight Sonata measure 12 chord transition, 10 slow reps with counting.

Day 6
- (10) scales: C major scale, one best take at your cleanest tempo.
- (8) repertoire: Minuet in G measures 9 to 16, wrist-led staccato check.
- (7) repertoire: Moonlight Sonata measures 5 to 8, steady tempo and relaxed hands.
```

### 5.3 Parent Email

```markdown
// fixtures/golden/parent_email.expected.md

Hi,

Leo made strong progress today.

Highlights
- His posture has improved a lot and his shoulders stayed relaxed.
- He showed great dynamic contrast in his phrasing.

This week, please aim for about 25 minutes a day, six days if possible.

Practice focus
- C major scale, two octaves hands together. Start with metronome 72 and work toward 84 by Friday only if it stays clean.
- Add C major arpeggio slowly, keeping the sound even and avoiding any rush at the top.
- Minuet in G measures 9 to 16. The left-hand staccato should come from the wrist and stay light.
- Moonlight Sonata measures 5 to 8 hands separate first. The measure 12 chord transition is the tricky spot, so repeat that transition 10 times slowly.

Thanks, and please tell Leo he did great today.
```

---

## 6. Test Implementation

```python
# tests/test_golden_fixture.py

import json
from pathlib import Path
from deepdiff import DeepDiff

from tools.validate_schema import validate as validate_json
from tools.text_checks import assert_max_words, assert_contains_any

REPO = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO / "schemas" / "lesson_instruction.schema.json"
FIXTURE_DIR = REPO / "fixtures" / "golden"

def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))

def test_expected_schema_conforms_to_json_schema():
    """Golden extraction must pass schema validation."""
    expected = load_json(FIXTURE_DIR / "schema.expected.json")
    validate_json(expected, SCHEMA_PATH)

def test_transcript_fixture_is_valid():
    """Transcript fixture must have correct structure."""
    segments = load_json(FIXTURE_DIR / "transcript.segments.json")
    
    assert isinstance(segments, list)
    assert len(segments) >= 10
    
    for seg in segments:
        assert "start_time_sec" in seg
        assert "end_time_sec" in seg
        assert "speaker" in seg
        assert "text" in seg
        assert seg["start_time_sec"] <= seg["end_time_sec"]

def test_outputs_meet_contracts():
    """Golden outputs must meet length and structure constraints."""
    recap = (FIXTURE_DIR / "recap.expected.md").read_text()
    plan = (FIXTURE_DIR / "practice_plan.expected.md").read_text()
    email = (FIXTURE_DIR / "parent_email.expected.md").read_text()
    
    # Word limits
    assert_max_words(recap, 180, "Recap")
    assert_max_words(email, 220, "Parent email")
    
    # Required markers
    assert_contains_any(plan, ["Day 1", "Day 2", "Monday", "Tuesday"], "Practice plan")

def test_schema_stability():
    """Prevent silent edits to golden schema."""
    expected = load_json(FIXTURE_DIR / "schema.expected.json")
    snapshot = load_json(FIXTURE_DIR / "schema.snapshot.json")
    
    diff = DeepDiff(snapshot, expected, ignore_order=True)
    assert diff == {}, f"Golden schema changed unexpectedly:\n{diff}"
```

---

## 7. Pipeline Runner

```python
# tools/run_pipeline_on_fixture.py

import json
from pathlib import Path
from deepdiff import DeepDiff

from tools.adapters.expected_adapter import ExpectedAdapter
from tools.validate_schema import validate
from tools.text_checks import assert_max_words, assert_contains_any

REPO = Path(__file__).resolve().parents[1]
FIXTURE_DIR = REPO / "fixtures" / "golden"
OUTPUT_DIR = REPO / "artifacts" / "golden-run"

def run_fixture(adapter, compare=True):
    """Run extraction + generation on golden fixture."""
    
    # Load inputs
    transcript = json.loads(
        (FIXTURE_DIR / "transcript.segments.json").read_text()
    )
    
    expected_schema = json.loads(
        (FIXTURE_DIR / "schema.expected.json").read_text()
    )
    
    context = {
        "lesson_id": expected_schema["meta"]["lesson_id"],
        "student_id": expected_schema["meta"]["student_id"],
        "student_name": expected_schema["meta"]["student_name"],
        "instrument": expected_schema["meta"]["instrument"],
        "level": expected_schema["meta"].get("level", ""),
    }
    
    # Run pipeline
    schema = adapter.extract_schema(transcript, context)
    drafts = adapter.generate_drafts(schema, context)
    
    # Validate outputs
    validate(schema)
    assert_max_words(drafts["recap"], 180, "Recap")
    assert_max_words(drafts["parent_email"], 220, "Parent email")
    assert_contains_any(drafts["practice_plan"], ["Day 1", "Monday"], "Plan")
    
    # Write artifacts
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "schema.json").write_text(json.dumps(schema, indent=2))
    (OUTPUT_DIR / "recap.md").write_text(drafts["recap"])
    (OUTPUT_DIR / "practice_plan.md").write_text(drafts["practice_plan"])
    (OUTPUT_DIR / "parent_email.md").write_text(drafts["parent_email"])
    
    # Compare if requested
    if compare:
        schema_diff = DeepDiff(expected_schema, schema, ignore_order=True)
        return {"ok": schema_diff == {}, "diff": schema_diff}
    
    return {"ok": True}

if __name__ == "__main__":
    adapter = ExpectedAdapter(FIXTURE_DIR)
    result = run_fixture(adapter, compare=True)
    print("OK" if result["ok"] else f"DIFF: {result.get('diff')}")
```

---

## 8. CI Integration

```yaml
# .github/workflows/ci.yml (excerpt)

  golden-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements-dev.txt
      
      - name: Run golden fixture tests
        run: pytest tests/test_golden_fixture.py -v
      
      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: golden-diff
          path: artifacts/golden-run/
```

---

## 9. Adding New Fixtures

When adding regression tests for new scenarios:

1. **Create transcript**: Write realistic lesson segments
2. **Run extraction manually**: Verify output is correct
3. **Save as expected**: Copy to `fixtures/new_scenario/schema.expected.json`
4. **Generate outputs**: Run generation, verify, save
5. **Create snapshot**: Copy schema.expected.json to schema.snapshot.json
6. **Add tests**: Reference the new fixture directory

```bash
# Example: Adding a violin lesson fixture
mkdir fixtures/violin_beginner/
# ... create transcript.segments.json
# ... run extraction, save schema.expected.json
# ... run generation, save *.expected.md files
# ... copy schema.expected.json to schema.snapshot.json
```

# Code Patterns

**Version**: 1.0.0  
**Purpose**: Reference implementations for AI agents

---

## 1. Overview

This document provides **working code patterns** that AI agents should follow when implementing the Note By Note MVP. Each pattern is designed to be copy-paste ready with modifications for specific requirements.

---

## 2. Backend Patterns (FastAPI + Python)

### 2.1 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app and health check
│   ├── config.py            # Settings and environment
│   ├── dependencies.py      # Dependency injection
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── lessons.py   # Lesson endpoints
│   │   │   ├── students.py  # Student endpoints
│   │   │   └── outputs.py   # Output endpoints
│   │   └── middleware/
│   │       └── auth.py      # Authentication
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ai_pipeline.py   # Main AI orchestration
│   │   ├── transcription.py # Whisper integration
│   │   ├── extraction.py    # LLM extraction
│   │   └── generation.py    # LLM generation
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── lesson.py        # Pydantic models
│   │   └── output.py
│   └── db/
│       ├── __init__.py
│       └── prisma.py        # Database client
├── tests/
├── requirements.txt
└── .env.example
```

### 2.2 Main Application

```python
# app/main.py

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.routes import lessons, students, outputs
from app.config import settings

load_dotenv()

app = FastAPI(
    title="Note By Note API",
    version="1.0.0",
    description="AI Practice Plan Generator for Music Teachers"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
app.include_router(students.router, prefix="/students", tags=["students"])
app.include_router(outputs.router, prefix="/outputs", tags=["outputs"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Note By Note API",
        "version": "1.0.0"
    }
```

### 2.3 Pydantic Schemas

```python
# app/schemas/lesson.py

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class LessonStatus(str, Enum):
    UPLOADING = "UPLOADING"
    TRANSCRIBING = "TRANSCRIBING"
    EXTRACTING = "EXTRACTING"
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class OutputType(str, Enum):
    RECAP = "RECAP"
    PRACTICE_PLAN = "PRACTICE_PLAN"
    PARENT_EMAIL = "PARENT_EMAIL"


class OutputBase(BaseModel):
    type: OutputType
    content: str
    word_count: int


class OutputResponse(OutputBase):
    id: str
    edited_content: Optional[str] = None
    was_edited: bool = False
    created_at: datetime
    updated_at: datetime


class LessonCreate(BaseModel):
    student_id: str = Field(..., description="ID of the student")


class LessonResponse(BaseModel):
    id: str
    student_id: str
    status: LessonStatus
    audio_url: Optional[str] = None
    audio_duration: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    outputs: List[OutputResponse] = []


class LessonWithTranscript(LessonResponse):
    transcript_text: Optional[str] = None
```

### 2.4 Lesson Endpoints

```python
# app/api/routes/lessons.py

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, BackgroundTasks
from typing import List
from app.schemas.lesson import LessonCreate, LessonResponse, LessonWithTranscript, LessonStatus
from app.services.ai_pipeline import process_lesson_async
from app.dependencies import get_current_user, get_db

router = APIRouter()


@router.post("/", response_model=LessonResponse)
async def create_lesson(
    lesson: LessonCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new lesson record."""
    # Verify student belongs to user
    student = await db.student.find_first(
        where={"id": lesson.student_id, "userId": current_user.id, "deletedAt": None}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Create lesson
    new_lesson = await db.lesson.create(
        data={
            "userId": current_user.id,
            "studentId": lesson.student_id,
            "status": LessonStatus.UPLOADING.value,
        }
    )
    
    return LessonResponse.model_validate(new_lesson)


@router.post("/{lesson_id}/upload")
async def upload_audio(
    lesson_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Upload audio file and start processing."""
    # Verify lesson belongs to user
    lesson = await db.lesson.find_first(
        where={"id": lesson_id, "userId": current_user.id}
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Upload to storage (pseudo-code)
    audio_url = await upload_to_storage(file, lesson_id)
    
    # Update lesson with audio URL
    await db.lesson.update(
        where={"id": lesson_id},
        data={"audioUrl": audio_url, "status": LessonStatus.TRANSCRIBING.value}
    )
    
    # Start background processing
    background_tasks.add_task(process_lesson_async, lesson_id)
    
    return {"message": "Processing started", "lesson_id": lesson_id}


@router.get("/{lesson_id}", response_model=LessonWithTranscript)
async def get_lesson(
    lesson_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a lesson with its outputs."""
    lesson = await db.lesson.find_first(
        where={"id": lesson_id, "userId": current_user.id},
        include={
            "outputs": True,
            "transcript": True,
            "student": {
                "select": {
                    "id": True,
                    "firstName": True,
                    "lastName": True,
                    "instrument": True,
                }
            }
        }
    )
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return LessonWithTranscript.model_validate(lesson)


@router.get("/", response_model=List[LessonResponse])
async def list_lessons(
    limit: int = 20,
    offset: int = 0,
    student_id: str = None,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """List lessons for the current user."""
    where = {"userId": current_user.id}
    if student_id:
        where["studentId"] = student_id
    
    lessons = await db.lesson.find_many(
        where=where,
        include={"outputs": True},
        order={"createdAt": "desc"},
        take=limit,
        skip=offset,
    )
    
    return [LessonResponse.model_validate(l) for l in lessons]
```

### 2.5 AI Pipeline Service

```python
# app/services/ai_pipeline.py

import json
import asyncio
from typing import Dict, Any
from app.services.transcription import transcribe_audio
from app.services.extraction import extract_lesson_instruction
from app.services.generation import generate_outputs
from app.db import get_db_client
from app.schemas.lesson import LessonStatus, OutputType
from tools.validate_schema import validate


async def process_lesson_async(lesson_id: str) -> None:
    """Process a lesson through the full AI pipeline.
    
    This runs as a background task after audio upload.
    """
    db = await get_db_client()
    
    try:
        # Get lesson with student info
        lesson = await db.lesson.find_unique(
            where={"id": lesson_id},
            include={"student": True}
        )
        
        if not lesson or not lesson.audioUrl:
            raise ValueError("Lesson or audio not found")
        
        context = {
            "lesson_id": lesson.id,
            "student_id": lesson.student.id,
            "student_name": f"{lesson.student.firstName}",
            "instrument": lesson.student.instrument.lower(),
            "level": lesson.student.skillLevel.replace("_", " ").lower(),
        }
        
        # Stage 1: Transcription
        await update_status(db, lesson_id, LessonStatus.TRANSCRIBING)
        transcript_segments = await transcribe_audio(lesson.audioUrl)
        
        await db.transcript.create(
            data={
                "lessonId": lesson_id,
                "segments": transcript_segments,
                "fullText": " ".join(s["text"] for s in transcript_segments),
                "wordCount": sum(len(s["text"].split()) for s in transcript_segments),
            }
        )
        
        # Stage 2: Extraction
        await update_status(db, lesson_id, LessonStatus.EXTRACTING)
        extraction = await extract_lesson_instruction(transcript_segments, context)
        
        # Validate against schema
        validate(extraction)
        
        await db.extraction.create(
            data={
                "lessonId": lesson_id,
                "data": extraction,
                "schemaVersion": "1.0.0",
                "isValid": True,
            }
        )
        
        # Stage 3: Generation
        await update_status(db, lesson_id, LessonStatus.GENERATING)
        outputs = await generate_outputs(extraction, context)
        
        # Save outputs
        for output_type, content in outputs.items():
            await db.output.create(
                data={
                    "lessonId": lesson_id,
                    "type": output_type,
                    "content": content,
                    "wordCount": len(content.split()),
                }
            )
        
        # Mark complete
        await update_status(db, lesson_id, LessonStatus.COMPLETED)
        
    except Exception as e:
        # Mark failed with error message
        await db.lesson.update(
            where={"id": lesson_id},
            data={
                "status": LessonStatus.FAILED.value,
                "errorMessage": str(e)[:500],
            }
        )
        raise


async def update_status(db, lesson_id: str, status: LessonStatus) -> None:
    """Update lesson status."""
    await db.lesson.update(
        where={"id": lesson_id},
        data={"status": status.value}
    )
```

### 2.6 Transcription Service

```python
# app/services/transcription.py

import os
from typing import List, Dict, Any
from openai import OpenAI

client = OpenAI()


async def transcribe_audio(audio_url: str) -> List[Dict[str, Any]]:
    """Transcribe audio using OpenAI Whisper.
    
    Returns list of transcript segments with timestamps.
    """
    # Download audio from storage (pseudo-code)
    audio_data = await download_from_storage(audio_url)
    
    # Call Whisper API
    response = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_data,
        response_format="verbose_json",
        timestamp_granularities=["segment"]
    )
    
    # Convert to our segment format
    segments = []
    for seg in response.segments:
        segments.append({
            "start_time_sec": seg["start"],
            "end_time_sec": seg["end"],
            "speaker": "Teacher",  # Default, could use diarization
            "text": seg["text"].strip(),
        })
    
    return segments
```

### 2.7 Test Example

```python
# tests/test_lessons.py

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from app.main import app

client = TestClient(app)


# Mock data
MOCK_TRANSCRIPT = [
    {"start_time_sec": 0, "end_time_sec": 10, "speaker": "Teacher", "text": "Hi Leo."}
]

MOCK_EXTRACTION = {
    "meta": {"lesson_id": "1", "student_id": "1", "student_name": "Leo", "instrument": "piano"},
    "praise_wins": [],
    "pieces_assigned": [],
    "techniques": [],
    "corrections": [],
    "practice_items": [],
}

MOCK_OUTPUTS = {
    "RECAP": "Lesson Recap\n\nWins\n- Good progress.",
    "PRACTICE_PLAN": "Practice Plan\n\nDay 1\n- (10) scales: C major",
    "PARENT_EMAIL": "Hi,\n\nLeo did great today.",
}


@pytest.fixture
def mock_auth():
    """Mock authentication to return a test user."""
    with patch("app.dependencies.get_current_user") as mock:
        mock.return_value = MagicMock(id="user_123")
        yield mock


@patch("app.services.transcription.transcribe_audio")
@patch("app.services.extraction.extract_lesson_instruction")
@patch("app.services.generation.generate_outputs")
def test_lesson_processing_pipeline(
    mock_generate,
    mock_extract,
    mock_transcribe,
    mock_auth
):
    """Test the full lesson processing pipeline."""
    mock_transcribe.return_value = MOCK_TRANSCRIPT
    mock_extract.return_value = MOCK_EXTRACTION
    mock_generate.return_value = MOCK_OUTPUTS
    
    # Create lesson
    response = client.post(
        "/lessons/",
        json={"student_id": "student_123"},
        headers={"Authorization": "Bearer test_token"}
    )
    assert response.status_code == 200
    lesson_id = response.json()["id"]
    
    # Verify transcription was called
    mock_transcribe.assert_called_once()
    
    # Verify extraction was called with transcript
    mock_extract.assert_called_once()
    
    # Verify generation was called with extraction
    mock_generate.assert_called_once()
```

---

## 3. Frontend Patterns (React Native + Expo)

### 3.1 Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx          # Root layout
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab layout
│   │   ├── index.tsx        # Home/Students list
│   │   └── history.tsx      # Lesson history
│   ├── record/
│   │   └── [studentId].tsx  # Recording screen
│   └── review/
│       └── [lessonId].tsx   # Review/Edit screen
├── components/
│   ├── RecordButton.tsx
│   ├── OutputCard.tsx
│   └── StudentCard.tsx
├── services/
│   ├── api.ts               # API client
│   └── auth.ts              # Authentication
├── stores/
│   └── useAppStore.ts       # Zustand store
├── types/
│   └── index.ts             # TypeScript types
└── package.json
```

### 3.2 API Service

```typescript
// services/api.ts

import axios, { AxiosError } from 'axios';
import * as FileSystem from 'expo-file-system';
import { getToken } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

// Add auth token to all requests
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  instrument: string;
  skillLevel: string;
  parentEmail: string;
}

export interface Lesson {
  id: string;
  studentId: string;
  status: 'UPLOADING' | 'TRANSCRIBING' | 'EXTRACTING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  outputs: Output[];
  errorMessage?: string;
  createdAt: string;
}

export interface Output {
  id: string;
  type: 'RECAP' | 'PRACTICE_PLAN' | 'PARENT_EMAIL';
  content: string;
  editedContent?: string;
  wasEdited: boolean;
}

// API functions
export async function getStudents(): Promise<Student[]> {
  const response = await api.get('/students');
  return response.data;
}

export async function createLesson(studentId: string): Promise<Lesson> {
  const response = await api.post('/lessons', { student_id: studentId });
  return response.data;
}

export async function uploadAudio(lessonId: string, audioUri: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'lesson_recording.m4a',
  } as any);

  await api.post(`/lessons/${lessonId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function getLesson(lessonId: string): Promise<Lesson> {
  const response = await api.get(`/lessons/${lessonId}`);
  return response.data;
}

export async function updateOutput(outputId: string, editedContent: string): Promise<Output> {
  const response = await api.put(`/outputs/${outputId}`, { edited_content: editedContent });
  return response.data;
}
```

### 3.3 Recording Screen

```typescript
// app/record/[studentId].tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { useLocalSearchParams, router } from 'expo-router';
import { createLesson, uploadAudio, getLesson } from '@/services/api';

type ProcessingStatus = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'extracting' | 'generating' | 'completed' | 'failed';

const STATUS_MESSAGES: Record<ProcessingStatus, string> = {
  idle: 'Ready to record',
  recording: 'Recording...',
  uploading: 'Uploading audio...',
  transcribing: 'Transcribing lesson...',
  extracting: 'Analyzing content...',
  generating: 'Generating outputs...',
  completed: 'Complete!',
  failed: 'Processing failed',
};

export default function RecordScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'recording') {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Poll for status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lessonId && ['uploading', 'transcribing', 'extracting', 'generating'].includes(status)) {
      interval = setInterval(async () => {
        try {
          const lesson = await getLesson(lessonId);
          const newStatus = lesson.status.toLowerCase() as ProcessingStatus;
          setStatus(newStatus);
          
          if (newStatus === 'completed') {
            router.replace(`/review/${lessonId}`);
          }
        } catch (error) {
          console.error('Status poll failed:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [lessonId, status]);

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setStatus('recording');
      setDuration(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    try {
      setStatus('uploading');
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error('No recording URI');

      // Create lesson and upload
      const lesson = await createLesson(studentId!);
      setLessonId(lesson.id);
      
      await uploadAudio(lesson.id, uri);
      setStatus('transcribing');
    } catch (error) {
      console.error('Failed to process recording:', error);
      setStatus('failed');
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isProcessing = ['uploading', 'transcribing', 'extracting', 'generating'].includes(status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Note By Note</Text>
        <Text style={styles.subtitle}>{STATUS_MESSAGES[status]}</Text>
      </View>

      <View style={styles.center}>
        {isProcessing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>{STATUS_MESSAGES[status]}</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.recordButton, status === 'recording' && styles.recordingActive]}
              onPress={status === 'recording' ? stopRecording : startRecording}
              disabled={status === 'failed'}
            >
              <View style={[styles.innerCircle, status === 'recording' && styles.innerCircleActive]} />
            </TouchableOpacity>
            
            <Text style={styles.timer}>{formatDuration(duration)}</Text>
            
            <Text style={styles.hint}>
              {status === 'recording' ? 'Tap to stop' : 'Tap to start recording'}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F9FAFB',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  recordingActive: {
    borderColor: '#EF4444',
  },
  innerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4F46E5',
  },
  innerCircleActive: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    color: '#F9FAFB',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  hint: {
    fontSize: 16,
    color: '#6B7280',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
});
```

### 3.4 Review Screen

```typescript
// app/review/[lessonId].tsx

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getLesson, updateOutput, Output } from '@/services/api';

export default function ReviewScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  async function loadLesson() {
    try {
      const lesson = await getLesson(lessonId!);
      setOutputs(lesson.outputs);
    } catch (error) {
      console.error('Failed to load lesson:', error);
    }
  }

  async function saveEdit(outputId: string) {
    try {
      const updated = await updateOutput(outputId, editText);
      setOutputs(outputs.map((o) => (o.id === outputId ? updated : o)));
      setEditing(null);
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  }

  function startEditing(output: Output) {
    setEditing(output.id);
    setEditText(output.editedContent || output.content);
  }

  async function shareOutput(output: Output) {
    const content = output.editedContent || output.content;
    await Share.share({ message: content });
  }

  const getOutputTitle = (type: string) => {
    switch (type) {
      case 'RECAP': return 'STUDENT RECAP';
      case 'PRACTICE_PLAN': return 'PRACTICE PLAN';
      case 'PARENT_EMAIL': return 'PARENT EMAIL';
      default: return type;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.headerTitle}>Lesson Review</Text>

        {outputs.map((output) => (
          <View key={output.id} style={styles.card}>
            <Text style={styles.label}>{getOutputTitle(output.type)}</Text>
            
            {editing === output.id ? (
              <TextInput
                style={styles.textArea}
                multiline
                value={editText}
                onChangeText={setEditText}
                autoFocus
              />
            ) : (
              <Text style={styles.content}>
                {output.editedContent || output.content}
              </Text>
            )}

            <View style={styles.actions}>
              {editing === output.id ? (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => saveEdit(output.id)}
                  >
                    <Text style={styles.actionText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setEditing(null)}
                  >
                    <Text style={styles.actionTextSecondary}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => startEditing(output)}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => shareOutput(output)}
                  >
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scrollView: {
    padding: 16,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F9FAFB',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 8,
    letterSpacing: 1,
  },
  content: {
    color: '#F3F4F6',
    fontSize: 16,
    lineHeight: 24,
  },
  textArea: {
    color: '#F3F4F6',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  actionButton: {
    marginRight: 16,
  },
  actionText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  actionTextSecondary: {
    color: '#6B7280',
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#4F46E5',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

---

## 4. Testing Patterns

### 4.1 Mocking OpenAI

```python
# tests/conftest.py

import pytest
from unittest.mock import MagicMock, patch

@pytest.fixture
def mock_openai():
    """Mock OpenAI client for testing."""
    with patch("app.services.transcription.client") as mock_transcription, \
         patch("app.services.extraction.client") as mock_extraction, \
         patch("app.services.generation.client") as mock_generation:
        
        # Mock Whisper response
        mock_transcription.audio.transcriptions.create.return_value = MagicMock(
            segments=[
                {"start": 0, "end": 10, "text": "Hello Leo."}
            ]
        )
        
        # Mock GPT extraction response
        mock_extraction.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content='{"meta": {}}'))]
        )
        
        # Mock GPT generation response
        mock_generation.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Generated output"))]
        )
        
        yield {
            "transcription": mock_transcription,
            "extraction": mock_extraction,
            "generation": mock_generation,
        }
```

### 4.2 Integration Test Pattern

```python
# tests/test_integration.py

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

REQUIRED_OUTPUT_TYPES = ["RECAP", "PRACTICE_PLAN", "PARENT_EMAIL"]

def test_full_pipeline_produces_all_outputs(mock_openai, mock_auth, mock_db):
    """Integration test: lesson creation through output generation."""
    
    # 1. Create lesson
    response = client.post("/lessons/", json={"student_id": "test_student"})
    assert response.status_code == 200
    lesson_id = response.json()["id"]
    
    # 2. Upload audio (simulated)
    files = {"file": ("test.m4a", b"fake_audio", "audio/m4a")}
    response = client.post(f"/lessons/{lesson_id}/upload", files=files)
    assert response.status_code == 200
    
    # 3. Wait for processing (in real test, would poll)
    # ... mock completes immediately
    
    # 4. Verify outputs
    response = client.get(f"/lessons/{lesson_id}")
    assert response.status_code == 200
    
    lesson = response.json()
    output_types = [o["type"] for o in lesson["outputs"]]
    
    for required_type in REQUIRED_OUTPUT_TYPES:
        assert required_type in output_types, f"Missing {required_type}"
```


# 09. Testing Strategy

> Comprehensive testing approach for Note By Note MVP

---

## Testing Philosophy

1. **Contract-First**: JSON Schema validation catches AI drift before it reaches users
2. **Golden Fixtures**: If it worked before, it must work now
3. **Fast Feedback**: Unit tests run in <10s, full suite in <2min
4. **Real Mocks**: Mock external services, never mock business logic

---

## Test Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ← 5 critical paths
                    │   Tests   │
                   ─┴───────────┴─
                 ┌─────────────────┐
                 │   Integration   │  ← API + DB + Mocked AI
                 │     Tests       │
                ─┴─────────────────┴─
              ┌───────────────────────┐
              │      Unit Tests       │  ← Business logic, validation
              │                       │
             ─┴───────────────────────┴─

Target Coverage: 80% overall, 95% for AI pipeline
```

---

## Test Categories

### 1. Unit Tests

**Location:** `backend/tests/unit/`

**Scope:**
- Schema validation functions
- Text processing utilities
- Business logic (no I/O)
- Pydantic model validation

**Example: Schema Validation**

```python
# backend/tests/unit/test_schema_validation.py
import pytest
from app.services.validation import validate_lesson_instruction

class TestLessonInstructionValidation:
    """Unit tests for LessonInstruction schema validation."""
    
    def test_valid_extraction_passes(self, valid_extraction_fixture):
        """Valid extraction should pass validation."""
        errors = validate_lesson_instruction(valid_extraction_fixture)
        assert errors == []
    
    def test_missing_required_field_fails(self):
        """Missing lesson_date should fail."""
        invalid = {"student_name": "Leo"}  # missing lesson_date
        errors = validate_lesson_instruction(invalid)
        assert any("lesson_date" in e for e in errors)
    
    def test_evidence_required_for_praise(self):
        """Each praise_win must have evidence."""
        invalid = {
            "lesson_date": "2024-01-10",
            "student_name": "Leo",
            "praise_wins": [
                {"text": "Great dynamics"}  # missing evidence
            ]
        }
        errors = validate_lesson_instruction(invalid)
        assert any("evidence" in e for e in errors)
    
    def test_evidence_quote_max_length(self):
        """Evidence quotes must be ≤240 characters."""
        long_quote = "x" * 250
        invalid = {
            "lesson_date": "2024-01-10",
            "student_name": "Leo",
            "praise_wins": [{
                "text": "Good job",
                "evidence": [{
                    "quote": long_quote,
                    "start_time_sec": 0,
                    "end_time_sec": 10,
                    "speaker": "teacher"
                }]
            }]
        }
        errors = validate_lesson_instruction(invalid)
        assert any("240" in e or "quote" in e.lower() for e in errors)


class TestOutputValidation:
    """Unit tests for output text validation."""
    
    def test_recap_word_count(self):
        """Recap must be ≤180 words."""
        from app.services.validation import validate_recap
        
        short_recap = "Great lesson. " * 50  # ~100 words
        assert validate_recap(short_recap) == []
        
        long_recap = "Great lesson. " * 100  # ~200 words
        errors = validate_recap(long_recap)
        assert any("180" in e or "word" in e.lower() for e in errors)
    
    def test_practice_plan_has_days(self):
        """Practice plan must have Day 1-6 markers."""
        from app.services.validation import validate_practice_plan
        
        valid = "## Day 1\nTask\n## Day 2\nTask\n## Day 3\nTask\n## Day 4\nTask\n## Day 5\nTask\n## Day 6\nTask"
        assert validate_practice_plan(valid) == []
        
        missing_days = "## Day 1\nTask\n## Day 2\nTask"
        errors = validate_practice_plan(missing_days)
        assert len(errors) > 0
```

**Example: Text Utilities**

```python
# backend/tests/unit/test_text_utils.py
import pytest
from app.utils.text import count_words, extract_timestamps, sanitize_transcript

class TestWordCount:
    def test_simple_sentence(self):
        assert count_words("Hello world") == 2
    
    def test_with_punctuation(self):
        assert count_words("Hello, world!") == 2
    
    def test_with_markdown(self):
        assert count_words("## Header\n\nSome **bold** text") == 4
    
    def test_empty_string(self):
        assert count_words("") == 0


class TestTimestampExtraction:
    def test_extracts_seconds(self):
        segments = [
            {"start": 0.0, "end": 5.5, "text": "Hello"},
            {"start": 5.5, "end": 10.0, "text": "World"}
        ]
        result = extract_timestamps(segments)
        assert result[0]["start_time_sec"] == 0
        assert result[0]["end_time_sec"] == 6  # rounded up
```

---

### 2. Integration Tests

**Location:** `backend/tests/integration/`

**Scope:**
- API endpoints with database
- Service layer with mocked external APIs
- Full request/response cycles

**Example: Lesson API**

```python
# backend/tests/integration/test_lesson_api.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

@pytest.fixture
async def client(app):
    """Async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def auth_headers(test_user):
    """Authentication headers for test user."""
    return {"Authorization": f"Bearer {test_user.token}"}


class TestLessonCreation:
    """Integration tests for lesson creation flow."""
    
    async def test_create_lesson_success(self, client, auth_headers, test_student):
        """Successfully create a new lesson."""
        response = await client.post(
            "/api/v1/lessons",
            json={
                "student_id": str(test_student.id),
                "date": "2024-01-15",
                "duration_minutes": 30
            },
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "CREATED"
        assert data["student_id"] == str(test_student.id)
        assert "upload_url" in data
    
    async def test_create_lesson_invalid_student(self, client, auth_headers):
        """Reject lesson for non-existent student."""
        response = await client.post(
            "/api/v1/lessons",
            json={
                "student_id": "00000000-0000-0000-0000-000000000000",
                "date": "2024-01-15"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_create_lesson_unauthorized(self, client):
        """Reject unauthenticated requests."""
        response = await client.post(
            "/api/v1/lessons",
            json={"student_id": "uuid", "date": "2024-01-15"}
        )
        
        assert response.status_code == 401


class TestLessonProcessing:
    """Integration tests for AI processing pipeline."""
    
    @patch("app.services.transcription.transcribe_audio")
    @patch("app.services.ai_pipeline.call_openai")
    async def test_process_lesson_success(
        self,
        mock_openai,
        mock_transcribe,
        client,
        auth_headers,
        test_lesson_with_audio,
        golden_transcript,
        golden_extraction
    ):
        """Successfully process a lesson through the AI pipeline."""
        # Setup mocks
        mock_transcribe.return_value = golden_transcript
        mock_openai.return_value = golden_extraction
        
        # Start processing
        response = await client.post(
            f"/api/v1/lessons/{test_lesson_with_audio.id}/process",
            headers=auth_headers
        )
        
        assert response.status_code == 202
        assert response.json()["status"] == "TRANSCRIBING"
    
    @patch("app.services.transcription.transcribe_audio")
    async def test_transcription_failure_handled(
        self,
        mock_transcribe,
        client,
        auth_headers,
        test_lesson_with_audio
    ):
        """Gracefully handle transcription failures."""
        mock_transcribe.side_effect = Exception("Whisper API error")
        
        response = await client.post(
            f"/api/v1/lessons/{test_lesson_with_audio.id}/process",
            headers=auth_headers
        )
        
        assert response.status_code == 202
```

**Example: Database Integration**

```python
# backend/tests/integration/test_database.py
import pytest
from app.db.repositories import LessonRepository, StudentRepository

class TestLessonRepository:
    """Database integration tests for lessons."""
    
    async def test_create_and_retrieve(self, db_session, test_user, test_student):
        """Create lesson and retrieve it."""
        repo = LessonRepository(db_session)
        
        lesson = await repo.create(
            user_id=test_user.id,
            student_id=test_student.id,
            date="2024-01-15",
            duration_minutes=30
        )
        
        retrieved = await repo.get_by_id(lesson.id)
        assert retrieved.student_id == test_student.id
        assert retrieved.status == "CREATED"
    
    async def test_update_status(self, db_session, test_lesson):
        """Update lesson status."""
        repo = LessonRepository(db_session)
        
        await repo.update_status(test_lesson.id, "TRANSCRIBING")
        
        updated = await repo.get_by_id(test_lesson.id)
        assert updated.status == "TRANSCRIBING"
```

---

### 3. Golden Fixture Tests

**Location:** `backend/tests/golden/`

**Purpose:** Prevent AI regression when prompts change

**Structure:**
```
backend/tests/golden/
├── fixtures/
│   ├── piano_intermediate/
│   │   ├── transcript.json
│   │   ├── extraction.expected.json
│   │   ├── recap.expected.md
│   │   ├── practice_plan.expected.md
│   │   └── parent_email.expected.md
│   ├── violin_beginner/
│   └── voice_advanced/
├── test_extraction.py
└── test_generation.py
```

**Example: Golden Extraction Test**

```python
# backend/tests/golden/test_extraction.py
import pytest
import json
from pathlib import Path
from app.services.ai_pipeline import extract_lesson_instruction
from app.services.validation import validate_lesson_instruction

FIXTURES_DIR = Path(__file__).parent / "fixtures"

def get_fixture_dirs():
    """Get all fixture directories."""
    return [d for d in FIXTURES_DIR.iterdir() if d.is_dir()]

@pytest.mark.parametrize("fixture_dir", get_fixture_dirs(), ids=lambda d: d.name)
class TestGoldenExtraction:
    """Golden fixture tests for extraction."""
    
    def test_extraction_matches_expected(self, fixture_dir, mock_openai_extraction):
        """Extraction output should match golden fixture."""
        transcript = json.loads((fixture_dir / "transcript.json").read_text())
        expected = json.loads((fixture_dir / "extraction.expected.json").read_text())
        
        mock_openai_extraction.return_value = expected
        result = extract_lesson_instruction(transcript)
        
        errors = validate_lesson_instruction(result)
        assert errors == [], f"Schema validation failed: {errors}"
        
        assert result["student_name"] == expected["student_name"]
        assert len(result["praise_wins"]) == len(expected["praise_wins"])
    
    def test_extraction_has_evidence(self, fixture_dir, mock_openai_extraction):
        """All extracted items must have evidence."""
        expected = json.loads((fixture_dir / "extraction.expected.json").read_text())
        mock_openai_extraction.return_value = expected
        
        transcript = json.loads((fixture_dir / "transcript.json").read_text())
        result = extract_lesson_instruction(transcript)
        
        for win in result.get("praise_wins", []):
            assert "evidence" in win, f"Missing evidence for praise: {win['text']}"
            assert len(win["evidence"]) > 0
```

---

### 4. End-to-End Tests

**Location:** `e2e/`

**Framework:** Playwright (web) + Detox (mobile)

**Critical Paths:**
1. Teacher signup → first lesson → view outputs
2. Record lesson → process → edit → share
3. Student management → lesson history
4. Settings update → reflected in outputs
5. Error recovery (network failure during upload)

**Example: E2E Test (Playwright)**

```typescript
// e2e/tests/lesson-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Lesson Recording Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('complete lesson flow: record → process → review', async ({ page }) => {
    await page.click('[data-testid="new-lesson"]');
    await page.click('[data-testid="student-select"]');
    await page.click('text=Leo Martinez');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/sample-lesson.m4a');
    
    await expect(page.locator('[data-testid="upload-status"]')).toHaveText('Uploaded');
    await page.click('[data-testid="process-button"]');
    
    await expect(page.locator('[data-testid="status"]')).toHaveText('Completed', {
      timeout: 60000
    });
    
    await expect(page.locator('[data-testid="recap-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="practice-plan-content"]')).toBeVisible();
  });
});
```

---

## Test Configuration

### pytest Configuration

```ini
# backend/pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts = 
    --cov=app
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=80
    -v
markers =
    unit: Unit tests (fast, no I/O)
    integration: Integration tests (database, mocked APIs)
    golden: Golden fixture tests (AI regression)
    e2e: End-to-end tests (full stack)
```

### Fixtures Configuration

```python
# backend/tests/conftest.py
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from app.main import app
from app.db.base import Base

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/test_db"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine):
    async with AsyncSession(db_engine) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def golden_transcript():
    import json
    from pathlib import Path
    path = Path(__file__).parent / "golden/fixtures/piano_intermediate/transcript.json"
    return json.loads(path.read_text())

@pytest.fixture
def mock_openai_extraction(mocker):
    return mocker.patch("app.services.ai_pipeline.call_openai")
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: |
          cd backend
          pip install ruff mypy
          pip install -r requirements.txt
      - run: cd backend && ruff check .
      - run: cd backend && mypy app --ignore-missing-imports

  backend-test:
    runs-on: ubuntu-latest
    needs: backend-lint
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: |
          cd backend
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      - run: cd backend && pytest tests/unit -v --cov=app
      - run: cd backend && pytest tests/integration -v --cov=app --cov-append
      - run: cd backend && pytest tests/golden -v --cov=app --cov-append
      - run: cd backend && coverage report --fail-under=80

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd mobile && npm ci
      - run: cd mobile && npm run lint
      - run: cd mobile && npm run type-check
      - run: cd mobile && npm test -- --coverage --watchAll=false

  e2e-test:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd e2e && npm ci && npx playwright install --with-deps
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: sleep 30
      - run: cd e2e && npx playwright test
```

---

## Running Tests Locally

```bash
# Backend - all tests
cd backend && pytest

# Backend - unit only (fast)
pytest tests/unit -v

# Backend - with coverage
pytest --cov=app --cov-report=html

# Frontend
cd mobile && npm test

# E2E
cd e2e && npx playwright test --ui
```

---

## Quality Gates

| Gate | Threshold | Enforced |
|------|-----------|----------|
| Code Coverage | ≥80% | CI |
| Unit Tests | 100% pass | CI |
| Integration Tests | 100% pass | CI |
| Golden Tests | 100% pass | CI |
| E2E Critical Paths | 100% pass | CI (main) |
| Lint Errors | 0 | CI |
| Type Errors | 0 | CI |


# 09. Testing Strategy

> Comprehensive testing approach for Note By Note MVP

---

## Testing Philosophy

1. **Contract-First**: JSON Schema validation catches AI drift before it reaches users
2. **Golden Fixtures**: If it worked before, it must work now
3. **Fast Feedback**: Unit tests run in <10s, full suite in <2min
4. **Real Mocks**: Mock external services, never mock business logic

---

## Test Pyramid

```
                    ┌───────────┐
                    │    E2E    │  ← 5 critical paths
                    │   Tests   │
                   ─┴───────────┴─
                 ┌─────────────────┐
                 │   Integration   │  ← API + DB + Mocked AI
                 │     Tests       │
                ─┴─────────────────┴─
              ┌───────────────────────┐
              │      Unit Tests       │  ← Business logic, validation
              │                       │
             ─┴───────────────────────┴─

Target Coverage: 80% overall, 95% for AI pipeline
```

---

## Test Categories

### 1. Unit Tests

**Location:** `backend/tests/unit/`

**Scope:**
- Schema validation functions
- Text processing utilities
- Business logic (no I/O)
- Pydantic model validation

**Example: Schema Validation**

```python
# backend/tests/unit/test_schema_validation.py
import pytest
from app.services.validation import validate_lesson_instruction

class TestLessonInstructionValidation:
    """Unit tests for LessonInstruction schema validation."""
    
    def test_valid_extraction_passes(self, valid_extraction_fixture):
        """Valid extraction should pass validation."""
        errors = validate_lesson_instruction(valid_extraction_fixture)
        assert errors == []
    
    def test_missing_required_field_fails(self):
        """Missing lesson_date should fail."""
        invalid = {"student_name": "Leo"}  # missing lesson_date
        errors = validate_lesson_instruction(invalid)
        assert any("lesson_date" in e for e in errors)
    
    def test_evidence_required_for_praise(self):
        """Each praise_win must have evidence."""
        invalid = {
            "lesson_date": "2024-01-10",
            "student_name": "Leo",
            "praise_wins": [
                {"text": "Great dynamics"}  # missing evidence
            ]
        }
        errors = validate_lesson_instruction(invalid)
        assert any("evidence" in e for e in errors)
    
    def test_evidence_quote_max_length(self):
        """Evidence quotes must be ≤240 characters."""
        long_quote = "x" * 250
        invalid = {
            "lesson_date": "2024-01-10",
            "student_name": "Leo",
            "praise_wins": [{
                "text": "Good job",
                "evidence": [{
                    "quote": long_quote,
                    "start_time_sec": 0,
                    "end_time_sec": 10,
                    "speaker": "teacher"
                }]
            }]
        }
        errors = validate_lesson_instruction(invalid)
        assert any("240" in e or "quote" in e.lower() for e in errors)


class TestOutputValidation:
    """Unit tests for output text validation."""
    
    def test_recap_word_count(self):
        """Recap must be ≤180 words."""
        from app.services.validation import validate_recap
        
        short_recap = "Great lesson. " * 50  # ~100 words
        assert validate_recap(short_recap) == []
        
        long_recap = "Great lesson. " * 100  # ~200 words
        errors = validate_recap(long_recap)
        assert any("180" in e or "word" in e.lower() for e in errors)
    
    def test_practice_plan_has_days(self):
        """Practice plan must have Day 1-6 markers."""
        from app.services.validation import validate_practice_plan
        
        valid = "## Day 1\nTask\n## Day 2\nTask\n## Day 3\nTask\n## Day 4\nTask\n## Day 5\nTask\n## Day 6\nTask"
        assert validate_practice_plan(valid) == []
        
        missing_days = "## Day 1\nTask\n## Day 2\nTask"
        errors = validate_practice_plan(missing_days)
        assert len(errors) > 0
```

**Example: Text Utilities**

```python
# backend/tests/unit/test_text_utils.py
import pytest
from app.utils.text import count_words, extract_timestamps, sanitize_transcript

class TestWordCount:
    def test_simple_sentence(self):
        assert count_words("Hello world") == 2
    
    def test_with_punctuation(self):
        assert count_words("Hello, world!") == 2
    
    def test_with_markdown(self):
        assert count_words("## Header\n\nSome **bold** text") == 4
    
    def test_empty_string(self):
        assert count_words("") == 0


class TestTimestampExtraction:
    def test_extracts_seconds(self):
        segments = [
            {"start": 0.0, "end": 5.5, "text": "Hello"},
            {"start": 5.5, "end": 10.0, "text": "World"}
        ]
        result = extract_timestamps(segments)
        assert result[0]["start_time_sec"] == 0
        assert result[0]["end_time_sec"] == 6  # rounded up
```

---

### 2. Integration Tests

**Location:** `backend/tests/integration/`

**Scope:**
- API endpoints with database
- Service layer with mocked external APIs
- Full request/response cycles

**Example: Lesson API**

```python
# backend/tests/integration/test_lesson_api.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

@pytest.fixture
async def client(app):
    """Async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def auth_headers(test_user):
    """Authentication headers for test user."""
    return {"Authorization": f"Bearer {test_user.token}"}


class TestLessonCreation:
    """Integration tests for lesson creation flow."""
    
    async def test_create_lesson_success(self, client, auth_headers, test_student):
        """Successfully create a new lesson."""
        response = await client.post(
            "/api/v1/lessons",
            json={
                "student_id": str(test_student.id),
                "date": "2024-01-15",
                "duration_minutes": 30
            },
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "CREATED"
        assert data["student_id"] == str(test_student.id)
        assert "upload_url" in data
    
    async def test_create_lesson_invalid_student(self, client, auth_headers):
        """Reject lesson for non-existent student."""
        response = await client.post(
            "/api/v1/lessons",
            json={
                "student_id": "00000000-0000-0000-0000-000000000000",
                "date": "2024-01-15"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_create_lesson_unauthorized(self, client):
        """Reject unauthenticated requests."""
        response = await client.post(
            "/api/v1/lessons",
            json={"student_id": "uuid", "date": "2024-01-15"}
        )
        
        assert response.status_code == 401


class TestLessonProcessing:
    """Integration tests for AI processing pipeline."""
    
    @patch("app.services.transcription.transcribe_audio")
    @patch("app.services.ai_pipeline.call_openai")
    async def test_process_lesson_success(
        self,
        mock_openai,
        mock_transcribe,
        client,
        auth_headers,
        test_lesson_with_audio,
        golden_transcript,
        golden_extraction
    ):
        """Successfully process a lesson through the AI pipeline."""
        # Setup mocks
        mock_transcribe.return_value = golden_transcript
        mock_openai.return_value = golden_extraction
        
        # Start processing
        response = await client.post(
            f"/api/v1/lessons/{test_lesson_with_audio.id}/process",
            headers=auth_headers
        )
        
        assert response.status_code == 202
        assert response.json()["status"] == "TRANSCRIBING"
    
    @patch("app.services.transcription.transcribe_audio")
    async def test_transcription_failure_handled(
        self,
        mock_transcribe,
        client,
        auth_headers,
        test_lesson_with_audio
    ):
        """Gracefully handle transcription failures."""
        mock_transcribe.side_effect = Exception("Whisper API error")
        
        response = await client.post(
            f"/api/v1/lessons/{test_lesson_with_audio.id}/process",
            headers=auth_headers
        )
        
        assert response.status_code == 202
```

**Example: Database Integration**

```python
# backend/tests/integration/test_database.py
import pytest
from app.db.repositories import LessonRepository, StudentRepository

class TestLessonRepository:
    """Database integration tests for lessons."""
    
    async def test_create_and_retrieve(self, db_session, test_user, test_student):
        """Create lesson and retrieve it."""
        repo = LessonRepository(db_session)
        
        lesson = await repo.create(
            user_id=test_user.id,
            student_id=test_student.id,
            date="2024-01-15",
            duration_minutes=30
        )
        
        retrieved = await repo.get_by_id(lesson.id)
        assert retrieved.student_id == test_student.id
        assert retrieved.status == "CREATED"
    
    async def test_update_status(self, db_session, test_lesson):
        """Update lesson status."""
        repo = LessonRepository(db_session)
        
        await repo.update_status(test_lesson.id, "TRANSCRIBING")
        
        updated = await repo.get_by_id(test_lesson.id)
        assert updated.status == "TRANSCRIBING"
```

---

### 3. Golden Fixture Tests

**Location:** `backend/tests/golden/`

**Purpose:** Prevent AI regression when prompts change

**Structure:**
```
backend/tests/golden/
├── fixtures/
│   ├── piano_intermediate/
│   │   ├── transcript.json
│   │   ├── extraction.expected.json
│   │   ├── recap.expected.md
│   │   ├── practice_plan.expected.md
│   │   └── parent_email.expected.md
│   ├── violin_beginner/
│   └── voice_advanced/
├── test_extraction.py
└── test_generation.py
```

**Example: Golden Extraction Test**

```python
# backend/tests/golden/test_extraction.py
import pytest
import json
from pathlib import Path
from app.services.ai_pipeline import extract_lesson_instruction
from app.services.validation import validate_lesson_instruction

FIXTURES_DIR = Path(__file__).parent / "fixtures"

def get_fixture_dirs():
    """Get all fixture directories."""
    return [d for d in FIXTURES_DIR.iterdir() if d.is_dir()]

@pytest.mark.parametrize("fixture_dir", get_fixture_dirs(), ids=lambda d: d.name)
class TestGoldenExtraction:
    """Golden fixture tests for extraction."""
    
    def test_extraction_matches_expected(self, fixture_dir, mock_openai_extraction):
        """Extraction output should match golden fixture."""
        transcript = json.loads((fixture_dir / "transcript.json").read_text())
        expected = json.loads((fixture_dir / "extraction.expected.json").read_text())
        
        mock_openai_extraction.return_value = expected
        result = extract_lesson_instruction(transcript)
        
        errors = validate_lesson_instruction(result)
        assert errors == [], f"Schema validation failed: {errors}"
        
        assert result["student_name"] == expected["student_name"]
        assert len(result["praise_wins"]) == len(expected["praise_wins"])
    
    def test_extraction_has_evidence(self, fixture_dir, mock_openai_extraction):
        """All extracted items must have evidence."""
        expected = json.loads((fixture_dir / "extraction.expected.json").read_text())
        mock_openai_extraction.return_value = expected
        
        transcript = json.loads((fixture_dir / "transcript.json").read_text())
        result = extract_lesson_instruction(transcript)
        
        for win in result.get("praise_wins", []):
            assert "evidence" in win, f"Missing evidence for praise: {win['text']}"
            assert len(win["evidence"]) > 0
```

---

### 4. End-to-End Tests

**Location:** `e2e/`

**Framework:** Playwright (web) + Detox (mobile)

**Critical Paths:**
1. Teacher signup → first lesson → view outputs
2. Record lesson → process → edit → share
3. Student management → lesson history
4. Settings update → reflected in outputs
5. Error recovery (network failure during upload)

**Example: E2E Test (Playwright)**

```typescript
// e2e/tests/lesson-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Lesson Recording Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('complete lesson flow: record → process → review', async ({ page }) => {
    await page.click('[data-testid="new-lesson"]');
    await page.click('[data-testid="student-select"]');
    await page.click('text=Leo Martinez');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/sample-lesson.m4a');
    
    await expect(page.locator('[data-testid="upload-status"]')).toHaveText('Uploaded');
    await page.click('[data-testid="process-button"]');
    
    await expect(page.locator('[data-testid="status"]')).toHaveText('Completed', {
      timeout: 60000
    });
    
    await expect(page.locator('[data-testid="recap-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="practice-plan-content"]')).toBeVisible();
  });
});
```

---

## Test Configuration

### pytest Configuration

```ini
# backend/pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts = 
    --cov=app
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=80
    -v
markers =
    unit: Unit tests (fast, no I/O)
    integration: Integration tests (database, mocked APIs)
    golden: Golden fixture tests (AI regression)
    e2e: End-to-end tests (full stack)
```

### Fixtures Configuration

```python
# backend/tests/conftest.py
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from app.main import app
from app.db.base import Base

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost:5432/test_db"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine):
    async with AsyncSession(db_engine) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def golden_transcript():
    import json
    from pathlib import Path
    path = Path(__file__).parent / "golden/fixtures/piano_intermediate/transcript.json"
    return json.loads(path.read_text())

@pytest.fixture
def mock_openai_extraction(mocker):
    return mocker.patch("app.services.ai_pipeline.call_openai")
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: |
          cd backend
          pip install ruff mypy
          pip install -r requirements.txt
      - run: cd backend && ruff check .
      - run: cd backend && mypy app --ignore-missing-imports

  backend-test:
    runs-on: ubuntu-latest
    needs: backend-lint
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: |
          cd backend
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      - run: cd backend && pytest tests/unit -v --cov=app
      - run: cd backend && pytest tests/integration -v --cov=app --cov-append
      - run: cd backend && pytest tests/golden -v --cov=app --cov-append
      - run: cd backend && coverage report --fail-under=80

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd mobile && npm ci
      - run: cd mobile && npm run lint
      - run: cd mobile && npm run type-check
      - run: cd mobile && npm test -- --coverage --watchAll=false

  e2e-test:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd e2e && npm ci && npx playwright install --with-deps
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: sleep 30
      - run: cd e2e && npx playwright test
```

---

## Running Tests Locally

```bash
# Backend - all tests
cd backend && pytest

# Backend - unit only (fast)
pytest tests/unit -v

# Backend - with coverage
pytest --cov=app --cov-report=html

# Frontend
cd mobile && npm test

# E2E
cd e2e && npx playwright test --ui
```

---

## Quality Gates

| Gate | Threshold | Enforced |
|------|-----------|----------|
| Code Coverage | ≥80% | CI |
| Unit Tests | 100% pass | CI |
| Integration Tests | 100% pass | CI |
| Golden Tests | 100% pass | CI |
| E2E Critical Paths | 100% pass | CI (main) |
| Lint Errors | 0 | CI |
| Type Errors | 0 | CI |


# 10. Design System

> Visual language and UI components for Note By Note MVP

---

## Design Principles

1. **Teacher-First**: Design for exhausted teachers at 9 PM after a full day of lessons
2. **Glanceable**: Critical info visible without scrolling or tapping
3. **Trust Through Transparency**: Show where AI-generated content came from
4. **Mobile-Native**: Thumb-friendly targets, one-handed operation

---

## Color System

### Brand Colors

```css
/* Primary - Warm Purple (Trust, Creativity) */
--color-primary-50:  #FAF5FF;
--color-primary-100: #F3E8FF;
--color-primary-200: #E9D5FF;
--color-primary-300: #D8B4FE;
--color-primary-400: #C084FC;
--color-primary-500: #A855F7;  /* Main brand color */
--color-primary-600: #9333EA;
--color-primary-700: #7E22CE;
--color-primary-800: #6B21A8;
--color-primary-900: #581C87;

/* Secondary - Warm Coral (Energy, Encouragement) */
--color-secondary-50:  #FFF5F5;
--color-secondary-100: #FED7D7;
--color-secondary-200: #FEB2B2;
--color-secondary-300: #FC8181;
--color-secondary-400: #F56565;
--color-secondary-500: #ED8936;  /* Accent color */
--color-secondary-600: #DD6B20;
--color-secondary-700: #C05621;
--color-secondary-800: #9C4221;
--color-secondary-900: #7B341E;
```

### Semantic Colors

```css
/* Success - Green */
--color-success-light: #D1FAE5;
--color-success-main:  #10B981;
--color-success-dark:  #065F46;

/* Warning - Amber */
--color-warning-light: #FEF3C7;
--color-warning-main:  #F59E0B;
--color-warning-dark:  #92400E;

/* Error - Red */
--color-error-light: #FEE2E2;
--color-error-main:  #EF4444;
--color-error-dark:  #991B1B;

/* Info - Blue */
--color-info-light: #DBEAFE;
--color-info-main:  #3B82F6;
--color-info-dark:  #1E40AF;
```

### Neutral Colors

```css
/* Grays */
--color-gray-50:  #FAFAFA;
--color-gray-100: #F4F4F5;
--color-gray-200: #E4E4E7;
--color-gray-300: #D4D4D8;
--color-gray-400: #A1A1AA;
--color-gray-500: #71717A;
--color-gray-600: #52525B;
--color-gray-700: #3F3F46;
--color-gray-800: #27272A;
--color-gray-900: #18181B;

/* Background */
--color-bg-primary:   #FFFFFF;
--color-bg-secondary: #FAFAFA;
--color-bg-tertiary:  #F4F4F5;

/* Text */
--color-text-primary:   #18181B;
--color-text-secondary: #52525B;
--color-text-tertiary:  #A1A1AA;
--color-text-inverse:   #FFFFFF;
```

### Status Colors (Lesson Pipeline)

```css
/* Processing Status */
--status-created:     #E4E4E7;  /* Gray - Not started */
--status-uploading:   #DBEAFE;  /* Blue - In progress */
--status-transcribing: #FEF3C7; /* Amber - Processing */
--status-extracting:  #FEF3C7;  /* Amber - Processing */
--status-generating:  #E9D5FF;  /* Purple - AI working */
--status-completed:   #D1FAE5;  /* Green - Done */
--status-failed:      #FEE2E2;  /* Red - Error */
```

---

## Typography

### Font Family

```css
/* Primary Font - Clean, Modern, Readable */
--font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Monospace - Code, Timestamps */
--font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale

```css
/* Headings */
--text-h1: 2rem;      /* 32px - Screen titles */
--text-h2: 1.5rem;    /* 24px - Section headers */
--text-h3: 1.25rem;   /* 20px - Card titles */
--text-h4: 1.125rem;  /* 18px - Subsection headers */

/* Body */
--text-body-lg: 1.125rem;  /* 18px - Primary content */
--text-body:    1rem;      /* 16px - Default body */
--text-body-sm: 0.875rem;  /* 14px - Secondary text */

/* Small */
--text-caption: 0.75rem;   /* 12px - Labels, timestamps */
--text-overline: 0.625rem; /* 10px - Status badges */
```

### Font Weights

```css
--font-weight-regular:  400;
--font-weight-medium:   500;
--font-weight-semibold: 600;
--font-weight-bold:     700;
```

### Line Heights

```css
--line-height-tight:  1.25;  /* Headings */
--line-height-normal: 1.5;   /* Body text */
--line-height-relaxed: 1.75; /* Long-form content */
```

---

## Spacing System

### Base Unit: 4px

```css
--space-0:  0;
--space-1:  0.25rem;  /* 4px */
--space-2:  0.5rem;   /* 8px */
--space-3:  0.75rem;  /* 12px */
--space-4:  1rem;     /* 16px */
--space-5:  1.25rem;  /* 20px */
--space-6:  1.5rem;   /* 24px */
--space-8:  2rem;     /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Component Spacing

```css
/* Card padding */
--padding-card: var(--space-4);        /* 16px */
--padding-card-lg: var(--space-6);     /* 24px */

/* Button padding */
--padding-button-y: var(--space-3);    /* 12px */
--padding-button-x: var(--space-6);    /* 24px */

/* Input padding */
--padding-input: var(--space-3);       /* 12px */

/* Screen margins */
--margin-screen: var(--space-4);       /* 16px */
--margin-screen-lg: var(--space-6);    /* 24px */
```

---

## Border Radius

```css
--radius-sm:   0.25rem;  /* 4px - Small elements */
--radius-md:   0.5rem;   /* 8px - Buttons, inputs */
--radius-lg:   0.75rem;  /* 12px - Cards */
--radius-xl:   1rem;     /* 16px - Modals */
--radius-full: 9999px;   /* Pills, avatars */
```

---

## Shadows

```css
/* Elevation levels */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04);

/* Focus ring */
--shadow-focus: 0 0 0 3px rgba(168, 85, 247, 0.4);
```

---

## Components

### Buttons

```tsx
// Button variants
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

// Styles
const buttonStyles = {
  primary: {
    bg: 'var(--color-primary-500)',
    text: 'white',
    hover: 'var(--color-primary-600)',
    active: 'var(--color-primary-700)',
  },
  secondary: {
    bg: 'var(--color-gray-100)',
    text: 'var(--color-gray-800)',
    hover: 'var(--color-gray-200)',
    active: 'var(--color-gray-300)',
  },
  ghost: {
    bg: 'transparent',
    text: 'var(--color-primary-600)',
    hover: 'var(--color-primary-50)',
    active: 'var(--color-primary-100)',
  },
  danger: {
    bg: 'var(--color-error-main)',
    text: 'white',
    hover: 'var(--color-error-dark)',
    active: '#7F1D1D',
  },
};

const buttonSizes = {
  sm: { height: 32, padding: '8px 12px', fontSize: '14px' },
  md: { height: 44, padding: '12px 24px', fontSize: '16px' },
  lg: { height: 56, padding: '16px 32px', fontSize: '18px' },
};
```

**Touch Targets:** Minimum 44x44px for all interactive elements

### Cards

```tsx
// Card component structure
<Card>
  <CardHeader>
    <CardTitle>Student Recap</CardTitle>
    <CardAction><ShareIcon /></CardAction>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <CardMeta>Generated 2 min ago</CardMeta>
  </CardFooter>
</Card>

// Card styles
const cardStyles = {
  background: 'var(--color-bg-primary)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  padding: 'var(--space-4)',
  border: '1px solid var(--color-gray-200)',
};
```

### Input Fields

```tsx
// Input states
const inputStyles = {
  default: {
    border: '1px solid var(--color-gray-300)',
    bg: 'var(--color-bg-primary)',
  },
  focus: {
    border: '1px solid var(--color-primary-500)',
    boxShadow: 'var(--shadow-focus)',
  },
  error: {
    border: '1px solid var(--color-error-main)',
    bg: 'var(--color-error-light)',
  },
  disabled: {
    bg: 'var(--color-gray-100)',
    color: 'var(--color-text-tertiary)',
  },
};
```

### Status Badges

```tsx
// Status badge component
const StatusBadge = ({ status }: { status: LessonStatus }) => {
  const config = {
    CREATED:     { bg: '#E4E4E7', text: '#52525B', label: 'Ready' },
    UPLOADING:   { bg: '#DBEAFE', text: '#1E40AF', label: 'Uploading' },
    TRANSCRIBING:{ bg: '#FEF3C7', text: '#92400E', label: 'Transcribing' },
    EXTRACTING:  { bg: '#FEF3C7', text: '#92400E', label: 'Analyzing' },
    GENERATING:  { bg: '#E9D5FF', text: '#6B21A8', label: 'Generating' },
    COMPLETED:   { bg: '#D1FAE5', text: '#065F46', label: 'Complete' },
    FAILED:      { bg: '#FEE2E2', text: '#991B1B', label: 'Failed' },
  };
  
  return <Badge {...config[status]} />;
};
```

---

## Icons

### Icon System

**Library:** Lucide React (consistent with Expo)

```tsx
import {
  Mic,           // Recording
  Square,        // Stop recording
  Play,          // Play audio
  Pause,         // Pause audio
  Upload,        // Upload file
  Check,         // Success
  X,             // Close, Error
  Edit3,         // Edit content
  Share2,        // Share outputs
  User,          // Student
  Users,         // Students list
  Calendar,      // Lesson date
  Clock,         // Duration
  Music,         // Instrument
  FileText,      // Document/output
  Mail,          // Email
  Settings,      // Settings
  ChevronRight,  // Navigation
  ChevronLeft,   // Back
  MoreVertical,  // Actions menu
  Loader2,       // Loading spinner
} from 'lucide-react-native';
```

### Icon Sizes

```css
--icon-sm: 16px;   /* Inline, badges */
--icon-md: 20px;   /* Default */
--icon-lg: 24px;   /* Buttons, nav */
--icon-xl: 32px;   /* Empty states */
--icon-2xl: 48px;  /* Recording button */
```

---

## Layout

### Screen Structure

```
┌─────────────────────────────────────┐
│           Status Bar                │  System
├─────────────────────────────────────┤
│           Header (56px)             │  Title, back, actions
├─────────────────────────────────────┤
│                                     │
│                                     │
│           Content Area              │  Scrollable
│          (flex: 1)                  │
│                                     │
│                                     │
├─────────────────────────────────────┤
│         Tab Bar (56px)              │  Bottom navigation
└─────────────────────────────────────┘
```

### Grid System

```css
/* Screen margins */
.screen {
  padding-left: var(--space-4);
  padding-right: var(--space-4);
}

/* Card grid */
.card-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Two-column on tablet */
@media (min-width: 768px) {
  .card-grid {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .card-grid > * {
    flex: 1 1 calc(50% - var(--space-4));
  }
}
```

---

## Screen Specifications

### Record Screen

```
┌─────────────────────────────────────┐
│  ←  Record Lesson                   │
├─────────────────────────────────────┤
│                                     │
│     ┌───────────────────────┐       │
│     │    Student Select     │ ▼     │
│     └───────────────────────┘       │
│                                     │
│              ┌─────┐                │
│              │     │                │
│              │ 🎤  │  ← 96px circle │
│              │     │                │
│              └─────┘                │
│                                     │
│            00:00:00                 │
│                                     │
│     ┌───────────────────────┐       │
│     │     Start Recording   │       │
│     └───────────────────────┘       │
│                                     │
│  Or upload audio file ↑             │
│                                     │
├─────────────────────────────────────┤
│   🏠    📝    👤    ⚙️              │
└─────────────────────────────────────┘
```

**States:**
- Idle: Gray mic icon, "Start Recording" button
- Recording: Pulsing red circle, timer counting, "Stop" button
- Uploading: Progress bar, "Uploading..."
- Processing: Status badge animation

### Review Screen

```
┌─────────────────────────────────────┐
│  ←  Leo's Lesson - Jan 10           │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ ▶️  0:00 / 32:15    📊      │    │  Audio player
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📝 Recap           ✏️ 📤    │    │
│  ├─────────────────────────────┤    │
│  │ Leo made great progress...  │    │
│  │ ...                         │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📋 Practice Plan   ✏️ 📤    │    │
│  ├─────────────────────────────┤    │
│  │ Day 1: Scales (5 min)       │    │
│  │ ...                         │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ✉️ Parent Email    ✏️ 📤    │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│   🏠    📝    👤    ⚙️              │
└─────────────────────────────────────┘
```

---

## Animation & Motion

### Timing Functions

```css
--ease-in:      cubic-bezier(0.4, 0, 1, 1);
--ease-out:     cubic-bezier(0, 0, 0.2, 1);
--ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce:  cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Durations

```css
--duration-fast:   150ms;  /* Micro-interactions */
--duration-normal: 250ms;  /* Standard transitions */
--duration-slow:   400ms;  /* Page transitions */
```

### Key Animations

```css
/* Recording pulse */
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

/* Loading spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide up (for modals) */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

---

## Accessibility

### Color Contrast

All text meets WCAG 2.1 AA standards:
- Normal text: 4.5:1 minimum contrast ratio
- Large text (18px+): 3:1 minimum contrast ratio

### Focus States

```css
/* Visible focus ring for keyboard navigation */
*:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

### Touch Targets

- Minimum size: 44x44px
- Minimum spacing: 8px between targets

### Screen Reader

```tsx
// Accessible labels
<TouchableOpacity
  accessibilityLabel="Start recording lesson"
  accessibilityRole="button"
  accessibilityState={{ disabled: isRecording }}
>
  <MicIcon />
</TouchableOpacity>
```

---

## Dark Mode (Future)

```css
/* Dark mode color overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary:   #18181B;
    --color-bg-secondary: #27272A;
    --color-bg-tertiary:  #3F3F46;
    
    --color-text-primary:   #FAFAFA;
    --color-text-secondary: #A1A1AA;
    --color-text-tertiary:  #71717A;
    
    --color-gray-200: #3F3F46;
    --color-gray-300: #52525B;
  }
}
```

---

## React Native Implementation

### Theme Provider

```tsx
// theme/index.ts
export const theme = {
  colors: {
    primary: {
      50: '#FAF5FF',
      500: '#A855F7',
      600: '#9333EA',
    },
    gray: {
      50: '#FAFAFA',
      500: '#71717A',
      900: '#18181B',
    },
    success: '#10B981',
    error: '#EF4444',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
};

// Usage with styled-components or StyleSheet
```

### Tailwind Config (Web)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FAF5FF',
          500: '#A855F7',
          600: '#9333EA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
```

</example4>
</prompt>