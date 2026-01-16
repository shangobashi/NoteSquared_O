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
