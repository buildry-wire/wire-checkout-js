# @buildry-wire/checkout

Client-side drop-in for presenting a [Wire](https://wire.mn) **hosted checkout** session in the
browser. Zero runtime dependencies. Safe to ship in client code — it never sees a secret key.

This is the browser companion to the server SDK. Your backend creates the checkout session (with
your secret key) and hands the browser the hosted `url`; this library presents it and tells you the
outcome.

## Install

```bash
npm install @buildry-wire/checkout
```

## How the flow works

1. **Server-side (your backend, with your secret key):** create a checkout session. You get back a
   hosted `url` of the form `https://pay.wire.mn/c/{token}`.
2. **Browser:** pass that `url` to this library.
3. This library presents the hosted page (redirect or overlay/popup) and resolves the outcome by
   polling the session **status API** — the status API is the single source of truth for
   completion, never the redirect.

## Quickstart — redirect mode

Full-page navigation to the hosted page. After payment the hosted page returns the buyer to your
configured return URL, where you re-confirm the result server-side.

```ts
import { WireCheckout } from "@buildry-wire/checkout";

// `url` came from your backend after it created the session.
const checkout = new WireCheckout();
checkout.redirectToCheckout({ url });
```

## Quickstart — overlay / popup mode

Present the hosted page in a centered popup (default) or a modal iframe overlay, and await the
outcome:

```ts
import { WireCheckout } from "@buildry-wire/checkout";

const checkout = new WireCheckout();

const result = await checkout.open({ url });            // popup (default)
// or: await checkout.open({ url }, { presentation: "overlay" });

switch (result.status) {
  case "completed":
    console.log("paid", result.paymentStatus, result.redirectUrl);
    break;
  case "canceled":
    console.log("buyer canceled");
    break;
  case "failed":
    console.log("payment failed");
    break;
}
```

`result` is `{ status, paymentStatus, redirectUrl }`. Resolution is always confirmed against the
status API; closing the popup or returning from a redirect only triggers an immediate confirmation
poll.

## Configuration

```ts
new WireCheckout({
  baseURL: "https://pay.wire.mn", // origin for token-only targets
  pollIntervalMs: 2000,            // status poll cadence
  timeoutMs: 600_000,              // overall budget before open() rejects with a timeout
});
```

You can also pass an explicit token instead of a url:

```ts
await checkout.open({ token: "cs_test_…", baseURL: "https://pay.wire.mn" });
```

## Test operator

In sandbox, sessions are created against the `["sandbox"]` test operator. In live mode the buyer
sees the operators enabled on your account.

## Errors

```ts
import { WireCheckoutError } from "@buildry-wire/checkout";

try {
  await checkout.open({ url });
} catch (e) {
  if (e instanceof WireCheckoutError) console.log(e.code); // invalid_url, timeout, network_error, …
}
```

## Security

This package is designed to run in untrusted client code. It only ever touches a public hosted
`url`/`token` and the public status endpoint — **never** a secret key. Create sessions on your
backend.

## Docs

Full documentation: [docs.wire.mn](https://docs.wire.mn).

## License

MIT
