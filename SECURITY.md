# Security policy

## Reporting a vulnerability

Report privately through GitHub Security Advisories:
**Security → Report a vulnerability** on this repository. Do not open a public
issue, and do not describe the problem in a pull request.

You will get a first response within **72 hours**. If the report is accepted we
agree a disclosure date with you; if it is not, we say why.

Please include what you can of: the version or commit, the proxy profile, a
request or sequence that reproduces it, and what an attacker gains. A working
exploit is welcome but never required.

## Supported versions

| Version                           | Supported                                               |
| --------------------------------- | ------------------------------------------------------- |
| Latest minor of the current major | Yes                                                     |
| Previous minor                    | Security fixes for 30 days after it was replaced        |
| Previous major                    | Critical security fixes for 90 days after the new major |
| Anything older                    | No                                                      |

`compose.yaml` follows the major line by default (`RR_VERSION`, section 24.4),
so a deployment that runs `docker compose pull` stays on a supported version.

## What counts

In scope: the application, the proxy templates, the deployment files and the
shipped theme. Out of scope: a Remnawave panel, a payment provider, Telegram,
and anything that needs an attacker to already hold `RR_APP_KEY`,
`RR_INTERNAL_TOKEN` or the database.

## Hardening the deployment

`docs/install.md` covers the parts an owner controls: keeping `.env` off the
backups, `RR_TRUSTED_PROXIES` behind an external proxy, and the administration
allowlist.
