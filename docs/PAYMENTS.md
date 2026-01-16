# Payments strategy

The idea includes pricing tiers, but MVP should not block pilots behind Stripe until core quality is proven.

MVP approach:
- Invite code onboarding
- Plan is stored in profiles.plan with SOLO default
- Studio limits enforced by app and DB constraints

Post MVP:
- Stripe subscription
- Webhook updates profiles.plan and profiles.plan_status
