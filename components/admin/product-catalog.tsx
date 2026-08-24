"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ImageOff, Pencil, Plus, RotateCcw } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/form-modal";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import {
  ProductFormModal,
  type ReferenceOption,
} from "@/components/admin/product-form-modal";

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

export function ProductCatalog({ query, initialData, categories, brands }: ProductCatalogProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const showingArchived = query.all;

  const list = useAdminProducts(query, initialData);
  const rows = list.data?.items ?? [];

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
              (showingArchived ? " (arxiv bilan)" : "")}
        </p>
        <Button type="button" onClick={() => setDialog({ kind: "create" })}>
          <Icon icon={Plus} />
          Yangi mahsulot
        </Button>
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
          <p className="type-body text-muted">
            Hech narsa topilmadi. Qidiruvni o&apos;zgartiring yoki yangi mahsulot qo&apos;shing.
          </p>
        ) : (
          <table className="w-full min-w-4xl text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="type-eyebrow pb-2 text-muted">
                  <span className="sr-only">Rasm</span>
                </th>
                <th scope="col" className="type-eyebrow pb-2 text-muted">Mahsulot</th>
                <th scope="col" className="type-eyebrow pb-2 text-muted">SKU</th>
                <th scope="col" className="type-eyebrow pb-2 text-muted">Brend</th>
                <th scope="col" className="type-eyebrow pb-2 text-right text-muted">Narx</th>
                <th scope="col" className="type-eyebrow pb-2 text-right text-muted">Qoldiq</th>
                <th scope="col" className="type-eyebrow pb-2 text-right text-muted">Holat</th>
                <th scope="col" className="type-eyebrow pb-2 text-right text-muted">
                  <span className="sr-only">Amallar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const short = product.stock <= product.minStock;
                return (
                  <tr
                    key={product.id}
                    /* `group` is what lets the row reveal its actions; `row-hover`
                       is the panel's existing background treatment. */
                    className="group row-hover border-b border-border last:border-0"
                  >
                    <td className="py-3 pr-3">
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
                    </td>
                    <td className="py-3 pr-3">
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
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-muted">{product.sku}</td>
                    <td className="py-3 pr-3 text-muted">{product.brandName}</td>
                    <td className="py-3 text-right font-mono tabular-nums text-foreground">
                      {product.price === null ? (
                        <span className="text-muted">so&apos;rov bo&apos;yicha</span>
                      ) : (
                        formatSum(product.price)
                      )}
                    </td>
                    <td
                      className={
                        "py-3 pl-3 text-right font-mono tabular-nums " +
                        (product.stock === 0
                          ? "text-danger"
                          : short
                            ? "text-warning"
                            : "text-foreground")
                      }
                    >
                      {formatInteger(product.stock)}
                      <span className="ml-1 text-muted">/ {formatInteger(product.minStock)}</span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {/* Both states are badges now. "faol" as bare text beside
                          "arxiv" in a pill made the column read as one status
                          and one absence of status, when they are two values of
                          the same field — and the pill was hand-rolled at a
                          padding the Badge component does not use. */}
                      {product.isActive ? (
                        <Badge variant="success">faol</Badge>
                      ) : (
                        <Badge>arxiv</Badge>
                      )}
                    </td>
                    <td className="py-3 pl-3">
                      {/*
                        * Row actions are icon buttons that appear on hover and
                        * on focus, and stay visible on touch, where there is no
                        * hover to reveal them. `group-hover` is on the row's
                        * `row-hover` class; `focus-within` is what keeps them
                        * reachable by keyboard.
                        */}
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          label={"Tahrirlash: " + product.name}
                          icon={Pencil}
                          busy={editLoader.loadingId === product.id}
                          onClick={() => void openEdit(product)}
                        />
                        {product.isActive ? (
                          <RowAction
                            label={"Arxivga olish: " + product.name}
                            icon={Archive}
                            tone="danger"
                            onClick={() => {
                              setActive.reset();
                              setDialog({ kind: "archive", row: product });
                            }}
                          />
                        ) : (
                          <RowAction
                            label={"Katalogga qaytarish: " + product.name}
                            icon={RotateCcw}
                            onClick={() => {
                              setActive.reset();
                              setDialog({ kind: "restore", row: product });
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

/**
 * One icon-only action in a table row.
 *
 * Hidden until the row is hovered or something inside it takes focus, so a
 * fifty-row table is not fifty pairs of competing buttons — but never hidden
 * from assistive technology, which is why this is `opacity` and not `hidden`.
 */
function RowAction({
  label,
  icon,
  onClick,
  busy = false,
  tone = "default",
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>["icon"];
  onClick: () => void;
  busy?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={
        "flex size-8 items-center justify-center rounded-md text-muted opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-100 [@media(hover:none)]:opacity-100 " +
        (tone === "danger"
          ? "hover:bg-danger-surface hover:text-danger"
          : "hover:bg-surface-hover hover:text-foreground")
      }
    >
      {busy ? <Spinner /> : <Icon icon={icon} />}
    </button>
  );
}
