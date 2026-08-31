import type { Dictionary } from "@/lib/i18n/dictionaries";
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
  errorMessage: string | null;
}

/** The line-count/total block, shared by the desktop card (CheckoutClient)
 *  and the mobile sheet (CheckoutSummarySheet) so the two can never drift
 *  into reporting different numbers. */
export function CheckoutOrderSummary({
  cartDict,
  checkoutDict,
  lineCount,
  unitCount,
  total,
  totalLabel,
  unpricedCount,
  errorMessage,
}: CheckoutOrderSummaryProps) {
  return (
    <>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{cartDict.summaryLines}</dt>
          <dd className="tabular-nums text-foreground">{lineCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{cartDict.summaryUnits}</dt>
          <dd className="tabular-nums text-foreground">{unitCount}</dd>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between">
          <dt className="text-muted">{cartDict.summaryPrice}</dt>
          <dd className="font-medium text-foreground">
            {total > 0 ? totalLabel : cartDict.priceOnRequest}
          </dd>
        </div>
      </dl>

      {unpricedCount > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-accent-strong">
          {cartDict.unpricedNote.replace("{count}", String(unpricedCount))}
        </p>
      ) : null}

      {errorMessage ? (
        <Alert variant="danger" className="mt-4">
          <AlertTitle>{checkoutDict.errorGeneric}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
