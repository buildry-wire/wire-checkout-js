import { WireCheckoutError } from "./errors.js";
import type { Browser, OverlayHandle, PopupHandle } from "./types.js";

/** Build the default {@link Browser} seam backed by real `window`/`fetch`. */
export function defaultBrowser(): Browser {
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    throw new WireCheckoutError(
      "WireCheckout requires a browser environment; inject a Browser seam to run elsewhere",
      "no_browser",
    );
  }

  return {
    fetch: (input, init) => fetch(input, init),
    navigate: (url) => {
      window.location.assign(url);
    },
    openPopup: (url, features) => {
      const win = window.open(url, "wire_checkout", features);
      if (!win) return null;
      return {
        get closed() {
          return win.closed;
        },
        close: () => win.close(),
      } as PopupHandle;
    },
    openOverlay: (url) => mountOverlay(url),
    setTimer: (cb, ms) => window.setTimeout(cb, ms),
    clearTimer: (token) => window.clearTimeout(token as number),
    now: () => Date.now(),
  };
}

/** Centered popup window features for a given size. */
export function popupFeatures(width = 480, height = 720): string {
  const dualLeft = typeof window !== "undefined" ? window.screenX ?? 0 : 0;
  const dualTop = typeof window !== "undefined" ? window.screenY ?? 0 : 0;
  const w = typeof window !== "undefined" ? window.outerWidth || width : width;
  const h = typeof window !== "undefined" ? window.outerHeight || height : height;
  const left = dualLeft + Math.max(0, (w - width) / 2);
  const top = dualTop + Math.max(0, (h - height) / 2);
  return `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`;
}

function mountOverlay(url: string): OverlayHandle {
  const backdrop = document.createElement("div");
  backdrop.setAttribute("data-wire-checkout", "overlay");
  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "2147483647",
  });

  const frame = document.createElement("iframe");
  frame.src = url;
  frame.setAttribute("allow", "payment");
  Object.assign(frame.style, {
    width: "min(480px, 100%)",
    height: "min(720px, 100%)",
    border: "0",
    borderRadius: "12px",
    background: "#fff",
  });

  backdrop.appendChild(frame);
  document.body.appendChild(backdrop);

  return {
    close: () => {
      backdrop.remove();
    },
  };
}
