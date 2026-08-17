import { systemJobContext } from "@/lib/context/domain-context";
import { sweepExpiredReservations } from "@/lib/stock/availability";

/** ADR-006 — reservation expiry sweep (scheduled via pg-boss in worker process). */
export async function runReservationExpirySweep(): Promise<number> {
  return sweepExpiredReservations(systemJobContext("reservation-expiry"));
}
