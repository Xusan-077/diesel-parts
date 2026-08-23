import { ProductImage } from "@/components/product/product-image";

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
}: {
  imageUrl: string | null;
  galleryAlt: string;
}) {
  return (
    <ProductImage
      src={imageUrl}
      alt={galleryAlt}
      fallbackIconSize="xl"
      className="aspect-4/3 w-full rounded-lg border border-border"
    />
  );
}
