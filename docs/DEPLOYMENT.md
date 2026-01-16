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
