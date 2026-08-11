export class ChannelCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelCatalogError";
  }
}
