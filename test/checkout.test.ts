import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WireCheckout } from "../src/checkout.js";
import { WireCheckoutError } from "../src/errors.js";
import { makeFakeBrowser, status } from "./fakeBrowser.js";

const URL = "https://pay.wire.mn/c/cs_test_abc";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("WireCheckout.redirectToCheckout", () => {
  it("navigates the page to the hosted url", () => {
    const { browser } = makeFakeBrowser([status("requires_payment")]);
    const checkout = new WireCheckout({ browser });
    checkout.redirectToCheckout({ url: URL });
    expect(browser.navigate).toHaveBeenCalledWith(URL);
  });

  it("validates the url before navigating", () => {
    const { browser } = makeFakeBrowser([status("requires_payment")]);
    const checkout = new WireCheckout({ browser });
    expect(() => checkout.redirectToCheckout({ url: "http://evil/c/x" })).toThrow(WireCheckoutError);
    expect(browser.navigate).not.toHaveBeenCalled();
  });
});

describe("WireCheckout.open (popup)", () => {
  it("opens a popup, polls, resolves completed, and closes the popup", async () => {
    const fb = makeFakeBrowser([status("processing"), status("succeeded", "https://shop/return")]);
    const checkout = new WireCheckout({ browser: fb.browser });
    const p = checkout.open({ url: URL });
    await vi.runAllTimersAsync();
    const result = await p;

    expect(fb.popupUrl()).toBe(URL);
    expect(result).toMatchObject({ status: "completed", paymentStatus: "succeeded" });
    expect(fb.popup.close).toHaveBeenCalled();
  });

  it("confirms promptly when the popup is closed by the user", async () => {
    const fb = makeFakeBrowser([status("processing"), status("succeeded")]);
    const checkout = new WireCheckout({ browser: fb.browser, pollIntervalMs: 60_000 });
    const p = checkout.open({ url: URL });
    // First poll happens immediately.
    await vi.advanceTimersByTimeAsync(0);
    // User closes the popup; the 500ms watcher should wake an immediate re-poll
    // even though the 60s interval has not elapsed.
    fb.popup.closed = true;
    await vi.advanceTimersByTimeAsync(600);
    const result = await p;
    expect(result.status).toBe("completed");
  });
});

describe("WireCheckout.open (overlay)", () => {
  it("mounts an overlay and tears it down on resolution", async () => {
    const fb = makeFakeBrowser([status("succeeded")]);
    const checkout = new WireCheckout({ browser: fb.browser });
    const p = checkout.open({ url: URL }, { presentation: "overlay" });
    await vi.runAllTimersAsync();
    await p;
    expect(fb.overlayUrl()).toBe(URL);
    expect(fb.overlayClose).toHaveBeenCalled();
  });
});

describe("WireCheckout config", () => {
  it("resolves a token-only target against a configured baseURL", async () => {
    const fb = makeFakeBrowser([status("succeeded")]);
    const checkout = new WireCheckout({ browser: fb.browser, baseURL: "https://pay.example.com" });
    const p = checkout.open({ token: "cs_test_zzz" });
    await vi.runAllTimersAsync();
    await p;
    expect(fb.fetch).toHaveBeenCalledWith("https://pay.example.com/checkout/cs_test_zzz/status");
  });
});
