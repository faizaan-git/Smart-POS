const bcrypt = require("bcrypt");
const prisma = require("../prisma/client");
const { isUserOnline } = require("../services/presence");

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isBlocked: user.isBlocked,
  isOnline: isUserOnline(user),
  lastSeenAt: user.lastSeenAt,
  createdAt: user.createdAt,
});

const createEmployeeController = (role, label) => {
  const responseKey = role.toLowerCase();

  return {
    listEmployees: async (req, res) => {
      try {
        const employees = await prisma.user.findMany({
          where: { role },
          orderBy: { createdAt: "desc" },
        });

        res.json(employees.map(safeUser));
      } catch (error) {
        console.error(`List ${label.toLowerCase()}s error:`, error);
        res.status(500).json({ message: `Failed to load ${label.toLowerCase()}s` });
      }
    },

    createEmployee: async (req, res) => {
      try {
        const { name, email, password } = req.body;

        if (!name?.trim() || !email?.trim() || !password) {
          return res.status(400).json({
            message: "Name, email, and password are required",
          });
        }

        if (password.length < 6) {
          return res.status(400).json({
            message: "Password must be at least 6 characters long",
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingUser) {
          return res.status(400).json({
            message: `A ${label.toLowerCase()} with this email already exists`,
          });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const employee = await prisma.user.create({
          data: {
            name: name.trim(),
            email: normalizedEmail,
            password: passwordHash,
            role,
            isBlocked: false,
            isOnline: false,
          },
        });

        res.status(201).json({
          message: `${label} created successfully`,
          [responseKey]: safeUser(employee),
        });
      } catch (error) {
        console.error(`Create ${label.toLowerCase()} error:`, error);
        res.status(500).json({ message: `Failed to create ${label.toLowerCase()}` });
      }
    },

    toggleEmployeeBlock: async (req, res) => {
      try {
        const id = Number(req.params.id);
        const employee = await prisma.user.findUnique({ where: { id } });

        if (!employee || employee.role !== role) {
          return res.status(404).json({ message: `${label} not found` });
        }

        const updated = await prisma.user.update({
          where: { id },
          data: {
            isBlocked: !employee.isBlocked,
            isOnline: employee.isBlocked ? employee.isOnline : false,
          },
        });

        res.json({
          message: updated.isBlocked
            ? `${label} blocked successfully`
            : `${label} unblocked successfully`,
          [responseKey]: safeUser(updated),
        });
      } catch (error) {
        console.error(`Toggle ${label.toLowerCase()} block error:`, error);
        res.status(500).json({ message: `Failed to update ${label.toLowerCase()} status` });
      }
    },

    removeEmployee: async (req, res) => {
      try {
        const id = Number(req.params.id);
        const employee = await prisma.user.findUnique({ where: { id } });

        if (!employee || employee.role !== role) {
          return res.status(404).json({ message: `${label} not found` });
        }

        await prisma.user.delete({ where: { id } });
        res.json({ message: `${label} removed successfully` });
      } catch (error) {
        console.error(`Remove ${label.toLowerCase()} error:`, error);
        res.status(500).json({ message: `Failed to remove ${label.toLowerCase()}` });
      }
    },
  };
};

module.exports = createEmployeeController;