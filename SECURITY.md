# Security

## Reporting a problem

Email the address in `apps/web/public/.well-known/security.txt`. Please do not open a public issue for a vulnerability.

## What is in place

**API**
- Every request is checked against Firebase with a signed token. Roles and suspensions are read from the database on each request.
- Rate limits per client address: reads, writes, sign-in sync, uploads, reports and admin calls each have their own limit.
- Strict CORS. In production the API refuses to start without HTTPS origins listed in `CORS_ORIGINS`.
- In production the API refuses to start unless the database connection requires TLS.
- Security headers on every response: HSTS, no sniffing, no framing, no referrer, a locked-down CSP, and `no-store` on private data.
- 1 MB request limit and a 20 second request timeout.
- All database access uses bound parameters.
- Photo links are only accepted from our own Cloudinary account.
- Admins cannot change their own role or status. Every admin action is written to the activity log.
- Optional `REQUIRE_VERIFIED_EMAIL=true` blocks accounts with unverified email.

**Web**
- Content Security Policy that only allows our own scripts, Firebase, Cloudinary and Google Fonts.
- HSTS, no framing, no sniffing, strict referrer policy and a locked permissions policy.
- All user text is escaped before it is shown.
- Private pages are marked noindex and blocked in `robots.txt`.

**Repository**
- Secrets are never committed: `.env` is ignored and CI runs gitleaks on every push.
- CI runs `npm audit` and `cargo audit`. Dependabot proposes weekly updates.

## Do these on GitHub

1. Turn on two-factor authentication on your account.
2. Settings, Branches: protect `main` and require the CI checks to pass.
3. Settings, Code security: turn on secret scanning, push protection and Dependabot alerts.
4. Use a Postgres user with only the permissions the API needs, not the owner account.
5. Rotate the database password if it was ever shared or pasted anywhere.
