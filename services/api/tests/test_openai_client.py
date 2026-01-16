from __future__ import annotations

from app.services.openai_client import client


def test_client_returns_openai() -> None:
    oai = client()
    assert hasattr(oai, "chat")
