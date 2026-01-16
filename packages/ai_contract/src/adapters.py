from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AdapterResult:
    text: str


class LLMAdapter(Protocol):
    def complete(self, prompt: str) -> AdapterResult: ...


class DeterministicAdapter:
    """
    Used in CI and fixture tests.
    Returns deterministic outputs so golden fixtures can validate shape and plumbing.
    """

    def __init__(self, mapping: dict[str, str]) -> None:
        self.mapping = mapping

    def complete(self, prompt: str) -> AdapterResult:
        for key, value in self.mapping.items():
            if key in prompt:
                return AdapterResult(text=value)
        return AdapterResult(text='{}')
