/**
 * SAS-001 — inbound mutation routes fail closed when secrets are unset.
 * Set ALLOW_INSECURE_INBOUND=true only for local development.
 */
export function isInboundAuthBypassEnabled(): boolean {
  return process.env.ALLOW_INSECURE_INBOUND?.trim().toLowerCase() === "true";
}

export function requireConfiguredSecret(
  secret: string | undefined,
  routeLabel: string,
): { ok: true; secret: string } | { ok: false; response: Response } {
  const trimmed = secret?.trim();
  if (trimmed) {
    return { ok: true, secret: trimmed };
  }

  if (isInboundAuthBypassEnabled()) {
    console.warn(
      `[SAS-001] ${routeLabel}: secret not configured; ALLOW_INSECURE_INBOUND=true — request allowed (dev only)`,
    );
    return { ok: true, secret: "" };
  }

  return {
    ok: false,
    response: new Response(
      JSON.stringify({
        error: `${routeLabel} is not configured. Set the required secret or ALLOW_INSECURE_INBOUND=true for local dev only.`,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    ),
  };
}
