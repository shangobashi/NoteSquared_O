from __future__ import annotations

from openai import OpenAI

from ..settings import settings


def client() -> OpenAI:
    return OpenAI(api_key=settings.openai_api_key)
