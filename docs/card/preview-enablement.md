# Card preview enablement runbook

This runbook describes the **non-production preview** switch for the card
program. It is intentionally documentation-only: enabling the preview does not
change the live swap, quote, offramp, or cross-chain-swap behavior.

> **Do not enable the card preview in production while the partner onboarding,
> KYC/AML approval, webhook verification, and sandbox replay checks are still in
> progress.** StellarRoute does not hold card PANs, CVVs, track data, or partner
> signing keys.

## Configuration contract

| Setting | Where it belongs | Safe default | Purpose |
|---|---|---|---|
| `CARD_ENABLED` | API/host environment | unset or `false` | Server-side master gate. When unset or false, card routes return `404` and no card state is exposed. |
| `NEXT_PUBLIC_CARD_ENABLED` | Frontend/public build environment | unset or `false` | Public UI feature flag. Keep it unset/false until the sandbox checklist is complete. |
| `NEXT_PUBLIC_CARD_PARTNER_STELLAR_ADDRESS` | Frontend/public build environment | empty | Public Stellar **G-address** used to build the partner payment. It is an address, not a secret. An empty value must keep confirmation disabled. |
| `CARD_WEBHOOK_HMAC_KEY` | API/host secret store | empty | Dedicated HMAC-SHA256 key for partner clearing/reversal webhooks. It is not the CCTP access-token key. |

The public partner address may be exposed to the browser. The webhook HMAC key
must **never** be exposed through a `NEXT_PUBLIC_*` variable, committed to the
repository, placed in a fixture, copied into a pull request, or logged.

## Safe enablement procedure

1. Keep `CARD_ENABLED` and `NEXT_PUBLIC_CARD_ENABLED` unset/false in every
   production and default deployment.
2. Obtain a sandbox-only partner G-address and set
   `NEXT_PUBLIC_CARD_PARTNER_STELLAR_ADDRESS` in the preview frontend's host
   environment. Verify the address with the partner out of band; do not infer it
   from a user-visible page.
3. Generate a dedicated random `CARD_WEBHOOK_HMAC_KEY` in the host's secret
   manager. Store it only in the API runtime environment, use the same key for
   signing and verification, and establish a rotation/revocation procedure
   before sending real partner events.
4. Configure the partner to send events to the sandbox webhook endpoint and
   verify the HMAC over the exact request bytes. Do not reuse a CCTP key or a
   personal credential.
5. Set `CARD_ENABLED=true` only in the isolated preview API environment, then
   set the matching public flag only in the isolated preview frontend build.
   Restart/redeploy the preview according to the host's normal secret-management
   procedure; do not edit the EC2 deployment workflow for this runbook.
6. Run the CARD-50 fixture-based acceptance checklist from the companion
   documentation, including KYC acknowledgement, EUR preview against USDC,
   cancellation, hold, and clearing replay. Use sandbox fixtures only.
7. Record the operator, timestamp, environment, partner address fingerprint, and
   check results in the preview's audit log. Never record the HMAC key, PAN, CVV,
   track data, or raw sensitive webhook bodies.

## Disable and rollback

To disable the preview, remove `CARD_ENABLED` (or set it to `false`) and remove
`NEXT_PUBLIC_CARD_ENABLED` from the preview environment. The card UI should
disappear and card API routes should return `404`. Clearing the public partner
address additionally prevents a new payment from being built. Revoke or rotate
`CARD_WEBHOOK_HMAC_KEY` through the host secret manager if it may have been
exposed; changing the key does not require a source-code or workflow change.

The existing live paths remain frozen and independent:

- classic one-hop SDEX prepare → wallet sign → submit;
- quote selection and ranking;
- wallet connect/sign adapters;
- `/swap`, `/offramp`, and `/cross-chain-swap` layout and OpenAPI contracts;
- CORS allowlists, `CCTP_ENABLED` defaults, and `real_xdr` pinning.

With the card flags unset, there must be no user-visible difference on those
paths. This document does not change the EC2 deployment workflow, Vercel
configuration, or `.env.example`.

## Verification queries

For a flag-off environment:

```text
GET /api/v1/card/health  -> 404
```

For a flag-on sandbox environment, confirm the health response reports
`enabled: true`. If the partner address is empty, the expected readiness state is
`partner_unconfigured`; do not treat that state as permission to enable a live
payment flow.
