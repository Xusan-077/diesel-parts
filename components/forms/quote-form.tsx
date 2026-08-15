"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteRequestSchema, type QuoteRequestInput } from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Status = "idle" | "submitting" | "success" | "error";

export function QuoteForm({ dict }: { dict: Dictionary["requestQuote"] }) {
  const [status, setStatus] = useState<Status>("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuoteRequestInput>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      country: "",
      products: "",
      quantity: "",
      message: "",
    },
  });

  async function onSubmit(values: QuoteRequestInput) {
    setStatus("submitting");
    try {
      const response = await fetch("/api/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-border bg-white/2 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">{dict.successTitle}</h2>
        <p className="mt-2 text-muted">{dict.successText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="quote-name">{dict.fieldName}</Label>
          <Input id="quote-name" {...register("name")} />
          {errors.name && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-company">{dict.fieldCompany}</Label>
          <Input id="quote-company" {...register("company")} />
          {errors.company && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-phone">{dict.fieldPhone}</Label>
          <Input id="quote-phone" {...register("phone")} />
          {errors.phone && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-email">{dict.fieldEmail}</Label>
          <Input id="quote-email" type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-sm text-accent">{dict.errorEmail}</p>}
        </div>
        <div>
          <Label htmlFor="quote-country">{dict.fieldCountry}</Label>
          <Input id="quote-country" {...register("country")} />
          {errors.country && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
        <div>
          <Label htmlFor="quote-quantity">{dict.fieldQuantity}</Label>
          <Input id="quote-quantity" {...register("quantity")} />
          {errors.quantity && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="quote-products">{dict.fieldProducts}</Label>
        <Textarea
          id="quote-products"
          placeholder={dict.fieldProductsPlaceholder}
          {...register("products")}
        />
        {errors.products && <p className="mt-1 text-sm text-accent">{dict.errorRequired}</p>}
      </div>

      <div>
        <Label htmlFor="quote-message">{dict.fieldMessage}</Label>
        <Textarea
          id="quote-message"
          placeholder={dict.fieldMessagePlaceholder}
          {...register("message")}
        />
      </div>

      {status === "error" && <p className="text-sm text-accent">{dict.errorGeneric}</p>}

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
