import type { RemoveBlockResult } from "@/lib/blocks/remove";

/** Build post-remove navigation URL (query params for destination flash banners). */
export function getRemoveRedirectUrl(result: RemoveBlockResult): string {
  const params = new URLSearchParams({
    removedBlock: result.blockId,
    cardsRemoved: String(result.cardCount),
  });

  if (result.stagingImportIds.length > 1) {
    return `/staging?${params.toString()}`;
  }

  if (result.stagingImportId) {
    if (result.importUnlocked) {
      params.set("lastBlock", "1");
    }
    return `/staging/${result.stagingImportId}?${params.toString()}`;
  }

  return `/blocks?${params.toString()}`;
}
