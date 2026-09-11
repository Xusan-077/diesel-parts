"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Input } from "@/components/seller/ui/input";
import { Button } from "@/components/seller/ui/button";
import { Dialog } from "@/components/seller/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCustomers } from "@/hooks/seller/queries/use-customers";
import { useCreateCustomer } from "@/hooks/seller/mutations/use-create-customer";
import type { Customer } from "@/lib/api/seller-panel/types";

export function CustomerPicker({
  selected,
  onSelect,
}: {
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const debounced = useDebouncedValue(query, 300);
  const { data, isLoading } = useCustomers({ search: debounced || undefined, limit: 8 });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
          <p className="font-mono text-xs text-muted">{selected.phone}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
          <X className="h-4 w-4" />
          O&apos;zgartirish
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mijoz: ism yoki telefon..."
        />
        <Button type="button" variant="secondary" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>

      {query ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border">
          {isLoading ? (
            <div className="p-3 text-xs text-muted">Qidirilmoqda...</div>
          ) : !data || data.data.length === 0 ? (
            <div className="p-3 text-xs text-muted">Mijoz topilmadi</div>
          ) : (
            <ul className="divide-y divide-border">
              {data.data.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(customer);
                      setQuery("");
                    }}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-hover"
                  >
                    <span className="text-sm text-foreground">{customer.name}</span>
                    <span className="font-mono text-xs text-muted">{customer.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <CreateCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(customer) => {
          onSelect(customer);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const create = useCreateCustomer();

  function reset() {
    setName("");
    setPhone("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Yangi mijoz"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            type="button"
            loading={create.isPending}
            disabled={!name.trim() || !phone.trim()}
            onClick={() => {
              create.mutate(
                { name: name.trim(), phone: phone.trim() },
                { onSuccess: (customer) => { onCreated(customer); reset(); } },
              );
            }}
          >
            Qo&apos;shish
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Ism</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Telefon</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 9x xxx xx xx" />
        </label>
      </div>
    </Dialog>
  );
}
