import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import {
  ORDER_STATUS_VARIANT,
  PAYMENT_STATUS_VARIANT,
  orderItemName,
  orderUnitCount,
  type AccountOrder,
} from "@/lib/account/orders";
import { formatPrice } from "@/lib/format-price";
import { formatDate } from "@/lib/warehouse/format";
import { Badge } from "@/components/ui/badge";
import { AccountPanelCard } from "./account-section";

type OrderHistoryDict = Dictionary["account"]["orderHistory"];

/**
 * The cabinet's order history: one card row per order with its lines listed
 * underneath, so a shopper can see what they bought without a second page.
 *
 * Server-safe like the rest of the cabinet's sections. Dates go through the
 * warehouse module's hand-assembled `dd.mm.yyyy` formatter (fixed to
 * Asia/Tashkent) rather than a locale pattern, for the ICU reasons its doc
 * comment gives.
 */
export function AccountOrders({
  title,
  orders,
  dict,
  locale,
}: {
  title: string;
  orders: readonly AccountOrder[];
  dict: OrderHistoryDict;
  locale: Locale;
}) {
  return (
    <AccountPanelCard title={title}>
      <ul className="divide-y divide-border">
        {orders.map((order) => (
          <li key={order.id} className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="type-body font-medium text-foreground">
                  {dict.orderLabel} {order.orderNumber}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {dict.placedOn}: {formatDate(order.createdAt)} ·{" "}
                  {order.deliveryMethod === "DELIVERY" ? dict.delivery : dict.pickup} ·{" "}
                  {dict.itemCount.replace("{count}", String(orderUnitCount(order)))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{dict.status[order.status]}</Badge>
                <Badge variant={PAYMENT_STATUS_VARIANT[order.paymentStatus]}>
                  {dict.payment[order.paymentStatus]}
                </Badge>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {order.items.map((item, index) => {
                const name = orderItemName(item, locale);
                return (
                  // A POS sale can carry the same product on two lines.
                  <li key={`${item.productId}-${index}`} className="flex justify-between gap-4 text-sm">
                    <span className="min-w-0 text-foreground">
                      {item.product ? (
                        <Link href={`/products/${item.product.slug}`} className="hover:underline">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                      <span className="text-muted"> × {item.qty}</span>
                    </span>
                    <span className="shrink-0 text-muted">{formatPrice(item.unitPrice * item.qty, locale)}</span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 flex justify-between border-t border-border pt-3 type-body font-medium text-foreground">
              <span>{dict.total}</span>
              <span>{formatPrice(order.totalAmount, locale)}</span>
            </p>
          </li>
        ))}
      </ul>
    </AccountPanelCard>
  );
}

/** The history's failure state: the backend was unreachable or refused. */
export function AccountOrdersError({ title, message }: { title: string; message: string }) {
  return (
    <AccountPanelCard title={title}>
      <p role="alert" className="px-6 py-14 text-center type-body text-muted">
        {message}
      </p>
    </AccountPanelCard>
  );
}
