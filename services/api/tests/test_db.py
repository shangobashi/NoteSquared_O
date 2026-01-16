from __future__ import annotations

from app.db import supabase_service


def test_supabase_service_uses_client(monkeypatch) -> None:
    sentinel = object()

    def fake_create_client(url: str, key: str):
        assert url
        assert key
        return sentinel

    monkeypatch.setattr("app.db.create_client", fake_create_client)
    assert supabase_service() is sentinel
