import { WireCheckoutError } from "./errors.js";
import type {
  Browser,
  CheckoutOutcome,
  CheckoutResult,
  CheckoutStatusResponse,
  PaymentStatus,
} from "./types.js";
import { statusUrl, type ResolvedTarget } from "./url.js";

/** Payment statuses that end polling, mapped to a terminal outcome. */
const TERMINAL: Record<string, CheckoutOutcome> = {
  succeeded: "completed",
  canceled: "canceled",
  failed: "failed",
};

/** Map a `payment_status` to a terminal outcome, or `undefined` if still pending. */
export function terminalOutcome(paymentStatus: PaymentStatus): CheckoutOutcome | undefined {
  return TERMINAL[paymentStatus];
}

export interface PollConfig {
  pollIntervalMs: number;
  timeoutMs: number;
}

/**
 * Poll `GET {origin}/checkout/{token}/status` until the payment reaches a
 * terminal state or the timeout budget is exhausted. The status API is the
 * single source of truth for completion — never the redirect.
 *
 * `signal` lets the caller request a poll *now* (e.g. on popup close / redirect)
 * by aborting the current wait. It is not an error to abort the wait.
 */
export async function pollUntilTerminal(
  browser: Browser,
  target: ResolvedTarget,
  config: PollConfig,
  wake?: { register: (fn: () => void) => void },
): Promise<CheckoutResult> {
  const deadline = browser.now() + config.timeoutMs;
  const url = statusUrl(target);

  for (;;) {
    const status = await fetchStatus(browser, url);
    const outcome = terminalOutcome(status.payment_status);
    if (outcome) {
      return {
        status: outcome,
        paymentStatus: status.payment_status,
        redirectUrl: status.redirect_url ?? undefined,
      };
    }

    if (browser.now() >= deadline) {
      throw new WireCheckoutError(
        `checkout timed out after ${config.timeoutMs}ms (last payment_status="${status.payment_status}")`,
        "timeout",
      );
    }

    const remaining = deadline - browser.now();
    await wait(browser, Math.min(config.pollIntervalMs, remaining), wake);
  }
}

async function fetchStatus(browser: Browser, url: string): Promise<CheckoutStatusResponse> {
  let res: Awaited<ReturnType<Browser["fetch"]>>;
  try {
    res = await browser.fetch(url);
  } catch (e) {
    throw new WireCheckoutError(
      `failed to reach checkout status endpoint: ${(e as Error).message}`,
      "network_error",
    );
  }
  if (!res.ok) {
    throw new WireCheckoutError(
      `checkout status endpoint returned HTTP ${res.status}`,
      "status_error",
    );
  }
  const body = (await res.json()) as Partial<CheckoutStatusResponse>;
  if (!body || typeof body.payment_status !== "string") {
    throw new WireCheckoutError("malformed checkout status response", "status_error");
  }
  return body as CheckoutStatusResponse;
}

/** Sleep for `ms`, resolving early if the caller fires the wake callback. */
function wait(
  browser: Browser,
  ms: number,
  wake?: { register: (fn: () => void) => void },
): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      browser.clearTimer(timer);
      resolve();
    };
    const timer = browser.setTimer(finish, Math.max(0, ms));
    if (wake) wake.register(finish);
  });
}
