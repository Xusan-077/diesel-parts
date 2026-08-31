/**
 * Enum-shaped string-literal types for the director-panel and legacy-admin
 * repositories under lib/api/, now that lib/db.ts and the generated Prisma
 * client are gone (see docs/superpowers/plans/2026-08-28-backend-consolidation
 * -director-panel.md's Task 28) — these repositories call backend/ over HTTP,
 * never a local Prisma client, so a hand-written union is all they need.
 *
 * OrderStatus is root's own five-value order lifecycle, NOT backend's raw
 * six-value schema enum (DRAFT|NEW|CONFIRMED|PREPARING|COMPLETED|CANCELLED).
 * `order-repository.ts`'s toRootStatus()/toBackendStatus() fold backend's
 * NEW/PREPARING onto root's PENDING/CONFIRMED at the HTTP boundary, so every
 * consumer of this repository (order-status.ts, customer-timeline.ts,
 * order-status-badge.tsx, analytics-repository.ts, ...) keeps seeing root's
 * original vocabulary. Do not widen this to backend's raw enum — that would
 * be a behavior change, not a type-only fix.
 *
 * DiscountStatus/InquiryStatus/InquirySource are identical on both sides
 * (confirmed against backend/prisma/schema.prisma) so there is only one
 * sensible shape for each.
 */

export type OrderStatus = "DRAFT" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
export type DiscountStatus = "PENDING" | "APPROVED" | "REJECTED";
export type InquiryStatus = "NEW" | "IN_PROGRESS" | "WON" | "LOST";
export type InquirySource = "PRODUCT_DIALOG" | "QUOTE_FORM" | "CONTACT_FORM";
