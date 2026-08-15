"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { inquirySchema, type InquiryInput } from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Status = "idle" | "submitting" | "success" | "error";

export function InquiryDialog({
  productId,
  productSlug,
  dict,
}: {
  productId: string;
  productSlug: string;
  dict: Dictionary["inquiry"];
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
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-60 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">{dict.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">{dict.subtitle}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={dict.title} className="text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {status === "success" ? (
            <div className="mt-6 text-center">
              <h3 className="text-base font-semibold text-foreground">{dict.successTitle}</h3>
              <p className="mt-2 text-sm text-muted">{dict.successText}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <input type="hidden" {...register("productId")} />
              <input type="hidden" {...register("productSlug")} />

              <div>
                <Label htmlFor="inquiry-name">{dict.fieldName}</Label>
                <Input id="inquiry-name" {...register("name")} />
                {errors.name && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
              </div>
              <div>
                <Label htmlFor="inquiry-email">{dict.fieldEmail}</Label>
                <Input id="inquiry-email" type="email" {...register("email")} />
                {errors.email && <p className="mt-1 text-sm text-accent">{dict.errorEmail}</p>}
              </div>
              <div>
                <Label htmlFor="inquiry-phone">{dict.fieldPhone}</Label>
                <Input id="inquiry-phone" {...register("phone")} />
              </div>
              <div>
                <Label htmlFor="inquiry-message">{dict.fieldMessage}</Label>
                <Textarea
                  id="inquiry-message"
                  placeholder={dict.fieldMessagePlaceholder}
                  {...register("message")}
                />
                {errors.message && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
              </div>

              {status === "error" && <p className="text-sm text-accent">{dict.errorGeneric}</p>}

              <Button type="submit" disabled={status === "submitting"} className="w-full">
                {status === "submitting" ? dict.submitting : dict.submit}
              </Button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
