"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";

/** URL-driven Tabs — the Warehouse page's stock-status filter and the same
 *  "navigate, don't just set state" rule `SortSelect` follows. */
export function StatusTabs({
  value,
  options,
}: {
  value: string;
  options: readonly { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  const hrefByValue = new Map(options.map((option) => [option.value, option.href]));

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const href = hrefByValue.get(next);
        if (href) {
          router.push(href);
        }
      }}
    >
      <TabsList>
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
