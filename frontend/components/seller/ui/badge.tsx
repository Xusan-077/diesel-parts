import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted border-border",
  accent: "bg-accent-subtle text-accent border-transparent",
  success: "bg-success-surface text-success border-transparent",
  warning: "bg-warning-surface text-warning border-transparent",
  danger: "bg-danger-surface text-danger border-transparent",
  info: "bg-info-surface text-info border-transparent",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "seller-eyebrow inline-flex items-center gap-1 rounded-sm border px-2 py-1",
        TONE_CLASS[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
