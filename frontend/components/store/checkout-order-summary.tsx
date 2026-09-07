import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { CheckoutRequestInput } from "@/lib/schemas";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface CheckoutOrderSummaryProps {
  cartDict: Dictionary["cart"];
  checkoutDict: Dictionary["checkout"];
  lineCount: number;
  unitCount: number;
  total: number;
  totalLabel: string | null;
  unpricedCount: number;
  deliveryMethod: CheckoutRequestInput["deliveryMethod"];
  errorMessage: string | null;
}

/** The money block, shared by the desktop card (CheckoutClient) and the mobile
 *  sheet (CheckoutSummarySheet) so the two can never drift into reporting
 *  different numbers. Items, then the delivery line, then the total set apart
 *  as the figure the eye should land on. */
export function CheckoutOrderSummary({
  cartDict,
  checkoutDict,
  lineCount,
  unitCount,
  total,
  totalLabel,
  unpricedCount,
  deliveryMethod,
  errorMessage,
}: CheckoutOrderSummaryProps) {
  const priced = total > 0 && totalLabel !== null;
  // Backend charges no delivery fee yet — a courier order is quoted by an
  // operator, a pickup order is free. Either way the total below is the goods.
  const deliveryValue =
    deliveryMethod === "DELIVERY"
      ? checkoutDict.deliveryFeeNegotiated
      : checkoutDict.deliveryFeeFree;

  return (
    <>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">
            {checkoutDict.summaryItemsLabel}{" "}
            <span className="tabular-nums">({unitCount})</span>
          </dt>
          <dd className="tabular-nums text-foreground">
            {priced ? totalLabel : cartDict.priceOnRequest}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{checkoutDict.deliveryFeeLabel}</dt>
          <dd className="text-foreground">{deliveryValue}</dd>
        </div>
      </dl>

      <Separator className="my-3" />

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-foreground">{checkoutDict.totalLabel}</span>
        <span className="type-figure text-foreground">
          {priced ? totalLabel : cartDict.priceOnRequest}
        </span>
      </div>

      {unpricedCount > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-accent-strong">
          {cartDict.unpricedNote.replace("{count}", String(unpricedCount))}
        </p>
      ) : null}

      {/* `lineCount` still drives the SR-only tally so the count is not lost
          when the visible row collapses items into a single figure. */}
      <p className="sr-only">{cartDict.summaryLines}: {lineCount}</p>

      {errorMessage ? (
        /* Title is a fixed short label, description carries the specific
           reason. They must never be the same string: when the backend
           returns no detail, `errorMessage` falls back to `errorGeneric`
           in CheckoutClient, and using that as the title too printed the
           same sentence twice inside one alert. */
        <Alert variant="danger" className="mt-4">
          <AlertTitle>{checkoutDict.errorTitle}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
