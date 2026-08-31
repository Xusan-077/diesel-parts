"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ImageOff, MoreHorizontal, PackageSearch, Pencil, Plus, RotateCcw } from "lucide-react";
import {
  useAdminProducts,
  useProductEditLoader,
  useSetProductActive,
} from "@/hooks/admin/use-admin-products";
import { requestErrorMessage } from "@/lib/api/request-error";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import type {
  AdminProductPage,
  AdminProductRow,
  ProductEditRecord,
} from "@/lib/api/product-write-repository";
import type { AdminProductListQuery } from "@/lib/schemas";
import type { CsvColumn } from "@/lib/analytics/csv";
import { ConfirmModal } from "@/components/ui/form-modal";
import { Spinner } from "@/components/ui/spinner";
import {
  ProductFormModal,
  type ReferenceOption,
} from "@/components/admin/product-form-modal";
import { ExportButton } from "@/components/admin/export-button";
import { EmptyState } from "@/components/director/empty-state";
import { Badge } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import { Checkbox } from "@/components/ui/shadcn/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu";

/**
 * The catalogue table, and the three dialogs that act on it.
 *
 * Search, sort, the archive toggle and paging are still URL state, resolved in
 * `page.tsx` before this renders — a director who sends someone a link to page
 * three of "shortest stock first" should be sending them that page. What
 * changed is where the rows come from after the first paint: the server's read
 * seeds React Query, and every write below invalidates that cache instead of
 * calling `router.refresh()`.
 *
 * The difference is visible in the two numbers this component now owns. The
 * total above the table and the pager below it are derived from the same query
 * as the rows, so archiving the last part on page three cannot leave a count
 * that disagrees with what is on screen — which is exactly what happened when
 * the count was server state and the table was not.
 */

/** Which dialog is open, and about what. `null` is the resting state. */
type Dialog =
  | { kind: "create" }
  | { kind: "edit"; row: AdminProductRow; values: ProductEditRecord }
  | { kind: "archive"; row: AdminProductRow }
  | { kind: "restore"; row: AdminProductRow }
  | null;

export interface ProductCatalogProps {
  /** The URL state the listing was resolved from; also this table's cache key. */
  query: AdminProductListQuery;
  /**
   * The first page as the server read it. `undefined` when that read failed,
   * which leaves the table to fetch and show its own loading and error states.
   */
  initialData?: AdminProductPage;
  categories: readonly ReferenceOption[];
  brands: readonly ReferenceOption[];
}

/** The current page's rows, for the toolbar's export button — the same rule
 *  `ExportButton`'s own doc comment states: an export is the rows already on
 *  screen, never a fresh request. */
const EXPORT_COLUMNS: readonly CsvColumn<AdminProductRow>[] = [
  { header: "Mahsulot", value: (row) => row.name },
  { header: "SKU", value: (row) => row.sku },
  { header: "Qoldiq", value: (row) => row.stock },
  { header: "Narx", value: (row) => row.price },
  { header: "Holat", value: (row) => (row.isActive ? "faol" : "arxiv") },
];

export function ProductCatalog({ query, initialData, categories, brands }: ProductCatalogProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const showingArchived = query.all;

  const list = useAdminProducts(query, initialData);
  const rows = list.data?.items ?? [];
  const selectedRows = rows.filter((row) => selected.has(row.id));

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set());
  }

  /*
   * The edit payload is a separate read: the row carries a name and a price,
   * the form needs specs, OEM numbers and three languages of description. It
   * is fetched when the row's edit button is pressed — through the cache, so
   * reopening the same row costs nothing — and the dialog opens once it is in
   * hand. A failure toasts and opens nothing, rather than showing an empty form.
   */
  const editLoader = useProductEditLoader();

  async function openEdit(row: AdminProductRow) {
    const values = await editLoader.load(row.id);
    if (values !== null) {
      setDialog({ kind: "edit", row, values });
    }
  }

  const setActive = useSetProductActive(() => setDialog(null));

  const confirmError =
    setActive.isError && (dialog?.kind === "archive" || dialog?.kind === "restore")
      ? requestErrorMessage(setActive.error, "Bajarilmadi. Qaytadan urinib ko'ring.")
      : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          * The count sits with the table rather than in the page header, where
          * it used to be: it is the same query's answer as the rows, and two
          * places reading two sources is how a table ends up saying "48 ta"
          * over forty-seven rows.
          */}
        <p className="font-mono text-xs tabular-nums text-muted">
          {list.data === undefined
            ? " "
            : formatInteger(list.data.total) +
              " ta mahsulot" +
              (showingArchived ? " (arxiv bilan)" : "") +
              (selectedRows.length > 0 ? " · " + selectedRows.length + " ta tanlandi" : "")}
        </p>
        <div className="flex items-center gap-2">
          <ExportButton
            columns={EXPORT_COLUMNS}
            rows={selectedRows.length > 0 ? selectedRows : rows}
            filename="mahsulotlar.csv"
            label={selectedRows.length > 0 ? "Tanlanganlarni eksport" : "Eksport"}
          />
          <Button type="button" onClick={() => setDialog({ kind: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Yangi mahsulot
          </Button>
        </div>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        {list.isPending ? (
          <CatalogSkeleton />
        ) : list.isError ? (
          <div className="py-6 text-center">
            <p className="type-body text-muted">
              {requestErrorMessage(list.error, "Ro'yxat yuklanmadi.")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void list.refetch()}
            >
              Qayta urinish
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            message="Hech narsa topilmadi. Qidiruvni o'zgartiring yoki yangi mahsulot qo'shing."
          />
        ) : (
          <Table className="min-w-4xl">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Barchasini tanlash"
                    checked={rows.length > 0 && selectedRows.length === rows.length}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Rasm</span>
                </TableHead>
                <TableHead>Mahsulot</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Narx</TableHead>
                <TableHead className="text-right">Qoldiq</TableHead>
                <TableHead className="text-right">Holat</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Amallar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((product) => {
                const short = product.stock <= product.minStock;
                return (
                  <TableRow key={product.id} data-state={selected.has(product.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        aria-label={"Tanlash: " + product.name}
                        checked={selected.has(product.id)}
                        onCheckedChange={(checked) => toggleRow(product.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell>
                      {/* A thumbnail, or the same empty-photo mark the upload
                          field shows — never a broken <img>, since most rows
                          in an existing catalog have no photo yet. */}
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="size-10 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md border border-dashed border-border text-muted">
                          <ImageOff aria-hidden className="size-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {/*
                        * The name opens the editor rather than navigating. It
                        * is a button and not a link because there is no longer
                        * a URL behind it — dressing a dialog trigger as a link
                        * would break middle-click and "open in new tab" in a
                        * way the director could not predict.
                        */}
                      <button
                        type="button"
                        onClick={() => void openEdit(product)}
                        className="text-left text-foreground transition-colors hover:text-accent-strong"
                      >
                        {product.name}
                      </button>
                      <span className="ml-2 text-xs text-muted">{product.categoryName}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted">{product.sku}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-foreground">
                      {product.price === null ? (
                        <span className="text-muted">so&apos;rov bo&apos;yicha</span>
                      ) : (
                        formatSum(product.price)
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        "text-right font-mono tabular-nums " +
                        (product.stock === 0
                          ? "text-danger"
                          : short
                            ? "text-warning"
                            : "text-foreground")
                      }
                    >
                      {formatInteger(product.stock)}
                      <span className="ml-1 text-muted">/ {formatInteger(product.minStock)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        {product.isActive ? (
                          <Badge variant="success">faol</Badge>
                        ) : (
                          <Badge variant="secondary">arxiv</Badge>
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
                            aria-label={"Amallar: " + product.name}
                            disabled={editLoader.loadingId === product.id}
                          >
                            {editLoader.loadingId === product.id ? (
                              <Spinner />
                            ) : (
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => void openEdit(product)}>
                            <Pencil className="size-4" aria-hidden="true" />
                            Tahrirlash
                          </DropdownMenuItem>
                          {product.isActive ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setActive.reset();
                                setDialog({ kind: "archive", row: product });
                              }}
                            >
                              <Archive className="size-4" aria-hidden="true" />
                              Arxivga olish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => {
                                setActive.reset();
                                setDialog({ kind: "restore", row: product });
                              }}
                            >
                              <RotateCcw className="size-4" aria-hidden="true" />
                              Katalogga qaytarish
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/*
        * Keyed on the row, so opening the editor on a second product remounts
        * the form with that product's values. Without the key React would keep
        * the first row's `useState` and show the wrong part under the right
        * title — the classic uncontrolled-form-in-a-dialog bug.
        */}
      {dialog?.kind === "create" ? (
        <ProductFormModal
          key="create"
          open
          onOpenChange={() => setDialog(null)}
          categories={categories}
          brands={brands}
        />
      ) : null}

      {dialog?.kind === "edit" ? (
        <ProductFormModal
          key={dialog.row.id}
          open
          onOpenChange={() => setDialog(null)}
          productId={dialog.row.id}
          initial={dialog.values}
          categories={categories}
          brands={brands}
        />
      ) : null}

      <ConfirmModal
        open={dialog?.kind === "archive"}
        onOpenChange={() => setDialog(null)}
        title="Mahsulot arxivga olinsinmi?"
        subject={dialog?.kind === "archive" ? dialog.row.sku + " · " + dialog.row.name : ""}
        warning="Mahsulot saytdan yo'qoladi, lekin eski buyurtmalarda saqlanib qoladi. Keyinroq katalogga qaytarishingiz mumkin."
        confirmLabel="Arxivga olish"
        busy={setActive.isPending}
        error={confirmError}
        onConfirm={() => {
          if (dialog?.kind === "archive") {
            setActive.mutate({ id: dialog.row.id, active: false });
          }
        }}
      />

      <ConfirmModal
        open={dialog?.kind === "restore"}
        onOpenChange={() => setDialog(null)}
        title="Mahsulot katalogga qaytarilsinmi?"
        subject={dialog?.kind === "restore" ? dialog.row.sku + " · " + dialog.row.name : ""}
        warning="Mahsulot saytda yana ko'rinadi va qidiruvga tushadi."
        confirmLabel="Qaytarish"
        busy={setActive.isPending}
        error={confirmError}
        onConfirm={() => {
          if (dialog?.kind === "restore") {
            setActive.mutate({ id: dialog.row.id, active: true });
          }
        }}
      />

      {showingArchived ? null : (
        /* Says why a part someone is looking for is not in the table, at the
           moment they have finished scanning it and not before. */
        <p className="mt-3 text-xs text-muted">
          Arxivdagi mahsulotlar bu ro&apos;yxatda ko&apos;rinmaydi.
        </p>
      )}

      {list.data !== undefined && list.data.totalPages > 1 ? (
        <Pager query={query} page={list.data.page} totalPages={list.data.totalPages} />
      ) : null}
    </>
  );
}

/**
 * The table's shape before its first answer.
 *
 * Only reached when the server-side read failed and left no seed — an ordinary
 * visit paints the rows themselves. Eight bars at the row height, so the panel
 * does not collapse to nothing and then push the page around when they land.
 */
function CatalogSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Yuklanmoqda...</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-md bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}

/**
 * Paging, as links rather than buttons.
 *
 * The page number belongs in the URL for the same reason the search term does:
 * it is what someone shares, bookmarks and comes back to. Each link re-runs
 * the server read, which reseeds this table under a new cache key.
 */
function Pager({
  query,
  page,
  totalPages,
}: {
  query: AdminProductListQuery;
  page: number;
  totalPages: number;
}) {
  const href = (next: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.sort !== "stock") params.set("sort", query.sort);
    if (query.all) params.set("all", "1");
    if (next > 1) params.set("page", String(next));
    const search = params.toString();
    return "/director/products" + (search ? "?" + search : "");
  };

  return (
    <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-muted hover:text-foreground">
          ← Oldingi
        </Link>
      ) : null}
      <span className="font-mono text-xs text-muted">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="text-muted hover:text-foreground">
          Keyingi →
        </Link>
      ) : null}
    </nav>
  );
}

