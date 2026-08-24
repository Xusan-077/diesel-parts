import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { HeaderMain } from "./header-main";
import type { HotOfferLabels } from "./header-search";
import { HeaderNav } from "./header-nav";
import { HeaderShell } from "./header-shell";
import { HeaderTopbar } from "./header-topbar";

interface HeaderProps {
  lang: Locale;
  siteName: string;
  nav: Dictionary["nav"];
  header: Dictionary["header"];
  closeLabel: string;
  viewAllLabel: string;
  /** Shown in a search suggestion whose part has no price yet. */
  requestPriceLabel: string;
  /** The home page's row titles, for the search dropdown's hot-offer chips. */
  hotOfferLabels: HotOfferLabels;
  account: Dictionary["account"];
  /** The signed-in visitor's number, or null. See `HeaderActions`. */
  phone: string | null;
}

export function Header({
  lang,
  siteName,
  nav,
  header,
  closeLabel,
  viewAllLabel,
  requestPriceLabel,
  hotOfferLabels,
  account,
  phone,
}: HeaderProps) {
  return (
    // `HeaderShell` is the only client component here; the rows themselves
    // are still rendered on the server and passed through as children.
    <HeaderShell topbar={<HeaderTopbar lang={lang} header={header} />}>
      <HeaderMain
        lang={lang}
        siteName={siteName}
        nav={nav}
        header={header}
        closeLabel={closeLabel}
        viewAllLabel={viewAllLabel}
        requestPriceLabel={requestPriceLabel}
        hotOfferLabels={hotOfferLabels}
        account={account}
        phone={phone}
      />
      <HeaderNav nav={nav} />
    </HeaderShell>
  );
}
