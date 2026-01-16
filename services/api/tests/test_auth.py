from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.auth import verify_supabase_token
from app.errors import AppError


class FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


def test_verify_supabase_token_success(monkeypatch) -> None:
    def fake_get(_url, headers=None, timeout: int = 0, **_kwargs):
        assert headers is not None
        assert timeout == 10
        return FakeResponse(200, {"id": "user-123"})

    monkeypatch.setattr("app.auth.requests.get", fake_get)
    assert verify_supabase_token("token") == "user-123"


def test_verify_supabase_token_invalid(monkeypatch) -> None:
    def fake_get(_url, headers=None, timeout: int = 0, **_kwargs):
        return FakeResponse(401, {})

    monkeypatch.setattr("app.auth.requests.get", fake_get)
    with pytest.raises(AppError) as exc:
        verify_supabase_token("bad")
    assert exc.value.code == "AUTH_INVALID"


def test_verify_supabase_token_missing_user(monkeypatch) -> None:
    def fake_get(_url, headers=None, timeout: int = 0, **_kwargs):
        return FakeResponse(200, {})

    monkeypatch.setattr("app.auth.requests.get", fake_get)
    with pytest.raises(AppError) as exc:
        verify_supabase_token("token")
    assert exc.value.code == "AUTH_INVALID"
