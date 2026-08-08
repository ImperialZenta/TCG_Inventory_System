import { db } from "@/lib/db";

export interface PickMetricsSummary {
  completedLists: number;
  medianDurationMinutes: number | null;
  meanDurationMinutes: number | null;
  shortRatePercent: number | null;
  medianDwellDays: number | null;
  shortRateByTier: { tier: string; shortRatePercent: number; resolved: number }[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function getPickMetrics(options?: {
  since?: Date;
}): Promise<PickMetricsSummary> {
  const since = options?.since;

  const completedLists = await db.pickList.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { not: null },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: { createdAt: true, completedAt: true },
  });

  const durations = completedLists
    .filter((l) => l.completedAt)
    .map((l) => (l.completedAt!.getTime() - l.createdAt.getTime()) / 60_000);

  const pickItems = await db.pickItem.findMany({
    where: {
      status: { in: ["PICKED", "SHORT", "SUBSTITUTED"] },
      ...(since
        ? { pickList: { createdAt: { gte: since } } }
        : {}),
    },
    select: { status: true },
  });

  const resolved = pickItems.length;
  const shortCount = pickItems.filter((i) => i.status === "SHORT").length;
  const shortRatePercent = resolved > 0 ? (shortCount / resolved) * 100 : null;

  const history = await db.pickHistory.findMany({
    where: {
      dwellDays: { not: null },
      ...(since ? { pickedAt: { gte: since } } : {}),
    },
    select: { dwellDays: true, blockTierAtPick: true },
  });

  const dwellValues = history.map((h) => h.dwellDays!).filter((d) => d >= 0);

  const tierMap = new Map<string, { short: number; total: number }>();
  const itemsWithTier = await db.pickItem.findMany({
    where: {
      status: { in: ["PICKED", "SHORT", "SUBSTITUTED"] },
      block: { isNot: null },
      ...(since ? { pickList: { createdAt: { gte: since } } } : {}),
    },
    select: { status: true, block: { select: { tier: true } } },
  });

  for (const item of itemsWithTier) {
    const tier = item.block?.tier ?? "GENERAL";
    const entry = tierMap.get(tier) ?? { short: 0, total: 0 };
    entry.total++;
    if (item.status === "SHORT") entry.short++;
    tierMap.set(tier, entry);
  }

  const shortRateByTier = [...tierMap.entries()].map(([tier, stats]) => ({
    tier,
    shortRatePercent: stats.total > 0 ? (stats.short / stats.total) * 100 : 0,
    resolved: stats.total,
  }));

  return {
    completedLists: completedLists.length,
    medianDurationMinutes: median(durations),
    meanDurationMinutes: mean(durations),
    shortRatePercent,
    medianDwellDays: median(dwellValues),
    shortRateByTier,
  };
}
