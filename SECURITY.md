# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via
[GitHub Security Advisories](https://github.com/LSUDOKO/InStep/security/advisories/new). Do not open a public issue.
You can expect an acknowledgement within 3 days.

## Scope notes

- The Creator Studio PIN (`CREATOR_PIN`) is demo-only protection; production use needs real authentication.
- Never commit `.env` files or AWS credentials. AWS access uses the standard credential chain.
- Learner camera frames are processed only in the browser; reports of any path that transmits or stores learner
  video are treated as high severity.
