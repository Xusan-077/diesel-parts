import { Phone } from "lucide-react";
import { SITE_PHONES } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { LanguageSelect } from "./language-select";
import { RegionSelect } from "./region-select";
import { ThemeToggle } from "./theme-toggle";
import { Container } from "@/components/ui/container";
import { Icon } from "@/components/ui/icon";

export function HeaderTopbar({
  lang,
  header,
}: {
  lang: Locale;
  header: Dictionary["header"];
}) {
  return (
    <div className="border-b border-border bg-surface-muted">
      <Container className="flex h-9 items-center gap-2 sm:gap-4">
        <RegionSelect lang={lang} label={header.regionLabel} />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="hidden items-center gap-3 lg:flex">
            {SITE_PHONES.map((phone) => (
              <a
                key={phone.tel}
                href={`tel:${phone.tel}`}
                className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
              >
                <Icon icon={Phone} size="xs" />
                {phone.display}
              </a>
            ))}
          </div>

          <ThemeToggle
            lightLabel={header.themeLight}
            darkLabel={header.themeDark}
          />
          <LanguageSelect lang={lang} label={header.languageLabel} />
        </div>
      </Container>
    </div>
  );
}
