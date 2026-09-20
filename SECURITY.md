# Security policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in public issues or pull requests.
Use **Security → Advisories → Report a vulnerability** on the upstream GitHub
repository to send a private report to the maintainer.

If that option is unavailable, open an issue asking only for a private security
reporting channel. Do not include the vulnerability, reproduction steps, logs,
or sensitive data in that public request. Wait for a private channel before
sharing details.

In the private report, include:

- The affected version or commit and deployment environment.
- A description of the vulnerability and its possible impact.
- Minimal reproduction steps or a proof of concept using dummy data.
- Any relevant logs with secrets and personal information removed.

Test only against instances you own or have permission to assess. Never send
real financial records, database credentials, password hashes, or session cookies.
The maintainer will assess reports and coordinate fixes and disclosure privately;
there is no guaranteed response or remediation timeline or paid bounty program.
The no-pull-request policy does not prevent private vulnerability reports.

## Supported versions

Security fixes target the latest release and the current default branch. Older
releases have no guaranteed backports; update before reporting an issue when
possible. This policy is not a guarantee that all vulnerabilities will be fixed.

## Deployment responsibilities

cointraq is a self-hosted, single-user ledger. One configured password grants
access to the ledger; there is no multi-user account isolation. The application
stores financial records in Postgres and uses signed session cookies.

- Set your own `APP_PASSWORD_HASH` and a long, random `SESSION_SECRET` as described
  in the README. Keep `.env` and deployment secrets private.
- Use HTTPS for production deployments; production session cookies require it.
- Restrict access to Postgres, protect backups and exports, and keep dependencies
  and your runtime updated. The app does not provide application-level encryption
  of ledger records at rest.
- Use access controls or rate limiting at your hosting boundary if exposing the
  app to the internet. The login failure delay is not a full rate limiter.
- If the session secret is exposed, replace it to invalidate existing sessions.
  If the login password or hash is exposed, replace the password hash and rotate
  the session secret as well. Rotate exposed database credentials separately.

Repository maintainers must enable GitHub private vulnerability reporting when
publishing this repository so the private reporting route above is available.
