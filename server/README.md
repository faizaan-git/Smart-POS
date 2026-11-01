# SmartPOS server setup

The API requires `DATABASE_URL`, `JWT_SECRET`, and `PORT` in `server/.env`.
Set `JWT_SECRET` to a unique random value of at least 32 characters before
starting the server. The API refuses to start with the old default secret.

The first administrator is provisioned once from an empty user table. Set
`INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and a unique
`INITIAL_ADMIN_PASSWORD` (at least 12 characters) in the environment, then run:

```sh
npm run seed:admin
```

The bootstrap command refuses to run if any user already exists. Afterward,
administrators can create cashier and manager accounts in SmartPOS. Account
registration is administrator-authenticated, password changes require the
current password and an authenticated session, and unverified public password
resets are disabled. Users who cannot sign in must contact their administrator.

Run the server tests with `npm test`.

## Merchant UPI payments

Apply database changes before starting the updated server. The migration keeps
existing records and assigns the current users and sales to one initial
merchant; it does not invent or enable UPI details.

```powershell
Set-Location server
npx prisma migrate deploy
npx prisma generate
```

Each merchant administrator can configure their own UPI and bank details from
**Settings → UPI Payment Settings**. Administrators can create a separate merchant by
registering a new ADMIN account; employees created by that administrator are
assigned to that merchant. Payment settings and payment/sales history are
restricted to the authenticated user's merchant.

UPI is an initiation-only QR/payment link. New UPI bills remain pending and do
not reduce inventory or count as completed sales until staff approve them in
SmartPOS after confirming payment was received. SmartPOS does not automatically
verify UPI payments. Approval records the staff member and timestamp, completes
the bill, and opens the thermal receipt for printing. UTR entry and an
administrator approval queue are not required. Administrators can view
read-only UPI history from the sidebar item below **Managers**.
Cash and card continue through the existing immediate-completion workflow.
There is no gateway or automatic bank confirmation.
