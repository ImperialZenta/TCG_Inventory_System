export class PickError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PickError";
  }
}

export class AllocationError extends PickError {
  constructor(message: string) {
    super(message);
    this.name = "AllocationError";
  }
}

export class OrderImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderImportError";
  }
}
