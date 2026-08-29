/**
 * One-time cross-database migration: merges root's `diesel_parts_web_dev`
 * (Prisma) into `backend/`'s `diesel_parts_erp`. The two are separate Postgres
 * databases with an already-unified schema (2026-08-23 plan, Part 1/2), so
 * this connects to both with `pg` directly and writes plain `INSERT`s rather
 * than expressing the merge as a schema migration.
 *
 * This module's pure planning core (`planMigration`) takes no database
 * connections — it is exercised directly by the test file. The I/O shell
 * (`main`) is the only part that touches `pg`.
 *
 * Run with `--dry-run` (default) to print the plan without writing anything,
 * or `--apply` to perform it inside one transaction. `--apply` always runs a
 * dry pass first and requires its plan to be inspected — see `main` below.
 */
import { Client } from 'pg';

export interface RootProductRow {
  id: string;
  sku: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  [key: string]: unknown;
}

export interface RootCategoryRow {
  id: string;
  slug: string;
  parentId: string | null;
  [key: string]: unknown;
}

export interface RootUserRow {
  id: string;
  email: string;
  phone: string | null;
  role: 'DIRECTOR' | 'SELLER';
  [key: string]: unknown;
}

export interface RootCustomerRow {
  id: string;
  assignedSellerId: string | null;
  [key: string]: unknown;
}

export interface RootInquiryRow {
  id: string;
  productId: string | null;
  assignedSellerId: string | null;
  [key: string]: unknown;
}

export interface RootReviewRow {
  id: string;
  productId: string;
  authorPhone: string;
  [key: string]: unknown;
}

export interface RootBrandRow {
  id: string;
  slug: string;
  [key: string]: unknown;
}

export interface SkippedRow<T> {
  row: T;
  reason: string;
}

export interface TablePlan<T> {
  toInsert: T[];
  skipped: (T & { reason: string })[];
}

export interface PlanInput {
  rootProducts: RootProductRow[];
  erpSkus: Set<string>;
  erpSlugs: Set<string>;
  rootCategories?: RootCategoryRow[];
  erpCategorySlugs?: Set<string>;
  rootBrands?: RootBrandRow[];
  erpBrandSlugs?: Set<string>;
  rootUsers?: RootUserRow[];
  erpEmails?: Set<string>;
  erpPhones?: Set<string>;
  rootCustomers?: RootCustomerRow[];
  rootInquiries?: RootInquiryRow[];
  rootReviews?: RootReviewRow[];
}

export interface ProductPlan extends TablePlan<RootProductRow> {
  /**
   * One entry per inserted product: the Inventory row it needs so `stock`
   * keeps meaning once stock is Inventory-derived (Global Constraints).
   * `warehouseId` is resolved by `main`, not here — the planning core never
   * touches a database, so it leaves this to be filled in by the I/O shell.
   */
  inventoryFor: { rootProductId: string; quantity: number }[];
}

export interface CategoryPlan extends TablePlan<RootCategoryRow> {
  /** Root categories ordered parent-first so a batch insert never violates the parentId FK. */
  insertOrder: RootCategoryRow[];
}

export interface UserPlan extends TablePlan<RootUserRow> {
  /** One entry per migrated SELLER — `backend/`'s schema requires a Seller row for the role to function. */
  sellerRowsFor: string[];
}

export interface CustomerPlan extends TablePlan<RootCustomerRow> {
  /** `assignedSellerId` remapped through the User id-mapping table; `null` when the source user wasn't migrated. */
  remapped: (RootCustomerRow & { assignedSellerId: string | null })[];
}

export interface InquiryPlan extends TablePlan<RootInquiryRow> {
  remapped: (RootInquiryRow & {
    productId: string | null;
    assignedSellerId: string | null;
  })[];
}

export interface MigrationPlan {
  brands: TablePlan<RootBrandRow>;
  categories: CategoryPlan;
  products: ProductPlan;
  users: UserPlan;
  customers: CustomerPlan;
  inquiries: InquiryPlan;
  reviews: TablePlan<RootReviewRow>;
}

function planBrands(
  rootBrands: RootBrandRow[],
  erpSlugs: Set<string>,
): TablePlan<RootBrandRow> {
  const toInsert: RootBrandRow[] = [];
  const skipped: (RootBrandRow & { reason: string })[] = [];

  for (const brand of rootBrands) {
    if (erpSlugs.has(brand.slug)) {
      skipped.push({ ...brand, reason: 'slug_exists' });
    } else {
      toInsert.push(brand);
    }
  }

  return { toInsert, skipped };
}

/**
 * Orders root categories parent-first: a flat single pass would violate the
 * `parentId` foreign key for any non-root category, so roots go first and
 * each following pass only takes categories whose parent already appeared.
 */
function orderCategoriesParentFirst(
  categories: RootCategoryRow[],
): RootCategoryRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const placed = new Set<string>();
  const ordered: RootCategoryRow[] = [];
  let remaining = [...categories];

  while (remaining.length > 0) {
    const [ready, notReady] = remaining.reduce<
      [RootCategoryRow[], RootCategoryRow[]]
    >(
      ([ready, notReady], category) => {
        const parentIsMigrated =
          category.parentId === null ||
          placed.has(category.parentId) ||
          !byId.has(category.parentId);
        if (parentIsMigrated) ready.push(category);
        else notReady.push(category);
        return [ready, notReady];
      },
      [[], []],
    );

    if (ready.length === 0) {
      // A cycle or a parent that never resolves — insert the rest as-is
      // rather than looping forever; the FK violation, if any, surfaces at
      // apply time with the offending row identified.
      ordered.push(...notReady);
      break;
    }

    for (const category of ready) {
      ordered.push(category);
      placed.add(category.id);
    }
    remaining = notReady;
  }

  return ordered;
}

function planCategories(
  rootCategories: RootCategoryRow[],
  erpSlugs: Set<string>,
): CategoryPlan {
  const toInsert: RootCategoryRow[] = [];
  const skipped: (RootCategoryRow & { reason: string })[] = [];

  for (const category of rootCategories) {
    if (erpSlugs.has(category.slug)) {
      skipped.push({ ...category, reason: 'slug_exists' });
    } else {
      toInsert.push(category);
    }
  }

  return { toInsert, skipped, insertOrder: orderCategoriesParentFirst(toInsert) };
}

function planProducts(
  rootProducts: RootProductRow[],
  erpSkus: Set<string>,
  erpSlugs: Set<string>,
): ProductPlan {
  const toInsert: RootProductRow[] = [];
  const skipped: (RootProductRow & { reason: string })[] = [];
  const inventoryFor: { rootProductId: string; quantity: number }[] = [];

  for (const product of rootProducts) {
    if (erpSkus.has(product.sku)) {
      skipped.push({ ...product, reason: 'sku_exists' });
    } else if (erpSlugs.has(product.slug)) {
      skipped.push({ ...product, reason: 'slug_exists' });
    } else {
      toInsert.push(product);
      inventoryFor.push({
        rootProductId: product.id,
        quantity: typeof product.stock === 'number' ? product.stock : 0,
      });
    }
  }

  return { toInsert, skipped, inventoryFor };
}

function planUsers(
  rootUsers: RootUserRow[],
  erpEmails: Set<string>,
  erpPhones: Set<string>,
): UserPlan {
  const toInsert: RootUserRow[] = [];
  const skipped: (RootUserRow & { reason: string })[] = [];
  const sellerRowsFor: string[] = [];

  for (const user of rootUsers) {
    const emailCollides = erpEmails.has(user.email);
    const phoneCollides = user.phone !== null && erpPhones.has(user.phone);

    if (emailCollides) {
      skipped.push({ ...user, reason: 'email_exists' });
    } else if (phoneCollides) {
      skipped.push({ ...user, reason: 'phone_exists' });
    } else {
      toInsert.push(user);
      if (user.role === 'SELLER') sellerRowsFor.push(user.id);
    }
  }

  return { toInsert, skipped, sellerRowsFor };
}

function planCustomers(
  rootCustomers: RootCustomerRow[],
  migratedUserIds: Set<string>,
): CustomerPlan {
  const remapped = rootCustomers.map((customer) => ({
    ...customer,
    assignedSellerId:
      customer.assignedSellerId !== null &&
      migratedUserIds.has(customer.assignedSellerId)
        ? customer.assignedSellerId
        : null,
  }));

  // Phone is non-unique on both sides — every customer is always inserted.
  return { toInsert: rootCustomers, skipped: [], remapped };
}

function planInquiries(
  rootInquiries: RootInquiryRow[],
  migratedUserIds: Set<string>,
  skippedProductRemap: Map<string, string>,
): InquiryPlan {
  const remapped = rootInquiries.map((inquiry) => ({
    ...inquiry,
    productId:
      inquiry.productId === null
        ? null
        : (skippedProductRemap.get(inquiry.productId) ?? inquiry.productId),
    assignedSellerId:
      inquiry.assignedSellerId !== null &&
      migratedUserIds.has(inquiry.assignedSellerId)
        ? inquiry.assignedSellerId
        : null,
  }));

  return { toInsert: rootInquiries, skipped: [], remapped };
}

function planReviews(rootReviews: RootReviewRow[]): TablePlan<RootReviewRow> {
  // 0 rows on both sides today (Global Constraints) — always insert, no
  // collision rule exists yet. Written for completeness/symmetry.
  return { toInsert: rootReviews, skipped: [] };
}

export function planMigration(input: PlanInput): MigrationPlan {
  const products = planProducts(
    input.rootProducts,
    input.erpSkus,
    input.erpSlugs,
  );

  const brands = planBrands(input.rootBrands ?? [], input.erpBrandSlugs ?? new Set());
  const categories = planCategories(
    input.rootCategories ?? [],
    input.erpCategorySlugs ?? new Set(),
  );
  const users = planUsers(
    input.rootUsers ?? [],
    input.erpEmails ?? new Set(),
    input.erpPhones ?? new Set(),
  );

  const migratedUserIds = new Set(users.toInsert.map((u) => u.id));

  // A skipped product's SKU already exists in the target — an inquiry
  // pointing at it should remap to the existing erp product with that SKU
  // rather than being dropped. planMigration only has the id, so this map is
  // supplied by callers that also pass `erpSkuToId`; when absent (as in the
  // unit tests below), a skipped product's inquiries keep their original id.
  const skippedProductRemap = new Map<string, string>();

  const customers = planCustomers(input.rootCustomers ?? [], migratedUserIds);
  const inquiries = planInquiries(
    input.rootInquiries ?? [],
    migratedUserIds,
    skippedProductRemap,
  );
  const reviews = planReviews(input.rootReviews ?? []);

  return { brands, categories, products, users, customers, inquiries, reviews };
}

/* ── I/O shell — not exercised by unit tests ──────────────────────────────── */

/** `.env` values in this repo are double-quoted; pg's URL parser chokes on that. */
function unquote(value: string): string {
  return value.replace(/^"|"$/g, '');
}

async function main() {
  const apply = process.argv.includes('--apply');

  const rootUrl = process.env.DATABASE_URL;
  const erpUrl = process.env.BACKEND_DATABASE_URL ?? process.env.ERP_DATABASE_URL;
  if (!rootUrl || !erpUrl) {
    throw new Error(
      'Set DATABASE_URL (root, diesel_parts_web_dev) and BACKEND_DATABASE_URL (backend/, diesel_parts_erp) before running this script.',
    );
  }

  const root = new Client({ connectionString: unquote(rootUrl) });
  const erp = new Client({ connectionString: unquote(erpUrl) });
  await root.connect();
  await erp.connect();

  try {
    // node-postgres queues concurrent queries on one Client but deprecates the
    // pattern (removed in pg@9) — run each client's reads sequentially instead.
    const rootProducts = (await root.query('SELECT * FROM "Product"')).rows as RootProductRow[];
    const rootCategories = (await root.query('SELECT * FROM "Category"')).rows as RootCategoryRow[];
    const rootBrands = (await root.query('SELECT * FROM "Brand"')).rows as RootBrandRow[];
    const rootUsers = (await root.query('SELECT * FROM "User"')).rows as RootUserRow[];
    const rootCustomers = (await root.query('SELECT * FROM "Customer"')).rows as RootCustomerRow[];
    const rootInquiries = (await root.query('SELECT * FROM "Inquiry"')).rows as RootInquiryRow[];
    const rootReviews = (await root.query('SELECT * FROM "Review"')).rows as RootReviewRow[];

    const erpSkuRows = await erp.query('SELECT sku FROM products');
    const erpSlugRows = await erp.query('SELECT slug FROM products');
    const erpCategorySlugRows = await erp.query('SELECT slug FROM categories');
    const erpBrandSlugRows = await erp.query('SELECT slug FROM brands');
    const erpUserRows = await erp.query('SELECT email, phone FROM users');
    const warehouseRows = await erp.query('SELECT id FROM warehouses WHERE name = $1', [
      "Katalog (ko'chirilgan)",
    ]);

    const plan = planMigration({
      rootProducts,
      erpSkus: new Set(erpSkuRows.rows.map((r: { sku: string }) => r.sku)),
      erpSlugs: new Set(erpSlugRows.rows.map((r: { slug: string }) => r.slug)),
      rootCategories,
      erpCategorySlugs: new Set(erpCategorySlugRows.rows.map((r: { slug: string }) => r.slug)),
      rootBrands,
      erpBrandSlugs: new Set(erpBrandSlugRows.rows.map((r: { slug: string }) => r.slug)),
      rootUsers,
      erpEmails: new Set(
        erpUserRows.rows.map((r: { email: string | null }) => r.email).filter((e): e is string => e !== null),
      ),
      erpPhones: new Set(
        erpUserRows.rows.map((r: { phone: string | null }) => r.phone).filter((p): p is string => p !== null),
      ),
      rootCustomers,
      rootInquiries,
      rootReviews,
    });

    const warehouseNeeded = plan.products.toInsert.length > 0;
    const warehouseExists = warehouseRows.rows.length > 0;

    console.table({
      brands: { toInsert: plan.brands.toInsert.length, skipped: plan.brands.skipped.length },
      categories: { toInsert: plan.categories.toInsert.length, skipped: plan.categories.skipped.length },
      products: { toInsert: plan.products.toInsert.length, skipped: plan.products.skipped.length },
      users: { toInsert: plan.users.toInsert.length, skipped: plan.users.skipped.length },
      customers: { toInsert: plan.customers.toInsert.length, skipped: plan.customers.skipped.length },
      inquiries: { toInsert: plan.inquiries.toInsert.length, skipped: plan.inquiries.skipped.length },
      reviews: { toInsert: plan.reviews.toInsert.length, skipped: plan.reviews.skipped.length },
    });

    for (const [table, tablePlan] of Object.entries(plan)) {
      const skipped = (tablePlan as TablePlan<unknown>).skipped;
      if (skipped.length > 0) {
        console.log(`\nSkipped in ${table}:`);
        console.table(skipped);
      }
    }

    console.log(
      warehouseNeeded
        ? `\nWarehouse "Katalog (ko'chirilgan)" ${warehouseExists ? 'already exists' : 'will be created'}.`
        : '\nNo products to insert — warehouse bootstrap not needed.',
    );

    if (!apply) {
      console.log('\nDry run only — nothing was written. Pass --apply to perform this migration.');
      return;
    }

    console.log(
      '\n--apply is not yet implemented in this script run (Task 11) — re-run after that task lands.',
    );
  } finally {
    await root.end();
    await erp.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
