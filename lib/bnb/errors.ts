export class BnbTransactionVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BnbTransactionVerificationError";
  }
}
