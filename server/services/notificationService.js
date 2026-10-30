const LOW_STOCK_THRESHOLD = 10;
const STAFF_ROLES = ["ADMIN", "MANAGER"];
const LOW_STOCK_RECIPIENT_ROLES = ["ADMIN", "MANAGER", "CASHIER"];

const createNotifications = async (db, notifications, eventName) => {
  if (!notifications.length) return;

  try {
    await db.notification.createMany({
      data: notifications,
      skipDuplicates: true,
    });
  } catch (error) {
    console.error(`Failed to create ${eventName} notifications:`, error);
  }
};

const notifyRoles = async (
  db,
  roles,
  notification,
  eventKey,
  additionalUserIds = []
) => {
  try {
    const recipients = await db.user.findMany({
      where: { role: { in: roles } },
      select: { id: true },
    });
    const recipientIds = new Set([
      ...recipients.map((user) => user.id),
      ...additionalUserIds.filter(Number.isSafeInteger),
    ]);

    await createNotifications(
      db,
      [...recipientIds].map((userId) => ({
        ...notification,
        userId,
        dedupeKey: `${eventKey}:user:${userId}`,
      })),
      notification.category
    );
  } catch (error) {
    console.error(`Failed to prepare ${notification.category} notifications:`, error);
  }
};

const notifyLowStock = async (db, product) => {
  try {
    const recipients = await db.user.findMany({
      where: { role: { in: LOW_STOCK_RECIPIENT_ROLES } },
      select: { id: true },
    });
    const notification = {
      category: "LOW_STOCK",
      priority: "HIGH",
      title: product.stock <= 0 ? "Product out of stock" : "Low stock alert",
      message: product.stock <= 0
        ? `${product.name} is out of stock (minimum: ${LOW_STOCK_THRESHOLD}).`
        : `${product.name} has only ${product.stock} units remaining (minimum: ${LOW_STOCK_THRESHOLD}).`,
      relatedType: "product",
      relatedId: product.id,
    };

    await Promise.all(recipients.map((user) => {
      const dedupeKey = `low-stock:${product.id}:user:${user.id}`;
      return db.notification.upsert({
        where: { dedupeKey },
        create: { ...notification, userId: user.id, dedupeKey },
        update: {
          ...notification,
          createdAt: new Date(),
          readAt: null,
          archivedAt: null,
        },
      });
    }));
  } catch (error) {
    console.error("Failed to create LOW_STOCK notifications:", error);
  }
};

const resolveLowStock = async (db, productId) => {
  try {
    await db.notification.updateMany({
      where: {
        category: "LOW_STOCK",
        relatedType: "product",
        relatedId: productId,
        archivedAt: null,
      },
      data: { archivedAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to resolve LOW_STOCK notifications:", error);
  }
};

const notifySaleCompleted = async (db, sale, cashierId) => {
  await notifyRoles(
    db,
    STAFF_ROLES,
    {
      category: "SALE",
      priority: "NORMAL",
      title: `Sale ${sale.invoiceNumber || `#${sale.id}`} completed`,
      message: `${sale.currency || "INR"} ${new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0,
      }).format(Number(sale.total) || 0)} sale completed.`,
      relatedType: "sale",
      relatedId: sale.id,
    },
    `sale:${sale.id}`,
    cashierId ? [cashierId] : []
  );
};

const notifyCustomerCreated = async (db, customer) => {
  await notifyRoles(
    db,
    STAFF_ROLES,
    {
      category: "CUSTOMER",
      priority: "LOW",
      title: "New customer added",
      message: `${customer.name} was added as a customer.`,
      relatedType: "customer",
      relatedId: customer.id,
    },
    `customer:${customer.id}`
  );
};

module.exports = {
  LOW_STOCK_THRESHOLD,
  notifyCustomerCreated,
  notifyLowStock,
  notifySaleCompleted,
  resolveLowStock,
};
