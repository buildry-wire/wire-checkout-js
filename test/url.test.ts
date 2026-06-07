import { describe, expect, it } from "vitest";
import { WireCheckoutError } from "../src/errors.js";
import { parseCheckoutUrl, resolveTarget, statusUrl, DEFAULT_BASE_URL } from "../src/url.js";

describe("parseCheckoutUrl", () => {
  it("derives origin and token from /c/{token}", () => {
    const t = parseCheckoutUrl("https://pay.wire.mn/c/cs_test_abc123");
    expect(t.origin).toBe("https://pay.wire.mn");
    expect(t.token).toBe("cs_test_abc123");
    expect(t.checkoutUrl).toBe("https://pay.wire.mn/c/cs_test_abc123");
  });

  it("builds the status url on the same origin", () => {
    const t = parseCheckoutUrl("https://pay.wire.mn/c/cs_test_abc123");
    expect(statusUrl(t)).toBe("https://pay.wire.mn/checkout/cs_test_abc123/status");
  });

  it("rejects non-https", () => {
    expect(() => parseCheckoutUrl("http://pay.wire.mn/c/tok")).toThrow(WireCheckoutError);
  });

  it("rejects a malformed path", () => {
    expect(() => parseCheckoutUrl("https://pay.wire.mn/checkout/tok")).toThrow(/\/c\/\{token\}/);
  });

  it("rejects an unparseable url", () => {
    expect(() => parseCheckoutUrl("not a url")).toThrow(WireCheckoutError);
  });

  it("rejects a token with illegal characters", () => {
    expect(() => parseCheckoutUrl("https://pay.wire.mn/c/bad%20token")).toThrow(/invalid checkout token/);
  });
});

describe("resolveTarget", () => {
  it("accepts an explicit token with default baseURL", () => {
    const t = resolveTarget({ token: "cs_test_1" });
    expect(t.origin).toBe(DEFAULT_BASE_URL);
    expect(t.checkoutUrl).toBe(`${DEFAULT_BASE_URL}/c/cs_test_1`);
  });

  it("accepts token + explicit baseURL", () => {
    const t = resolveTarget({ token: "cs_test_1", baseURL: "https://pay.example.com" });
    expect(t.origin).toBe("https://pay.example.com");
  });

  it("honors a constructor fallback baseURL", () => {
    const t = resolveTarget({ token: "cs_test_1" }, "https://pay.example.com");
    expect(t.origin).toBe("https://pay.example.com");
  });

  it("rejects an http baseURL", () => {
    expect(() => resolveTarget({ token: "cs_test_1", baseURL: "http://pay.example.com" })).toThrow(
      WireCheckoutError,
    );
  });

  it("prefers url over fallback when given", () => {
    const t = resolveTarget({ url: "https://pay.wire.mn/c/tok" }, "https://other.example.com");
    expect(t.origin).toBe("https://pay.wire.mn");
  });
});
