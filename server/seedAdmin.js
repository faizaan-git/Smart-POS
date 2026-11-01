require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("./prisma/client");

const seedAdmin = async () => {
  const name = process.env.INITIAL_ADMIN_NAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!name || !email || !password || password.length < 12) {
    throw new Error(
      "Set INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and an INITIAL_ADMIN_PASSWORD of at least 12 characters"
    );
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    throw new Error("Admin bootstrap is only allowed when the user table is empty");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const merchant = await prisma.merchant.findFirst({
    orderBy: { id: "asc" },
  });
  if (!merchant) {
    throw new Error("Run Prisma migrations before creating the initial administrator");
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "ADMIN",
      merchantId: merchant.id,
    },
  });

  console.log("Initial SmartPOS administrator created.");
};

seedAdmin()
  .catch((error) => {
    console.error("Admin bootstrap failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
