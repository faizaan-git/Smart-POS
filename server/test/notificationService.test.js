const test = require("node:test");
const assert = require("node:assert/strict");
const {
  notifyLowStock,
  notifySaleCompleted,
  resolveLowStock,
} = require("../services/notificationService");

test("upserts one low-stock notification per authorized recipient", async () => {
  const state = { rows: [], recipients: null, dedupeKeys: [] };
  const db = {
    user: {
      findMany: async ({ where }) => {
        state.recipients = where.role.in;
        return [{ id: 1 }, { id: 2 }, { id: 3 }];
      },
    },
    notification: {
      upsert: async (args) => {
        state.dedupeKeys.push(args.where.dedupeKey);
        state.rows.push(args.create);
      },
    },
  };

  await notifyLowStock(db, { id: 7, name: "Coffee", stock: 3 });

  assert.deepEqual(state.recipients, ["ADMIN", "MANAGER", "CASHIER"]);
  assert.equal(state.rows.length, 3);
  assert.equal(state.rows[0].category, "LOW_STOCK");
  assert.equal(state.rows[0].priority, "HIGH");
  assert.match(state.rows[0].message, /3 units remaining/);
  assert.deepEqual(state.dedupeKeys, [
    "low-stock:7:user:1",
    "low-stock:7:user:2",
    "low-stock:7:user:3",
  ]);
  assert.equal(state.rows[0].dedupeKey, "low-stock:7:user:1");
});

test("sale notification is sent to managers, administrators, and the cashier who made it", async () => {
  const state = { rows: [] };
  const db = {
    user: {
      findMany: async () => [{ id: 1 }, { id: 2 }],
    },
    notification: {
      createMany: async ({ data }) => state.rows.push(...data),
    },
  };

  await notifySaleCompleted(db, {
    id: 11,
    invoiceNumber: "INV-11",
    total: 250,
    currency: "INR",
  }, 8);

  assert.deepEqual(state.rows.map((row) => row.userId).sort(), [1, 2, 8]);
  assert.equal(state.rows[0].category, "SALE");
  assert.equal(state.rows[0].relatedId, 11);
});

test("resolves active low-stock notifications after the product is restocked", async () => {
  let query;
  const db = {
    notification: {
      updateMany: async (args) => {
        query = args;
        return { count: 1 };
      },
    },
  };

  await resolveLowStock(db, 7);

  assert.deepEqual(query.where, {
    category: "LOW_STOCK",
    relatedType: "product",
    relatedId: 7,
    archivedAt: null,
  });
  assert.ok(query.data.archivedAt instanceof Date);
});
