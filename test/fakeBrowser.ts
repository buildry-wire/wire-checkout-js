import { vi } from "vitest";
import type { Browser, CheckoutStatusResponse, PopupHandle } from "../src/types.js";

/** A scripted JSON response or a thrown network error for the fake fetch queue. */
type ScriptedResponse =
  | { ok: true; status: number; body: Partial<CheckoutStatusResponse> }
  | { ok: false; status: number; body?: unknown }
  | { throw: Error };

/**
 * Build a fake {@link Browser} driven by vitest fake timers. `responses` is the
 * scripted status-poll queue, consumed one per `fetch` call; the last entry is
 * reused once exhausted.
 */
export function makeFakeBrowser(responses: ScriptedResponse[]) {
  let i = 0;
  const popup: PopupHandle & { closed: boolean } = { closed: false, close: vi.fn() };
  const overlayClose = vi.fn();
  let overlayUrl: string | undefined;
  let popupUrl: string | undefined;

  const fetch = vi.fn(async (_input: string) => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if ("throw" in r) throw r.throw;
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
    };
  });

  const browser: Browser = {
    fetch,
    navigate: vi.fn(),
    openPopup: vi.fn((url: string) => {
      popupUrl = url;
      return popup;
    }),
    openOverlay: vi.fn((url: string) => {
      overlayUrl = url;
      return { close: overlayClose };
    }),
    // Bridge to vitest fake timers.
    setTimer: (cb, ms) => setTimeout(cb, ms),
    clearTimer: (token) => clearTimeout(token as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
  };

  return {
    browser,
    fetch,
    popup,
    overlayClose,
    fetchCount: () => i,
    popupUrl: () => popupUrl,
    overlayUrl: () => overlayUrl,
  };
}

export const status = (
  payment_status: string,
  redirect_url?: string,
): { ok: true; status: number; body: Partial<CheckoutStatusResponse> } => ({
  ok: true,
  status: 200,
  body: { object: "checkout.session.status", status: payment_status, payment_status, redirect_url },
});
