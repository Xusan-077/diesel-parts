import Link from "next/link";
import { FeatureIcon } from "@/components/marketing/feature-icon";
import { Container } from "@/components/ui/container";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * TODO(Xusan): replace with the real office coordinates. These point at the
 * centre of Tashkent purely as a placeholder.
 * Format: ll=<longitude>,<latitude>&z=<zoom>
 */
const MAP_EMBED_URL =
  "https://yandex.uz/map-widget/v1/?ll=69.240562%2C41.311081&z=15";

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
    <footer className="border-t border-border bg-background">
      <Container className="grid gap-10 py-16 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{siteName}</p>
          <p className="mt-3 max-w-sm text-sm text-muted">{footer.description}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{footer.linksTitle}</p>
          <ul className="mt-1">
            {links.map((link) => (
              <li key={link.href}>
                {/* inline-block + py keeps the hit area at the 24px minimum
                    without spreading the list out on desktop. */}
                <Link
                  href={link.href}
                  className="inline-block py-1.5 text-sm text-muted transition-colors hover:text-foreground"
                >
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
              {/* Was plain text — on mobile the number is the primary action. */}
              <dd className="inline">
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="transition-colors hover:text-foreground"
                >
                  {phone}
                </a>
              </dd>
            </div>
            <div>
              <dd>
                <a
                  href={`mailto:${footer.email}`}
                  className="inline-block py-1 transition-colors hover:text-foreground"
                >
                  {footer.email}
                </a>
              </dd>
            </div>
            {/* TODO(Xusan): replace with the real opening hours. */}
            <div>
              <dt className="inline text-foreground">{footer.hoursTitle}: </dt>
              <dd className="inline">{footer.hours}</dd>
            </div>
          </dl>
        </div>
      </Container>

      <Container className="pb-12">
        <p className="text-sm font-semibold text-foreground">{footer.mapTitle}</p>
        {/*
          The address sits behind the iframe, so a map that fails to load
          (blocked network, offline) leaves something useful rather than a
          blank rectangle.
        */}
        <div className="relative mt-4 h-64 overflow-hidden rounded-lg border border-border bg-surface-muted">
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
            {footer.address}
          </p>
          <iframe
            src={MAP_EMBED_URL}
            title={footer.mapAlt}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="relative h-full w-full border-0"
          />
        </div>
      </Container>

      <Container className="pb-12">
        <p className="text-sm font-semibold text-foreground">{footer.paymentTitle}</p>
        <ul className="mt-4 flex flex-wrap gap-3">
          {payment.methods.map((method) => (
            <li
              key={method.title}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-muted"
            >
              <FeatureIcon icon={method.icon} className="text-accent-strong" />
              {method.title}
            </li>
          ))}
        </ul>
      </Container>

      <div className="border-t border-border">
        <Container className="py-6 text-center text-xs text-muted">
          © {year} {siteName}. {footer.rights}
        </Container>
      </div>
    </footer>
  );
}
