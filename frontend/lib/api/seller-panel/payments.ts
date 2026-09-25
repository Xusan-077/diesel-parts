import { sellerApiRequest } from "./client";
import type { Payment, PaymentMethod } from "./types";

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}

/** Backend mounts this at bare `/payments`, not under `/seller/*` — see PaymentsController. */
export function createPayment(dto: CreatePaymentInput): Promise<Payment> {
  return sellerApiRequest<Payment>("/payments", { method: "POST", body: dto });
}
