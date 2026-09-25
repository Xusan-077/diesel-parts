/**
 * One-time loader for the Yandex Maps JS API v3 (`ymaps3`).
 *
 * A second `<script>` for the same API re-runs the whole bundle and leaves two
 * `ymaps3` globals fighting over the same containers — the double-init that bit
 * the EduMRX map. The module-level promise is the guard: the tag is appended
 * exactly once per page and every caller after the first awaits that same load.
 *
 * `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` is read here rather than at each call site.
 * When it is unset the promise rejects immediately, and the callers
 * (delivery-map.tsx) fall back to plain manual address entry.
 */

export const YANDEX_MAPS_API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

/** `true` when a key is configured — lets a component decide whether to even
 *  mount the map before attempting a load. */
export const yandexMapsEnabled = YANDEX_MAPS_API_KEY.length > 0;

const SCRIPT_ID = "yandex-maps-v3";

/** The slim slice of the `ymaps3` global this app actually touches. The full
 *  API is untyped here on purpose — a types package is a large dependency for
 *  the handful of constructors delivery-map.tsx uses. */
export interface Ymaps3 {
  ready: Promise<void>;
  import: (module: string) => Promise<Record<string, unknown>>;
  [key: string]: unknown;
}

declare global {
  interface Window {
    ymaps3?: Ymaps3;
  }
}

let loadPromise: Promise<Ymaps3> | null = null;

/** Yandex v3 accepts `ru_RU` / `en_US` reliably; the storefront's Uzbek locale
 *  has no first-class map language, so it borrows Russian — Tashkent street
 *  names render in full either way. */
function yandexLang(locale: string): string {
  return locale === "en" ? "en_US" : "ru_RU";
}

export function loadYandexMaps(locale: string): Promise<Ymaps3> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps can only load in the browser"));
  }
  if (!YANDEX_MAPS_API_KEY) {
    return Promise.reject(new Error("NEXT_PUBLIC_YANDEX_MAPS_API_KEY is not set"));
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<Ymaps3>((resolve, reject) => {
    const settle = () => {
      const ymaps3 = window.ymaps3;
      if (!ymaps3) {
        reject(new Error("ymaps3 global missing after script load"));
        return;
      }
      ymaps3.ready.then(() => resolve(ymaps3)).catch(reject);
    };

    const fail = (message: string) => {
      // Drop the cached rejection so a later mount can retry (a flaky network,
      // or the key arriving after a redeploy).
      loadPromise = null;
      reject(new Error(message));
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.ymaps3) {
        settle();
      } else {
        existing.addEventListener("load", settle, { once: true });
        existing.addEventListener("error", () => fail("Yandex Maps script failed to load"), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(
      YANDEX_MAPS_API_KEY,
    )}&lang=${yandexLang(locale)}`;
    script.addEventListener("load", settle, { once: true });
    script.addEventListener("error", () => fail("Yandex Maps script failed to load"), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return loadPromise;
}
