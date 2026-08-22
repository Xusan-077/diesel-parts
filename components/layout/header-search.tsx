"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

interface HeaderSearchProps {
  lang: Locale;
  header: Dictionary["header"];
  /** Shown in a row whose part has no price yet. */
  requestPriceLabel: string;
  /** The phone's dialog opens straight into typing. */
  autoFocus?: boolean;
  /** Lets that dialog close itself once the visitor has gone somewhere. */
  onNavigate?: () => void;
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
  autoFocus = false,
  onNavigate,
  className,
}: HeaderSearchProps) {
  const router = useRouter();
  const listId = useId();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(NO_SUGGESTION);

  const debounced = useDebouncedValue(query, SUGGEST_DEBOUNCE_MS);
  // The panel follows what has been typed; the rows follow what was asked for.
  // Splitting them is what keeps a cleared field from showing stale results.
  const asking = isSuggestible(debounced);
  const showing = open && isSuggestible(query);

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

  function leave(href: string) {
    setOpen(false);
    setActive(NO_SUGGESTION);
    onNavigate?.();
    router.push(href);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = items[active];
    leave(chosen ? productHref(chosen.slug) : searchResultsHref(query));
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
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showing && active !== NO_SUGGESTION ? `${listId}-${active}` : undefined
          }
          // The same ring the panel's fields wear: a border in `accent-strong`
          // with a 2px solid stop hard against it. The bare `focus:border-accent`
          // this replaces was a 1px change at 2.56:1 on white, which is under
          // what a focus indicator owes — it only ever read as focused because
          // an unlayered rule was drawing a black outline over the top of it.
          className="h-10 w-full rounded-md border border-chrome-border-strong bg-chrome-surface pl-9 pr-9 text-sm text-chrome-foreground outline-none transition-[border-color,box-shadow] placeholder:text-chrome-muted focus:border-chrome-accent focus:shadow-[0_0_0_2px_var(--chrome-accent)]"
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

      {showing ? (
        <div
          // Keeping focus in the field means the panel cannot close itself out
          // from under the click that is about to land on one of its rows.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-2xl"
        >
          <ul id={listId} role="listbox" aria-label={header.searchSuggestions}>
            {items.map((product, index) => {
              const price = formatPrice(product.price, lang);
              return (
                <li key={product.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                  <Link
                    href={productHref(product.slug)}
                    onClick={() => {
                      setOpen(false);
                      setActive(NO_SUGGESTION);
                      onNavigate?.();
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      rowClass,
                      index === active ? "bg-surface-hover" : "hover:bg-surface-hover"
                    )}
                  >
                    {/*
                      The catalog stores a caption per photograph, not the
                      photograph — so the tile carries the caption, exactly as
                      a product card does. It becomes a picture on the day the
                      pictures arrive, and the row does not change shape.
                    */}
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-hover text-[10px] leading-tight text-muted"
                    >
                      {product.imageLabels[0]}
                    </span>

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
              onClick={() => {
                setOpen(false);
                setActive(NO_SUGGESTION);
                onNavigate?.();
              }}
              className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-sm text-accent-strong transition-colors hover:bg-surface-hover"
            >
              {header.searchViewAll}
              <span className="tabular-nums text-muted">{total}</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
