"use client";

import type { CSSProperties } from "react";
import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/hooks/use-store";

/**
 * The one toast surface, mounted once per layout.
 *
 * Sonner ships its own palette; every colour it uses is remapped here onto the
 * design tokens, so a confirmation toast is the same green as a success badge
 * and a failure is the same red as a field error. `richColors` is on precisely
 * because those two now come from this file rather than from the library.
 *
 * The theme is read from the app's own store rather than left on Sonner's
 * `"system"`, which would consult `prefers-color-scheme` and disagree with a
 * visitor who picked a theme by hand.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      richColors
      closeButton
      // Long enough to read a sentence in a second language.
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
          "--info-bg": "var(--color-accent-subtle)",
          "--info-text": "var(--color-accent-strong)",
          "--info-border": "var(--color-accent-strong)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "rounded-lg text-sm shadow-md",
          description: "text-xs opacity-80",
        },
      }}
    />
  );
}
