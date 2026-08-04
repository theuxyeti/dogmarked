/**
 * PWA helpers for Dogmarked.
 *
 * Manifest: `public/manifest.webmanifest` (link from root layout metadata).
 *
 * Service worker: optional. Serwist / next-pwa can own `src/app/sw.ts` later.
 * Until then, `registerServiceWorkerStub()` may register `/sw.js` only when
 * that file exists in `public/` — never invent offline caching of map tiles.
 */

const SW_PATH = "/sw.js";

export function getManifestPath(): string {
  return "/manifest.webmanifest";
}

/**
 * Attempt to register an optional service worker stub.
 * No-ops when unsupported, insecure context, or SW file missing (404).
 */
export async function registerServiceWorkerStub(): Promise<
  ServiceWorkerRegistration | null
> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!window.isSecureContext) return null;

  try {
    const head = await fetch(SW_PATH, { method: "HEAD", cache: "no-store" });
    if (!head.ok) {
      // Expected until public/sw.js ships — silent no-op.
      return null;
    }
    return await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch {
    return null;
  }
}

/** Call once from a client layout/effect when PWA baseline is desired. */
export function scheduleServiceWorkerRegistration(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    void registerServiceWorkerStub();
  };
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: 4000 });
  } else {
    globalThis.setTimeout(run, 2000);
  }
}
