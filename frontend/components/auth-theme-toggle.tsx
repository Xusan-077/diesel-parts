"use client";

import { Moon, Sun } from "lucide-react";
import { resolveTheme } from "@/lib/store/theme";
import { useThemeStore } from "@/lib/store/theme-store";
import { Button } from "@/components/ui/shadcn/button";

/**
 * The one control the sign-in screen carries. It drives the same
 * `useThemeStore` the storefront's own toggle does — `ThemeProvider` (mounted
 * by app/director/layout.tsx) is what actually puts the `dark` class on
 * `<html>` in response, and the `.auth-scene` palette in app/globals.css has
 * both a light and a dark set keyed off that class.
 *
 * No mounted guard: the store is created with `skipHydration`, so server and
 * first client render both read the light default and the icon only settles
 * once the stored preference is rehydrated — matching components/layout/
 * theme-toggle.tsx.
 */
export function AuthThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const systemDark = useThemeStore((state) => state.systemDark);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = resolveTheme(theme, systemDark) === "dark";

  const label = isDark ? "Yorug' rejimga o'tish" : "Tungi rejimga o'tish";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
