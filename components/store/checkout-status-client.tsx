"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Phase = "processing" | "success" | "failed";

interface OrderStatusResponse {
  orderNumber: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  latestPaymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | null;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~1 minute of polling before settling on "processing"

/**
 * Payme's redirect back to this page carries no documented, trustworthy
 * success/failure signal of its own — the only source of truth is this
 * poll against backend/'s own Payment record, set exclusively by Payme's
 * webhook (see CheckoutService.getOrderStatus's doc comment).
 */
export function resolvePhase(data: OrderStatusResponse): Phase {
  if (data.paymentStatus === "PAID" || data.latestPaymentStatus === "COMPLETED") {
    return "success";
  }
  if (data.latestPaymentStatus === "FAILED" || data.latestPaymentStatus === "REFUNDED") {
    return "failed";
  }
  return "processing";
}

export function CheckoutStatusClient({ orderId, dict }: { orderId: string; dict: Dictionary["checkout"] }) {
  const [phase, setPhase] = useState<Phase>("processing");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const pollsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const { data } = await axios.get<{ success: true } & OrderStatusResponse>(
          `/api/v1/checkout/orders/${orderId}`,
        );
        if (cancelled) return;

        setOrderNumber(data.orderNumber);
        const next = resolvePhase(data);
        setPhase(next);

        pollsRef.current += 1;
        if (next === "processing" && pollsRef.current < MAX_POLLS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setPhase("failed");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  const content = {
    processing: {
      icon: Clock,
      iconClassName: "text-muted animate-pulse",
      title: dict.statusProcessingTitle,
      text: dict.statusProcessingText,
    },
    success: {
      icon: CheckCircle2,
      iconClassName: "text-success",
      title: dict.statusSuccessTitle,
      text: orderNumber
        ? dict.statusSuccessText.replace("{orderNumber}", orderNumber)
        : dict.statusSuccessText.replace("#{orderNumber} ", ""),
    },
    failed: {
      icon: XCircle,
      iconClassName: "text-danger",
      title: dict.statusFailedTitle,
      text: dict.statusFailedText,
    },
  }[phase];

  return (
    <Card role="status">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <Icon icon={content.icon} size="xl" className={content.iconClassName} strokeWidth={1.5} />
        <h1 className="type-section mt-4 text-foreground">{content.title}</h1>
        <p className="mt-2 max-w-md type-body text-muted">{content.text}</p>
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
