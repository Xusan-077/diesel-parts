import "server-only";
import type { AccountOrder } from "@/lib/account/orders";
import { callBackendPhoneVerified } from "@/lib/api/internal-backend";

/**
 * The signed-in shopper's orders, newest first. `phone` must come from the
 * verified session — the backend trusts it on the strength of the HMAC
 * signature alone and returns every order under that number.
 */
export function listAccountOrders(phone: string): Promise<AccountOrder[]> {
  return callBackendPhoneVerified<AccountOrder[]>(phone, "checkout/orders");
}
