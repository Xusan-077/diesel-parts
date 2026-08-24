"use client";

import { useState, type MouseEvent } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon, type IconSize } from "@/components/ui/icon";
import { ImageLightbox } from "@/components/product/image-lightbox";

/**
 * The product page's own photo. A mouse over it drives a magnifying-glass
 * effect — the photo scales up around the cursor, clipped to the frame it
 * already sits in — and either a click or a tap opens the same photo full
 * screen, which is also the only zoom a touch visitor gets: there is no hover
 * to drive the lens on a phone.
 */
export function ZoomableProductImage({
  src,
  alt,
  fallbackIconSize = "xl",
  zoomLabel,
  closeLabel,
  className,
}: {
  src: string | null;
  alt: string;
  fallbackIconSize?: IconSize;
  zoomLabel: string;
  closeLabel: string;
  className?: string;
}) {
  const [origin, setOrigin] = useState("50% 50%");
  const [magnified, setMagnified] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }

  return (
    <>
      <div
        className={cn("relative overflow-hidden", className)}
        onMouseEnter={() => setMagnified(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMagnified(false)}
      >
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={zoomLabel}
          className="block h-full w-full cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see ProductImage's note. */}
          <img
            src={src}
            alt={alt}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover transition-transform duration-200 ease-out"
            style={{
              transformOrigin: origin,
              transform: magnified ? "scale(2)" : "scale(1)",
            }}
          />
        </button>
      </div>

      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        src={src}
        alt={alt}
        closeLabel={closeLabel}
      />
    </>
  );
}
