export { InsufficientStockError, StockError } from "@/lib/stock/errors";
export {
  normalizeStockIdentity,
  resolveCatalogCardId,
  stockIdentityUniqueWhere,
} from "@/lib/stock/identity";
export type { NormalizedStockIdentity, StockIdentity } from "@/lib/stock/identity";
export {
  applyStockMovementInTx,
} from "@/lib/stock/apply-movement";
export type { ApplyStockMovementInput, ApplyStockMovementResult } from "@/lib/stock/apply-movement";
export { receiveStock, receiveStockInTx } from "@/lib/stock/receive";
export type { ReceiveStockOptions } from "@/lib/stock/receive";
export {
  commitSale,
  commitSaleInTx,
  DEFAULT_HOLD_WINDOW_MS,
  getAvailable,
  getStockAvailability,
  releaseStock,
  releaseStockInTx,
  reserveStock,
  reserveStockInTx,
  sweepExpiredReservations,
} from "@/lib/stock/availability";
export type {
  CommitSaleInput,
  CommitSaleResult,
  ReleaseStockInput,
  ReleaseStockResult,
  ReserveStockInput,
  ReserveStockResult,
  StockAvailability,
  StockReference,
} from "@/lib/stock/availability";
export { promoteCardLineToStock, promoteCardLineToStockInTx } from "@/lib/stock/promote-from-block";
export type { PromoteCardLineResult } from "@/lib/stock/promote-from-block";
export {
  countStockItems,
  findStockItemByIdentity,
  findStockItemByIdentityInTx,
  getStockItemById,
  getStockItemDetail,
  listStockItems,
  sumMovements,
  verifyOnHandIntegrity,
} from "@/lib/stock/queries";
export type {
  StockItemDetail,
  StockListFilters,
  StockListRow,
  StockMovementRow,
} from "@/lib/stock/queries";
export {
  adjustStockQuantity,
  MANUAL_ADJUSTMENT_REASONS,
} from "@/lib/stock/adjust";
export type { AdjustStockQuantityInput, ManualAdjustmentReason } from "@/lib/stock/adjust";
