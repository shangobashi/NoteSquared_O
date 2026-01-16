You are extracting structured lesson facts from a transcript of a music lesson.

Return only valid JSON that matches the provided JSON Schema.

Rules:
- Use evidence quotes directly from transcript where possible.
- If a field is unknown, infer conservatively and keep confidence low.
- Do not hallucinate repertoire names unless mentioned.

JSON Schema:
{{SCHEMA_JSON}}
