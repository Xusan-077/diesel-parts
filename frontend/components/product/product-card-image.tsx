"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product/product-image";
import { ImageLightbox } from "@/components/product/image-lightbox";

/**
 * The card's picture, plus the one interaction it has of its own: a click
 * opens the same photo full screen instead of following the card's stretched
 * title link to the product page.
 *
 * That link is `after:absolute after:inset-0` over the whole card (see
 * `ProductCard`), so a plain click on the picture would leave the grid. The
 * invisible button below sits at `z-10` — the same trick `ProductSaveActions`
 * and `StockBadge` already use — to catch the click first, and
 * `preventDefault` belt-and-braces against the link underneath.
 */
export function ProductCardImage({
  src,
  alt,
  zoomLabel,
  closeLabel,
  className,
}: {
  src: string | null;
  alt: string;
  zoomLabel: string;
  closeLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ProductImage src={src} alt={alt} fallbackIconSize="xl" className={className} />

      {src ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
            aria-label={zoomLabel}
            className="absolute inset-0 z-10 cursor-zoom-in"
          />
          <ImageLightbox
            open={open}
            onOpenChange={setOpen}
            src={src}
            alt={alt}
            closeLabel={closeLabel}
          />
        </>
      ) : null}
    </>
  );
}
