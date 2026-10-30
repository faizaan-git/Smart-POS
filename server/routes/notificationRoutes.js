const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const {
  list,
  unreadCount,
  markRead,
  markAllRead,
  archive,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(authenticateToken);
router.get("/", list);
router.get("/unread-count", unreadCount);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);
router.patch("/:id/archive", archive);

module.exports = router;
