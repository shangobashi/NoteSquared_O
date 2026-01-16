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
