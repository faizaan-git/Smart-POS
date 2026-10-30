const test = require("node:test");
const assert = require("node:assert/strict");
const { createNotificationController } = require("../controllers/notificationController");

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("lists only current user's notifications and validates filters", async () => {
  let query;
  const controller = createNotificationController({
    notification: {
      findMany: async (args) => {
        query = args;
        return [];
      },
    },
  });
  const response = makeResponse();

  await controller.list({
    user: { id: 42, role: "CASHIER" },
    query: { category: "SALE", priority: "NORMAL", read: "false", limit: "8" },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query.where, {
    userId: 42,
    archivedAt: null,
    category: "SALE",
    priority: "NORMAL",
    readAt: null,
  });
  assert.equal(query.take, 8);
  assert.equal(query.skip, 0);

  const invalidResponse = makeResponse();
  await controller.list({ user: { id: 42 }, query: { category: "SECURITY" } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);

  const invalidSkipResponse = makeResponse();
  await controller.list({ user: { id: 42 }, query: { skip: "-1" } }, invalidSkipResponse);
  assert.equal(invalidSkipResponse.statusCode, 400);
});

test("mark-read cannot find or modify another user's notification", async () => {
  let updateCalled = false;
  const controller = createNotificationController({
    notification: {
      findFirst: async ({ where }) => where.userId === 42 ? null : ({ id: 5 }),
      update: async () => {
        updateCalled = true;
      },
    },
  });
  const response = makeResponse();

  await controller.markRead({ user: { id: 42 }, params: { id: "5" } }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(updateCalled, false);
});

test("mark-all-read updates only the current user's active unread notifications", async () => {
  let query;
  const controller = createNotificationController({
    notification: {
      updateMany: async (args) => {
        query = args;
        return { count: 3 };
      },
    },
  });
  const response = makeResponse();

  await controller.markAllRead({ user: { id: 9 } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query.where, { userId: 9, readAt: null, archivedAt: null });
  assert.equal(response.body.updatedCount, 3);
});
