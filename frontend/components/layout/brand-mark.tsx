import { cn } from "@/lib/utils";

/*
 * The DieselParts mark, drawn rather than linked.
 *
 * The artwork ships as PNG (public/android-chrome-512x512.png, and the icon
 * set built from it), and the PNG cannot go in the header: the lower half of
 * the mark is #353535 and the storefront's chrome is #151719 in *both* themes
 * -- see the "Chrome: a dark frame, in both themes" block in globals.css -- so
 * half the logo would sit at 1.3:1 and simply not be there. These paths were
 * traced from that PNG's alpha channel and split by colour, which lets the
 * lower half take `currentColor` and follow whatever foreground it is placed
 * on: `text-chrome-foreground` in the header and the footer, the ordinary
 * `text-foreground` anywhere on a light page. The upper half keeps the brand
 * red, which is fixed -- see --brand-red in globals.css.
 *
 * The trace is within 2% of the source bitmap by area at its native 512px and
 * costs about 1KB of path data, so it is cheaper than the request the PNG
 * would have made and stays sharp at any size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 383 278"
      /*
       * The mark never carries the accessible name on its own: every caller
       * pairs it with the site name, either as visible text or as the link's
       * own aria-label, so announcing it here would only repeat the brand.
       */
      aria-hidden="true"
      focusable="false"
      className={cn("h-8 w-auto shrink-0", className)}
    >
      <path fill="currentColor" d="M29 152L14 157L6 165L6 167L3 170L0 182L289 182L286 193L277 211L275 212L273 217L268 221L268 223L257 234L255 234L252 238L250 238L246 242L242 243L241 245L233 249L205 257L176 257L158 253L148 248L145 248L137 244L127 236L125 236L120 230L118 230L112 224L112 222L106 217L106 215L103 213L102 209L98 205L91 190L58 190L61 202L68 217L70 218L78 232L81 234L81 236L86 240L86 242L107 261L137 278L242 278L262 268L267 263L272 261L276 256L278 256L292 242L292 240L297 236L301 228L304 226L316 202L322 182L325 163L325 152Z" />
      <path fill="var(--brand-red)" d="M184 0L166 2L136 11L126 16L125 18L119 20L118 22L114 23L103 33L101 33L86 48L86 50L81 54L81 56L73 66L72 70L70 71L60 93L54 118L53 140L359 140L370 135L379 125L383 115L383 111L89 111L94 95L102 80L110 71L110 69L123 56L125 56L128 52L130 52L137 46L156 37L172 33L189 31L205 32L220 35L229 38L233 41L236 41L242 44L243 46L247 47L251 51L253 51L274 71L276 76L281 81L283 87L285 88L291 104L322 104L317 84L307 64L300 56L300 54L297 52L297 50L291 45L291 43L277 30L275 30L269 24L265 23L263 20L257 18L256 16L243 10L240 10L238 8L234 8L232 6L208 1Z" />
    </svg>
  );
}
