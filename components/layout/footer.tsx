import Link from "next/link";
import { FeatureIcon } from "@/components/marketing/feature-icon";
import { BrandMark } from "@/components/layout/brand-mark";
import { Container } from "@/components/ui/container";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface FooterProps {
  siteName: string;
  footer: Dictionary["footer"];
  nav: Dictionary["nav"];
  payment: Dictionary["payment"];
  phone: string;
}

export function Footer({ siteName, footer, nav, payment, phone }: FooterProps) {
  const year = new Date().getFullYear();

  const links = [
    { href: "/products", label: nav.products },
    { href: "/about", label: nav.about },
    { href: "/blog", label: nav.blog },
    { href: "/contact", label: nav.contact },
  ];

  return (
    <footer className="border-t border-chrome-border bg-chrome">
      <Container className="grid gap-10 py-16 md:grid-cols-3">
        <div className="text-chrome-foreground">
          {/*
            The same lockup as the header's, at the same size, so the frame
            closes on the mark it opened with. It is not a link: it would
            point at the page the visitor is already reading from, and the
            nav column below already carries the routes.
          */}
          <div className="flex items-center gap-2">
            <BrandMark className="h-8" />
            <p className="text-lg font-semibold tracking-tight">{siteName}</p>
          </div>
          <p className="mt-3 max-w-sm text-sm text-chrome-secondary">{footer.description}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-chrome-foreground">{footer.linksTitle}</p>
          <ul className="mt-1">
            {links.map((link) => (
              <li key={link.href}>
                {/* inline-block + py keeps the hit area at the 24px minimum
                    without spreading the list out on desktop. */}
                <Link
                  href={link.href}
                  className="inline-block py-1.5 text-sm text-chrome-secondary transition-colors hover:text-chrome-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-chrome-foreground">{footer.contactTitle}</p>
          <dl className="mt-3 space-y-2 text-sm text-chrome-secondary">
            <div>
              <dt className="inline text-chrome-foreground">{footer.addressLabel}: </dt>
              <dd className="inline">{footer.address}</dd>
            </div>
            <div>
              <dt className="inline text-chrome-foreground">{footer.phoneLabel}: </dt>
              {/* Was plain text — on mobile the number is the primary action. */}
              <dd className="inline">
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="transition-colors hover:text-chrome-foreground"
                >
                  {phone}
                </a>
              </dd>
            </div>
            <div>
              <dd>
                <a
                  href={`mailto:${footer.email}`}
                  className="inline-block py-1 transition-colors hover:text-chrome-foreground"
                >
                  {footer.email}
                </a>
              </dd>
            </div>
            {/* TODO(Xusan): replace with the real opening hours. */}
            <div>
              <dt className="inline text-chrome-foreground">{footer.hoursTitle}: </dt>
              <dd className="inline">{footer.hours}</dd>
            </div>
          </dl>
        </div>
      </Container>

      <Container className="pb-12">
        <p className="text-sm font-semibold text-chrome-foreground">{footer.paymentTitle}</p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {payment.methods.map((method) => (
            <li
              key={method.title}
              className="flex items-center gap-2 rounded-md border border-chrome-border bg-chrome-surface px-3 py-2 text-xs text-chrome-secondary"
            >
              <FeatureIcon icon={method.icon} className="text-chrome-accent" />
              {method.title}
            </li>
          ))}
        </ul>
      </Container>

      <div className="border-t border-chrome-border">
        <Container className="py-6 text-center text-xs text-chrome-muted">
          © {year} {siteName}. {footer.rights}
        </Container>
      </div>
    </footer>
  );
}
