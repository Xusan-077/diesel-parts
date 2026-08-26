/* ============================================================================
 * CLEAR TEST DATA — deletes rows from exactly 7 tables, in FK-safe order.
 *
 * Scope (nothing else is ever touched):
 *   OrderItem, DiscountRequest, Order, Review, Inquiry, Notification, Customer
 *
 * The User table (login accounts) is never imported, queried, or referenced
 * by this script under any flag.
 *
 * Reads DATABASE_URL from the environment exactly as it is set when the
 * script starts — it does not load .env.local or any other file. That is
 * deliberate: which database this runs against is decided by whoever sets
 * $env:DATABASE_URL before invoking it, not by this file.
 *
 * Modes:
 *   npx tsx scripts/clear-test-data.ts             -> dry run: prints row
 *                                                      counts only, deletes
 *                                                      nothing.
 *   npx tsx scripts/clear-test-data.ts --execute    -> shows the same counts,
 *                                                      then requires typing
 *                                                      DELETE at a prompt
 *                                                      before touching a
 *                                                      single row.
 * ==========================================================================*/
import { createInterface } from "node:readline/promises";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/prisma/generated/prisma/client";

/**
 * Deletion order matters for FK integrity, and differs slightly from a naive
 * "top to bottom" read of the schema:
 *   - OrderItem and DiscountRequest both hold a Cascade FK to Order, so they
 *     must go before Order (or Order's cascade would remove them as a side
 *     effect mid-script, ahead of their own reported count).
 *   - Order holds a Restrict FK to Customer, so Order must be gone before
 *     Customer can be deleted at all.
 *   - Review only references Product (untouched), so it has no ordering
 *     constraint against the others.
 *   - Inquiry is referenced by Order.inquiryId (SetNull), so clearing Order
 *     first means Inquiry can never be blocked.
 *   - Notification only references User (untouched), so it is independent.
 */
const TABLES = [
  "OrderItem",
  "DiscountRequest",
  "Order",
  "Review",
  "Inquiry",
  "Notification",
  "Customer",
] as const;

type TableName = (typeof TABLES)[number];

function countOf(table: TableName): Promise<number> {
  switch (table) {
    case "OrderItem":
      return prisma.orderItem.count();
    case "DiscountRequest":
      return prisma.discountRequest.count();
    case "Order":
      return prisma.order.count();
    case "Review":
      return prisma.review.count();
    case "Inquiry":
      return prisma.inquiry.count();
    case "Notification":
      return prisma.notification.count();
    case "Customer":
      return prisma.customer.count();
  }
}

/** Same switch shape as countOf, so the two can never drift apart silently. */
function deleteAllOf(
  table: TableName,
  tx: Prisma.TransactionClient,
): Promise<{ count: number }> {
  switch (table) {
    case "OrderItem":
      return tx.orderItem.deleteMany();
    case "DiscountRequest":
      return tx.discountRequest.deleteMany();
    case "Order":
      return tx.order.deleteMany();
    case "Review":
      return tx.review.deleteMany();
    case "Inquiry":
      return tx.inquiry.deleteMany();
    case "Notification":
      return tx.notification.deleteMany();
    case "Customer":
      return tx.customer.deleteMany();
  }
}

/** Host and database name only — never the credentials embedded in the URL. */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL could not be parsed)";
  }
}

async function printCounts(): Promise<Record<TableName, number>> {
  const counts = {} as Record<TableName, number>;
  for (const table of TABLES) {
    counts[table] = await countOf(table);
  }
  console.log("\nCurrent row counts:");
  for (const table of TABLES) {
    console.log(`  ${table.padEnd(16)} ${counts[table]}`);
  }
  return counts;
}

async function confirm(target: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\nAbout to DELETE all rows above from: ${target}`);
  console.log("This cannot be undone. Products, brands, categories, and every");
  console.log("User (login) row are never touched by this script.");
  const answer = await rl.question('Type "DELETE" (all caps, no quotes) to proceed: ');
  rl.close();
  return answer.trim() === "DELETE";
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const target = describeTarget(process.env.DATABASE_URL ?? "");

  console.log(`Target database: ${target}`);
  console.log(execute ? "Mode: EXECUTE (will delete after confirmation)" : "Mode: DRY RUN (no deletes)");

  const before = await printCounts();

  if (!execute) {
    console.log("\nDry run only — nothing was deleted. Re-run with --execute to delete.");
    return;
  }

  const proceed = await confirm(target);
  if (!proceed) {
    console.log("\nNot confirmed — nothing was deleted.");
    return;
  }

  const results = await prisma.$transaction(async (tx) => {
    const deleted = {} as Record<TableName, number>;
    for (const table of TABLES) {
      const { count } = await deleteAllOf(table, tx);
      deleted[table] = count;
    }
    return deleted;
  });

  console.log("\nDeleted:");
  for (const table of TABLES) {
    console.log(`  ${table.padEnd(16)} ${results[table]} (had ${before[table]})`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("[clear-test-data] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
