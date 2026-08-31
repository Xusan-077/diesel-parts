"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, ChevronDown, LogOut, Moon } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import { FlagIcon } from "@/components/layout/flag-icon";
import { useLanguage, useTheme } from "@/hooks/use-store";
import { useAccentStore } from "@/lib/admin/accent-store";
import { signOutOfPanel } from "@/lib/admin/sign-out";
import { ACCENTS, applyAccentAttribute, type Accent } from "@/lib/admin/accent";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import type { PanelDictionary } from "@/lib/i18n/panel-dictionary";
import type { NavLink } from "./panel-nav";
import { PanelSwitch } from "./panel-switch";

const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

/** Two letters from the name, for the avatar. Falls back to one. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow mb-2 text-muted">{children}</p>;
}

/**
 * Everything about *this reader* that is not a page.
 *
 * The panel had these controls in three places or nowhere at all: sign-out was
 * pinned to the bottom of the sidebar where it competed with the navigation
 * for the eye, the theme could only be changed on the marketing site, and the
 * language could not be changed in the panel at all. They belong together
 * because they are one category — how the panel looks and who is looking at it
 * — and a director changes them roughly never, which is exactly the kind of
 * control that should be one click away and zero pixels wide the rest of the
 * time.
 *
 * A popover rather than a dropdown menu. Menu semantics give arrow-key
 * traversal over a list of commands; this panel holds a switch, a five-swatch
 * grid and a set of radio-ish language rows, and forcing those into menu items
 * would trade correct control semantics for a keystroke nobody asked for.
 */
export function PanelProfileMenu({
  name,
  email,
  roleLabel,
  quickLinks,
  dict,
  locale,
}: {
  name: string;
  email: string;
  roleLabel: string;
  /** The reader's own sections, so the menu doubles as a jump list. */
  quickLinks: NavLink[];
  dict: PanelDictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { isDark, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage(locale);
  const accent = useAccentStore((state) => state.accent);
  const setAccentValue = useAccentStore((state) => state.setAccent);

  function chooseAccent(next: Accent) {
    // The attribute is written first so the repaint lands on this frame; the
    // store write is what makes it survive a reload.
    applyAccentAttribute(next);
    setAccentValue(next);
  }

  function chooseLanguage(next: Locale) {
    if (next === language) {
      return;
    }
    setLanguage(next);
    // Every string in the shell was rendered on the server from the cookie
    // `setLanguage` just wrote, so the new language arrives with the refresh
    // rather than with the state update.
    router.refresh();
  }

  async function signOut() {
    setLeaving(true);
    toast.success(dict.profile.signOut);
    await signOutOfPanel(router);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={dict.profile.open}
        className="flex h-10 items-center gap-2 rounded-md border border-transparent px-2 transition-colors hover:bg-surface-hover data-[state=open]:border-border data-[state=open]:bg-surface-hover"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-edge bg-accent-subtle font-mono text-xs font-semibold text-accent-strong"
        >
          {initials(name)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="type-label block truncate text-foreground">{name}</span>
          <span className="type-caption block truncate text-muted">{roleLabel}</span>
        </span>
        <Icon icon={ChevronDown} size="xs" className="hidden text-muted sm:block" />
      </Popover.Trigger>

      <Popover.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Popover.Content asChild forceMount align="end" sideOffset={8} key="profile">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={MOTION.pop}
                className="z-100 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
              >
                {/* --- who you are ------------------------------------------ */}
                <div className="flex items-center gap-3 border-b border-border p-4">
                  <span
                    aria-hidden="true"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent-edge bg-accent-subtle font-mono text-sm font-semibold text-accent-strong"
                  >
                    {initials(name)}
                  </span>
                  <div className="min-w-0">
                    <p className="type-label truncate text-foreground">{name}</p>
                    <p className="type-caption truncate font-mono text-muted">{email}</p>
                  </div>
                  <span className="type-eyebrow ms-auto inline-flex h-5 shrink-0 items-center rounded-full bg-surface-muted px-2 text-muted">
                    {roleLabel}
                  </span>
                </div>

                {/* --- how it looks ----------------------------------------- */}
                <div className="border-b border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <Icon icon={Moon} size="sm" className="text-muted" />
                      {dict.profile.darkMode}
                    </span>
                    <PanelSwitch
                      checked={isDark}
                      label={dict.profile.darkMode}
                      onChange={(next) => setTheme(next ? "dark" : "light")}
                    />
                  </div>

                  <div className="mt-4">
                    <SectionLabel>{dict.profile.accent}</SectionLabel>
                    {/*
                     * A radio group and not five buttons: the sets are mutually
                     * exclusive, and arrow-key traversal over a row of swatches
                     * is what a keyboard user expects from one.
                     */}
                    <div role="radiogroup" aria-label={dict.profile.accent} className="flex gap-2">
                      {ACCENTS.map((set) => {
                        const selected = set.id === accent;
                        return (
                          <button
                            key={set.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={dict.accents[set.id] + " · " + set.code}
                            title={dict.accents[set.id] + " · " + set.code}
                            onClick={() => chooseAccent(set.id)}
                            data-swatch={set.id}
                            className={
                              "paint-chip " +
                              (selected
                                ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface"
                                : "")
                            }
                          >
                            {selected ? (
                              <Icon
                                icon={Check}
                                size="xs"
                                className="text-accent-foreground"
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    <SectionLabel>{dict.profile.language}</SectionLabel>
                    <div role="radiogroup" aria-label={dict.profile.language} className="flex flex-col gap-1">
                      {SUPPORTED_LOCALES.map((option) => {
                        const selected = option === language;
                        return (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => chooseLanguage(option)}
                            className={
                              "flex h-8 items-center gap-2 rounded-sm px-2 text-sm transition-colors " +
                              (selected
                                ? "bg-accent-subtle text-accent-strong"
                                : "text-muted hover:bg-surface-hover hover:text-foreground")
                            }
                          >
                            <FlagIcon
                              locale={option}
                              className="h-3 w-4.5 shrink-0 rounded-xs"
                            />
                            {LOCALE_LABELS[option]}
                            {selected ? (
                              <Icon icon={Check} size="xs" className="ms-auto" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* --- where to go ------------------------------------------ */}
                {quickLinks.length > 0 ? (
                  <div className="border-b border-border p-4">
                    <SectionLabel>{dict.profile.quickLinks}</SectionLabel>
                    <ul className="flex flex-col gap-1">
                      {quickLinks.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className="flex h-8 items-center rounded-sm px-2 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* --- the way out ------------------------------------------
                    Its own block below a rule, in the danger tint. It is the
                    only destructive thing in the menu and the only one that
                    ends the session, so it does not share a list with the
                    links that merely move you. */}
                <div className="p-2">
                  <button
                    type="button"
                    onClick={signOut}
                    disabled={leaving}
                    className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-sm font-medium text-danger transition-colors hover:bg-danger-surface disabled:opacity-50"
                  >
                    <Icon icon={LogOut} size="sm" />
                    {leaving ? dict.profile.signingOut : dict.profile.signOut}
                  </button>
                </div>
              </motion.div>
            </Popover.Content>
          ) : null}
        </AnimatePresence>
      </Popover.Portal>
    </Popover.Root>
  );
}
