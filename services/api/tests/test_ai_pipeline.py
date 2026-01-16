from __future__ import annotations

from types import SimpleNamespace

from app.services import ai_pipeline


class FakeTranscriptions:
    def create(self, model: str, file):
        return SimpleNamespace(text="transcript text")


class FakeAudio:
    def __init__(self):
        self.transcriptions = FakeTranscriptions()


class FakeChatCompletions:
    def __init__(self, contents: list[str]):
        self._contents = contents

    def create(self, *args, **kwargs):
        content = self._contents.pop(0)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class FakeChat:
    def __init__(self, contents: list[str]):
        self.completions = FakeChatCompletions(contents)


class FakeOpenAI:
    def __init__(self, chat_contents: list[str] | None = None):
        self.audio = FakeAudio()
        self.chat = FakeChat(chat_contents or [])


def test_transcribe(tmp_path) -> None:
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"data")

    oai = FakeOpenAI()
    assert ai_pipeline.transcribe(oai, str(audio_path)) == "transcript text"


def test_extract_validates_schema() -> None:
    extraction = {
        "student": "Sam",
        "instrument": "Piano",
        "highlights": ["Great rhythm"],
        "focus_areas": ["Scales"],
        "assignments": [{"task": "Practice scales", "target": "10 min", "confidence": 0.8}],
        "evidence": [{"claim": "Great rhythm", "quote": "Nice rhythm today"}],
    }
    oai = FakeOpenAI([__import__("json").dumps(extraction)])
    result = ai_pipeline.extract(oai, "Transcript")
    assert result["student"] == "Sam"


def test_generate_outputs() -> None:
    extraction = {
        "student": "Sam",
        "instrument": "Piano",
        "highlights": ["Great rhythm"],
        "focus_areas": ["Scales"],
        "assignments": [{"task": "Practice scales", "target": "10 min", "confidence": 0.8}],
        "evidence": [{"claim": "Great rhythm", "quote": "Nice rhythm today"}],
    }
    outputs = [
        "A" * 60,
        "B" * 120,
        "C" * 60,
    ]
    oai = FakeOpenAI(outputs.copy())
    result = ai_pipeline.generate(oai, extraction)
    assert len(result["student_recap"]) >= 50
    assert len(result["practice_plan"]) >= 100
    assert len(result["parent_email"]) >= 50
