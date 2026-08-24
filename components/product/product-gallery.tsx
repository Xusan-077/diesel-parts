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
}) {
  return (
    <ZoomableProductImage
      src={imageUrl}
      alt={galleryAlt}
      fallbackIconSize="xl"
      zoomLabel={zoomLabel}
      closeLabel={closeLabel}
      className="aspect-4/3 w-full rounded-lg border border-border"
    />
  );
}
