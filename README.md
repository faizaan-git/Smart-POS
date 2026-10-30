# SmartPOS – Point of Sale & Billing Management System

SmartPOS is a modern, full-stack Point of Sale (POS) and billing management application designed to simplify retail business operations. It provides an integrated platform for managing products, processing sales, tracking inventory, handling customers, and monitoring business activities.

## 🚀 Features

- **Dashboard:** Overview of sales, revenue, products, and business performance.
- **Product Management:** Add, edit, delete, and manage product information.
- **Barcode Scanning:** Support for barcode-based product lookup and faster billing.
- **POS Billing:** Create invoices, manage cart items, calculate totals, and process sales.
- **Sales Management:** View and manage sales transactions and invoices.
- **Customer Management:** Maintain customer information and purchase records.
- **Inventory Management:** Monitor product stock and identify low-stock items.
- **Reports:** Analyze sales and business performance.
- **Cashier Management:** Support cashier operations and shift-related settings.
- **Notification System:** Keep track of important business alerts and updates.
- **Business Settings:** Configure business information, POS preferences, and receipt settings.
- **Authentication:** Secure login and user account management.

## 🛠️ Technology Stack

**Frontend**
- React.js
- JavaScript
- HTML5
- CSS3

**Backend**
- Node.js
- Express.js
- Prisma ORM

**Database**
- PostgreSQL

**Authentication**
- JSON Web Tokens (JWT)
- bcrypt password hashing

## 📂 Project Structure

```text
SmartPOS/
├── client/          # React frontend
├── server/          # Express backend
├── package.json     # Root project configuration
└── README.md
```

## ⚙️ Getting Started

### Prerequisites
- Node.js
- npm
- PostgreSQL

### Installation

1. Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

2. Navigate to the project:

```bash
cd SmartPOS
```

3. Install dependencies:

```bash
npm install
```

4. Install backend and frontend dependencies if required:

```bash
cd server
npm install
cd ../client
npm install
cd ..
```

5. Configure the environment variables in `server/.env`:

```env
DATABASE_URL="your_postgresql_connection_string"
JWT_SECRET="your_secret_key"
PORT=5000
```

6. Generate Prisma Client and apply database migrations:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
```

7. Start the application from the project root:

```bash
npm run dev
```

## 🎯 Project Goal

The goal of SmartPOS is to provide businesses with a centralized, user-friendly platform for managing daily retail operations, reducing manual billing work, improving inventory tracking, and simplifying sales management.

## 👨‍💻 Developer

Developed as a full-stack POS and billing management project.

---

**SmartPOS – Simplifying Billing, Sales & Inventory Management.**
