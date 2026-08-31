import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

const alertVariants = cva("flex items-start gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-surface text-foreground",
      success: "border-success/30 bg-success-surface text-success",
      danger: "border-danger/30 bg-danger-surface text-danger",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const ALERT_ICON = {
  default: Info,
  success: CheckCircle2,
  danger: AlertCircle,
} as const;

export interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {}

/** Colour is never the only carrier of a state here — the glyph and the
 *  `role` say it too, matching the pattern `FieldMessage` already sets. */
export function Alert({ className, variant = "default", children, ...props }: AlertProps) {
  const resolved = variant ?? "default";
  return (
    <div
      role={resolved === "danger" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon icon={ALERT_ICON[resolved]} size="md" className="mt-0.5" />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-medium leading-none", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm leading-relaxed", className)} {...props} />;
}
