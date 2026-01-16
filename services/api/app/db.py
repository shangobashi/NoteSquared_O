from __future__ import annotations

from supabase import create_client, Client

from .settings import settings


def supabase_service() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
