"use client";

import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Local to the seller panel — components/providers/toaster.tsx reads the
 * storefront/admin theme store (light/dark toggle), which this standalone,
 * always-dark panel doesn't mount. Colours are remapped onto the panel's own
 * tokens the same way the shared one does onto globals.css's.
 */
export function SellerToaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      style={
        {
          "--normal-bg": "var(--color-surface)",
          "--normal-text": "var(--color-foreground)",
          "--normal-border": "var(--color-border)",
          "--success-bg": "var(--color-success-surface)",
          "--success-text": "var(--color-success)",
          "--success-border": "var(--color-success)",
          "--error-bg": "var(--color-danger-surface)",
          "--error-text": "var(--color-danger)",
          "--error-border": "var(--color-danger)",
          "--warning-bg": "var(--color-warning-surface)",
          "--warning-text": "var(--color-warning)",
          "--warning-border": "var(--color-warning)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "rounded-md text-sm shadow-md",
          description: "text-xs opacity-80",
        },
      }}
    />
  );
}
