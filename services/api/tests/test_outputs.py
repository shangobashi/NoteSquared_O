from __future__ import annotations

from app.routes import outputs as outputs_routes
from services.api.tests.fakes import FakeClient


def test_update_output(monkeypatch) -> None:
    monkeypatch.setattr(outputs_routes, "verify_supabase_token", lambda _token: "user-1")
    monkeypatch.setattr(outputs_routes, "supabase_service", lambda: FakeClient({}))

    resp = outputs_routes.update_output("out-1", {"editedContent": "Updated"}, "Bearer t")
    assert resp["success"] is True
    assert resp["data"]["output"]["edited_content"] == "Updated"


def test_mark_sent(monkeypatch) -> None:
    monkeypatch.setattr(outputs_routes, "verify_supabase_token", lambda _token: "user-1")
    monkeypatch.setattr(outputs_routes, "supabase_service", lambda: FakeClient({}))

    resp = outputs_routes.mark_sent(
        "out-1", {"sentTo": "p@example.com", "sentVia": "email"}, "Bearer t"
    )
    assert resp["success"] is True
    assert resp["data"]["output"]["sent_via"] == "email"


def test_send_email_returns_mailto(monkeypatch) -> None:
    monkeypatch.setattr(outputs_routes, "verify_supabase_token", lambda _token: "user-1")
    store = {
        "outputs": [
            {
                "id": "out-1",
                "owner_id": "user-1",
                "content": "Hello parent",
                "edited_content": None,
                "sent_to": "parent@example.com",
            }
        ]
    }
    monkeypatch.setattr(outputs_routes, "supabase_service", lambda: FakeClient(store))
    monkeypatch.setattr(outputs_routes, "can_send", lambda: False)

    resp = outputs_routes.send_email("out-1", {"to": ""}, "Bearer t")
    assert resp["success"] is True
    assert resp["data"]["method"] == "mailto"


def test_send_email_when_resend_configured(monkeypatch) -> None:
    monkeypatch.setattr(outputs_routes, "verify_supabase_token", lambda _token: "user-1")
    store = {"outputs": [{"id": "out-1", "owner_id": "user-1", "content": "Hi"}]}
    monkeypatch.setattr(outputs_routes, "supabase_service", lambda: FakeClient(store))
    monkeypatch.setattr(outputs_routes, "can_send", lambda: True)

    resp = outputs_routes.send_email("out-1", {"to": "parent@example.com"}, "Bearer t")
    assert resp["success"] is False
    assert resp["error"]["code"] == "NOT_IMPLEMENTED"
