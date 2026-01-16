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
