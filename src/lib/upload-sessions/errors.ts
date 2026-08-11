export class UploadSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadSessionError";
  }
}
