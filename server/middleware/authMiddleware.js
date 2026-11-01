const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");

const authenticateToken = async (req, res, next) => {
	const token = req.headers.authorization?.split(" ")[1];

	if (!token) {
		return res.status(401).json({ message: "Authentication required" });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await prisma.user.findUnique({
			where: { id: Number(decoded.id) },
			select: { id: true, role: true, isBlocked: true, merchantId: true },
		});

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		if (user.isBlocked) {
			return res.status(403).json({
				code: "ACCOUNT_BLOCKED",
				message: "Your account has been blocked by the administrator.",
			});
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};

module.exports = authenticateToken;
module.exports.requireRole = (...roles) => (req, res, next) => {
	if (!req.user || !roles.includes(req.user.role)) {
		return res.status(403).json({ message: "You do not have permission to access this resource" });
	}

	return next();
};
