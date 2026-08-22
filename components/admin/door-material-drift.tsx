"use client";

import { usePointerParallax } from "@/hooks/use-pointer-parallax";

/**
 * The layer the login screen's line field is drawn on, leaning with the
 * pointer.
 *
 * Five pixels, and that is deliberate: the 404 pushes its gears thirteen
 * because nothing on that screen is being read, while this one sits beside a
 * form. Enough that the material is clearly not a printed panel, little enough
 * that it never pulls the eye off the password box.
 *
 * The drift is applied here, on the wrapper, and not on the sheafs inside it.
 * Those carry `door-drift`, a CSS animation on the same property, and a
 * transform written by JavaScript on an element that is being animated is
 * simply overwritten — one element per job keeps both.
 */
export function DoorMaterialDrift({ children }: { children: React.ReactNode }) {
  const layer = usePointerParallax<HTMLDivElement>(5);

  return (
    <div
      ref={layer}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-[var(--door-ignite)] opacity-[0.16]"
      style={{ transform: "translate3d(var(--parallax-x, 0px), var(--parallax-y, 0px), 0)" }}
    >
      {children}
    </div>
  );
}
