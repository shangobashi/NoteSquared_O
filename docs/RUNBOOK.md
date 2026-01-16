# Runbook

## Common failures

1. Whisper errors
- Symptom: job status FAILED at TRANSCRIBING
- Action: retry from TRANSCRIBE
- Check: file size and format

2. Schema validation errors
- Symptom: job FAILED at EXTRACT
- Action: inspect raw model output in job metadata
- Fix: prompt or schema mismatch

3. Output quality regressions
- Symptom: teachers report wrong plan
- Action: add a new golden fixture and tune prompts
- Confirm: CI is green on fixtures
