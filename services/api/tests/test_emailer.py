from __future__ import annotations

from app.services import emailer


def test_can_send_true(monkeypatch) -> None:
    monkeypatch.setattr(emailer.settings, "resend_api_key", "rk")
    monkeypatch.setattr(emailer.settings, "email_from", "from@example.com")
    assert emailer.can_send() is True


def test_can_send_false_when_missing(monkeypatch) -> None:
    monkeypatch.setattr(emailer.settings, "resend_api_key", None)
    monkeypatch.setattr(emailer.settings, "email_from", "from@example.com")
    assert emailer.can_send() is False


def test_build_mailto_encodes() -> None:
    mailto = emailer.build_mailto("parent@example.com", "Lesson Summary", "Line 1\nLine 2")
    assert mailto.startswith("mailto:")
    assert "Lesson%20Summary" in mailto
