# P3.4 Role and audit delivery

## Roles

- `viewer`: read data sources, snapshots, devices, history, alerts, rules, and alert audit records.
- `operator`: all viewer permissions plus acknowledge and close alerts.
- `admin`: all operator permissions plus publish alert rules and read rule-publish audit records.

Production roles are read from the trusted identity JWT (`role` or `roles`). A role in the token request cannot elevate the identity role. Development mode may request a role explicitly for local verification.

## Audited actions

- Alert opened, deduplicated, escalated, acknowledged, and closed.
- Alert rule publication, including the complete published rule set, actor, version, and timestamp.

The current token issuer carries the resolved role in the short-lived realtime token. This is an authorization boundary for P3.4; external IdP provisioning and organization-level role administration remain deployment work.
