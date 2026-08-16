"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { Icon } from "@/components/ui/icon";

interface ThemeToggleProps {
  lightLabel: string;
  darkLabel: string;
  className?: string;
}

export function ThemeToggle({ lightLabel, darkLabel, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the stored theme, so the icon only resolves after
  // hydration and the markup stays identical on both sides.
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? lightLabel : darkLabel;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground",
        className
      )}
    >
      {mounted ? (
        isDark ? (
          <Icon icon={Sun} />
        ) : (
          <Icon icon={Moon} />
        )
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  );
}
