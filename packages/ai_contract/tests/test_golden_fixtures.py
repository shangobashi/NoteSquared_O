from __future__ import annotations

import json
from pathlib import Path

from ai_contract.src.adapters import DeterministicAdapter
from ai_contract.src.runner import extract, generate


ROOT = Path(__file__).resolve().parents[1]


def test_fixture_0001_shapes() -> None:
    fixture = ROOT / "fixtures" / "golden" / "fixture_0001"
    transcript = (fixture / "transcript.txt").read_text(encoding="utf-8")

    expected_extraction = json.loads((fixture / "expected_extraction.json").read_text(encoding="utf-8"))
    expected_outputs = json.loads((fixture / "expected_outputs.json").read_text(encoding="utf-8"))

    adapter = DeterministicAdapter(
        mapping={
            "TRANSCRIPT:": json.dumps(expected_extraction),
            "Write a student recap": expected_outputs["student_recap"],
            "Write a 7 day practice plan": expected_outputs["practice_plan"],
            "Write a parent email": expected_outputs["parent_email"],
        }
    )

    got_extraction = extract(adapter, transcript)
    got_outputs = generate(adapter, got_extraction)

    assert set(got_extraction.keys()) == set(expected_extraction.keys())
    assert set(got_outputs.keys()) == set(expected_outputs.keys())
