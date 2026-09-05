/**
 * Manual smoke test for the Order.sellerId -> User FK fix.
 *
 * Exercises, against a real database, the paths that unit tests (mocked Prisma)
 * can't catch:
 *   1. ORDER_INCLUDE resolves (no `seller.user` unknown-field error).
 *   2. Order.sellerId accepts a User id and rejects a non-User id.
 *   3. users.service-style groupBy(['sellerId']) keys straight to the user.
 *   4. getOrCreateHouseSeller() returns a usable User id for checkout.
 *
 * Run:  npx tsx scripts/smoke-order-seller-fk.ts
 * It creates rows under a `smoke-<ts>` namespace and deletes them at the end
 * (even on failure).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  getOrCreateHouseSeller,
  HOUSE_SELLER_EMAIL,
} from '../src/checkout/house-seller';
import { ORDER_INCLUDE } from '../src/orders/orders.service';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const tag = `smoke-${Date.now()}`;
const ids: {
  users: string[];
  customers: string[];
  products: string[];
  orders: string[];
  categories: string[];
  brands: string[];
} = {
  users: [],
  customers: [],
  products: [],
  orders: [],
  categories: [],
  brands: [],
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
}

async function main() {
  const seller = await prisma.user.create({
    data: {
      id: `${tag}-user`,
      name: 'Smoke Seller',
      email: `${tag}@smoke.local`,
      passwordHash: 'x',
      role: 'SELLER',
    },
  });
  ids.users.push(seller.id);

  const brand = await prisma.brand.create({
    data: { id: `${tag}-brand`, slug: `${tag}-brand`, name: 'Smoke' },
  });
  ids.brands.push(brand.id);
  const category = await prisma.category.create({
    data: {
      id: `${tag}-cat`,
      slug: `${tag}-cat`,
      nameUz: 'S',
      nameRu: 'S',
      nameEn: 'S',
    },
  });
  ids.categories.push(category.id);
  const product = await prisma.product.create({
    data: {
      id: `${tag}-prod`,
      slug: `${tag}-prod`,
      sku: `${tag}-SKU`,
      nameUz: 'P',
      nameRu: 'P',
      nameEn: 'Smoke Part',
      descriptionUz: '',
      descriptionRu: '',
      descriptionEn: '',
      price: '100',
      stockStatus: 'available',
      categoryId: category.id,
      brandId: brand.id,
      specs: {},
    },
  });
  ids.products.push(product.id);

  const customer = await prisma.customer.create({
    data: { id: `${tag}-cus`, name: 'Smoke Customer', phone: '+998900000000' },
  });
  ids.customers.push(customer.id);

  console.log(
    '\n1. order.create with sellerId = User.id, read back via ORDER_INCLUDE',
  );
  const created = await prisma.order.create({
    data: {
      orderNumber: `${tag}-DP1`,
      customerId: customer.id,
      sellerId: seller.id,
      subtotal: '200',
      totalAmount: '200',
      status: 'PENDING',
      items: {
        create: [
          {
            productId: product.id,
            productSku: product.sku,
            productName: product.nameEn,
            qty: 2,
            unitPrice: '100',
          },
        ],
      },
    },
    include: ORDER_INCLUDE,
  });
  ids.orders.push(created.id);
  assert(created.seller.id === seller.id, 'created.seller.id === user id');
  assert(
    created.seller.name === 'Smoke Seller',
    'created.seller.name resolved off User',
  );
  assert(created.items.length === 1, 'order line persisted');

  const readBack = await prisma.order.findUniqueOrThrow({
    where: { id: created.id },
    include: { ...ORDER_INCLUDE, discountRequests: true },
  });
  assert(
    readBack.seller.phone === null,
    'findOne-style ORDER_INCLUDE resolves seller off User',
  );

  console.log(
    '\n2. Order.sellerId rejects a non-User id (proves the FK really is -> User)',
  );
  let fkRejected = false;
  try {
    await prisma.order.create({
      data: {
        orderNumber: `${tag}-DP2`,
        customerId: customer.id,
        sellerId: `${tag}-not-a-user`,
        subtotal: '1',
        totalAmount: '1',
      },
    });
  } catch (e) {
    fkRejected = (e as { code?: string }).code === 'P2003';
  }
  assert(fkRejected, 'foreign key violation (P2003) on a bogus sellerId');

  console.log(
    '\n3. groupBy(["sellerId"]) keys straight to the user (users.service path)',
  );
  const grouped = await prisma.order.groupBy({
    by: ['sellerId'],
    where: { sellerId: seller.id },
    _count: { _all: true },
  });
  assert(
    grouped[0]?.sellerId === seller.id,
    'grouped sellerId is the user id, no Seller re-key',
  );

  console.log(
    '\n4. getOrCreateHouseSeller returns a real User id usable as Order.sellerId',
  );
  const house = await getOrCreateHouseSeller(prisma as never);
  const houseUser = await prisma.user.findUnique({ where: { id: house.id } });
  assert(houseUser !== null, 'house seller id is a real User row');
  const houseOrder = await prisma.order.create({
    data: {
      orderNumber: `${tag}-DP3`,
      customerId: customer.id,
      sellerId: house.id,
      subtotal: '1',
      totalAmount: '1',
    },
  });
  ids.orders.push(houseOrder.id);
  assert(
    houseOrder.sellerId === house.id,
    'checkout-style order created under the house user',
  );

  console.log('\nALL SMOKE ASSERTIONS PASSED');
}

async function cleanup() {
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids.orders } } });
  await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
  await prisma.product.deleteMany({ where: { id: { in: ids.products } } });
  await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  await prisma.brand.deleteMany({ where: { id: { in: ids.brands } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  // The house account is created lazily by the checkout path; drop it too if
  // this run is what created it (deleteMany is a no-op / FK-safe otherwise).
  await prisma.user
    .deleteMany({ where: { email: HOUSE_SELLER_EMAIL, orders: { none: {} } } })
    .catch(() => undefined);
}

main()
  .then(() => cleanup())
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('\nSMOKE FAILED:', e);
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
    process.exit(1);
  });
