-- Reference schema, actual source of truth is supabase/migrations/001_init.sql

-- profiles: 1 per auth user
-- students: belongs to profile
-- lessons: belongs to student plus profile
-- outputs: 3 per lesson
-- jobs: pipeline status and retry tracking
