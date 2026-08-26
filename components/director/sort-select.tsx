"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

/**
 * The products page's sort control, as the brief's "filter (Select)" —
 * sort stays URL state (a director who shares a link to "price, ascending"
 * shares that exact listing), so choosing an option navigates rather than
 * setting local state.
 */
export function SortSelect({
  value,
  options,
  label,
}: {
  value: string;
  options: readonly { value: string; label: string; href: string }[];
  label: string;
}) {
  const router = useRouter();
  const hrefByValue = new Map(options.map((option) => [option.value, option.href]));

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const href = hrefByValue.get(next);
        if (href) {
          router.push(href);
        }
      }}
    >
      <SelectTrigger className="h-9 w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
