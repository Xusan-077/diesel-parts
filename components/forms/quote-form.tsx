"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import {
  quoteRequestSchema,
  type QuoteCartItemInput,
  type QuoteRequestInput,
} from "@/lib/schemas";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Field-level error text. Rendered in the danger colour rather than the brand
 * orange, which measured 2.56:1 against the form background.
 */
function FieldError({
  id,
  show,
  message,
}: {
  id: string;
  show: boolean;
  message: string;
}) {
  if (!show) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}

interface QuoteFormProps {
  dict: Dictionary["requestQuote"];
  /** Text prefilled into the products field when the visitor came from the cart. */
  initialProducts?: string;
  initialQuantity?: string;
  /** Structured cart lines submitted alongside the free-text description. */
  cartItems?: QuoteCartItemInput[];
}

export function QuoteForm({
  dict,
  initialProducts = "",
  initialQuantity = "",
  cartItems,
}: QuoteFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<QuoteRequestInput>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      country: "",
      products: initialProducts,
      quantity: initialQuantity,
      message: "",
    },
  });

  // The cart hydrates from localStorage after mount, so the prefilled values
  // arrive a tick late. Applying them exactly once keeps `setValue` from
  // overwriting anything the visitor has since edited.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !initialProducts) {
      return;
    }
    prefilled.current = true;
    setValue("products", initialProducts);
    setValue("quantity", initialQuantity);
  }, [initialProducts, initialQuantity, setValue]);

  /**
   * Wires each control to its error text so screen readers announce the
   * reason a field was rejected, not just that something is invalid.
   */
  function fieldProps(name: keyof QuoteRequestInput) {
    const invalid = !!errors[name];
    return {
      ...register(name),
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `quote-${name}-error` : undefined,
    };
  }

  async function onSubmit(values: QuoteRequestInput) {
    setStatus("submitting");
    try {
      await axios.post("/api/quote-request", { ...values, cartItems });
      setStatus("success");
      reset();
      toast.success(dict.successTitle, { description: dict.successText });
    } catch {
      setStatus("error");
      // The inline alert stays: the toast is a nudge, not the only record of
      // a failure, and it is gone four seconds later.
      toast.error(dict.errorGeneric);
    }
  }

  if (status === "success") {
    return (
      // The form it replaces held focus, so focus lands on the confirmation
      // instead of resetting to the top of the document.
      <div
        role="status"
        tabIndex={-1}
        ref={(el) => {
          el?.focus();
        }}
        className="rounded-lg border border-border bg-surface-muted p-8 text-center"
      >
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
          <Input id="quote-name" {...fieldProps("name")} />
          <FieldError id="quote-name-error" show={!!errors.name} message={dict.errorRequired} />
        </div>
        <div>
          <Label htmlFor="quote-company">{dict.fieldCompany}</Label>
          <Input id="quote-company" {...fieldProps("company")} />
          <FieldError
            id="quote-company-error"
            show={!!errors.company}
            message={dict.errorRequired}
          />
        </div>
        <div>
          <Label htmlFor="quote-phone">{dict.fieldPhone}</Label>
          <Input id="quote-phone" type="tel" {...fieldProps("phone")} />
          <FieldError id="quote-phone-error" show={!!errors.phone} message={dict.errorRequired} />
        </div>
        <div>
          <Label htmlFor="quote-email">{dict.fieldEmail}</Label>
          <Input id="quote-email" type="email" {...fieldProps("email")} />
          <FieldError id="quote-email-error" show={!!errors.email} message={dict.errorEmail} />
        </div>
        <div>
          <Label htmlFor="quote-country">{dict.fieldCountry}</Label>
          <Input id="quote-country" {...fieldProps("country")} />
          <FieldError
            id="quote-country-error"
            show={!!errors.country}
            message={dict.errorRequired}
          />
        </div>
        <div>
          <Label htmlFor="quote-quantity">{dict.fieldQuantity}</Label>
          <Input id="quote-quantity" inputMode="numeric" {...fieldProps("quantity")} />
          <FieldError
            id="quote-quantity-error"
            show={!!errors.quantity}
            message={dict.errorRequired}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="quote-products">{dict.fieldProducts}</Label>
        <Textarea
          id="quote-products"
          placeholder={dict.fieldProductsPlaceholder}
          {...fieldProps("products")}
        />
        <FieldError
          id="quote-products-error"
          show={!!errors.products}
          message={dict.errorRequired}
        />
      </div>

      <div>
        <Label htmlFor="quote-message">{dict.fieldMessage}</Label>
        <Textarea
          id="quote-message"
          placeholder={dict.fieldMessagePlaceholder}
          {...register("message")}
        />
      </div>

      {/*
        Kept mounted so assistive tech is already observing the region when a
        submit fails; an element that appears and announces at the same time is
        missed by some screen readers.
      */}
      <p role="alert" className="text-sm text-danger empty:hidden">
        {status === "error" ? dict.errorGeneric : ""}
      </p>

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
