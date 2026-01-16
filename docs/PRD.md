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
