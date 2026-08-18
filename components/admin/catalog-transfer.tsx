"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ImportReport {
  success: boolean;
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
}

/**
 * Export and import in one control, because they are one workflow: the director
 * exports the catalog, edits it in Excel, and imports the same file back. The
 * export carries each product's id, so a re-import updates rather than
 * duplicates.
 */
export function CatalogTransfer() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setReport(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/v1/products/import", { method: "POST", body });
      const data = (await response.json()) as ImportReport & {
        errors?: { _root?: string[] } | ImportReport["errors"];
      };

      setReport({
        success: data.success ?? false,
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        errors: Array.isArray(data.errors)
          ? data.errors
          : [{ line: 0, message: (data.errors as { _root?: string[] })?._root?.[0] ?? "Xatolik" }],
      });

      if (data.success) {
        router.refresh();
      }
    } catch {
      setReport({ success: false, created: 0, updated: 0, errors: [{ line: 0, message: "Ulanmadi." }] });
    } finally {
      setBusy(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* A plain link, not fetch-then-blob: the browser already knows how to
            save a response with Content-Disposition, and doing it any other way
            costs a copy of the whole catalog in memory.

            next/link is wrong here for the same reason — it would try to
            client-navigate to a route that returns a file, so the download never
            starts. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/v1/products/export"
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          CSV yuklab olish
        </a>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? "Yuklanmoqda…" : "CSV dan yuklash"}
        </Button>

        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
          }}
        />
      </div>

      {report ? (
        <div
          role="status"
          className={
            "mt-4 rounded-md border px-4 py-3 text-sm " +
            (report.success ? "border-border bg-success-surface" : "border-danger bg-danger-surface")
          }
        >
          <p className="text-foreground">
            {report.success
              ? report.created + " ta qo'shildi, " + report.updated + " ta yangilandi."
              : "Import to'xtatildi — hech narsa o'zgartirilmadi."}
          </p>
          {report.errors.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {report.errors.slice(0, 10).map((issue, index) => (
                <li key={index} className="font-mono text-xs text-foreground">
                  {issue.line > 0 ? issue.line + "-qator: " : ""}
                  {issue.message}
                </li>
              ))}
              {report.errors.length > 10 ? (
                <li className="text-xs text-muted">
                  …va yana {report.errors.length - 10} ta xato
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
