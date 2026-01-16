# AI contract

Goal:
- Convert transcript into structured lesson extraction JSON
- Generate three outputs using that JSON, not raw transcript

This reduces hallucination and makes outputs testable.

## Extraction schema

Canonical schema:
- packages/ai_contract/schema/lesson_extraction.schema.json

Evidence requirement:
- Every extracted claim must include a short supporting quote from transcript where possible.
- Confidence must be a float 0 to 1.

## Output schema

Canonical schema:
- packages/ai_contract/schema/outputs.schema.json

## Golden fixtures

Folder:
- packages/ai_contract/fixtures/golden

Each fixture contains:
- transcript.txt
- expected_extraction.json
- expected_outputs.json

Rule:
- If prompts change, fixtures must be updated intentionally.
- CI runs the deterministic adapter for fixture validation and schema checks.

## Tuning loop

1. Run pilot with real teachers
2. Capture transcript and teacher edited outputs
3. Create a fixture from the transcript and final teacher approved outputs
4. Adjust prompts to reduce edit distance
5. Keep fixtures growing over time to prevent regression
