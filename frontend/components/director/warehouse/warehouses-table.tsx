"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { useWarehouses, useDeleteWarehouse } from "@/hooks/admin/use-warehouse";
import { requestErrorMessage } from "@/lib/api/request-error";
import type { WarehouseRow } from "@/lib/api/warehouse-repository";
import { EmptyState } from "@/components/director/empty-state";
import { Badge } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import { ConfirmModal } from "@/components/ui/form-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { WarehouseFormModal } from "./warehouse-form-modal";

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; row: WarehouseRow }
  | { kind: "delete"; row: WarehouseRow }
  | null;

export function WarehousesTable({ initialData }: { initialData?: WarehouseRow[] }) {
  const list = useWarehouses(initialData);
  const [dialog, setDialog] = useState<Dialog>(null);

  const remove = useDeleteWarehouse(() => setDialog(null));
  const deleteError =
    remove.isError && dialog?.kind === "delete"
      ? requestErrorMessage(remove.error, "O'chirib bo'lmadi.")
      : null;

  const rows = list.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-end">
        <Button type="button" onClick={() => setDialog({ kind: "create" })}>
          <Plus className="size-4" aria-hidden="true" />
          Yangi ombor
        </Button>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        {list.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <span className="sr-only">Yuklanmoqda…</span>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} aria-hidden="true" className="h-11 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="py-6 text-center">
            <p className="type-body text-muted">
              {requestErrorMessage(list.error, "Omborlar yuklanmadi.")}
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void list.refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={WarehouseIcon}
            title="Hali ombor yo'q"
            message="Birinchi omborni qo'shing — qabullar va qoldiqlar shunga bog'lanadi."
            action={
              <Button type="button" onClick={() => setDialog({ kind: "create" })}>
                <Plus className="size-4" aria-hidden="true" />
                Yangi ombor
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Nomi</TableHead>
                <TableHead>Manzil</TableHead>
                <TableHead>Menejer</TableHead>
                <TableHead className="text-right">Holat</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Amallar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs text-muted">{row.code}</TableCell>
                  <TableCell>
                    <Link
                      href={`/director/warehouse/warehouses/${row.id}`}
                      className="text-foreground transition-colors hover:text-accent-strong"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted">{row.address || "—"}</TableCell>
                  <TableCell className="text-muted">{row.managerName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      {row.status === "ACTIVE" ? (
                        <Badge variant="success">Faol</Badge>
                      ) : (
                        <Badge variant="secondary">Faol emas</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={"Amallar: " + row.name}
                        >
                          <MoreHorizontal className="size-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDialog({ kind: "edit", row })}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Tahrirlash
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            remove.reset();
                            setDialog({ kind: "delete", row });
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          O&apos;chirish
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {dialog?.kind === "create" ? (
        <WarehouseFormModal
          key="create"
          open
          onOpenChange={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "edit" ? (
        <WarehouseFormModal
          key={dialog.row.id}
          open
          onOpenChange={() => setDialog(null)}
          warehouse={dialog.row}
          onDone={() => setDialog(null)}
        />
      ) : null}

      <ConfirmModal
        open={dialog?.kind === "delete"}
        onOpenChange={() => setDialog(null)}
        title="Ombor o'chirilsinmi?"
        subject={dialog?.kind === "delete" ? dialog.row.code + " · " + dialog.row.name : ""}
        warning="Qoldig'i bor ombor o'chirilmaydi — avval mahsulotlarni boshqa omborga o'tkazing yoki hisobdan chiqaring."
        confirmLabel="O'chirish"
        busy={remove.isPending}
        error={deleteError}
        onConfirm={() => {
          if (dialog?.kind === "delete") {
            remove.mutate({ id: dialog.row.id });
          }
        }}
      />
    </div>
  );
}
