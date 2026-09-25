import { ZoomableProductImage } from "@/components/product/zoomable-product-image";

/**
 * The product page's own photo.
 *
 * One image per product today (`Product.imageUrl`), so this is a frame, not a
 * browsable gallery — the thumbnail strip and active-frame state a multi-photo
 * page would need are not built here. A `ProductImage` table backing several
 * photos per product is a real future feature, not something this component
 * should grow toward speculatively; the day it exists, this is the one place
 * that changes.
 */
export function ProductGallery({
  imageUrl,
  galleryAlt,
  zoomLabel,
  closeLabel,
  soldOut = false,
  soldOutLabel,
}: {
  imageUrl: string | null;
  /** The part's own name — this is the page's single most important image,
   *  so its alt text names what it is a photograph of, the same way every
   *  card in a grid already does, rather than a caption identical on all of
   *  them ("Product image"). */
  galleryAlt: string;
  /** Names the magnifier/click target, which carries no visible text of its
   *  own — the picture is the whole button. */
  zoomLabel: string;
  /** Names the full-screen view's dismiss control. */
  closeLabel: string;
  /** Blurs the frame and drops a marker over it — the same "this part is gone"
   *  treatment the catalog card gets. */
  soldOut?: boolean;
  soldOutLabel?: string;
}) {
  return (
    <div className="relative">
      <ZoomableProductImage
        src={imageUrl}
        alt={galleryAlt}
        fallbackIconSize="xl"
        zoomLabel={zoomLabel}
        closeLabel={closeLabel}
        dimmed={soldOut}
        className="aspect-4/3 w-full rounded-lg border border-border"
      />
      {soldOut && soldOutLabel ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="rounded-md border border-border bg-background/85 px-4 py-2 type-eyebrow text-danger shadow-sm backdrop-blur-sm">
            {soldOutLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}
