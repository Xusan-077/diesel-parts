"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { MOTION } from "@/components/providers/motion-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { inquirySchema, type InquiryInput } from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icon";

type Status = "idle" | "submitting" | "success" | "error";

export function InquiryDialog({
  productId,
  productSlug,
  dict,
  closeLabel,
}: {
  productId: string;
  productSlug: string;
  dict: Dictionary["inquiry"];
  /** Label for the dismiss control — it is an icon button with no text. */
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { productId, productSlug, name: "", email: "", phone: "", message: "" },
  });

  /** Ties each control to its error text for assistive tech. */
  function fieldProps(name: keyof InquiryInput) {
    const invalid = !!errors[name];
    return {
      ...register(name),
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `inquiry-${name}-error` : undefined,
    };
  }

  async function onSubmit(values: InquiryInput) {
    setStatus("submitting");
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      reset({ productId, productSlug, name: "", email: "", phone: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStatus("idle");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="outline">{dict.openButton}</Button>
      </Dialog.Trigger>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <Dialog.Overlay asChild forceMount key="overlay">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={MOTION.fade}
                className="fixed inset-0 z-60 bg-black/80"
              />
            </Dialog.Overlay>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {open ? (
            <Dialog.Content asChild forceMount key="content">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.96, x: "-50%", y: "-50%" }}
                transition={MOTION.pop}
                className="fixed left-1/2 top-1/2 z-60 w-full max-w-md rounded-lg border border-border bg-background p-6"
              >
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">{dict.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">{dict.subtitle}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={closeLabel}
                className="-m-2 p-2 text-muted hover:text-foreground"
              >
                <Icon icon={X} size="md" />
              </button>
            </Dialog.Close>
          </div>

          {status === "success" ? (
            <div role="status" className="mt-6 text-center">
              <h3 className="text-base font-semibold text-foreground">{dict.successTitle}</h3>
              <p className="mt-2 text-sm text-muted">{dict.successText}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <input type="hidden" {...register("productId")} />
              <input type="hidden" {...register("productSlug")} />

              <div>
                <Label htmlFor="inquiry-name">{dict.fieldName}</Label>
                <Input id="inquiry-name" {...fieldProps("name")} />
                {errors.name && (
                  <p id="inquiry-name-error" className="mt-1 text-sm text-danger">
                    {dict.errorRequired}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="inquiry-email">{dict.fieldEmail}</Label>
                <Input id="inquiry-email" type="email" {...fieldProps("email")} />
                {errors.email && (
                  <p id="inquiry-email-error" className="mt-1 text-sm text-danger">
                    {dict.errorEmail}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="inquiry-phone">{dict.fieldPhone}</Label>
                <Input id="inquiry-phone" type="tel" {...register("phone")} />
              </div>
              <div>
                <Label htmlFor="inquiry-message">{dict.fieldMessage}</Label>
                <Textarea
                  id="inquiry-message"
                  placeholder={dict.fieldMessagePlaceholder}
                  {...fieldProps("message")}
                />
                {errors.message && (
                  <p id="inquiry-message-error" className="mt-1 text-sm text-danger">
                    {dict.errorRequired}
                  </p>
                )}
              </div>

              <p role="alert" className="text-sm text-danger empty:hidden">
                {status === "error" ? dict.errorGeneric : ""}
              </p>

              <Button type="submit" disabled={status === "submitting"} className="w-full">
                {status === "submitting" ? dict.submitting : dict.submit}
              </Button>
            </form>
                )}
              </motion.div>
            </Dialog.Content>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
