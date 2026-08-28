"use client";

import { useId, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { StoreEmpty } from "@/components/store/store-empty";
import { useCart, useProfile } from "@/hooks/use-store";
import { formatPrice, sumPrices } from "@/lib/format-price";
import { cartLineCount, cartUnitCount } from "@/lib/store/cart";
import { useResolvedProducts } from "@/hooks/use-resolved-products";
import { usePruneMissing } from "@/hooks/use-prune-missing";
import { ResolvedProductsSkeleton } from "@/components/store/resolved-products-skeleton";
import { CheckoutDetailsForm } from "@/components/store/checkout-details-form";
import { CheckoutOrderSummary } from "@/components/store/checkout-order-summary";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { CheckoutRequestInput } from "@/lib/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CheckoutClientProps {
  lang: Locale;
  dict: Dictionary["checkout"];
  cartDict: Dictionary["cart"];
}

type Status = "submitting" | "idle" | "success" | "error";

/** `order` is opaque here — the proxy route passes it through unparsed, and
 *  the one field this screen reads out of it is optional in the response. */
function getOrderNumber(order: Record<string, unknown>): string | null {
  return typeof order.orderNumber === "string" ? order.orderNumber : null;
}

/** A plain top-level function, not a hook: Payme's checkout lives on another
 *  origin, so this needs a full navigation rather than `next/navigation`. */
function redirectTo(url: string) {
  window.location.href = url;
}

function extractErrorMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }
  const data: unknown = error.response?.data;
  if (data === null || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  const errors = record.errors;
  if (errors !== null && typeof errors === "object") {
    const root = (errors as Record<string, unknown>)._root;
    if (Array.isArray(root) && typeof root[0] === "string") {
      return root[0];
    }
  }
  return typeof record.message === "string" ? record.message : null;
}

/**
 * The local (Zustand/localStorage) cart and the server cart `backend/`'s
 * checkout reads from are two different stores that nothing keeps in sync
 * yet — so every line is pushed to `PUT /api/v1/cart/items` right before
 * `POST /api/v1/checkout`, once, at the moment it is actually needed rather
 * than on every cart edit.
 */
export function CheckoutClient({ lang, dict, cartDict }: CheckoutClientProps) {
  const cart = useCart();
  const { profile } = useProfile();
  const formId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const ids = cart.items.map((item) => item.productId);
  const { items: resolved, isLoading, isSuccess } = useResolvedProducts(ids, lang);
  usePruneMissing(ids, resolved, isSuccess, cart.remove);

  const byId = new Map(resolved.map((entry) => [entry.product.id, entry]));
  const lines = cart.items
    .map((item) => {
      const entry = byId.get(item.productId);
      return entry ? { ...entry, quantity: item.quantity } : null;
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const { total, unpriced } = sumPrices(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity })),
  );
  const unitCount = cartUnitCount(lines);
  const lineCount = cartLineCount(lines);
  const totalLabel = formatPrice(total, lang);

  async function placeOrder(values: CheckoutRequestInput) {
    if (lines.length === 0 || status === "submitting") {
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      await Promise.all(
        lines.map((line) =>
          axios.put("/api/v1/cart/items", {
            productId: line.product.id,
            quantity: line.quantity,
          }),
        ),
      );

      const response = await axios.post("/api/v1/checkout", values);
      const { order, checkoutUrl } = response.data as {
        order: Record<string, unknown>;
        checkoutUrl: string | null;
      };

      cart.clear();

      if (checkoutUrl) {
        redirectTo(checkoutUrl);
        return;
      }

      setOrderNumber(getOrderNumber(order));
      setStatus("success");
    } catch (error) {
      const message = extractErrorMessage(error) ?? dict.errorGeneric;
      setErrorMessage(message);
      setStatus("error");
      toast.error(message);
    }
  }

  if (isLoading) {
    return <ResolvedProductsSkeleton count={cart.items.length} />;
  }

  if (status !== "success" && lines.length === 0) {
    return (
      <StoreEmpty
        icon={PackageCheck}
        message={dict.errorEmpty}
        ctaHref="/products"
        ctaLabel={cartDict.emptyCta}
      />
    );
  }

  if (status === "success") {
    return (
      <Card
        role="status"
        tabIndex={-1}
        ref={(el) => {
          el?.focus();
        }}
      >
        <CardContent className="flex flex-col items-center py-8 text-center">
          <PackageCheck aria-hidden className="size-10 text-success" strokeWidth={1.5} />
          <h2 className="type-section mt-4 text-foreground">{dict.successTitle}</h2>
          <p className="mt-2 max-w-md type-body text-muted">
            {orderNumber
              ? dict.successPendingText.replace("{orderNumber}", orderNumber)
              : dict.successPendingText.replace("#{orderNumber} ", "")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/account/orders" className={buttonVariants({ variant: "outline" })}>
              {dict.viewOrders}
            </Link>
            <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
              {dict.continueShopping}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{dict.itemsTitle}</CardTitle>
            <Link href="/cart" className="text-sm text-accent-strong hover:underline">
              {dict.editCart}
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {lines.map(({ product, quantity }, index) => (
                <li key={product.id}>
                  {index > 0 ? <Separator className="my-3" /> : null}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm text-foreground">
                      {product.name[lang]} <span className="text-muted">({product.sku})</span>
                    </span>
                    <span className="tabular-nums text-sm text-muted">
                      {quantity} × {formatPrice(product.price, lang) ?? cartDict.priceOnRequest}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <CheckoutDetailsForm formId={formId} dict={dict} profile={profile} onSubmit={placeOrder} />
      </div>

      <aside className="lg:sticky lg:top-40">
        <Card>
          <CardHeader>
            <CardTitle>{cartDict.summaryTitle}</CardTitle>
          </CardHeader>

          <CardContent>
            <CheckoutOrderSummary
              cartDict={cartDict}
              checkoutDict={dict}
              lineCount={lineCount}
              unitCount={unitCount}
              total={total}
              totalLabel={totalLabel}
              unpricedCount={unpriced}
              errorMessage={status === "error" ? errorMessage : null}
            />

            <Button type="submit" form={formId} size="lg" className="mt-6 w-full" disabled={status === "submitting"}>
              {status === "submitting" ? dict.submitting : dict.submit}
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
