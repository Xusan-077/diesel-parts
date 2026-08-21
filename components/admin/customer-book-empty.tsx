import Link from "next/link";

/**
 * The empty customer book.
 *
 * Drawn rather than shrugged at, because this screen is empty exactly once —
 * on a seller's first day — and that is the moment to say what the book is for.
 *
 * The mark is a card index with its first card still blank: the thing this page
 * replaces, and the thing a parts shop actually ran on before it. Hairline
 * strokes and a single accent edge on the left of the front card, which is the
 * same device the inquiry board uses to ink a lead by age — the two seller
 * screens are meant to look like one tool.
 */
function CardIndexMark() {
  return (
    <svg
      viewBox="0 0 168 108"
      role="img"
      aria-label="Bo'sh mijozlar kartotekasi"
      className="h-[6.75rem] w-42 text-border"
      fill="none"
    >
      {/* Two filed cards behind, receding. Never the focus, so they fade. */}
      <rect x="28.5" y="12.5" width="118" height="66" rx="3" stroke="currentColor" opacity="0.4" />
      <rect x="22.5" y="20.5" width="118" height="66" rx="3" stroke="currentColor" opacity="0.7" />

      {/* The card waiting to be written. Dashed: it is a slot, not a record. */}
      <rect
        x="16.5"
        y="28.5"
        width="118"
        height="66"
        rx="3"
        stroke="currentColor"
        strokeDasharray="4 4"
      />
      <path
        d="M18.5 28.5h-2v66h2"
        className="text-accent-strong"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Where a name and a number would go. The number's rule is dotted the
          way a phone number is grouped, which is the only hint of what belongs
          on the line. */}
      <path d="M32 52h58" stroke="currentColor" opacity="0.55" />
      <path
        d="M32 68h10M46 68h16M66 68h10M80 68h10"
        stroke="currentColor"
        opacity="0.55"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Copy differs by why the list is empty, because the answer differs. A seller
 * with no book needs to know where customers come from; a seller whose search
 * missed needs their search back.
 */
export function CustomerBookEmpty() {
  return (
    <div className="border-t border-border py-12 text-center">
      <div className="flex justify-center">
        <CardIndexMark />
      </div>

      <p className="mt-6 text-sm font-medium text-foreground">
        Mijozlar kitobingiz hali bo&apos;sh
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Bu yerda faqat sizga biriktirilgan mijozlar turadi. Birinchisini qo&apos;lda
        qo&apos;shing yoki so&apos;rovlar taxtasidagi kartadan saqlang — ism va telefon
        o&apos;zi ko&apos;chadi.
      </p>

      <Link
        href="/admin/seller/inquiries"
        className="mt-4 inline-block text-sm text-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
      >
        So&apos;rovlar taxtasiga o&apos;tish
      </Link>
    </div>
  );
}
