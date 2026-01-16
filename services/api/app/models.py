from __future__ import annotations

from pydantic import BaseModel, Field


class Envelope(BaseModel):
    success: bool = True
    data: dict


class ErrorEnvelope(BaseModel):
    success: bool = False
    error: dict


class CreateLessonRequest(BaseModel):
    studentId: str
    title: str | None = None
    audioStoragePath: str = Field(min_length=1)


class LessonStatusResponse(BaseModel):
    lessonId: str
    status: str
    step: str
    progress: int
    lastError: str | None = None
