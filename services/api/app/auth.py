from __future__ import annotations

import requests

from .errors import AppError
from .settings import settings


def verify_supabase_token(access_token: str) -> str:
    """
    Minimal MVP verification:
    - Call Supabase auth user endpoint with the bearer token
    - Return user id
    """
    url = f"{settings.supabase_url}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "apikey": settings.supabase_anon_key,
    }
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise AppError(code="AUTH_INVALID", message="Invalid or expired token")
    data = resp.json()
    user_id = data.get("id")
    if not user_id:
        raise AppError(code="AUTH_INVALID", message="Missing user id")
    return user_id
