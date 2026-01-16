# Security and privacy

## Data classification

- Audio and transcripts are sensitive
- Parent emails are personal data

## Controls in MVP

- Supabase RLS ensures users only see their own rows
- API verifies Supabase JWT and uses service role only server side
- Storage paths are per user namespace
- Encrypt in transit by default via HTTPS in production

## MVP limitations

- No formal GDPR DPA automation
- No enterprise compliance

## Immediate guardrails

- Default retention policy: delete audio after 30 days, configurable later
- Provide a delete lesson endpoint that also deletes storage object
