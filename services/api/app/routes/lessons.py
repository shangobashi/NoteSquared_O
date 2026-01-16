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
