# Citizen email verification

Citizen requests, complaints and inquiries use a custom email OTP service independently of staff Supabase Auth. Staff signup and email OTP login remain disabled: historical staff email addresses must not grant their email owners administrative access.

Cloudflare Pages serves `/api/citizen`. The function validates Turnstile hostname and action, reserves an atomic database quota, sends through Brevo, verifies a five-minute six-digit OTP, and returns a random 256-bit capability for one operation within 15 minutes. Only hashes are stored; plaintext codes and capabilities are never logged or stored in browser storage. Five incorrect attempts lock a challenge. The free sending budget is capped at 250/day, five/email/hour with a 60-second cooldown, and 20/IP/hour. Brevo's account has a free 300/day allowance; delivery is subject to provider availability and quota.

Only the server role can execute the citizen RPCs or access private challenge rows. On activation, anonymous table inserts, public lookups and direct storage uploads are revoked. The API explicitly selects allowed input fields, forces pending status, binds the verified email, and atomically consumes the capability. A lookup additionally matches the saved email, national ID, name and phone. Images remain private; inquiry responses never contain images or administrative data. Uploads are bound to the verification ID, limited to six JPEGs of at most 1200×1200 and 1.5 MiB each, a 64 MiB rolling daily budget and an 800 MiB bucket ceiling. Abandoned citizen uploads older than one day are cleaned in batches when new verification requests succeed.

Legacy records have no email association and are excluded from citizen inquiries. SUPER uses **ربط بريد الاستعلام** in the vehicle dossier after independently establishing identity and email ownership. The database enforces SUPER authorization and records the association event. ADMIN and VIEWER cannot change email associations. This does not change vehicle codes, including legacy duplicates.

Deployment order:

1. Apply `database/citizen-email-otp.sql` (also recorded as the CLI-generated migration). It stages the API with verification disabled.
2. Configure production Pages environment: `APP_ORIGIN`, `SUPABASE_URL`, and secret bindings `SUPABASE_SERVICE_KEY`, `BREVO_API_KEY`, `CITIZEN_OTP_PEPPER`, `TURNSTILE_SECRET`. Never use browser-exposed variables for secrets. Production sender is `noreply@notify.ks-smart-tok.com`.
3. Verify Brevo sender/domain and delivery. Build and deploy with the repository's `functions/` directory. `_routes.json` limits function invocations to the API route.
4. Run SQL and browser/API tests; verify the staged live API returns `enabled:false`.
5. Apply `database/activate-citizen-email-otp.sql` atomically; confirm `enabled:true` and that old anonymous routes refuse requests.

Keep the environment bindings when rolling back a deployment. Re-deploy a known working OTP release; do not restore the old anonymous policies as a convenience rollback. On email provider failure or quota exhaustion, operations fail closed. Existing administrative login and data remain available to authorized staff.

Brevo requires account ownership verification separately from citizens' OTPs. Its API key expires on 2027-10-16 and may expire after 90 days of inactivity. Account recovery credentials and the deployment environment backup are encrypted locally outside the repository. No payment method or paid plan was added.
