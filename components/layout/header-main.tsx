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
      <Container className="flex items-center gap-3 py-2.5 lg:gap-4 lg:py-3">
        <MobileMenu
          lang={lang}
          siteName={siteName}
          nav={nav}
          header={header}
          closeLabel={closeLabel}
          className="lg:hidden"
        />

        <Logo lang={lang} siteName={siteName} />

        <CatalogMegaMenu
          lang={lang}
          label={header.catalog}
          viewAllLabel={viewAllLabel}
          className="hidden lg:inline-flex"
        />

        <HeaderSearch
          lang={lang}
          placeholder={header.searchPlaceholder}
          label={header.searchLabel}
          className="hidden min-w-0 flex-1 lg:block"
        />

        <HeaderActions
          lang={lang}
          header={header}
          account={account}
          closeLabel={closeLabel}
          className="ml-auto hidden lg:flex"
        />
        <HeaderActions
          lang={lang}
          header={header}
          account={account}
          closeLabel={closeLabel}
          compact
          className="ml-auto lg:hidden"
        />
      </Container>

      <Container className="pb-3 lg:hidden">
        <HeaderSearch
          lang={lang}
          placeholder={header.searchPlaceholder}
          label={header.searchLabel}
        />
      </Container>
    </div>
  );
}
