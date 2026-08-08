# ADR-009: Protected API surface

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **ACC-001** (User accounts and authentication) |

## Context

There is no auth today: no middleware, no session, [`/api/backup/export`](../../../src/app/api/backup/export/route.ts) is open to anyone who can reach the server. Parity introduces:

- **Staff-only** inventory, POS, pricing, settings (most of the app)
- **Inbound webhooks** from marketplaces (**CHN-007**) — must verify signature, not session cookie
- **Customer-facing** buylist portal (**BUY-001**) — unauthenticated submit, no staff powers
- **Future** external API (**ACC-006**, parked) — scoped API keys

These need different trust models on the same Next.js app.

## Decision

### Layer 1: Session middleware (staff app)

At **ACC-001**:

- Add Next.js `middleware.ts` guarding `/`, `/blocks`, `/staging`, `/settings`, `/activity`, `/inventory`, `/pick`, `/orders`, `/analytics`, and `/api/*` except public routes listed below.
- Session library (implementation choice left to ACC-001 story — prefer maintained cookie sessions over hand-rolled JWT in localStorage).
- Populate **DomainContext** (ADR-002) from session on every server action.

### Layer 2: Route handler conventions

| Surface | Auth | Location |
|---------|------|----------|
| Staff pages + actions | Session required | Existing app routes |
| Staff internal APIs | Session required | `/api/*` |
| Channel webhooks | HMAC / signature per adapter | `/api/webhooks/[channel]/` |
| Buylist portal | Public read + submit; rate limit | `/buylist/*` or subdomain (BUY-001) |
| Health / readiness | Optional public | `/api/health` if needed |

Webhooks **never** use staff session — they verify provider signature in the route handler, then call domain functions with `ctx.actor = "webhook:<channel>"`.

### Layer 3: Server-side authorization (ACC-002)

Middleware proves identity; **domain layer enforces role** (Owner / Manager / Staff / Read-only) per ADR-001 actions → domain split. Prefer checking role in domain entry points for destructive operations, not only hiding UI buttons.

### Layer 4: API keys (deferred)

**ACC-006** adds scoped keys for external integrations. Keys are hashed in DB, passed via `Authorization` header, mapped to a service user with Read-only or custom scope. Not required for MVP parity.

## Consequences

- **Positive:** Backup export and danger zone require login; webhook and portal surfaces are explicit; path to ACC-006 is clear.
- **Negative:** Local dev must sign in; seed must create a default owner (ACC-001 acceptance).
- **Neutral:** Docker deployment remains single-tenant; no OAuth/multi-org.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Network-only security (VPN) | Insufficient for webhook + buylist surfaces |
| Auth at page level only | API routes stay exposed |
| Single API key for everything | Cannot separate staff vs integration vs customer |

## Related stories

ACC-001, ACC-002, ACC-004, ACC-006, CHN-007, BUY-001.

## References

- [epic-20-access-platform.md](../../backlog/epic-20-access-platform.md)
- [ADR-002](002-actor-context-propagation.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
