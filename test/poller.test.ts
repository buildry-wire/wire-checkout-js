import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollUntilTerminal, terminalOutcome } from "../src/poller.js";
import { WireCheckoutError } from "../src/errors.js";
import { parseCheckoutUrl } from "../src/url.js";
import { makeFakeBrowser, status } from "./fakeBrowser.js";

const target = parseCheckoutUrl("https://pay.wire.mn/c/cs_test_abc");
const cfg = { pollIntervalMs: 2000, timeoutMs: 60_000 };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("terminalOutcome", () => {
  it("maps payment statuses", () => {
    expect(terminalOutcome("succeeded")).toBe("completed");
    expect(terminalOutcome("canceled")).toBe("canceled");
    expect(terminalOutcome("failed")).toBe("failed");
    expect(terminalOutcome("processing")).toBeUndefined();
    expect(terminalOutcome("requires_payment")).toBeUndefined();
  });
});

describe("pollUntilTerminal", () => {
  it("resolves completed once payment_status is succeeded", async () => {
    const { browser, fetch } = makeFakeBrowser([
      status("requires_payment"),
      status("processing"),
      status("succeeded", "https://shop.example.com/return"),
    ]);
    const p = pollUntilTerminal(browser, target, cfg);
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result).toEqual({
      status: "completed",
      paymentStatus: "succeeded",
      redirectUrl: "https://shop.example.com/return",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("hits the same-origin status endpoint", async () => {
    const { browser, fetch } = makeFakeBrowser([status("succeeded")]);
    const p = pollUntilTerminal(browser, target, cfg);
    await vi.runAllTimersAsync();
    await p;
    expect(fetch).toHaveBeenCalledWith("https://pay.wire.mn/checkout/cs_test_abc/status");
  });

  it("resolves canceled", async () => {
    const { browser } = makeFakeBrowser([status("canceled")]);
    const p = pollUntilTerminal(browser, target, cfg);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ status: "canceled" });
  });

  it("resolves failed", async () => {
    const { browser } = makeFakeBrowser([status("failed")]);
    const p = pollUntilTerminal(browser, target, cfg);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ status: "failed" });
  });

  it("times out while still pending", async () => {
    const { browser } = makeFakeBrowser([status("processing")]);
    const p = pollUntilTerminal(browser, target, { pollIntervalMs: 2000, timeoutMs: 5000 });
    const assertion = expect(p).rejects.toMatchObject({
      code: "timeout",
    });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("throws a network_error when fetch rejects", async () => {
    const { browser } = makeFakeBrowser([{ throw: new Error("offline") }]);
    const p = pollUntilTerminal(browser, target, cfg);
    const assertion = expect(p).rejects.toBeInstanceOf(WireCheckoutError);
    await vi.runAllTimersAsync().catch(() => {});
    await assertion;
  });

  it("throws status_error on non-ok HTTP", async () => {
    const { browser } = makeFakeBrowser([{ ok: false, status: 404 }]);
    const p = pollUntilTerminal(browser, target, cfg);
    const assertion = expect(p).rejects.toMatchObject({ code: "status_error" });
    await vi.runAllTimersAsync().catch(() => {});
    await assertion;
  });

  it("throws status_error on a malformed body", async () => {
    const { browser } = makeFakeBrowser([{ ok: true, status: 200, body: {} }]);
    const p = pollUntilTerminal(browser, target, cfg);
    const assertion = expect(p).rejects.toMatchObject({ code: "status_error" });
    await vi.runAllTimersAsync().catch(() => {});
    await assertion;
  });

  it("wakes early to confirm when the caller fires the waker", async () => {
    const { browser, fetch } = makeFakeBrowser([status("processing"), status("succeeded")]);
    let waker: (() => void) | undefined;
    const wake = { register: (fn: () => void) => (waker = fn) };
    const p = pollUntilTerminal(browser, target, cfg, wake);
    // Let the first poll resolve and register the wait+waker.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    // Fire the waker before the 2s interval elapses -> immediate re-poll.
    waker?.();
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
