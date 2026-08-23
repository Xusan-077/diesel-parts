"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ProductImageFieldProps {
  /** The product's photo as it exists on the server, or `null` if it has none. */
  currentUrl: string | null;
  /** The file staged for upload, chosen here and held by the parent form. */
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop (or click-to-browse) photo picker, with a live preview.
 *
 * The preview shows the staged file once one is chosen, and falls back to
 * `currentUrl` — the create dialog has neither and shows the empty state, the
 * edit dialog starts from the product's existing photo. Nothing is uploaded
 * from here: this only stages a `File` in the parent's state, which is what
 * lets create bundle it into one multipart request and edit send it through
 * its own endpoint only when a new file was actually picked.
 */
export function ProductImageField({
  currentUrl,
  file,
  onFileChange,
  disabled = false,
}: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Created during render rather than in an effect: a blob URL derived purely
  // from `file` is exactly what `useMemo` is for, and it needs no state of its
  // own. The effect below only handles the side effect memoisation cannot —
  // revoking the previous URL once React has committed past it, so it is
  // never revoked while still on screen.
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const preview = objectUrl ?? currentUrl;

  function accept(candidate: File) {
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setError("Rasm JPEG, PNG yoki WebP formatida bo'lishi kerak.");
      return;
    }
    if (candidate.size > 5 * 1024 * 1024) {
      setError("Rasm hajmi 5 MB dan oshmasligi kerak.");
      return;
    }
    setError(null);
    onFileChange(candidate);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const dropped = e.dataTransfer.files[0];
          if (dropped) accept(dropped);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-disabled={disabled}
        className={cn(
          "relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          dragging ? "border-accent-strong bg-accent/5" : "border-border hover:border-border-strong",
        )}
      >
        {preview ? (
          // Local blob preview or the product's existing photo — plain <img>
          // rather than next/image, since one is a blob: URL and both are user
          // content the optimiser has no build-time knowledge of.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <ImageOff aria-hidden className="size-6" />
            <p className="text-xs">Rasm yo&apos;q</p>
          </div>
        )}

        {!disabled ? (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/90 text-xs text-foreground transition-opacity",
              preview ? "opacity-0 hover:opacity-100" : "opacity-100",
            )}
          >
            <Upload aria-hidden className="size-5" />
            <p>Sudrab tashlang yoki bosing</p>
            <p className="text-muted">JPEG, PNG, WebP · 5 MB gacha</p>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) accept(picked);
          // Cleared so choosing the same file twice in a row still fires onChange.
          e.target.value = "";
        }}
      />

      {file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onFileChange(null)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
          Tanlangan rasmni bekor qilish
        </button>
      ) : null}

      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
