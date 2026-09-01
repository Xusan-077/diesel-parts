import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Prisma,
  Role,
  OrderStatus,
  OrderPaymentStatus,
  PaymentMethod,
  PaymentStatus,
  StockMovementType,
  NotificationType,
} from '../generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'Passw0rd!123';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('Seeding diesel-parts-erp...');

  // --- Warehouses ---------------------------------------------------------
  const warehouses = await Promise.all(
    [
      { name: 'Main Warehouse - Tashkent', location: 'Tashkent, Yashnobod district' },
      { name: 'Samarkand Branch', location: 'Samarkand, Siob market area' },
      { name: 'Bukhara Branch', location: 'Bukhara, industrial zone' },
    ].map((w) => prisma.warehouse.create({ data: w })),
  );

  // --- Categories & Brands -------------------------------------------------
  // Category/Brand/Product ids are the slug (D1): no @default on the column,
  // and storefront URLs depend on the id being the slug.
  const categories = await Promise.all(
    ['Fuel Injectors', 'Turbochargers', 'Filters', 'Brake Systems', 'Engine Components'].map((name) => {
      const slug = slugify(name);
      return prisma.category.create({
        data: { id: slug, slug, nameUz: name, nameRu: name, nameEn: name },
      });
    }),
  );
  const brands = await Promise.all(
    ['Bosch', 'Denso', 'Delphi', 'Mahle', 'Cummins'].map((name) => {
      const slug = slugify(name);
      return prisma.brand.create({ data: { id: slug, slug, name } });
    }),
  );

  // --- Products --------------------------------------------------------------
  const productDefs = [
    { sku: 'INJ-BSH-1001', name: 'Bosch Common Rail Injector 0445110376', category: 0, brand: 0, sell: 1450000, buy: 980000, minStock: 5 },
    { sku: 'INJ-BSH-1002', name: 'Bosch Common Rail Injector 0445120231', category: 0, brand: 0, sell: 1620000, buy: 1120000, minStock: 5 },
    { sku: 'INJ-DEN-1003', name: 'Denso Injector 095000-6353', category: 0, brand: 1, sell: 1380000, buy: 940000, minStock: 4 },
    { sku: 'INJ-DEL-1004', name: 'Delphi Injector EJBR04101D', category: 0, brand: 2, sell: 1290000, buy: 890000, minStock: 4 },
    { sku: 'TRB-BSH-2001', name: 'Bosch Turbocharger GT2260', category: 1, brand: 0, sell: 3200000, buy: 2350000, minStock: 3 },
    { sku: 'TRB-CUM-2002', name: 'Cummins Turbocharger HX35', category: 1, brand: 4, sell: 3650000, buy: 2680000, minStock: 3 },
    { sku: 'TRB-DEN-2003', name: 'Denso Turbocharger TD04', category: 1, brand: 1, sell: 2950000, buy: 2100000, minStock: 3 },
    { sku: 'FLT-MHL-3001', name: 'Mahle Oil Filter OC90', category: 2, brand: 3, sell: 85000, buy: 52000, minStock: 20 },
    { sku: 'FLT-MHL-3002', name: 'Mahle Fuel Filter KL145', category: 2, brand: 3, sell: 120000, buy: 78000, minStock: 20 },
    { sku: 'FLT-BSH-3003', name: 'Bosch Air Filter S3959', category: 2, brand: 0, sell: 95000, buy: 60000, minStock: 15 },
    { sku: 'FLT-DEL-3004', name: 'Delphi Fuel Filter HDF919', category: 2, brand: 2, sell: 110000, buy: 71000, minStock: 15 },
    { sku: 'BRK-BSH-4001', name: 'Bosch Brake Pad Set 0986494', category: 3, brand: 0, sell: 340000, buy: 220000, minStock: 10 },
    { sku: 'BRK-DEN-4002', name: 'Denso Brake Disc DDF1234', category: 3, brand: 1, sell: 410000, buy: 275000, minStock: 8 },
    { sku: 'BRK-MHL-4003', name: 'Mahle Brake Caliper Kit', category: 3, brand: 3, sell: 780000, buy: 540000, minStock: 5 },
    { sku: 'ENG-CUM-5001', name: 'Cummins Cylinder Head Gasket Set', category: 4, brand: 4, sell: 650000, buy: 430000, minStock: 6 },
    { sku: 'ENG-BSH-5002', name: 'Bosch Timing Belt Kit', category: 4, brand: 0, sell: 520000, buy: 340000, minStock: 8 },
    { sku: 'ENG-DEL-5003', name: 'Delphi Water Pump WP1980', category: 4, brand: 2, sell: 290000, buy: 190000, minStock: 10 },
    { sku: 'ENG-MHL-5004', name: 'Mahle Piston Ring Set', category: 4, brand: 3, sell: 380000, buy: 250000, minStock: 8 },
    { sku: 'ENG-CUM-5005', name: 'Cummins Fuel Pump 3973228', category: 4, brand: 4, sell: 1850000, buy: 1320000, minStock: 4 },
    { sku: 'FLT-DEN-3005', name: 'Denso Cabin Filter DCF001', category: 2, brand: 1, sell: 65000, buy: 40000, minStock: 20 },
  ];

  const products = await Promise.all(
    productDefs.map((p) =>
      prisma.product.create({
        data: {
          id: slugify(p.sku),
          sku: p.sku,
          slug: slugify(p.sku),
          nameUz: p.name,
          nameRu: p.name,
          nameEn: p.name,
          categoryId: categories[p.category].id,
          brandId: brands[p.brand].id,
          descriptionUz: `${p.name} - genuine spare part for diesel engines.`,
          descriptionRu: `${p.name} - genuine spare part for diesel engines.`,
          descriptionEn: `${p.name} - genuine spare part for diesel engines.`,
          price: p.sell,
          purchasePrice: p.buy,
          minStock: p.minStock,
        },
      }),
    ),
  );

  // --- Inventory: stock every product into every warehouse -----------------
  const inventoryByKey = new Map<string, { id: string; quantity: number; reservedQuantity: number }>();
  for (const product of products) {
    for (const warehouse of warehouses) {
      const quantity = Math.floor(Math.random() * 60) + 2; // 2..61
      const row = await prisma.inventory.create({
        data: { productId: product.id, warehouseId: warehouse.id, quantity, reservedQuantity: 0 },
      });
      inventoryByKey.set(`${product.id}:${warehouse.id}`, row);
    }
  }
  // Force a few products low/out of stock in the main warehouse, so the
  // low-stock and out-of-stock endpoints have something real to return.
  const mainWarehouse = warehouses[0];
  const lowStockKey = `${products[7].id}:${mainWarehouse.id}`; // Mahle Oil Filter, minStock 20
  await prisma.inventory.update({ where: { id: inventoryByKey.get(lowStockKey)!.id }, data: { quantity: 6 } });
  inventoryByKey.set(lowStockKey, { ...inventoryByKey.get(lowStockKey)!, quantity: 6 });

  const outOfStockKey = `${products[4].id}:${mainWarehouse.id}`; // Bosch Turbocharger GT2260
  await prisma.inventory.update({ where: { id: inventoryByKey.get(outOfStockKey)!.id }, data: { quantity: 0 } });
  inventoryByKey.set(outOfStockKey, { ...inventoryByKey.get(outOfStockKey)!, quantity: 0 });

  // --- Users & Sellers -------------------------------------------------------
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const userDefs: { phone: string; role: Role }[] = [
    { phone: '+998901112233', role: Role.SUPER_ADMIN },
    { phone: '+998901112234', role: Role.DIRECTOR },
    { phone: '+998901112235', role: Role.MANAGER },
    { phone: '+998901112236', role: Role.SELLER },
    { phone: '+998901112237', role: Role.SELLER },
    { phone: '+998901112238', role: Role.VIEWER },
  ];
  const users = await Promise.all(
    userDefs.map((u) => prisma.user.create({ data: { phone: u.phone, passwordHash, role: u.role } })),
  );

  const [sellerUserA, sellerUserB] = users.filter((u) => u.role === Role.SELLER);
  const sellerA = await prisma.seller.create({ data: { userId: sellerUserA.id, warehouseId: warehouses[0].id } });
  const sellerB = await prisma.seller.create({ data: { userId: sellerUserB.id, warehouseId: warehouses[1].id } });
  const sellers = [sellerA, sellerB];

  // --- Customers ---------------------------------------------------------
  const customerDefs = [
    { name: 'Aziz Karimov', phone: '+998911234501', telegram: '@aziz_karimov' },
    { name: 'Dilnoza Yusupova', phone: '+998911234502', telegram: null },
    { name: 'Rustam Tosh-Avto MChJ', phone: '+998911234503', telegram: '@rustam_toshavto' },
    { name: 'Shahnoza Rakhimova', phone: '+998911234504', telegram: null },
    { name: 'Bekzod Diesel Service', phone: '+998911234505', telegram: '@bekzod_diesel' },
    { name: 'Farrux Nazarov', phone: '+998911234506', telegram: null },
    { name: 'Malika Transport LLC', phone: '+998911234507', telegram: '@malika_transport' },
    { name: 'Jasur Yo\'ldoshev', phone: '+998911234508', telegram: null },
    { name: 'Nodira Cargo Xizmatlari', phone: '+998911234509', telegram: '@nodira_cargo' },
    { name: 'Otabek Mashinasozlik', phone: '+998911234510', telegram: null },
  ];
  const customers = await Promise.all(
    customerDefs.map((c) => prisma.customer.create({ data: { ...c, debt: 0 } })),
  );

  // --- Orders --------------------------------------------------------------
  const statusCycle: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.COMPLETED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ];

  let orderNumber = 1000;
  for (let i = 0; i < 15; i += 1) {
    orderNumber += 1;
    const seller = sellers[i % sellers.length];
    const warehouse = warehouses.find((w) => w.id === seller.warehouseId)!;
    const customer = customers[i % customers.length];
    const status = statusCycle[i % statusCycle.length];

    const itemCount = 1 + (i % 3);
    const chosenProducts = products.slice((i * 2) % products.length, (i * 2) % products.length + itemCount);
    const lines = (chosenProducts.length ? chosenProducts : [products[0]]).map((product) => {
      const qty = 1 + (i % 3);
      const unitPrice = product.price!;
      return {
        productId: product.id,
        productSku: product.sku,
        productName: product.nameEn,
        qty,
        unitPrice,
      };
    });

    const subtotal = lines.reduce(
      (sum, l) => sum.add(l.unitPrice.mul(l.qty)),
      new Prisma.Decimal(0),
    );
    const discount = subtotal.mul(i % 4 === 0 ? 0.05 : 0);
    const deliveryFee = i % 2 === 0 ? 30000 : 0;
    const total = subtotal.sub(discount).add(deliveryFee);

    const paymentStatus =
      status === OrderStatus.COMPLETED
        ? OrderPaymentStatus.PAID
        : status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING
          ? OrderPaymentStatus.PARTIAL
          : OrderPaymentStatus.UNPAID;

    const order = await prisma.order.create({
      data: {
        orderNumber: `DP-${orderNumber}`,
        customerId: customer.id,
        sellerId: seller.id,
        warehouseId: warehouse.id,
        status,
        subtotal,
        discount,
        deliveryFee,
        totalAmount: total,
        paymentStatus,
        items: { create: lines },
      },
    });

    // Reflect the order's status in inventory, same as OrdersService would.
    if (status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING) {
      for (const line of lines) {
        const key = `${line.productId}:${warehouse.id}`;
        const inv = inventoryByKey.get(key)!;
        const reserveQty = Math.min(line.qty, inv.quantity - inv.reservedQuantity);
        if (reserveQty <= 0) continue;
        await prisma.inventory.update({ where: { id: inv.id }, data: { reservedQuantity: { increment: reserveQty } } });
        await prisma.stockMovement.create({
          data: { inventoryId: inv.id, type: StockMovementType.RESERVE, quantity: reserveQty, reason: 'Order confirmed (seed)', createdById: sellerUserA.id },
        });
        inv.reservedQuantity += reserveQty;
      }
    } else if (status === OrderStatus.COMPLETED) {
      for (const line of lines) {
        const key = `${line.productId}:${warehouse.id}`;
        const inv = inventoryByKey.get(key)!;
        const fulfillQty = Math.min(line.qty, inv.quantity);
        if (fulfillQty <= 0) continue;
        await prisma.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: fulfillQty } } });
        await prisma.stockMovement.create({
          data: { inventoryId: inv.id, type: StockMovementType.OUT, quantity: fulfillQty, reason: 'Order completed (seed)', createdById: sellerUserA.id },
        });
        inv.quantity -= fulfillQty;
      }
    }

    if (paymentStatus !== OrderPaymentStatus.UNPAID) {
      const amount = paymentStatus === OrderPaymentStatus.PAID ? total : total.mul(0.5);
      await prisma.payment.create({
        data: { orderId: order.id, amount, method: PaymentMethod.CASH, status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
    }

    if (status === OrderStatus.COMPLETED) {
      await prisma.invoice.create({
        data: { orderId: order.id, invoiceNumber: `INV-${orderNumber}`, issuedAt: new Date() },
      });
    }
  }

  await prisma.orderSequence.upsert({
    where: { id: 1 },
    create: { id: 1, lastNumber: orderNumber },
    update: { lastNumber: orderNumber },
  });

  // --- A couple of sample notifications -----------------------------------
  await prisma.notification.create({
    data: {
      userId: sellerUserA.id,
      type: NotificationType.LOW_STOCK,
      message:
        'Low stock alert: Mahle Oil Filter OC90 is running low at Main Warehouse - Tashkent.',
    },
  });
  await prisma.notification.create({
    data: {
      userId: users.find((u) => u.role === Role.DIRECTOR)!.id,
      type: NotificationType.ORDER_STATUS,
      message: 'Daily summary ready: Yesterday\'s sales report is ready to review.',
    },
  });

  console.log('\nSeed complete. Login with phone + password:');
  for (const u of userDefs) {
    console.log(`  ${u.role.padEnd(11)} ${u.phone}  password: ${SEED_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
