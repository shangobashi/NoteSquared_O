from __future__ import annotations

from ..settings import settings


def can_send() -> bool:
    return bool(settings.resend_api_key and settings.email_from)


def build_mailto(to: str, subject: str, body: str) -> str:
    import urllib.parse
    return f"mailto:{urllib.parse.quote(to)}?subject={urllib.parse.quote(subject)}&body={urllib.parse.quote(body)}"
