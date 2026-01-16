from __future__ import annotations

import json
from pathlib import Path

from .adapters import LLMAdapter
from .validate import load_schema, validate_json


ROOT = Path(__file__).resolve().parents[1]


def render_prompt(template_path: Path, replacements: dict[str, str]) -> str:
    text = template_path.read_text(encoding="utf-8")
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text


def extract(adapter: LLMAdapter, transcript: str) -> dict:
    schema_path = ROOT / "schema" / "lesson_extraction.schema.json"
    prompt_path = ROOT / "prompts" / "extraction.md"
    schema_json = schema_path.read_text(encoding="utf-8")

    prompt = render_prompt(
        prompt_path,
        {
            "{{SCHEMA_JSON}}": schema_json,
        },
    ) + "\n\nTRANSCRIPT:\n" + transcript

    raw = adapter.complete(prompt).text
    data = json.loads(raw)

    validate_json(data, load_schema(schema_path))
    return data


def generate(adapter: LLMAdapter, extraction_json: dict) -> dict:
    schema_path = ROOT / "schema" / "outputs.schema.json"
    schema = load_schema(schema_path)
    extraction_str = json.dumps(extraction_json, ensure_ascii=False)

    def gen_one(prompt_file: str) -> str:
        p = ROOT / "prompts" / prompt_file
        prompt = render_prompt(p, {"{{EXTRACTION_JSON}}": extraction_str})
        return adapter.complete(prompt).text

    outputs = {
        "student_recap": gen_one("student_recap.md"),
        "practice_plan": gen_one("practice_plan.md"),
        "parent_email": gen_one("parent_email.md"),
    }

    validate_json(outputs, schema)
    return outputs
