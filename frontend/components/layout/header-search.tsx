"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { BadgePercent, Flame, History, Loader2, Search, Sparkles } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product/product-image";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchHistory } from "@/hooks/use-store";
import { fetchProducts } from "@/lib/api/products";
import { formatPrice } from "@/lib/format-price";
import {
  isSuggestible,
  moveActive,
  NO_SUGGESTION,
  productHref,
  searchResultsHref,
  SUGGEST_DEBOUNCE_MS,
  SUGGESTION_LIMIT,
} from "@/lib/search-suggest";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The shortcuts offered before a visitor has typed anything: real, working
 * destinations rather than filters the catalog cannot actually apply.
 *
 * The catalog page reads only `q`, `group` and `category` from its URL — sort
 * and availability are client-only state (see `product-catalog-client.tsx`),
 * so a link like `/products?sort=bestseller` would silently do nothing. These
 * three instead jump to the home page's own curated rows, which already carry
 * real data — and carry the *same* label the row itself uses, so a chip never
 * promises something the section it lands on does not say.
 */
const HOT_OFFERS = [
  { key: "popular", href: "/#popular", icon: BadgePercent } as const,
  { key: "newest", href: "/#newest", icon: Sparkles } as const,
  { key: "bestSellers", href: "/#best-sellers", icon: Flame } as const,
];

/** The home page's own row titles, reused so a chip's label matches its landing section. */
export interface HotOfferLabels {
  popular: string;
  bestSellers: string;
  newest: string;
}

interface HeaderSearchProps {
  lang: Locale;
  header: Dictionary["header"];
  /** Shown in a row whose part has no price yet. */
  requestPriceLabel: string;
  hotOfferLabels: HotOfferLabels;
  /** The phone's dialog opens straight into typing. */
  autoFocus?: boolean;
  /** Lets that dialog close itself once the visitor has gone somewhere. */
  onNavigate?: () => void;
  /**
   * True inside the phone's full-width dialog, where the panel needs a dark
   * backdrop over the page and has to reach edge to edge instead of sitting
   * inset under the field like the desktop bar's dropdown does.
   */
  overlay?: boolean;
  className?: string;
}

/**
 * The header's search field, and the six parts it offers while you type.
 *
 * The dropdown is a shortcut, not a second catalog. Six rows, each a part the
 * query already matched, and every other route out of it — Enter, "see all",
 * an empty result — lands on `/products?q=`, which is where the filters,
 * the sort and the paging live. Rebuilding any of that inside a 400px panel
 * hanging off the header would be building the catalog twice.
 *
 * A row is the part's placeholder tile, its name and its price, because those
 * are what tell a buyer whether to stop scrolling. The catalog cards use the
 * same three, so a row here and a card there are recognisably the same part.
 */
export function HeaderSearch({
  lang,
  header,
  requestPriceLabel,
  hotOfferLabels,
  autoFocus = false,
  onNavigate,
  overlay = false,
  className,
}: HeaderSearchProps) {
  const router = useRouter();
  const listId = useId();
  const { terms: history, add: addHistoryTerm } = useSearchHistory();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(NO_SUGGESTION);

  const debounced = useDebouncedValue(query, SUGGEST_DEBOUNCE_MS);
  // The panel follows what has been typed; the rows follow what was asked for.
  // Splitting them is what keeps a cleared field from showing stale results.
  const asking = isSuggestible(debounced);
  const showingSuggestions = open && isSuggestible(query);
  /*
   * Below the length worth a request, the field is not empty of ideas — it
   * offers what was searched for before and three fixed shortcuts, so opening
   * the field is never a dead end while nothing has been typed yet.
   */
  const showingQuickPicks = open && !isSuggestible(query);
  const showing = showingSuggestions || showingQuickPicks;

  const { data, isFetching } = useQuery({
    queryKey: ["search-suggestions", debounced.trim(), lang] as const,
    queryFn: () =>
      fetchProducts({
        q: debounced.trim(),
        page: 1,
        pageSize: SUGGESTION_LIMIT,
        lang,
      }),
    enabled: asking,
    // Holding the previous rows while the next ones land keeps the panel from
    // blanking on every keystroke that clears the debounce.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const items = asking ? (data?.items ?? []) : [];
  const total = asking ? (data?.total ?? 0) : 0;
  const pending = asking && isFetching && items.length === 0;
  const empty = asking && !isFetching && items.length === 0;

  /**
   * Closes the panel on the way out. Every exit from the field goes through
   * here, so nothing forgets to reset the highlight or notify the mobile
   * dialog it can close itself.
   *
   * `term` is what gets remembered as a search: the typed query for a
   * submission or a suggestion click, the chip's own text for a re-run from
   * history, and nothing at all for a hot-offer shortcut, which was never
   * typed and is not a search.
   */
  function close(term?: string) {
    if (term && isSuggestible(term)) {
      addHistoryTerm(term);
    }
    setOpen(false);
    setActive(NO_SUGGESTION);
    onNavigate?.();
  }

  /** `close` plus the navigation a `<Link>` gets for free from its `href`. */
  function leave(href: string, term?: string) {
    close(term);
    router.push(href);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = items[active];
    leave(chosen ? productHref(chosen.slug) : searchResultsHref(query), query);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // Otherwise the caret jumps to one end of the field on the way past.
      event.preventDefault();
      setOpen(true);
      setActive((current) => moveActive(current, items.length, event.key === "ArrowUp" ? -1 : 1));
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActive(NO_SUGGESTION);
    }
  }

  const rowClass =
    "flex items-center gap-3 px-3 py-2.5 text-left transition-colors";

  return (
    <div
      className={cn("relative", className)}
      // Closes on a click outside and on tabbing away, and stays open while
      // focus is still somewhere inside the panel.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <form role="search" onSubmit={handleSubmit}>
        <Icon
          icon={Search}
          className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-chrome-muted"
        />
        <input
          type="search"
          role="combobox"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            // A new query invalidates a highlight taken against the old one.
            setActive(NO_SUGGESTION);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={header.searchPlaceholder}
          aria-label={header.searchLabel}
          aria-expanded={showing}
          aria-controls={showingSuggestions ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            showingSuggestions && active !== NO_SUGGESTION ? `${listId}-${active}` : undefined
          }
          // The same ring the panel's fields wear: a border in `accent-strong`
          // with a 2px solid stop hard against it, plus the soft
          // `chrome-accent-halo` bloom the rest of the site's fields wear too
          // (see `--field-halo` in globals.css) — the solid ring alone read as
          // too hard-edged for how bright `--chrome-accent` is. The bare
          // `focus:border-accent` this replaced was a 1px change at 2.56:1 on
          // white, which is under what a focus indicator owes — it only ever
          // read as focused because an unlayered rule was drawing a black
          // outline over the top of it.
          //
          // `text-base` below `lg` (the breakpoint this field is a full-screen
          // mobile dialog below, and the desktop bar from) — iOS Safari zooms
          // the whole page in on focus of any input under 16px, and `text-sm`
          // is 14px. `lg:text-sm` restores the tighter desktop size, where
          // there is no touch keyboard to trigger the zoom.
          className="h-10 w-full rounded-md border border-chrome-border-strong bg-chrome-surface pl-9 pr-9 text-base text-chrome-foreground outline-none transition-[border-color,box-shadow] placeholder:text-chrome-muted focus:border-chrome-accent focus:shadow-[0_0_0_2px_var(--chrome-accent),0_0_0_6px_var(--chrome-accent-halo)] lg:text-sm"
        />
        {pending ? (
          <Icon
            icon={Loader2}
            aria-hidden={false}
            aria-label={header.searchLoading}
            className="pointer-events-none absolute right-3 top-5 -translate-y-1/2 animate-spin text-chrome-muted"
          />
        ) : null}
      </form>

      {/*
        On the phone dialog the panel sits over live product cards, not empty
        chrome, so it gets its own backdrop rather than borrowing the
        dialog's — Radix's `Dialog.Overlay` is tied to the dialog's own
        `open`, which flips the instant the bar slides in, a beat before
        there is anything under it worth dimming. This one is tied to
        `showing`, the same state the panel itself uses, so the two always
        appear and disappear together. A tap on it closes exactly like the
        dialog's own close button — through `close()`, so the dropdown, the
        backdrop and the mobile bar all go away in one gesture.
      */}
      {overlay ? (
        <AnimatePresence>
          {showing ? (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={MOTION.pop}
              onClick={() => close()}
              className="fixed inset-0 z-40 bg-black/50"
            />
          ) : null}
        </AnimatePresence>
      ) : null}

      <AnimatePresence>
        {showing ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={MOTION.pop}
            // Keeping focus in the field means the panel cannot close itself
            // out from under the click that is about to land on one of its
            // rows.
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "z-50 overflow-y-auto border border-border bg-surface-elevated shadow-2xl",
              // The overlay variant is `fixed` to the viewport rather than
              // `absolute` to the field, so it reaches both screen edges
              // instead of sitting inset the way the field itself is — and
              // `top-16` (the bar's own height: two 40px controls in 12px of
              // padding) is what lines its top up flush under that bar rather
              // than floating half a rem below it like the desktop dropdown.
              overlay
                ? "fixed inset-x-0 top-16 max-h-[calc(100vh-4rem)] border-t-0"
                : "absolute inset-x-0 top-[calc(100%+0.5rem)] max-h-[70vh] rounded-lg"
            )}
          >
            {showingSuggestions ? (
              <>
                <ul id={listId} role="listbox" aria-label={header.searchSuggestions}>
                  {items.map((product, index) => {
                    const price = formatPrice(product.price, lang);
                    return (
                      <li key={product.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                        <Link
                          href={productHref(product.slug)}
                          onClick={() => close(query)}
                          onMouseEnter={() => setActive(index)}
                          className={cn(
                            rowClass,
                            index === active ? "bg-surface-hover" : "hover:bg-surface-hover"
                          )}
                        >
                          <ProductImage
                            src={product.imageUrl}
                            alt=""
                            fallbackIconSize="sm"
                            className="h-11 w-11 shrink-0 rounded-md"
                          />

                          {/* Two lines rather than an ellipsis: on a phone the name
                              is the only thing distinguishing "Doosan DX140…" from
                              "Doosan DX225…", and it is the half that gets cut. */}
                          <span className="min-w-0 flex-1 text-sm leading-snug text-foreground line-clamp-2">
                            {product.name[lang]}
                          </span>

                          <span
                            className={cn(
                              "shrink-0 text-sm tabular-nums",
                              price ? "font-medium text-foreground" : "text-accent-strong"
                            )}
                          >
                            {price ?? requestPriceLabel}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {empty ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">{header.searchEmpty}</p>
                ) : null}

                {pending ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">{header.searchLoading}</p>
                ) : null}

                {items.length > 0 ? (
                  <Link
                    href={searchResultsHref(query)}
                    onClick={() => close(query)}
                    className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-sm text-accent-strong transition-colors hover:bg-surface-hover"
                  >
                    {header.searchViewAll}
                    <span className="tabular-nums text-muted">{total}</span>
                  </Link>
                ) : null}
              </>
            ) : (
              <div className="py-1">
                {/*
                  `pb-2` / `pt-2` either side of the divider rather than each
                  block keeping a full `py-3` of its own — two full paddings
                  stacked around the border read as a noticeably bigger gap
                  than the `py-1` + `py-3` either end of the panel gets, even
                  though each side was "correct" on its own.
                */}
                <div className="px-3 pt-3 pb-2">
                  <p className="type-eyebrow text-muted">{header.searchHistoryTitle}</p>
                  {history.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">{header.searchHistoryEmpty}</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {history.map((term) => (
                        <li key={term}>
                          <Link
                            href={searchResultsHref(term)}
                            onClick={() => close(term)}
                            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
                          >
                            <Icon icon={History} size="xs" className="text-muted" />
                            {term}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-border px-3 pt-2 pb-3">
                  <p className="type-eyebrow text-muted">{header.searchHotOffersTitle}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {HOT_OFFERS.map((offer) => (
                      <Link
                        key={offer.key}
                        href={offer.href}
                        onClick={() => close()}
                        // Chip labels are the home page's own row titles now
                        // (see the note above `HOT_OFFERS`), which run longer
                        // than the marketing words this replaced — `items-start`
                        // and no `truncate` so "Eng ko'p sotiladiganlar" wraps
                        // onto a second line instead of losing its tail.
                        // `min-h-16` covers a two-line label so that card isn't
                        // the only one of the three not matched by CSS grid's
                        // own row-stretch — the odd one out sits alone in the
                        // second row, which stretch can't reach.
                        className="flex min-h-16 items-start gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
                      >
                        <Icon icon={offer.icon} size="sm" className="mt-0.5 shrink-0 text-accent-strong" />
                        <span className="leading-snug">{hotOfferLabels[offer.key]}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
