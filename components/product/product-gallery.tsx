"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({
  imageLabels,
  galleryAlt,
}: {
  imageLabels: string[];
  galleryAlt: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        role="img"
        aria-label={`${galleryAlt} — ${imageLabels[active]}`}
        className="flex aspect-4/3 items-center justify-center rounded-lg border border-border bg-linear-to-br from-white/6 to-transparent text-lg text-muted"
      >
        {imageLabels[active]}
      </div>
      <div className="mt-3 flex gap-2">
        {imageLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-md border text-xs text-muted",
              index === active ? "border-accent text-accent" : "border-border"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
