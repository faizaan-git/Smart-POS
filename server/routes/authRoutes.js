const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");

const {
  register,
  login,
  logout,
  changePassword,
} = require("../controllers/authController");
const { requireRole } = require("../middleware/authMiddleware");
const prisma = require("../prisma/client");

const router = express.Router();

router.post("/register", authenticateToken, requireRole("ADMIN"), register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/session", authenticateToken, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    res.json({ user: req.user });
  } catch (error) {
    console.error("Session heartbeat failed:", error);
    res.status(500).json({ message: "Failed to refresh session" });
  }
});
router.put("/change-password", authenticateToken, changePassword);


module.exports = router;