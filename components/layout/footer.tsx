import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

interface FooterProps {
  lang: Locale;
  siteName: string;
  footer: Dictionary["footer"];
  nav: Dictionary["nav"];
  phone: string;
}

export function Footer({ lang, siteName, footer, nav, phone }: FooterProps) {
  const year = new Date().getFullYear();

  const links = [
    { href: `/${lang}/products`, label: nav.products },
    { href: `/${lang}/about`, label: nav.about },
    { href: `/${lang}/blog`, label: nav.blog },
    { href: `/${lang}/contact`, label: nav.contact },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{siteName}</p>
          <p className="mt-3 max-w-sm text-sm text-muted">{footer.description}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{footer.linksTitle}</p>
          <ul className="mt-3 space-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{footer.contactTitle}</p>
          <dl className="mt-3 space-y-2 text-sm text-muted">
            <div>
              <dt className="inline text-foreground">{footer.addressLabel}: </dt>
              <dd className="inline">{footer.address}</dd>
            </div>
            <div>
              <dt className="inline text-foreground">{footer.phoneLabel}: </dt>
              <dd className="inline">{phone}</dd>
            </div>
            <div>
              <dd>{footer.email}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        © {year} {siteName}. {footer.rights}
      </div>
    </footer>
  );
}
