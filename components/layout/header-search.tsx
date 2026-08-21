"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface HeaderSearchProps {
  placeholder: string;
  label: string;
  className?: string;
}

export function HeaderSearch({ placeholder, label, className }: HeaderSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(
      trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : "/products"
    );
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={cn("relative", className)}>
      <Icon
        icon={Search}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
      />
    </form>
  );
}
