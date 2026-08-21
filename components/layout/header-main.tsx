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
}

export function HeaderMain({
  lang,
  siteName,
  nav,
  header,
  closeLabel,
  viewAllLabel,
  account,
}: HeaderMainProps) {
  return (
    <div className="bg-surface">
      {/*
        The condensed padding is a single utility on purpose: the attribute
        selector `group-data-*` compiles to outranks the plain `lg:py-3`
        above it, so one rule covers both breakpoints.
      */}
      <Container className="flex items-center gap-3 py-2.5 transition-[padding] duration-300 ease-out group-data-[condensed]/header:py-1.5 lg:gap-4 lg:py-3">
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
          className="ml-auto hidden lg:flex"
        />
        <HeaderActions
          header={header}
          account={account}
          closeLabel={closeLabel}
          compact
          className="ml-auto lg:hidden"
        />
      </Container>

      {/* A phone has the least room to spare, so its search row collapses
          with the top bar and comes back on the way up. */}
      <div className="grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out group-data-[condensed]/header:grid-rows-[0fr] lg:hidden">
        <div className="overflow-hidden">
          <Container className="pb-3">
            <HeaderSearch
              placeholder={header.searchPlaceholder}
              label={header.searchLabel}
            />
          </Container>
        </div>
      </div>
    </div>
  );
}
