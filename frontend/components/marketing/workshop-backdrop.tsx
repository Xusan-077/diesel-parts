"use client";

import { usePointerParallax } from "@/hooks/use-pointer-parallax";

/**
 * What sits behind the 404: two gears turning in the dark, a CRT sweep, and a
 * film of grain over the lot.
 *
 * The only reason this is a Client Component is the pointer parallax, and that
 * is one shared hook writing two custom properties on one element — the gear
 * layers read them in CSS, so no React state changes and nothing re-renders
 * while the pointer moves. See hooks/use-pointer-parallax.ts.
 *
 * Everything else — the rotation, the sweep, the grain — is CSS, guarded by
 * `prefers-reduced-motion`. See the 404 block in app/globals.css.
 */
export function WorkshopBackdrop() {
  const scene = usePointerParallax<HTMLDivElement>(13);

  return (
    <div ref={scene} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {/*
        The gears are held at a trace and given no blur filter. A blur over a
        rotating group is recomputed every frame across the whole plate, which
        is exactly the cost this screen is built to avoid; the haze comes from
        the opacity and the mask instead.
      */}
      <svg
        className="absolute inset-0 h-full w-full text-[#f77d2a] opacity-[0.09] [mask-image:radial-gradient(70%_60%_at_50%_45%,#000,transparent)]"
        viewBox="0 0 1200 700"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g style={{ transform: "translate(calc(var(--parallax-x) * 1.6), calc(var(--parallax-y) * 1.6))" }}>
          <Gear cx={215} cy={190} radius={185} teeth={18} className="nf-gear" />
        </g>
        <g style={{ transform: "translate(calc(var(--parallax-x) * -2.4), calc(var(--parallax-y) * -2.4))" }}>
          <Gear cx={985} cy={545} radius={130} teeth={14} className="nf-gear nf-gear-fast nf-gear-reverse" />
        </g>
      </svg>

      {/* The fixed scanline texture, and the band that crosses it. */}
      <div className="nf-scanlines absolute inset-0" />
      <div className="nf-sweep absolute inset-x-0 top-0" />
    </div>
  );
}

interface GearProps {
  cx: number;
  cy: number;
  radius: number;
  teeth: number;
  className: string;
}

/**
 * One gear, drawn rather than imported: a rim, a hub, spokes, and the teeth
 * spaced around the rim. Stroked in `currentColor` at hairline weights, which
 * is what keeps it a silhouette instead of an illustration.
 */
function Gear({ cx, cy, radius, teeth, className }: GearProps) {
  const step = 360 / teeth;
  const toothLength = radius * 0.14;
  const toothWidth = radius * 0.09;

  return (
    <g className={className} stroke="currentColor" strokeWidth={2} fill="none">
      <circle cx={cx} cy={cy} r={radius} />
      <circle cx={cx} cy={cy} r={radius * 0.74} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={radius * 0.22} />

      {Array.from({ length: teeth }, (_, index) => {
        const angle = index * step;
        return (
          <g key={index} transform={`rotate(${angle} ${cx} ${cy})`}>
            <rect
              x={cx - toothWidth / 2}
              y={cy - radius - toothLength}
              width={toothWidth}
              height={toothLength}
              rx={2}
            />
          </g>
        );
      })}

      {/* Four spokes, at the quarters — enough to read as a wheel with a load
          on it, few enough to stay a silhouette. */}
      {[0, 90, 180, 270].map((angle) => (
        <line
          key={angle}
          x1={cx}
          y1={cy - radius * 0.22}
          x2={cx}
          y2={cy - radius * 0.74}
          strokeWidth={1}
          transform={`rotate(${angle} ${cx} ${cy})`}
        />
      ))}
    </g>
  );
}
