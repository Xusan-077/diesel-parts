import { CatalogMegaMenu } from "@/components/catalog/catalog-mega-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { HeaderActions } from "./header-actions";
import { HeaderSearch } from "./header-search";
import { HeaderSearchDialog } from "./header-search-dialog";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-nav";
import { Container } from "@/components/ui/container";

interface HeaderMainProps {
  lang: Locale;
  siteName: string;
  nav: Dictionary["nav"];
  header: Dictionary["header"];
  closeLabel: string;
  viewAllLabel: string;
  /** Shown in a suggestion row whose part has no price yet. */
  requestPriceLabel: string;
  account: Dictionary["account"];
  phone: string | null;
}

export function HeaderMain({
  lang,
  siteName,
  nav,
  header,
  closeLabel,
  viewAllLabel,
  requestPriceLabel,
  account,
  phone,
}: HeaderMainProps) {
  return (
    <div className="bg-surface">
      {/*
        This row's height is fixed at every breakpoint, and the condensed state
        deliberately does not touch it. It used to tighten its padding by 8px
        on the way down, which resized the sticky header and fed the scroll
        oscillation described in header-shell.tsx — the same bug as the top
        bar's old collapse, eight pixels at a time instead of thirty-seven.
        The header already gets shorter on screen by sliding the row above this
        one out of view; taking the padding with it is not worth reopening the
        loop for.
      */}
      <Container className="flex items-center gap-3 py-2.5 lg:gap-4 lg:py-3">
        <MobileMenu
          lang={lang}
          siteName={siteName}
          nav={nav}
          header={header}
          closeLabel={closeLabel}
          className="lg:hidden"
        />

        <Logo siteName={siteName} />

        <CatalogMegaMenu
          lang={lang}
          label={header.catalog}
          viewAllLabel={viewAllLabel}
          className="hidden lg:inline-flex"
        />

        {/* Wide enough for the field, and it is the first thing most visitors
            here are looking for, so it stays open rather than behind an icon. */}
        <HeaderSearch
          lang={lang}
          header={header}
          requestPriceLabel={requestPriceLabel}
          className="hidden min-w-0 flex-1 lg:block"
        />

        <HeaderActions
          header={header}
          account={account}
          closeLabel={closeLabel}
          phone={phone}
          className="ml-auto hidden lg:flex"
        />

        {/*
          A phone gets the icon instead. The field used to have a row of its
          own under this one, which cost the header a third of its height on
          every page whether anyone was searching or not — and that row could
          not collapse away, because shrinking the sticky header is what
          header-shell.tsx exists to prevent.
        */}
        <HeaderSearchDialog
          lang={lang}
          header={header}
          requestPriceLabel={requestPriceLabel}
          closeLabel={closeLabel}
          className="ml-auto lg:hidden"
        />
        <HeaderActions
          header={header}
          account={account}
          closeLabel={closeLabel}
          phone={phone}
          compact
          className="lg:hidden"
        />
      </Container>
    </div>
  );
}
