/** Error thrown for invalid input or a failed/timed-out checkout flow. */
export class WireCheckoutError extends Error {
  code: string;

  constructor(message: string, code = "checkout_error") {
    super(message);
    this.name = "WireCheckoutError";
    this.code = code;
  }
}
