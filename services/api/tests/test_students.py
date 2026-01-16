from __future__ import annotations

import pytest

from app.errors import AppError
from app.routes import students as students_routes
from services.api.tests.fakes import FakeClient


def test_list_students_returns_data(monkeypatch) -> None:
    monkeypatch.setattr(students_routes, "verify_supabase_token", lambda _token: "user-1")
    store = {"students": [{"id": "s1", "owner_id": "user-1", "name": "Sam"}]}
    monkeypatch.setattr(students_routes, "supabase_service", lambda: FakeClient(store))

    resp = students_routes.list_students("Bearer token")
    assert resp["success"] is True
    assert resp["data"]["students"][0]["id"] == "s1"


def test_create_student_requires_name(monkeypatch) -> None:
    monkeypatch.setattr(students_routes, "verify_supabase_token", lambda _token: "user-1")
    monkeypatch.setattr(students_routes, "supabase_service", lambda: FakeClient({}))

    with pytest.raises(AppError):
        students_routes.create_student({"name": "   "}, "Bearer token")


def test_create_student_success(monkeypatch) -> None:
    monkeypatch.setattr(students_routes, "verify_supabase_token", lambda _token: "user-1")
    monkeypatch.setattr(students_routes, "supabase_service", lambda: FakeClient({}))

    resp = students_routes.create_student(
        {"name": "Ava", "instrument": "piano", "parent_email": "p@example.com"},
        "Bearer token",
    )
    assert resp["success"] is True
    assert resp["data"]["student"]["name"] == "Ava"
