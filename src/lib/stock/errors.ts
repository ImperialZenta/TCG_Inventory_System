export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

export class InsufficientStockError extends StockError {
  constructor(message = "Insufficient stock available") {
    super(message);
    this.name = "InsufficientStockError";
  }
}
