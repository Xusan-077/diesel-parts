"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getErrorFallbackStrings } from "@/lib/i18n/fallback-strings";
import { useLanguageStore } from "@/lib/store/language-store";

/**
 * What a visitor sees when a public page throws.
 *
 * This is the outer net, not the first one. Every database read on the public
 * pages is guarded where it happens (`safeRead`), because a server error that
 * reaches this boundary costs more than a notice does: Next answers the request
 * with its own bare error document and a 500, and this screen only appears once
 * the browser has hydrated — verified by pointing `DATABASE_URL` at a dead host
 * and reading what the server actually sent. So an unreachable database is
 * handled in the pages themselves, and what is left for this file is the
 * genuinely unexpected: a bug in a component, a malformed row, a null nobody
 * predicted.
 *
 * After hydration the layout is back — header, language switcher, catalog menu,
 * footer, none of which touch the database — so the visitor lands on a page
 * they can navigate out of.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  /*
   * The store is on its default until `LanguageSync` (in the layout, which is
   * still mounted) rehydrates it. Reading `hydrated` rather than `language`
   * alone keeps the first render byte-identical to the server's, the same
   * contract `useLanguage` follows.
   */
  const language = useLanguageStore((state) => state.language);
  const hydrated = useLanguageStore((state) => state.hydrated);
  const strings = getErrorFallbackStrings(hydrated ? language : DEFAULT_LOCALE);

  return (
    <Container as="main" size="narrow" className="pb-24 pt-16">
      <h1 className="text-3xl font-semibold text-foreground">{strings.title}</h1>
      <p className="mt-3 text-muted">{strings.description}</p>

      {/*
        In production Next replaces the message with an opaque digest, and that
        digest is the only thing tying this screen to a server log line — so it
        is shown, quietly, for a visitor to quote. The raw message is never
        printed here: unlike the panel, this page is public, and a Prisma error
        names the host and the schema.
      */}
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-muted">{error.digest}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={reset}>
          {strings.retry}
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {strings.home}
        </Link>
      </div>
    </Container>
  );
}
