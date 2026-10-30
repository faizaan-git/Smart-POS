const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

// ===============================
// Register User
// ===============================
const register = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "ADMIN",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ===============================
// Login User
// ===============================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid Email",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: "This account has been blocked by the administrator.",
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(401).json({
        message: "Invalid Password",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      {
        id: updatedUser.id,
        role: updatedUser.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.json({
      message: "Login Successful",
      token,
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// ===============================
// Change Password
// ===============================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        message: "All password fields are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "New password must be at least 6 characters",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error(
      "Change Password Error:",
      error
    );

    res.status(500).json({
      message: "Failed to change password",
    });
  }
};

// ===============================
// Logout User
// ===============================
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(200).json({ message: "Logged out successfully" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await prisma.user.update({
      where: { id: Number(decoded.id) },
      data: {
        isOnline: false,
        lastSeenAt: new Date(),
      },
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    console.error("Logout Error:", error);
    res.status(500).json({ message: "Failed to log out" });
  }
};

// ===============================
// Export Controllers
// ===============================
module.exports = {
  register,
  login,
  logout,
  changePassword,
};