import { defaultBrowser, popupFeatures } from "./browser.js";
import { pollUntilTerminal } from "./poller.js";
import type { Browser, CheckoutResult, CheckoutTarget, OpenOptions } from "./types.js";
import { resolveTarget } from "./url.js";

/** Configuration for {@link WireCheckout}. */
export interface WireCheckoutConfig {
  /** Default origin for token-only targets. Defaults to the hosted checkout origin. */
  baseURL?: string;
  /** How often to poll the status endpoint. Default 2000ms. */
  pollIntervalMs?: number;
  /** Overall budget before {@link WireCheckout.open} rejects with a timeout. Default 600000ms (10 min). */
  timeoutMs?: number;
  /** Browser seam. Tests inject a fake; production uses real `window`/`fetch`. */
  browser?: Browser;
}

/**
 * Client-side presenter for Wire hosted checkout. Safe to ship in browser code:
 * it never sees a secret key. The merchant creates the session server-side and
 * passes the hosted `url` (or `{ token, baseURL }`) to the browser.
 */
export class WireCheckout {
  private readonly baseURL?: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly browser?: Browser;

  constructor(config: WireCheckoutConfig = {}) {
    this.baseURL = config.baseURL;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.timeoutMs = config.timeoutMs ?? 600_000;
    this.browser = config.browser;
  }

  private resolveBrowser(): Browser {
    return this.browser ?? defaultBrowser();
  }

  /**
   * Redirect-mode: navigate the whole page to the hosted checkout. Does not
   * return — after payment the hosted page redirects the buyer back to your
   * configured return URL, where you re-confirm via the status API server-side.
   */
  redirectToCheckout(target: CheckoutTarget): void {
    const resolved = resolveTarget(target, this.baseURL);
    this.resolveBrowser().navigate(resolved.checkoutUrl);
  }

  /**
   * Overlay/popup-mode: present the hosted checkout and resolve with the
   * outcome. The status API is the source of truth — closing the popup or a
   * redirect only triggers an immediate confirmation poll.
   */
  async open(target: CheckoutTarget, options: OpenOptions = {}): Promise<CheckoutResult> {
    const browser = this.resolveBrowser();
    const resolved = resolveTarget(target, this.baseURL);
    const presentation = options.presentation ?? "popup";

    const wakers: Array<() => void> = [];
    const wake = { register: (fn: () => void) => wakers.push(fn) };
    const fireWake = () => {
      for (const fn of wakers.splice(0)) fn();
    };

    let close: () => void = () => {};
    let watchToken: unknown;

    if (presentation === "overlay") {
      const handle = browser.openOverlay(resolved.checkoutUrl);
      close = () => handle.close();
    } else {
      const handle = browser.openPopup(resolved.checkoutUrl, popupFeatures());
      if (handle) {
        close = () => handle.close();
        // Poll the popup's closed flag; when it closes, wake an immediate confirm.
        const watch = () => {
          if (handle.closed) {
            fireWake();
            return;
          }
          watchToken = browser.setTimer(watch, 500);
        };
        watchToken = browser.setTimer(watch, 500);
      }
      // If the popup was blocked, we still poll status; the buyer may have a
      // foreground tab. Resolution remains driven by the status API.
    }

    try {
      return await pollUntilTerminal(
        browser,
        resolved,
        { pollIntervalMs: this.pollIntervalMs, timeoutMs: this.timeoutMs },
        wake,
      );
    } finally {
      if (watchToken !== undefined) browser.clearTimer(watchToken);
      close();
    }
  }
}
