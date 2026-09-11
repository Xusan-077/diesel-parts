"use client";
import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/seller/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/shadcn/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/shadcn/command";
import { useOrders } from "@/hooks/seller/queries/use-orders";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { QueryErrorState } from "@/components/seller/query-error-state";
import type { Order } from "@/lib/api/seller-panel/types";
export function SalePicker({
  selected,
  onSelect,
}: {
  selected: Order | null;
  onSelect: (order: Order | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const query = useOrders({ search: debounced || undefined, limit: 20 });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          role="combobox"
          aria-expanded={open}
          aria-label="Sotuv tanlash"
          className="w-full justify-between h-auto min-h-10 text-left"
        >
          <span className="truncate">
            {selected
              ? selected.orderNumber + " · " + selected.customer.name
              : "Sotuv tanlash"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(32rem,calc(100vw-2rem))] p-0 border-border bg-surface text-foreground"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Sotuv ID yoki mijoz..."
          />
          <CommandList>
            {query.isError ? (
              <QueryErrorState
                error={query.error}
                onRetry={() => void query.refetch()}
              />
            ) : query.isFetching || search !== debounced ? (
              <p className="p-4 text-sm text-muted">Qidirilmoqda...</p>
            ) : (
              <>
                <CommandEmpty>Sotuv topilmadi</CommandEmpty>
                {query.data?.data.map((order) => (
                  <CommandItem
                    key={order.id}
                    value={order.id}
                    onSelect={() => {
                      onSelect(order);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1"
                  >
                    <span className="font-mono">{order.orderNumber}</span>
                    <span className="text-xs text-muted">
                      {order.customer.name}
                    </span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
