/**
 * The drifting line field behind the panel's login screen.
 *
 * Only the paths are exported. The upstream component this is adapted from
 * shipped a headline and a CTA bolted onto the same file; here the artwork is
 * pure background, and the screen that uses it owns its own copy.
 *
 * Two instances are meant to be stacked (`position={1}` and `position={-1}`)
 * so the two sheafs lean against each other and the field reads as depth
 * rather than as one repeated arc.
 *
 * THE MOTION IS ONE CSS TRANSFORM PER SHEAF, AND IT HAS TO STAY THAT WAY.
 * The upstream version animates `pathLength` and `pathOffset` on every path
 * through a JS animation loop, which is 36 animations per instance and 72 on
 * this screen. Motion drives those by writing `stroke-dasharray` and
 * `stroke-dashoffset` inline on each frame, so every frame invalidates the
 * geometry of 72 paths and repaints a full-height column — the main thread
 * never goes idle and the whole page, fields included, stops responding.
 * Drifting the two groups instead is one compositable transform each, looks
 * the same at this opacity, and costs nothing.
 *
 * Stroke is `currentColor`, so the caller sets the hue with a text colour and
 * the depth with the wrapper's opacity — nothing about the palette is decided
 * here. No `"use client"`: with the animation in CSS there is no state, no
 * effect and no handler, so this renders on the server and ships no JS.
 */
export function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, index) => ({
    id: index,
    d: `M-${380 - index * 5 * position} -${189 + index * 6}C-${380 - index * 5 * position} -${189 + index * 6} -${312 - index * 5 * position} ${216 - index * 6} ${152 - index * 5 * position} ${343 - index * 6}C${616 - index * 5 * position} ${470 - index * 6} ${684 - index * 5 * position} ${875 - index * 6} ${684 - index * 5 * position} ${875 - index * 6}`,
    // The sheaf thickens and darkens as it fans out, which is what keeps a
    // flat set of parallel curves from reading as a printed pattern.
    width: 0.5 + index * 0.03,
    opacity: 0.1 + index * 0.02,
  }));

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* The two sheafs drift against each other: same keyframes, opposite
            direction. See `door-drift` in app/globals.css. */}
        <g className={position > 0 ? "door-paths" : "door-paths door-paths-reverse"}>
          {paths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={path.opacity}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
