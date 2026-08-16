import type { Locale } from "@/lib/i18n/locales";

/**
 * Inline SVG flags. Emoji flags are not rendered on Windows, so the locale
 * switcher draws them instead of relying on the regional-indicator glyphs.
 */
export function FlagIcon({ locale, className }: { locale: Locale; className?: string }) {
  const shared = {
    className,
    viewBox: "0 0 60 30",
    role: "presentation" as const,
    "aria-hidden": true,
  };

  if (locale === "uz") {
    return (
      <svg {...shared}>
        <rect width="60" height="30" fill="#fff" />
        <rect width="60" height="9.5" fill="#0099b5" />
        <rect y="20.5" width="60" height="9.5" fill="#1eb53a" />
        <rect y="9" width="60" height="1" fill="#ce1126" />
        <rect y="20" width="60" height="1" fill="#ce1126" />
        <circle cx="12" cy="5" r="3" fill="#fff" />
        <circle cx="13.6" cy="4.4" r="3" fill="#0099b5" />
      </svg>
    );
  }

  if (locale === "ru") {
    return (
      <svg {...shared}>
        <rect width="60" height="10" fill="#fff" />
        <rect y="10" width="60" height="10" fill="#0039a6" />
        <rect y="20" width="60" height="10" fill="#d52b1e" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <clipPath id="flag-gb-diagonals">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath="url(#flag-gb-diagonals)"
        stroke="#c8102e"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
