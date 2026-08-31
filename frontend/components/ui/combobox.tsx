"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useControlProps, useFieldState } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

/**
 * A select you can type into.
 *
 * The panel's `Select` is a native `<select>` and stays that way for closed
 * sets of a handful — a role, a status, a language. This is the other case: a
 * catalogue with two hundred categories, where the native list is a scroll
 * through an unsearchable column and the platform's type-ahead only matches
 * from the first character, so "injector" never finds "Yoqilg'i injektorlari".
 *
 * The trade is real and worth naming: this gives up the mobile wheel and the
 * zero-JS render that the native control has for free. It is used only where
 * the list is long enough that finding the value was the harder problem.
 */

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second line under the label: a SKU, a parent category, a count. */
  meta?: string;
}

export interface ComboboxProps {
  options: readonly ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown on the trigger while nothing is chosen. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  /** Called when the list closes, so a field can be marked touched on blur. */
  onClose?: () => void;
  className?: string;
}

/**
 * Case- and diacritic-insensitive substring match.
 *
 * `toLocaleLowerCase` alone is not enough for this catalogue: part names are
 * typed in Uzbek Latin with apostrophes (`Yoqilg'i`) and searched without them,
 * and `normalize("NFD")` plus a mark strip is what lets `yoqilgi` find it.
 */
function matches(haystack: string, needle: string): boolean {
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’ʻ`]/g, "")
      .toLocaleLowerCase();

  return fold(haystack).includes(fold(needle));
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Tanlang",
  searchPlaceholder = "Qidirish",
  emptyMessage = "Hech narsa topilmadi",
  disabled,
  id,
  onClose,
  className,
}: ComboboxProps) {
  const field = useFieldState();
  const control = useControlProps(field, { id, disabled });

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listId = React.useId();

  const selected = options.find((option) => option.value === value);

  const filtered = React.useMemo(() => {
    if (query.trim() === "") {
      return options;
    }
    return options.filter(
      (option) => matches(option.label, query) || matches(option.meta ?? "", query),
    );
  }, [options, query]);

  /*
   * The active row for the keyboard, tracked separately from the selected one:
   * arrowing through a list is not choosing from it until Enter, and moving the
   * selection as the highlight moves would fire a change per keystroke.
   *
   * It resets in the search box's own handler rather than in an effect on
   * `query`. An effect would run a render late, so the first Enter after a
   * keystroke could still fire on the row the highlight had before the list was
   * refiltered — which is how a combobox picks the wrong value.
   */
  const [active, setActive] = React.useState(0);

  function search(next: string) {
    setQuery(next);
    setActive(0);
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        // Wraps, because a list this long is faster to reach the end of from
        // the top than to arrow down through.
        return (next + filtered.length) % Math.max(filtered.length, 1);
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option !== undefined) {
        choose(option);
      }
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          onClose?.();
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          id={control.id}
          // Radix gives the trigger `aria-expanded` and `aria-controls`; the
          // role is what makes `aria-invalid` legal on it — and what tells a
          // screen reader this is a value to be chosen, not a command.
          role="combobox"
          // Radix sets these on the trigger too, at the same values. They are
          // written out because the role's contract requires them and a lint
          // rule cannot see what a runtime clone will add.
          aria-expanded={open}
          aria-controls={listId}
          disabled={control.disabled}
          aria-describedby={control["aria-describedby"]}
          aria-invalid={control["aria-invalid"]}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 bg-transparent text-left text-sm disabled:cursor-not-allowed",
            selected === undefined ? "text-muted" : "text-foreground",
            // Inside a field the box around this trigger is what lights up on
            // focus, exactly as it is for an input. Keeping the app's outline
            // here too would draw a second, squarer ring inside the first.
            control.ring === "field" && "focus:outline-none",
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <Icon icon={ChevronsUpDown} className="text-muted" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          // Matches the trigger so the list cannot be narrower than the value
          // it is showing, which is what makes a long category name unreadable
          // in an otherwise working combobox.
          className="z-100 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Icon icon={Search} className="text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              aria-controls={listId}
              className="h-10 w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            />
          </div>

          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => choose(option)}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors",
                        index === active ? "bg-surface-hover" : "",
                        isSelected ? "text-foreground" : "text-muted",
                      )}
                    >
                      <Icon
                        icon={Check}
                        className={cn(
                          "text-accent-strong",
                          // Held in the layout rather than removed, so the
                          // labels do not shift left as the selection moves.
                          isSelected ? "" : "invisible",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.meta === undefined ? null : (
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {option.meta}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
