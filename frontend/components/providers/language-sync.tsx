"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/locales";
import { useLanguageStore, writeLanguageCookie } from "@/lib/store/language-store";

/**
 * Reconciles the persisted language with the one the server just rendered.
 *
 * The server can only see the cookie, so a visitor whose cookie was cleared or
 * never written — the first visit after this refactor, a browser that drops
 * cookies but keeps localStorage — would be served Uzbek while their store
 * says Russian. Writing the cookie and refreshing once after mount repairs
 * that; when the two already agree, which is every ordinary page view, this
 * costs a cookie write and nothing else.
 *
 * Rendering nothing keeps the server HTML and the first client render
 * identical, so the swap can never show up as a hydration mismatch.
 */
export function LanguageSync({ serverLanguage }: { serverLanguage: Locale }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve(useLanguageStore.persist.rehydrate()).then(() => {
      if (cancelled) {
        return;
      }

      const { language, setHydrated } = useLanguageStore.getState();
      setHydrated(true);
      writeLanguageCookie(language);

      if (language !== serverLanguage) {
        router.refresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router, serverLanguage]);

  return null;
}
