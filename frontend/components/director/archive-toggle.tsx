"use client";

import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/shadcn/checkbox";

/** A URL-driven checkbox — same "navigate, don't just set state" rule as `SortSelect`. */
export function ArchiveToggle({
  id,
  checked,
  href,
  label,
}: {
  id: string;
  checked: boolean;
  href: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground select-none">
      <Checkbox id={id} checked={checked} onCheckedChange={() => router.push(href)} />
      {label}
    </label>
  );
}
