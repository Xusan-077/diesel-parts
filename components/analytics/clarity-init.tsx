"use client";

import { useEffect } from "react";
import Clarity from "@microsoft/clarity";

/**
 * Starts Microsoft Clarity session replay. Production-only: local/preview
 * traffic would otherwise pollute session recordings and skew heatmaps with
 * developer activity, and `NEXT_PUBLIC_CLARITY_ID` is only ever set for the
 * Production environment in Vercel (see docs/deploy-checklist.md).
 */
export function ClarityInit() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      Clarity.init(process.env.NEXT_PUBLIC_CLARITY_ID!);
    }
  }, []);

  return null;
}
