from __future__ import annotations

from app.routes import lessons as lessons_routes
from services.api.tests.fakes import FakeClient


def test_create_lesson_not_implemented(monkeypatch) -> None:
    monkeypatch.setattr(lessons_routes, "verify_supabase_token", lambda _token: "user-1")
    monkeypatch.setattr(lessons_routes, "supabase_service", lambda: FakeClient({}))
    monkeypatch.setattr(lessons_routes, "openai_client", lambda: object())

    req = lessons_routes.CreateLessonRequest(
        studentId="student-1",
        title="Lesson",
        audioStoragePath="path.wav",
    )
    resp = lessons_routes.create_lesson(req, "Bearer t")
    assert resp["success"] is False
    assert resp["error"]["code"] == "NOT_IMPLEMENTED"


def test_create_lesson_handles_exception(monkeypatch) -> None:
    monkeypatch.setattr(lessons_routes, "verify_supabase_token", lambda _token: "user-1")
    monkeypatch.setattr(lessons_routes, "supabase_service", lambda: FakeClient({}))

    def boom():
        raise RuntimeError("boom")

    monkeypatch.setattr(lessons_routes, "openai_client", boom)

    req = lessons_routes.CreateLessonRequest(
        studentId="student-1",
        title=None,
        audioStoragePath="path.wav",
    )
    resp = lessons_routes.create_lesson(req, "Bearer t")
    assert resp["success"] is False
    assert resp["error"]["code"] == "UNKNOWN"


def test_lesson_status(monkeypatch) -> None:
    monkeypatch.setattr(lessons_routes, "verify_supabase_token", lambda _token: "user-1")
    store = {
        "lessons": [{"id": "lesson-1", "owner_id": "user-1", "status": "READY"}],
        "jobs": [{"lesson_id": "lesson-1", "owner_id": "user-1", "step": "DONE", "progress": 100}],
    }
    monkeypatch.setattr(lessons_routes, "supabase_service", lambda: FakeClient(store))

    resp = lessons_routes.lesson_status("lesson-1", "Bearer t")
    assert resp["success"] is True
    assert resp["data"]["status"] == "READY"
    assert resp["data"]["step"] == "DONE"
