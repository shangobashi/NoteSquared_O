from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AppError(Exception):
    code: str
    message: str
