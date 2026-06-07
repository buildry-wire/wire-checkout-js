import { WireCheckoutError } from "./errors.js";
import type { CheckoutTarget } from "./types.js";

/** The default origin that serves hosted checkout pages. */
export const DEFAULT_BASE_URL = "https://pay.wire.mn";

/** A resolved hosted-checkout target: an origin plus the session token. */
export interface ResolvedTarget {
  /** Origin only, e.g. `https://pay.wire.mn` (no trailing slash). */
  origin: string;
  /** The opaque session token. */
  token: string;
  /** The hosted checkout page URL. */
  checkoutUrl: string;
}

const TOKEN_RE = /^[A-Za-z0-9._~-]+$/;

function assertHttps(u: URL): void {
  if (u.protocol !== "https:") {
    throw new WireCheckoutError(
      `checkout url must be https, got "${u.protocol}"`,
      "invalid_url",
    );
  }
}

/** Parse a hosted url of the form `{origin}/c/{token}` into its parts. */
export function parseCheckoutUrl(rawUrl: string): ResolvedTarget {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new WireCheckoutError(`invalid checkout url: "${rawUrl}"`, "invalid_url");
  }
  assertHttps(u);

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "c") {
    throw new WireCheckoutError(
      `checkout url path must be "/c/{token}", got "${u.pathname}"`,
      "invalid_url",
    );
  }
  const token = decodeURIComponent(parts[1]);
  assertToken(token);

  return { origin: u.origin, token, checkoutUrl: `${u.origin}/c/${encodeURIComponent(token)}` };
}

function assertToken(token: string | undefined): asserts token is string {
  if (!token || !TOKEN_RE.test(token)) {
    throw new WireCheckoutError(`invalid checkout token: "${token}"`, "invalid_token");
  }
}

/** Resolve a {@link CheckoutTarget} (url or token+baseURL) to a concrete target. */
export function resolveTarget(target: CheckoutTarget, fallbackBaseURL?: string): ResolvedTarget {
  if (target.url) return parseCheckoutUrl(target.url);

  const token = target.token;
  assertToken(token);
  const base = target.baseURL ?? fallbackBaseURL ?? DEFAULT_BASE_URL;
  let origin: string;
  try {
    const u = new URL(base);
    assertHttps(u);
    origin = u.origin;
  } catch (e) {
    if (e instanceof WireCheckoutError) throw e;
    throw new WireCheckoutError(`invalid baseURL: "${base}"`, "invalid_url");
  }
  return { origin, token, checkoutUrl: `${origin}/c/${encodeURIComponent(token)}` };
}

/** Build the status-polling endpoint for a resolved target. */
export function statusUrl(target: ResolvedTarget): string {
  return `${target.origin}/checkout/${encodeURIComponent(target.token)}/status`;
}
