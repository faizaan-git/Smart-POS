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
