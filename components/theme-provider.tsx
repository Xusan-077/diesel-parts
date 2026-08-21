"use client";

import { useEffect } from "react";
import {
  applyThemeClass,
  DARK_MEDIA_QUERY,
  prefersDark,
  resolveTheme,
} from "@/lib/store/theme";
import { rehydrateThemeStore, useThemeStore } from "@/lib/store/theme-store";

/**
 * Owns the two side effects the theme store cannot own itself: the `dark`
 * class on `<html>` once React is running, and the operating system
 * preference that the `system` theme follows.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);
  const systemDark = useThemeStore((state) => state.systemDark);

  useEffect(() => {
    rehydrateThemeStore();
  }, []);

  useEffect(() => {
    const { setSystemDark } = useThemeStore.getState();
    setSystemDark(prefersDark());

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applyThemeClass(resolveTheme(theme, systemDark));
  }, [theme, systemDark]);

  return <>{children}</>;
}
