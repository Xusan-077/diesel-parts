"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { Home, LayoutGrid, ScanSearch, Search, ShoppingCart, User, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useCart, useSearchHistory } from "@/hooks/use-store";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { isHeaderCondensed } from "@/lib/scroll-direction";
import { isNavItemActive } from "@/lib/nav";
import { searchResultsHref } from "@/lib/search-suggest";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The storefront's bottom navigation on a phone.
 *
 * Four flat tabs and one raised centre button. It exists only below `lg`,
 * where the header is a logo, a hamburger and a search icon — the three-row
 * nav with every section spelled out does not appear until `lg`, so a phone
 * has no always-visible way to Home, the catalog, the cart or the cabinet
 * without opening the drawer first. Desktop keeps that header untouched.
 *
 * It is the same dark material as the header and the footer — `--chrome`
 * (#151719 in both themes) with the marketing accent (`--chrome-accent` for
 * the active tab, the brand red `--accent` on the centre button, the same
 * fill every primary button on the site wears). No palette of its own; a
 * `border-t` and an upward shadow are what separate it from the footer when
 * it floats over it.
 *
 * The centre button is a part-number search, not a fifth destination. Diesel
 * buyers almost always arrive holding the OEM number stamped on the part that
 * failed, and that is a different job from browsing: one field, framed around
 * the number, dropping the shopper straight onto the filtered results page
 * (`/products?q=`). The catalog's own search already matches codes, so this is
 * a faster door to it rather than a new mechanism. It is text entry, never the
 * camera — the numbers are usually read off an invoice or a photo, not a
 * legible label on the part.
 *
 * Hide-on-scroll follows the header exactly (`useScrollDirection` +
 * `isHeaderCondensed`): gone while the shopper reads downward, back the moment
 * they scroll up or reach the top. `transform` only, so the page layout never
 * moves; `prefers-reduced-motion` flattens the transition in globals.css. The
 * scroll tracker is remounted per route (`key={pathname}` on the inner
 * component) so a fresh page always starts with the bar shown — the hook
 * keeps its state across client navigations, and Next's scroll-to-top does
 * not reliably produce a scroll event it could read.
 *
 * It stays out of the way on `/cart` and `/checkout`, which pin their own
 * total-and-continue bar to the same edge — during checkout a jump to the
 * catalog is not what the thumb is reaching for anyway.
 */

interface MobileTabBarProps {
  nav: Dictionary["nav"];
  header: Dictionary["header"];
  mobileNav: Dictionary["mobileNav"];
  closeLabel: string;
}

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Routes that carry their own bottom bar; the tab bar yields to it. */
function hasOwnBottomBar(pathname: string): boolean {
  return isNavItemActive(pathname, "/cart") || isNavItemActive(pathname, "/checkout");
}

export function MobileTabBar(props: MobileTabBarProps) {
  const pathname = usePathname();

  if (hasOwnBottomBar(pathname)) {
    return null;
  }

  // Keyed by route: remounts the scroll tracker on every navigation so the bar
  // is always shown on a fresh page rather than inheriting the hidden state
  // from wherever the shopper was on the previous one.
  return <MobileTabBarInner key={pathname} pathname={pathname} {...props} />;
}

function MobileTabBarInner({
  pathname,
  nav,
  header,
  mobileNav,
  closeLabel,
}: MobileTabBarProps & { pathname: string }) {
  const router = useRouter();
  const cart = useCart();
  const condensed = isHeaderCondensed(useScrollDirection());

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { terms: history, add: addHistoryTerm } = useSearchHistory();

  const leading: Tab[] = [
    { href: "/", label: nav.home, icon: Home },
    { href: "/products", label: header.catalog, icon: LayoutGrid },
  ];
  const trailing: Tab[] = [
    { href: "/cart", label: header.cart, icon: ShoppingCart },
    { href: "/account", label: header.account, icon: User },
  ];

  const cartCount = cart.lineCount;
  const cartCountLabel = cartCount > 99 ? "99+" : String(cartCount);

  function runSearch(term: string) {
    const trimmed = term.trim();
    if (trimmed.length === 0) {
      inputRef.current?.focus();
      return;
    }
    addHistoryTerm(trimmed);
    setSearchOpen(false);
    setQuery("");
    router.push(searchResultsHref(trimmed));
  }

  function renderTab({ href, label, icon }: Tab) {
    const active = isNavItemActive(pathname, href);
    const isCart = href === "/cart";
    const showBadge = isCart && cartCount > 0;

    return (
      <li key={href} className="flex flex-1">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          aria-label={showBadge ? `${label}, ${cartCountLabel}` : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 rounded-md py-2 text-[11px] font-medium leading-none outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-chrome-accent",
            active ? "text-chrome-accent" : "text-chrome-secondary hover:text-chrome-foreground"
          )}
        >
          <span className="relative">
            <Icon icon={icon} size="md" />
            {showBadge ? (
              <span
                aria-hidden
                className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground ring-2 ring-[color:var(--chrome)]"
              >
                {cartCountLabel}
              </span>
            ) : null}
          </span>
          <span>{label}</span>
        </Link>
      </li>
    );
  }

  return (
    <>
      {/* Reserves the bar's footprint at the foot of the page so a fixed bar
          never covers the last of the footer. Zero on desktop — see
          `--mobile-tabbar-clearance` in globals.css. */}
      <div
        aria-hidden
        className="lg:hidden"
        style={{ height: "var(--mobile-tabbar-clearance)" }}
      />

      <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
        <nav
          aria-label={mobileNav.label}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t border-chrome-border bg-chrome lg:hidden",
            "pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-14px_rgb(0_0_0/0.7)]",
            "transition-transform duration-300 ease-out",
            condensed && "translate-y-[calc(100%+2rem)]"
          )}
        >
          <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
            {leading.map(renderTab)}

            <li className="flex flex-1 items-center justify-center">
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  aria-label={mobileNav.searchAction}
                  className={cn(
                    "-translate-y-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground outline-none",
                    "ring-4 ring-[color:var(--chrome)]",
                    "shadow-[0_8px_22px_-4px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
                    "transition-transform hover:-translate-y-6",
                    "focus-visible:ring-accent-foreground",
                    "motion-reduce:transition-none motion-reduce:hover:-translate-y-5"
                  )}
                >
                  <Icon icon={ScanSearch} size="lg" />
                </button>
              </Dialog.Trigger>
            </li>

            {trailing.map(renderTab)}
          </ul>
        </nav>

        <Dialog.Portal forceMount>
          <AnimatePresence>
            {searchOpen ? (
              <>
                <Dialog.Overlay asChild forceMount key="overlay">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={MOTION.fade}
                    className="fixed inset-0 z-100 bg-black/60"
                  />
                </Dialog.Overlay>

                <Dialog.Content
                  asChild
                  forceMount
                  key="sheet"
                  onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    inputRef.current?.focus();
                  }}
                >
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={MOTION.drawer}
                    className="fixed inset-x-0 bottom-0 z-100 rounded-t-2xl border-t border-chrome-border bg-chrome pb-[max(1.5rem,env(safe-area-inset-bottom))] text-chrome-foreground shadow-[0_-24px_56px_-12px_rgb(0_0_0/0.7)]"
                  >
                    <div className="mx-auto max-w-md px-4 pt-3">
                      <span
                        aria-hidden
                        className="mx-auto mb-3 block h-1 w-9 rounded-full bg-chrome-border-strong"
                      />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Dialog.Title className="text-base font-semibold text-chrome-foreground">
                            {mobileNav.searchTitle}
                          </Dialog.Title>
                          <Dialog.Description className="mt-1 text-[0.8125rem] leading-snug text-chrome-secondary">
                            {mobileNav.searchHint}
                          </Dialog.Description>
                        </div>
                        <Dialog.Close
                          aria-label={closeLabel}
                          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-chrome-secondary outline-none transition-colors hover:bg-chrome-hover hover:text-chrome-foreground focus-visible:ring-2 focus-visible:ring-chrome-accent"
                        >
                          <Icon icon={X} size="lg" />
                        </Dialog.Close>
                      </div>

                      <form
                        role="search"
                        className="mt-4 flex gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          runSearch(query);
                        }}
                      >
                        <span className="relative min-w-0 flex-1">
                          <Icon
                            icon={Search}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chrome-muted"
                          />
                          <input
                            ref={inputRef}
                            type="search"
                            name="q"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            inputMode="search"
                            enterKeyHint="search"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            aria-label={mobileNav.searchTitle}
                            placeholder={mobileNav.searchPlaceholder}
                            className="h-11 w-full rounded-md border border-chrome-border-strong bg-chrome-surface pl-9 pr-3 text-base text-chrome-foreground outline-none transition-[border-color,box-shadow] placeholder:text-chrome-muted focus:border-chrome-accent focus:shadow-[0_0_0_2px_var(--chrome-accent),0_0_0_6px_var(--chrome-accent-halo)]"
                          />
                        </span>
                        <button
                          type="submit"
                          className="h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground outline-none transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-chrome-accent focus-visible:ring-offset-2 focus-visible:ring-offset-chrome"
                        >
                          {mobileNav.searchSubmit}
                        </button>
                      </form>

                      {history.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-chrome-muted">
                            {mobileNav.recentTitle}
                          </p>
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {history.map((term) => (
                              <li key={term}>
                                <button
                                  type="button"
                                  onClick={() => runSearch(term)}
                                  className="flex items-center gap-1.5 rounded-full border border-chrome-border bg-chrome-surface px-3 py-1.5 text-sm text-chrome-foreground outline-none transition-colors hover:border-chrome-accent hover:text-chrome-accent focus-visible:ring-2 focus-visible:ring-chrome-accent"
                                >
                                  {term}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                </Dialog.Content>
              </>
            ) : null}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
