from __future__ import annotations

import json
from pathlib import Path

import jsonschema


def load_schema(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_json(instance: dict, schema: dict) -> None:
    jsonschema.validate(instance=instance, schema=schema)
