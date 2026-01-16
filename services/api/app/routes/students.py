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
