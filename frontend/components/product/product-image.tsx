import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon, type IconSize } from "@/components/ui/icon";

export interface ProductImageProps {
  /** `Product.imageUrl` — `null` on every row nobody has photographed yet. */
  src: string | null;
  /** Empty for a purely decorative tile sitting beside the product's own name. */
  alt: string;
  /** Sizes the fallback glyph to the tile it sits in — a 44px search row wants
   *  a smaller mark than a full-width card photo. */
  fallbackIconSize?: IconSize;
  className?: string;
}

/**
 * A product's photograph, or the same placeholder wherever one is missing.
 *
 * Every place on the site that used to show a caption from `imageLabels` shows
 * this instead: the catalog's photographs are real now, one per product (see
 * `Product.imageUrl`), and a product nobody has photographed yet gets this
 * icon rather than a broken image or an empty box.
 *
 * A plain `<img>` rather than `next/image`: the seed catalog's placeholder
 * photos are SVG, and `next/image`'s optimizer refuses to process SVG unless
 * `dangerouslyAllowSVG` is turned on — a security-relevant config change this
 * local, already-small catalog imagery does not need. The admin panel made
 * the same call for the same reason.
 */
export function ProductImage({
  src,
  alt,
  fallbackIconSize = "lg",
  className,
}: ProductImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-surface-hover text-muted",
          className,
        )}
      >
        <Icon icon={ImageOff} size={fallbackIconSize} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the SVG note above.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("object-cover", className)}
    />
  );
}
