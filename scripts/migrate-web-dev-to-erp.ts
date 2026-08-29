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
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
  /** sku -> existing erp product id, for remapping an inquiry onto the erp row a skipped product collided with. */
  erpSkuToId?: Map<string, string>;
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
  // rather than being dropped, when the caller supplied `erpSkuToId` (the I/O
  // shell does; the unit tests below mostly don't, and a skipped product's
  // inquiries then keep their original — now dangling — id).
  const skippedProductRemap = new Map<string, string>();
  if (input.erpSkuToId) {
    for (const skipped of products.skipped) {
      if (skipped.reason !== 'sku_exists') continue;
      const erpId = input.erpSkuToId.get(skipped.sku);
      if (erpId) skippedProductRemap.set(skipped.id, erpId);
    }
  }

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

/**
 * The Windows installer for Postgres does not add `pg_dump` to PATH, so a
 * bare `pg_dump` invocation on this environment reliably fails even when it
 * is installed. Try PATH first (works on Linux/macOS CI), then the standard
 * Windows install location, preferring the newest version directory found.
 */
function resolvePgDump(): string {
  const override = process.env.PG_DUMP_PATH;
  if (override) return override;

  const installRoots = [
    'C:\\Program Files\\PostgreSQL',
    'C:\\Program Files (x86)\\PostgreSQL',
  ];
  const candidates: string[] = [];
  for (const root of installRoots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const exe = path.join(root, entry, 'bin', 'pg_dump.exe');
      if (existsSync(exe)) candidates.push(exe);
    }
  }
  // Version directories are plain numbers ("17", "18") — numeric sort picks
  // the newest rather than a lexical one misordering "9" after "17".
  candidates.sort((a, b) => {
    const versionOf = (p: string) => Number(path.basename(path.dirname(path.dirname(p))));
    return versionOf(b) - versionOf(a);
  });

  return candidates[0] ?? 'pg_dump';
}

/**
 * Prisma connection strings carry a `?schema=` query param that libpq-based
 * tools (pg_dump, psql) don't recognize as a URI param — `pg`'s own Client
 * tolerates it, but pg_dump errors with "invalid URI query parameter". Strip
 * it; `public` is the default schema pg_dump would dump anyway.
 */
function stripPrismaSchemaParam(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('schema');
  return parsed.toString();
}

/**
 * Dumps `backend/`'s database before `--apply` writes anything — the rollback
 * path if the migration goes wrong. Never committed (see .gitignore).
 */
async function backupErpDatabase(erpUrl: string): Promise<string> {
  const dir = path.join(process.cwd(), 'scripts', 'backups');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(dir, `diesel_parts_erp_pre_migration_${date}.sql`);

  await execFileAsync(resolvePgDump(), [
    '--dbname',
    stripPrismaSchemaParam(erpUrl),
    '--file',
    file,
  ]);
  return file;
}

async function insertBrand(client: Client, row: RootBrandRow) {
  await client.query(
    `INSERT INTO brands (id, slug, name, logo_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [row.id, row.slug, row.name, row.logoUrl ?? null],
  );
}

async function insertCategory(client: Client, row: RootCategoryRow) {
  await client.query(
    `INSERT INTO categories
       (id, slug, name_uz, name_ru, name_en, type, parent_id, "order", icon, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      row.id,
      row.slug,
      row.nameUz,
      row.nameRu,
      row.nameEn,
      row.type ?? 'general',
      row.parentId,
      row.order ?? 0,
      row.icon ?? null,
      row.createdAt ?? new Date(),
    ],
  );
}

async function insertProduct(client: Client, row: RootProductRow) {
  await client.query(
    `INSERT INTO products
       (id, slug, sku, oem_numbers, name_uz, name_ru, name_en,
        description_uz, description_ru, description_en, category_id, brand_id,
        compatible_models, specs, price, currency, purchase_price, image_url,
        min_stock, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15,
             $16, $17, $18, $19, $20, $21, NOW())`,
    [
      row.id,
      row.slug,
      row.sku,
      row.oemNumbers ?? [],
      row.nameUz,
      row.nameRu,
      row.nameEn,
      row.descriptionUz ?? '',
      row.descriptionRu ?? '',
      row.descriptionEn ?? '',
      row.categoryId,
      row.brandId,
      row.compatibleModels ?? [],
      // `pg` serializes a JS array as a Postgres array literal, not JSON —
      // `specs` is jsonb, so it must be stringified explicitly (root's own
      // `Product.specs` is itself an array-of-objects shape).
      JSON.stringify(row.specs ?? {}),
      row.price,
      row.currency ?? 'UZS',
      // Root never had this column — a migrated product has no purchase-price
      // figure on record until a director fills one in.
      null,
      row.imageUrl ?? null,
      row.minStock ?? 0,
      row.isActive ?? true,
      row.createdAt ?? new Date(),
    ],
  );
}

async function insertInventory(
  client: Client,
  productId: string,
  warehouseId: string,
  quantity: number,
) {
  await client.query(
    `INSERT INTO inventories (id, product_id, warehouse_id, quantity, reserved_quantity, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, NOW(), NOW())`,
    [randomUUID(), productId, warehouseId, quantity],
  );
}

async function insertUser(client: Client, row: RootUserRow) {
  await client.query(
    `INSERT INTO users (id, phone, email, name, password_hash, role, is_active, discount_limit, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      row.id,
      row.phone,
      row.email,
      row.name ?? '',
      row.passwordHash,
      row.role,
      row.isActive ?? true,
      row.discountLimit ?? 5,
      row.createdAt ?? new Date(),
    ],
  );
}

/**
 * `warehouseId: null` — resolved lazily, same as the checkout CRM-order path
 * already does (2026-08-23 plan, Task 10), not tied to the catalog warehouse.
 */
async function insertSeller(client: Client, userId: string) {
  await client.query(
    `INSERT INTO sellers (id, user_id, warehouse_id, created_at, updated_at)
     VALUES ($1, $2, NULL, NOW(), NOW())`,
    [randomUUID(), userId],
  );
}

async function insertCustomer(
  client: Client,
  row: RootCustomerRow & { assignedSellerId: string | null },
) {
  await client.query(
    `INSERT INTO customers
       (id, name, phone, email, company, notes, tax_id, telegram, debt, assigned_seller_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, 0, $7, $8, $9)`,
    [
      row.id,
      row.name,
      row.phone,
      row.email ?? null,
      row.company ?? null,
      row.notes ?? null,
      row.assignedSellerId,
      row.createdAt ?? new Date(),
      row.updatedAt ?? new Date(),
    ],
  );
}

async function insertInquiry(
  client: Client,
  row: RootInquiryRow & { productId: string | null; assignedSellerId: string | null },
) {
  await client.query(
    `INSERT INTO inquiries
       (id, customer_name, phone, email, message, product_id, product_sku,
        quantity, status, source, assigned_seller_id, notes, follow_up_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      row.id,
      row.customerName,
      row.phone,
      row.email ?? null,
      row.message,
      row.productId,
      row.productSku ?? null,
      row.quantity ?? null,
      row.status,
      row.source,
      row.assignedSellerId,
      row.notes ?? null,
      row.followUpAt ?? null,
      row.createdAt ?? new Date(),
    ],
  );
}

async function insertReview(client: Client, row: RootReviewRow) {
  await client.query(
    `INSERT INTO reviews (id, product_id, rating, body, author_name, author_phone, is_approved, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      row.id,
      row.productId,
      row.rating,
      row.body ?? null,
      row.authorName,
      row.authorPhone,
      row.isApproved ?? true,
      row.createdAt ?? new Date(),
    ],
  );
}

/**
 * Writes the whole plan inside one transaction — insert order follows the
 * FK dependency chain (categories/brands before products, products before
 * their Inventory row, users before the Seller rows a migrated SELLER needs).
 * Any failure rolls back the entire batch; nothing is left half-applied.
 */
async function applyPlan(erp: Client, plan: MigrationPlan, warehouseId: string) {
  await erp.query('BEGIN');
  try {
    for (const brand of plan.brands.toInsert) await insertBrand(erp, brand);
    for (const category of plan.categories.insertOrder) await insertCategory(erp, category);
    for (const product of plan.products.toInsert) await insertProduct(erp, product);
    for (const { rootProductId, quantity } of plan.products.inventoryFor) {
      await insertInventory(erp, rootProductId, warehouseId, quantity);
    }
    for (const user of plan.users.toInsert) await insertUser(erp, user);
    for (const userId of plan.users.sellerRowsFor) await insertSeller(erp, userId);
    for (const customer of plan.customers.remapped) await insertCustomer(erp, customer);
    for (const inquiry of plan.inquiries.remapped) await insertInquiry(erp, inquiry);
    for (const review of plan.reviews.toInsert) await insertReview(erp, review);
    await erp.query('COMMIT');
  } catch (error) {
    await erp.query('ROLLBACK');
    throw error;
  }
}

async function ensureCatalogWarehouse(erp: Client): Promise<string> {
  const existing = await erp.query(
    'SELECT id FROM warehouses WHERE name = $1',
    ["Katalog (ko'chirilgan)"],
  );
  if (existing.rows.length > 0) return (existing.rows[0] as { id: string }).id;

  const created = await erp.query(
    `INSERT INTO warehouses (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
    [randomUUID(), "Katalog (ko'chirilgan)"],
  );
  return (created.rows[0] as { id: string }).id;
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

    const erpSkuRows = await erp.query('SELECT id, sku FROM products');
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
      erpSkuToId: new Map(
        erpSkuRows.rows.map((r: { id: string; sku: string }) => [r.sku, r.id]),
      ),
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

    console.log('\nBacking up backend/\'s database before writing anything...');
    const backupPath = await backupErpDatabase(unquote(erpUrl));
    console.log(`Backup written to ${backupPath}`);

    const warehouseId = warehouseNeeded
      ? await ensureCatalogWarehouse(erp)
      : ((warehouseRows.rows[0] as { id: string } | undefined)?.id ?? '');

    console.log('\nApplying migration inside one transaction...');
    await applyPlan(erp, plan, warehouseId);

    const finalCounts: Record<string, number> = {};
    for (const table of ['brands', 'categories', 'products', 'users', 'customers', 'inquiries']) {
      const result = await erp.query(`SELECT count(*)::int AS count FROM ${table}`);
      finalCounts[table] = (result.rows[0] as { count: number }).count;
    }

    console.log('\nMigration applied. Post-migration row counts:');
    console.table(finalCounts);
    console.log(
      `\nRollback path if anything looks wrong: restore from ${backupPath} ` +
        `(psql -d diesel_parts_erp -f "${backupPath}").`,
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
