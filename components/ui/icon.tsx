import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The icon scale.
 *
 * Icons had drifted across six sizes (`h-3.5`, `h-4`, `h-5`, `h-6` …) chosen
 * per call site, so a chevron next to 14px text was the same weight as one
 * next to 24px text. Four steps cover every use on the site:
 *
 * - `xs` sits inside dense metadata rows and small chips
 * - `sm` is the default: buttons, links, inline labels
 * - `md` pairs with icon-only controls in the header and dialogs
 * - `lg` is for standalone feature and category glyphs
 * - `xl` is the illustration weight used by empty states
 */
export const ICON_SIZE = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-10 w-10",
} as const;

export type IconSize = keyof typeof ICON_SIZE;

/**
 * Lucide draws at `strokeWidth={2}` on a 24px grid. Scaled down to 14–16px
 * that reads noticeably heavier than the surrounding text, so the small steps
 * thin out to stay optically level with the type they sit beside.
 */
export const ICON_STROKE: Record<IconSize, number> = {
  xs: 2,
  sm: 1.75,
  md: 1.75,
  lg: 1.5,
  xl: 1.25,
};

export interface IconProps extends Omit<LucideProps, "size" | "ref"> {
  icon: LucideIcon;
  size?: IconSize;
}

/**
 * Renders a lucide icon at a scale step. Decorative by default — pass an
 * `aria-label` (and drop `aria-hidden`) when the icon is the only label.
 */
export function Icon({ icon: LucideGlyph, size = "sm", className, ...props }: IconProps) {
  return (
    <LucideGlyph
      aria-hidden
      strokeWidth={ICON_STROKE[size]}
      className={cn(ICON_SIZE[size], "shrink-0", className)}
      {...props}
    />
  );
}
