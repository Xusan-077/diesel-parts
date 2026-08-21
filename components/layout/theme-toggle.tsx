"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-store";
import { Icon } from "@/components/ui/icon";

interface ThemeToggleProps {
  lightLabel: string;
  darkLabel: string;
  className?: string;
}

export function ThemeToggle({ lightLabel, darkLabel, className }: ThemeToggleProps) {
  // No mounted guard is needed: the store is created with `skipHydration`, so
  // server and first client render both read the light default and the icon
  // only changes once the stored preference is rehydrated.
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? lightLabel : darkLabel;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground",
        className
      )}
    >
      <Icon icon={isDark ? Sun : Moon} />
    </button>
  );
}
