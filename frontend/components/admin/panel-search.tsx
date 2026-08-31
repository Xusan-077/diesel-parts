"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import type { NavGroupView } from "./panel-nav";

/**
 * Whether this machine's modifier is Command or Control.
 *
 * Read from the platform string rather than from a key event, because the hint
 * has to be printed on the button before anyone has pressed anything. Unknown
 * platforms get Ctrl, which is the safer guess: a Mac user who sees "Ctrl"
 * still finds the field, and both bindings are live regardless.
 *
 * `useSyncExternalStore` rather than an effect writing state. The platform
 * never changes, so `subscribe` is a no-op; what the hook is actually buying
 * is the server snapshot — React renders "Ctrl" into the HTML, hydrates
 * against it, and only then swaps in the browser's answer, which is the one
 * shape that cannot produce a mismatch.
 */
const NO_CHANGES = () => () => {};

function readModifier(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
}

function serverModifier(): string {
  return "Ctrl";
}

function useModifierLabel(): string {
  return useSyncExternalStore(NO_CHANGES, readModifier, serverModifier);
}

interface Hit {
  href: string;
  label: string;
  group: string;
}

/**
 * Jump to a section by typing its name.
 *
 * Deliberately a section jumper and not a catalogue search. The panel already
 * has a product search on the products page and a customer search on the
 * customer book, both of which query the database; a second field in the
 * chrome that searched everything would duplicate them and be slower than
 * either. What the chrome is missing is the thing a keyboard user reaches for
 * on every ERP — a way to get to a screen without aiming at the sidebar — and
 * that is what this is.
 *
 * Matching is a plain substring on the label, in the language the panel is
 * currently in, because the list is at most eleven entries. Anything cleverer
 * would be a ranking function nobody could predict over a set small enough to
 * read.
 */
export function PanelSearch({
  groups,
  placeholder,
  title,
  emptyLabel,
  hint,
}: {
  groups: NavGroupView[];
  placeholder: string;
  title: string;
  emptyLabel: string;
  hint: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const modifier = useModifierLabel();

  const all = useMemo<Hit[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.label })),
      ),
    [groups],
  );

  const hits = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle === ""
      ? all
      : all.filter((hit) => hit.label.toLocaleLowerCase().includes(needle));
  }, [all, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        // The browser's own bindings for ⌘K/Ctrl+K are a focus-the-address-bar
        // shortcut in some builds, so this has to claim the event outright.
        event.preventDefault();
        setOpen((was) => !was);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(hit: Hit | undefined) {
    if (!hit) {
      return;
    }
    setOpen(false);
    router.push(hit.href);
  }

  function onFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((was) => {
        const next = event.key === "ArrowDown" ? was + 1 : was - 1;
        // Wraps, so a keyboard user reaches the last entry by pressing up once
        // instead of holding down through the whole list.
        return (next + hits.length) % Math.max(hits.length, 1);
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      go(hits[cursor]);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setCursor(0);
        }
      }}
    >
      <Dialog.Trigger
        className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-left text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground sm:max-w-xs"
      >
        <Icon icon={Search} size="sm" />
        <span className="truncate">{placeholder}</span>
        {/* The shortcut printed on the control that answers it. Hidden on a
            phone, where there is no keyboard to press it with. */}
        <kbd className="ms-auto hidden shrink-0 rounded-sm border border-border bg-surface px-1 font-mono text-[0.625rem] text-muted sm:block">
          {modifier}K
        </kbd>
      </Dialog.Trigger>

      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={MOTION.fade}
                  className="fixed inset-0 z-100 bg-background/80 backdrop-blur-sm"
                />
              </Dialog.Overlay>

              <Dialog.Content
                asChild
                forceMount
                key="palette"
                aria-describedby={undefined}
                // The field carries autoFocus; without this Radix focuses the
                // dialog itself and the first keystroke is swallowed.
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={MOTION.pop}
                  className="fixed inset-x-4 top-16 z-100 mx-auto max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
                >
                  <Dialog.Title className="sr-only">{title}</Dialog.Title>

                  <div className="flex items-center gap-3 border-b border-border px-4">
                    <Icon icon={Search} size="sm" className="text-muted" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setCursor(0);
                      }}
                      onKeyDown={onFieldKeyDown}
                      placeholder={placeholder}
                      aria-label={title}
                      className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
                    />
                  </div>

                  {hits.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-muted">{emptyLabel}</p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto p-2">
                      {hits.map((hit, index) => (
                        <li key={hit.href}>
                          <button
                            type="button"
                            onClick={() => go(hit)}
                            onMouseEnter={() => setCursor(index)}
                            className={
                              "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors " +
                              (index === cursor
                                ? "bg-accent-subtle text-foreground"
                                : "text-muted")
                            }
                          >
                            <span className="truncate">{hit.label}</span>
                            <span className="type-caption ms-auto shrink-0 text-muted">
                              {hit.group}
                            </span>
                            {index === cursor ? (
                              <Icon
                                icon={CornerDownLeft}
                                size="xs"
                                className="text-accent-strong"
                              />
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="type-caption border-t border-border px-4 py-2 text-muted">
                    {hint}
                  </p>
                </motion.div>
              </Dialog.Content>
            </>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
