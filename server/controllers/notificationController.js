const prisma = require("../prisma/client");

const categories = new Set(["LOW_STOCK", "SALE", "CUSTOMER"]);
const priorities = new Set(["HIGH", "NORMAL", "LOW"]);

const createNotificationController = (db) => ({
  list: async (req, res) => {
    const { category, priority, read, limit = "20", skip = "0" } = req.query;
    const parsedLimit = Number(limit);
    const parsedSkip = Number(skip);

    if (category !== undefined && !categories.has(category)) {
      return res.status(400).json({ message: "Notification category is invalid" });
    }
    if (priority !== undefined && !priorities.has(priority)) {
      return res.status(400).json({ message: "Notification priority is invalid" });
    }
    if (read !== undefined && read !== "true" && read !== "false") {
      return res.status(400).json({ message: "Read filter must be true or false" });
    }
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ message: "Limit must be between 1 and 100" });
    }
    if (!Number.isInteger(parsedSkip) || parsedSkip < 0 || parsedSkip > 10000) {
      return res.status(400).json({ message: "Skip must be between 0 and 10000" });
    }

    const where = {
      userId: req.user.id,
      archivedAt: null,
      ...(category ? { category } : {}),
      ...(priority ? { priority } : {}),
      ...(read === "true" ? { readAt: { not: null } } : {}),
      ...(read === "false" ? { readAt: null } : {}),
    };

    try {
      const notifications = await db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parsedLimit,
        skip: parsedSkip,
      });
      res.json(notifications);
    } catch (error) {
      console.error("List notifications error:", error);
      res.status(500).json({ message: "Failed to load notifications" });
    }
  },

  unreadCount: async (req, res) => {
    try {
      const count = await db.notification.count({
        where: {
          userId: req.user.id,
          readAt: null,
          archivedAt: null,
        },
      });
      res.json({ unreadCount: count });
    } catch (error) {
      console.error("Unread notification count error:", error);
      res.status(500).json({ message: "Failed to load unread notification count" });
    }
  },

  markRead: async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "Notification ID is invalid" });
    }

    try {
      const notification = await db.notification.findFirst({
        where: { id, userId: req.user.id, archivedAt: null },
      });
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      const updated = notification.readAt
        ? notification
        : await db.notification.update({
            where: { id },
            data: { readAt: new Date() },
          });
      res.json(updated);
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  },

  markAllRead: async (req, res) => {
    try {
      const result = await db.notification.updateMany({
        where: {
          userId: req.user.id,
          readAt: null,
          archivedAt: null,
        },
        data: { readAt: new Date() },
      });
      res.json({ updatedCount: result.count });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  },

  archive: async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "Notification ID is invalid" });
    }

    try {
      const result = await db.notification.updateMany({
        where: { id, userId: req.user.id, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (!result.count) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ message: "Notification archived" });
    } catch (error) {
      console.error("Archive notification error:", error);
      res.status(500).json({ message: "Failed to archive notification" });
    }
  },
});

module.exports = {
  ...createNotificationController(prisma),
  createNotificationController,
};
