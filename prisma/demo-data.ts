/* ============================================================================
 * DEMO SALES DATA — NOT REAL BUSINESS DATA
 *
 * Orders are created by sellers in their own panel, so until that exists the
 * director's revenue charts have nothing to plot. This script invents a small,
 * plausible order history so those screens can be built and checked against
 * something.
 *
 * Everything it writes is removable:  npm run db:demo -- --clear
 * Every row it creates is tagged, so the clear step cannot touch real data.
 *
 * Run with:  npm run db:demo
 * ==========================================================================*/
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/prisma/generated/prisma/enums";

/** Stamped into notes so --clear can find exactly these rows and no others. */
const DEMO_TAG = "[demo]";
const DEMO_EMAIL_DOMAIN = "@demo.dieselparts.uz";

const SELLERS = [
  { name: "Aziz Karimov", email: `aziz${DEMO_EMAIL_DOMAIN}`, discountLimit: 5 },
  { name: "Nodira Yusupova", email: `nodira${DEMO_EMAIL_DOMAIN}`, discountLimit: 7 },
  { name: "Sardor Rahimov", email: `sardor${DEMO_EMAIL_DOMAIN}`, discountLimit: 3 },
];

const CUSTOMERS = [
  { name: "Bekzod Tursunov", phone: "+998901110011", company: "Qurilish Mash MChJ" },
  { name: "Dilshod Ergashev", phone: "+998901110022", company: "Navoiy Kon Servis" },
  { name: "Shahnoza Alimova", phone: "+998901110033", company: "AgroTexnika XK" },
  { name: "Rustam Nazarov", phone: "+998901110044", company: "Yo'l Qurilish Trest" },
  { name: "Kamola Sobirova", phone: "+998901110055", company: "Zarafshon Logistika" },
];

/** Deterministic, so re-running produces the same history instead of drifting. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const STATUS_MIX: OrderStatus[] = [
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "CONFIRMED",
  "CONFIRMED",
  "PENDING",
  "DRAFT",
  "CANCELLED",
];

function daysAgo(days: number, random: () => number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(Math.floor(random() * 10) + 8, Math.floor(random() * 60), 0, 0);
  return date;
}

async function clear(): Promise<void> {
  const orders = await prisma.order.findMany({
    where: { notes: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.discountRequest.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.customer.deleteMany({ where: { notes: { startsWith: DEMO_TAG } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });

  console.log(`[demo] removed ${orderIds.length} orders and their demo sellers/customers`);
}

async function seedDemo(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { isActive: true, price: { not: null } },
    select: { id: true, sku: true, nameUz: true, price: true },
  });

  if (products.length === 0) {
    throw new Error("No priced products found. Run `npm run db:seed` first.");
  }

  const passwordHash = await hash("demo-not-a-real-password", 12);
  const sellers = [];
  for (const seller of SELLERS) {
    sellers.push(
      await prisma.user.upsert({
        where: { email: seller.email },
        update: { isActive: true },
        create: { ...seller, passwordHash, role: "SELLER" },
      }),
    );
  }

  const customers = [];
  for (const customer of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({ where: { phone: customer.phone } });
    customers.push(
      existing ??
        (await prisma.customer.create({
          data: {
            ...customer,
            notes: `${DEMO_TAG} sample customer`,
            assignedSellerId: sellers[customers.length % sellers.length].id,
          },
        })),
    );
  }

  const random = makeRandom(20260818);
  let created = 0;

  // Ninety days, so "this month vs last month" has both sides to compare.
  for (let day = 89; day >= 0; day -= 1) {
    const ordersToday = Math.floor(random() * 3);

    for (let n = 0; n < ordersToday; n += 1) {
      const seller = sellers[Math.floor(random() * sellers.length)];
      const customer = customers[Math.floor(random() * customers.length)];
      const status = STATUS_MIX[Math.floor(random() * STATUS_MIX.length)];
      const createdAt = daysAgo(day, random);

      const lineCount = 1 + Math.floor(random() * 3);
      const items: {
        productId: string;
        productSku: string;
        productName: string;
        qty: number;
        unitPrice: number;
      }[] = [];
      let subtotal = 0;

      for (let line = 0; line < lineCount; line += 1) {
        const product = products[Math.floor(random() * products.length)];
        if (items.some((item) => item.productId === product.id)) {
          continue;
        }
        const qty = 1 + Math.floor(random() * 4);
        const unitPrice = Number(product.price);
        subtotal += unitPrice * qty;
        items.push({
          productId: product.id,
          productSku: product.sku,
          productName: product.nameUz,
          qty,
          unitPrice,
        });
      }

      if (items.length === 0) {
        continue;
      }

      // Most orders carry no discount; a few carry one within a seller's limit.
      const discount = random() < 0.25 ? Math.round(random() * seller.discountLimit) : 0;
      const total = subtotal * (1 - discount / 100);

      await prisma.order.create({
        data: {
          orderNumber: `DP-${createdAt.getUTCFullYear()}-${String(created + 1).padStart(4, "0")}`,
          customerId: customer.id,
          sellerId: seller.id,
          status,
          subtotal,
          discountRequestedPercent: discount,
          discountApprovedPercent: discount,
          totalAmount: total,
          notes: `${DEMO_TAG} generated order`,
          createdAt,
          updatedAt: createdAt,
          items: { create: items },
        },
      });
      created += 1;
    }
  }

  console.log(
    `[demo] created ${created} orders across 90 days, ${sellers.length} sellers, ${customers.length} customers`,
  );
  console.warn("[demo] this is invented data — remove it with: npm run db:demo -- --clear");
}

const run = process.argv.includes("--clear") ? clear : seedDemo;

run()
  .catch((error: unknown) => {
    console.error("[demo] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
