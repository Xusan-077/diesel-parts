import { CatalogMegaMenu } from "@/components/catalog/catalog-mega-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { HeaderActions } from "./header-actions";
import { HeaderSearch } from "./header-search";
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

        <HeaderSearch
          placeholder={header.searchPlaceholder}
          label={header.searchLabel}
          className="hidden min-w-0 flex-1 lg:block"
        />

        <HeaderActions
          header={header}
          account={account}
          closeLabel={closeLabel}
          phone={phone}
          className="ml-auto hidden lg:flex"
        />
        <HeaderActions
          header={header}
          account={account}
          closeLabel={closeLabel}
          phone={phone}
          compact
          className="ml-auto lg:hidden"
        />
      </Container>

      {/*
        A phone has no room for the search field beside the logo, so it gets
        its own row underneath.

        The row used to collapse on the way down. It cannot: it is the last row
        in the header, so collapsing it shortens the header itself, and a
        sticky header that changes height in response to scrolling is the
        oscillation header-shell.tsx exists to avoid. Sliding is not available
        to it either — it sits below the row that has to stay on screen, and
        only the top of the header can leave the top of the viewport.
      */}
      <Container className="pb-3 lg:hidden">
        <HeaderSearch
          placeholder={header.searchPlaceholder}
          label={header.searchLabel}
        />
      </Container>
    </div>
  );
}
