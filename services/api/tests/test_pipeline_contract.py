from __future__ import annotations

from pathlib import Path

from packages.ai_contract.src.validate import validate_json, load_schema


def test_outputs_schema_validates() -> None:
    root = Path(__file__).resolve().parents[3]
    schema = load_schema(root / "packages" / "ai_contract" / "schema" / "outputs.schema.json")
    sample = {
        "student_recap": "x" * 60,
        "practice_plan": "y" * 120,
        "parent_email": "z" * 60,
    }
    validate_json(sample, schema)
