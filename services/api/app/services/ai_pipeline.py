from __future__ import annotations

import json
from pathlib import Path

from openai import OpenAI

from packages.ai_contract.src.validate import validate_json, load_schema

AI_ROOT = Path(__file__).resolve().parents[4] / "packages" / "ai_contract"


def _load_prompt(name: str) -> str:
    return (AI_ROOT / "prompts" / name).read_text(encoding="utf-8")


def transcribe(oai: OpenAI, audio_file_path: str) -> str:
    with open(audio_file_path, "rb") as f:
        result = oai.audio.transcriptions.create(
            model="whisper-1",
            file=f,
        )
    return result.text


def extract(oai: OpenAI, transcript: str) -> dict:
    schema_path = AI_ROOT / "schema" / "lesson_extraction.schema.json"
    prompt = _load_prompt("extraction.md").replace(
        "{{SCHEMA_JSON}}", schema_path.read_text(encoding="utf-8")
    )
    prompt = prompt + "\n\nTRANSCRIPT:\n" + transcript

    res = oai.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    raw = res.choices[0].message.content or "{}"
    data = json.loads(raw)

    validate_json(data, load_schema(schema_path))
    return data


def generate(oai: OpenAI, extraction_json: dict) -> dict:
    schema_path = AI_ROOT / "schema" / "outputs.schema.json"
    schema = load_schema(schema_path)
    extraction_str = json.dumps(extraction_json, ensure_ascii=False)

    def run_one(prompt_name: str) -> str:
        prompt = _load_prompt(prompt_name).replace("{{EXTRACTION_JSON}}", extraction_str)
        res = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        return (res.choices[0].message.content or "").strip()

    outputs = {
        "student_recap": run_one("student_recap.md"),
        "practice_plan": run_one("practice_plan.md"),
        "parent_email": run_one("parent_email.md"),
    }
    validate_json(outputs, schema)
    return outputs
