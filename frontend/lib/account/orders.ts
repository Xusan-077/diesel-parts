import type { BadgeProps } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The account page's order history, as `backend/`'s `GET /checkout/orders`
 * sends it (`CheckoutService.listOrders`). Amounts arrive as numbers and dates
 * as ISO strings — the backend converts them so nothing here parses `Decimal`.
 */

export type AccountOrderStatus =
  | "DRAFT"
  | "NEW"
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "COMPLETED"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type AccountOrderPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface AccountOrderItem {
  productId: string;
  productSku: string;
  /** Snapshot taken at checkout — English, whatever the shopper's language. */
  productName: string;
  qty: number;
  unitPrice: number;
  product: {
    slug: string;
    nameUz: string;
    nameRu: string;
    nameEn: string;
    imageUrl: string | null;
  } | null;
}

export interface AccountOrder {
  id: string;
  orderNumber: string;
  status: AccountOrderStatus;
  paymentStatus: AccountOrderPaymentStatus;
  deliveryMethod: "PICKUP" | "DELIVERY";
  currency: string;
  totalAmount: number;
  createdAt: string;
  items: AccountOrderItem[];
}

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * DRAFT is what a checkout order is created as, so to the shopper it reads the
 * same as NEW — "received" — and takes the same neutral badge.
 */
export const ORDER_STATUS_VARIANT: Record<AccountOrderStatus, BadgeVariant> = {
  DRAFT: "default",
  NEW: "default",
  PENDING: "default",
  CONFIRMED: "info",
  PREPARING: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "danger",
};

export const PAYMENT_STATUS_VARIANT: Record<AccountOrderPaymentStatus, BadgeVariant> = {
  UNPAID: "default",
  PARTIAL: "warning",
  PAID: "success",
};

/**
 * The line's name in the reader's language. The order's own snapshot is only
 * a fallback: it is always English, and it is all there is once the product
 * row is gone.
 */
export function orderItemName(item: AccountOrderItem, locale: Locale): string {
  if (!item.product) {
    return item.productName;
  }
  const byLocale: Record<Locale, string> = {
    uz: item.product.nameUz,
    ru: item.product.nameRu,
    en: item.product.nameEn,
  };
  return byLocale[locale] || item.productName;
}

/** Units across every line, for the "{count} items" summary. */
export function orderUnitCount(order: AccountOrder): number {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}
