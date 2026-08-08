# ADR-008: Provider and adapter registry

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **GAM-002** (Catalog provider interface with local cache) |

## Context

Today Scryfall is called directly from [`src/lib/scryfall.ts`](../../../src/lib/scryfall.ts) and [`src/lib/manabox/csv-import.ts`](../../../src/lib/manabox/csv-import.ts). Phase 7+ needs:

- **Catalog providers** — Scryfall (MTG), Pokémon API, others (**GAM-002**, **GAM-004**)
- **Price sources** — Scryfall, TCGplayer, etc. (**PRC-001**)
- **Channel adapters** — Shopify, Mana Pool API, eBay (**CHN-002**, **CHN-008**)

Copy-pasting "interface + switch on vendor name" three times will diverge. One registry pattern serves all three.

## Decision

### Shared shape

```typescript
interface ProviderAdapter<TConfig, TCapabilities extends string> {
  readonly key: string;
  readonly capabilities: readonly TCapabilities[];
  isConfigured(config: TConfig): boolean;
}

// Registry
function getCatalogProvider(gameCode: string): CatalogProvider;
function getPriceSource(sourceKey: string): PriceSource;
function getChannelAdapter(channelType: string): ChannelAdapter;
```

### Catalog provider (`src/lib/catalog/`)

- **Normalised DTO:** name, setCode, collectorNumber, finishes, languages, imageUris, rarity, pricesByFinishCents.
- **Cache:** `CatalogCard` table (see GAM-002 schema notes) — keyed by `providerKey + providerCardId`.
- **Rule:** No file outside `src/lib/catalog/providers/` imports Scryfall URLs or response shapes.

### Price source (`src/lib/pricing/sources/`)

- Returns market price in **cents** (ADR-003).
- Fallback chain configured in DB/settings (**PRC-001**).

### Channel adapter (`src/lib/channels/adapters/`)

- Declares capabilities: `pushListing`, `updateQty`, `updatePrice`, `ingestOrders`, `webhooks`.
- **CHN-008:** new channel = new adapter class + config row, no changes to stock or outbox drain logic.

### Configuration

Channel and game config stored in DB (`Channel`, `Game` tables) with opaque JSON credentials — never in client bundles.

## Consequences

- **Positive:** GAM-004 acceptance ("third game needs only provider + registry row") becomes achievable; tests mock adapters.
- **Negative:** Initial abstraction cost for one game (MTG); pays off at game two.
- **Neutral:** Existing Scryfall code moves behind `ScryfallCatalogProvider` during GAM-002 — behaviour unchanged.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Separate patterns per domain | Three registries to maintain |
| Plugin npm packages per channel | Overkill for self-hosted single tenant |
| Direct API calls forever | GAM-004 and CHN-008 explicitly fail |

## Related stories

GAM-002, GAM-004, GAM-005, C-004, PRC-001, CHN-002, CHN-008, SCN-001.

## References

- [src/lib/scryfall.ts](../../../src/lib/scryfall.ts)
- [epic-11-multi-game.md](../../backlog/epic-11-multi-game.md)
- [epic-14-channel-sync.md](../../backlog/epic-14-channel-sync.md)
