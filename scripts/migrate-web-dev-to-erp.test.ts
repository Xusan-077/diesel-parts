import { describe, expect, it } from "vitest";
import { planMigration } from "./migrate-web-dev-to-erp";

describe("planMigration", () => {
  it("marks a product skipped when its SKU already exists in the target", () => {
    const rootProducts = [
      { id: "r1", sku: "DUP-1", slug: "dup-1", nameUz: "X", nameRu: "X", nameEn: "X" },
    ];
    const erpSkus = new Set(["DUP-1"]);

    const plan = planMigration({ rootProducts, erpSkus, erpSlugs: new Set() });

    expect(plan.products.skipped).toHaveLength(1);
    expect(plan.products.skipped[0]).toMatchObject({ id: "r1", reason: "sku_exists" });
    expect(plan.products.toInsert).toHaveLength(0);
  });

  it("plans an insert for a non-colliding product", () => {
    const rootProducts = [
      { id: "r2", sku: "NEW-1", slug: "new-1", nameUz: "Y", nameRu: "Y", nameEn: "Y" },
    ];
    const plan = planMigration({ rootProducts, erpSkus: new Set(), erpSlugs: new Set() });

    expect(plan.products.toInsert).toEqual(rootProducts);
    expect(plan.products.skipped).toHaveLength(0);
  });

  it("plans an Inventory row for every inserted product, carrying its stock", () => {
    const rootProducts = [
      { id: "r3", sku: "NEW-2", slug: "new-2", nameUz: "Z", nameRu: "Z", nameEn: "Z", stock: 14 },
    ];
    const plan = planMigration({ rootProducts, erpSkus: new Set(), erpSlugs: new Set() });

    expect(plan.products.inventoryFor).toEqual([{ rootProductId: "r3", quantity: 14 }]);
  });

  it("plans no Inventory row for a skipped (colliding) product", () => {
    const rootProducts = [
      { id: "r4", sku: "DUP-2", slug: "dup-2", nameUz: "W", nameRu: "W", nameEn: "W", stock: 5 },
    ];
    const plan = planMigration({
      rootProducts,
      erpSkus: new Set(["DUP-2"]),
      erpSlugs: new Set(),
    });

    expect(plan.products.inventoryFor).toHaveLength(0);
  });

  it("orders categories parent-first so a batch insert never violates the parentId FK", () => {
    const rootCategories = [
      { id: "child", slug: "child", parentId: "root" },
      { id: "grandchild", slug: "grandchild", parentId: "child" },
      { id: "root", slug: "root", parentId: null },
    ];

    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootCategories,
      erpCategorySlugs: new Set(),
    });

    const order = plan.categories.insertOrder.map((c) => c.id);
    expect(order.indexOf("root")).toBeLessThan(order.indexOf("child"));
    expect(order.indexOf("child")).toBeLessThan(order.indexOf("grandchild"));
  });

  it("skips a category whose slug already exists in the target", () => {
    const rootCategories = [{ id: "c1", slug: "engine", parentId: null }];
    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootCategories,
      erpCategorySlugs: new Set(["engine"]),
    });

    expect(plan.categories.skipped).toHaveLength(1);
    expect(plan.categories.toInsert).toHaveLength(0);
  });

  it("creates a Seller row for a migrated SELLER but not for a migrated DIRECTOR", () => {
    const rootUsers = [
      { id: "u-director", email: "director@dieselparts.uz", phone: null, role: "DIRECTOR" as const },
      { id: "u-seller", email: "seller@dieselparts.uz", phone: null, role: "SELLER" as const },
    ];

    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootUsers,
      erpEmails: new Set(),
      erpPhones: new Set(),
    });

    expect(plan.users.sellerRowsFor).toEqual(["u-seller"]);
    expect(plan.users.toInsert).toHaveLength(2);
  });

  it("skips a user whose email already exists in the target", () => {
    const rootUsers = [
      { id: "u1", email: "taken@dieselparts.uz", phone: null, role: "SELLER" as const },
    ];

    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootUsers,
      erpEmails: new Set(["taken@dieselparts.uz"]),
      erpPhones: new Set(),
    });

    expect(plan.users.skipped).toEqual([
      { ...rootUsers[0], reason: "email_exists" },
    ]);
  });

  it("always inserts a customer — phone is non-unique on both sides", () => {
    const rootCustomers = [{ id: "cust-1", assignedSellerId: null }];
    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootCustomers,
    });

    expect(plan.customers.toInsert).toEqual(rootCustomers);
    expect(plan.customers.skipped).toHaveLength(0);
  });

  it("remaps a customer's assignedSellerId to null when that seller wasn't migrated", () => {
    const rootUsers = [
      { id: "u-migrated", email: "a@x.uz", phone: null, role: "SELLER" as const },
    ];
    const rootCustomers = [
      { id: "cust-1", assignedSellerId: "u-migrated" },
      { id: "cust-2", assignedSellerId: "u-not-migrated" },
    ];

    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootUsers,
      erpEmails: new Set(),
      erpPhones: new Set(),
      rootCustomers,
    });

    expect(plan.customers.remapped).toEqual([
      { id: "cust-1", assignedSellerId: "u-migrated" },
      { id: "cust-2", assignedSellerId: null },
    ]);
  });

  it("remaps an inquiry's assignedSellerId to null when that seller wasn't migrated", () => {
    const rootUsers = [
      { id: "u-migrated", email: "a@x.uz", phone: null, role: "SELLER" as const },
    ];
    const rootInquiries = [
      { id: "inq-1", productId: null, assignedSellerId: "u-migrated" },
      { id: "inq-2", productId: null, assignedSellerId: "u-not-migrated" },
    ];

    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootUsers,
      erpEmails: new Set(),
      erpPhones: new Set(),
      rootInquiries,
    });

    expect(plan.inquiries.remapped).toEqual([
      { id: "inq-1", productId: null, assignedSellerId: "u-migrated" },
      { id: "inq-2", productId: null, assignedSellerId: null },
    ]);
  });

  it("plans reviews for completeness even with zero rows on both sides", () => {
    const plan = planMigration({ rootProducts: [], erpSkus: new Set(), erpSlugs: new Set() });
    expect(plan.reviews).toEqual({ toInsert: [], skipped: [] });
  });

  it("remaps an inquiry's productId onto the erp row a skipped product collided with", () => {
    const rootProducts = [
      { id: "r1", sku: "DUP-1", slug: "dup-1", nameUz: "X", nameRu: "X", nameEn: "X" },
    ];
    const rootInquiries = [{ id: "inq-1", productId: "r1", assignedSellerId: null }];

    const plan = planMigration({
      rootProducts,
      erpSkus: new Set(["DUP-1"]),
      erpSlugs: new Set(),
      rootInquiries,
      erpSkuToId: new Map([["DUP-1", "erp-product-1"]]),
    });

    expect(plan.inquiries.remapped[0].productId).toBe("erp-product-1");
  });

  it("plans an insert for a synthetic review row", () => {
    const rootReviews = [{ id: "rev-1", productId: "p1", authorPhone: "+998901234567" }];
    const plan = planMigration({
      rootProducts: [],
      erpSkus: new Set(),
      erpSlugs: new Set(),
      rootReviews,
    });
    expect(plan.reviews.toInsert).toEqual(rootReviews);
  });
});
