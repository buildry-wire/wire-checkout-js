/** Terminal outcome of a hosted-checkout session, as resolved by {@link WireCheckout.open}. */
export type CheckoutOutcome = "completed" | "canceled" | "failed";

/** Raw payment status reported by the status API. Non-terminal values keep polling. */
export type PaymentStatus =
  | "requires_payment"
  | "processing"
  | "succeeded"
  | "canceled"
  | "failed"
  | (string & {});

/** Shape of `GET {origin}/checkout/{token}/status`. */
export interface CheckoutStatusResponse {
  object: "checkout.session.status";
  status: string;
  payment_status: PaymentStatus;
  redirect_url?: string | null;
}

/** Result of a resolved overlay/popup checkout. */
export interface CheckoutResult {
  /** Terminal outcome derived from `payment_status`. */
  status: CheckoutOutcome;
  /** The raw `payment_status` from the status API at resolution time. */
  paymentStatus: PaymentStatus;
  /** Where the hosted page would have sent the buyer, if provided. */
  redirectUrl?: string;
}

/** Either a full hosted `url` (`https://pay.wire.mn/c/{token}`) or an explicit `{ token, baseURL }`. */
export type CheckoutTarget =
  | { url: string; token?: never; baseURL?: never }
  | { token: string; baseURL?: string; url?: never };

/** Options for {@link WireCheckout.open}. */
export interface OpenOptions {
  /** How to present the hosted page. `popup` (default) opens a centered window; `overlay` mounts a modal iframe. */
  presentation?: "popup" | "overlay";
}

/** A minimal subset of `fetch` so callers (and tests) can inject one. */
export type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Browser seams, injectable for testing. */
export interface Browser {
  fetch: FetchLike;
  /** Full-page navigation (redirect mode). */
  navigate: (url: string) => void;
  /** Open a popup window; returns a handle or null if blocked. */
  openPopup: (url: string, features: string) => PopupHandle | null;
  /** Mount a modal iframe overlay; returns a handle. */
  openOverlay: (url: string) => OverlayHandle;
  /** Schedule a callback after `ms`; returns a cancel token. */
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (token: unknown) => void;
  /** Wall-clock now in ms (for the overall timeout budget). */
  now: () => number;
}

/** A popup window handle the SDK can observe and close. */
export interface PopupHandle {
  /** True once the popup has been closed (by the user or by us). */
  closed: boolean;
  close: () => void;
}

/** A mounted overlay handle the SDK can tear down. */
export interface OverlayHandle {
  close: () => void;
}
