"use client";

import { ChevronDown, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSelectableItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import { DEFAULT_REGION_ID, regions } from "@/lib/data/regions";
import type { Locale } from "@/lib/i18n/locales";
import { Icon } from "@/components/ui/icon";

const STORAGE_KEY = "diesel-parts:region";

export function RegionSelect({ lang, label }: { lang: Locale; label: string }) {
  const [storedId, setStoredId] = useLocalStorageValue(STORAGE_KEY, DEFAULT_REGION_ID);
  const active = regions.find((region) => region.id === storedId) ?? regions[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex max-w-[11rem] items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-chrome-secondary transition-colors hover:bg-chrome-hover hover:text-chrome-foreground sm:max-w-none"
      >
        <Icon icon={MapPin} size="xs" className="shrink-0" />
        <span className="truncate">{active.name[lang]}</span>
        <Icon icon={ChevronDown} size="xs" className="shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {regions.map((region) => (
          <DropdownMenuSelectableItem
            key={region.id}
            selected={region.id === active.id}
            onSelect={() => setStoredId(region.id)}
          >
            {region.name[lang]}
          </DropdownMenuSelectableItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
