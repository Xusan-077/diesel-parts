"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { MOTION } from "@/components/providers/motion-provider";
import { Icon } from "@/components/ui/icon";
import {
  applyRail,
  railServerSnapshot,
  railSnapshot,
  subscribeRail,
  type Rail,
} from "@/lib/admin/rail";
import { rehydrateAccentStore } from "@/lib/admin/accent-store";
import type { Locale } from "@/lib/i18n/locales";
import type { PanelDictionary } from "@/lib/i18n/panel-dictionary";
import { PanelSidebar } from "./panel-sidebar";
import { PanelTopbar, type PanelAlert } from "./panel-topbar";
import type { NavGroupView, NavLink } from "./panel-nav";

/**
 * The panel's frame: a rail down the left, a bar across the top, the page in
 * the corner they leave.
 *
 * This is the client boundary and it is drawn here rather than higher up on
 * purpose. `children` arrives as an already-rendered server tree and passes
 * straight through, so a dashboard that queries the database stays a Server
 * Component even though the chrome around it is interactive.
 *
 * Two pieces of state live here because two components need them:
 *
 *   - `rail` mirrors the `data-rail` attribute a blocking script already
 *     stamped on `<html>`. CSS owns the width, the folded labels and the
 *     chevron; React holds the value only so `aria-expanded` and the toggle's
 *     label are truthful.
 *   - `drawer` is the phone's overlay. It is a real dialog — focus trap,
 *     escape, scroll lock — because on a phone the navigation covers the page,
 *     and an overlay that leaves the page behind it tabbable is a trap of a
 *     different kind.
 */
export function PanelFrame({
  brand,
  name,
  email,
  roleLabel,
  groups,
  alerts,
  quickLinks,
  dict,
  locale,
  children,
}: {
  brand: string;
  name: string;
  email: string;
  roleLabel: string;
  groups: NavGroupView[];
  alerts: PanelAlert[];
  quickLinks: NavLink[];
  dict: PanelDictionary;
  locale: Locale;
  children: React.ReactNode;
}) {
  // Reads what the pre-paint script decided rather than deciding again, so the
  // attribute stays the single source and React never fights it.
  const rail = useSyncExternalStore(subscribeRail, railSnapshot, railServerSnapshot);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    rehydrateAccentStore();
  }, []);

  function toggleRail() {
    const next: Rail = rail === "expanded" ? "collapsed" : "expanded";
    // `applyRail` notifies the subscription, so the re-render comes from the
    // same write that moved the attribute.
    applyRail(next);
  }

  const collapsed = rail === "collapsed";

  return (
    <div className="panel-frame admin-root min-h-dvh bg-background">
      {/* --- desktop: the permanent rail ---------------------------------- */}
      <aside className="panel-chrome fixed inset-y-0 left-0 z-40 hidden w-[var(--rail)] border-r border-border transition-[width] duration-200 lg:block">
        <PanelSidebar
          brand={brand}
          groups={groups}
          navLabel={dict.nav.label}
          collapsed={collapsed}
          onToggleCollapse={toggleRail}
          collapseLabel={collapsed ? dict.topbar.expand : dict.topbar.collapse}
        />
      </aside>

      {/* --- phone: the same navigation, as an overlay --------------------- */}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal forceMount>
          <AnimatePresence>
            {drawer ? (
              <>
                <Dialog.Overlay asChild forceMount>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={MOTION.fade}
                    className="fixed inset-0 z-100 bg-foreground/40 lg:hidden"
                  />
                </Dialog.Overlay>

                <Dialog.Content asChild forceMount key="drawer" aria-describedby={undefined}>
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={MOTION.drawer}
                    className="panel-chrome fixed inset-y-0 left-0 z-100 flex w-72 max-w-[85vw] flex-col border-r border-border lg:hidden"
                  >
                    <Dialog.Title className="sr-only">{dict.nav.label}</Dialog.Title>
                    <Dialog.Close
                      aria-label={dict.topbar.closeMenu}
                      className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      <Icon icon={X} size="sm" />
                    </Dialog.Close>

                    <PanelSidebar
                      brand={brand}
                      groups={groups}
                      navLabel={dict.nav.label}
                      onNavigate={() => setDrawer(false)}
                    />
                  </motion.div>
                </Dialog.Content>
              </>
            ) : null}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>

      {/* --- the page ------------------------------------------------------ */}
      <div className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 lg:ps-[var(--rail)]">
        <PanelTopbar
          groups={groups}
          alerts={alerts}
          quickLinks={quickLinks}
          name={name}
          email={email}
          roleLabel={roleLabel}
          dict={dict}
          locale={locale}
          onOpenDrawer={() => setDrawer(true)}
        />

        <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
