import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { HeaderMain } from "./header-main";
import { HeaderNav } from "./header-nav";
import { HeaderTopbar } from "./header-topbar";

interface HeaderProps {
  lang: Locale;
  siteName: string;
  nav: Dictionary["nav"];
  header: Dictionary["header"];
  closeLabel: string;
  viewAllLabel: string;
  account: Dictionary["account"];
}

export function Header({
  lang,
  siteName,
  nav,
  header,
  closeLabel,
  viewAllLabel,
  account,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <HeaderTopbar lang={lang} header={header} />
      <HeaderMain
        lang={lang}
        siteName={siteName}
        nav={nav}
        header={header}
        closeLabel={closeLabel}
        viewAllLabel={viewAllLabel}
        account={account}
      />
      <HeaderNav lang={lang} nav={nav} />
    </header>
  );
}
