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
