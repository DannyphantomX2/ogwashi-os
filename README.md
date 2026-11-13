# Ogwashi Farmers Registry

A mobile-first web app for registering and managing farmers in the Ogwashi area:
who they are, where they farm, what they grow, and how to reach them on WhatsApp.
Built so field agents can register a farmer on a phone, and admins can keep the
records honest.

## What it does

- **Register farmers** with name, phone (Nigerian mobile numbers are cleaned up
  automatically), village, main crop, farm size and a GPS location captured at the farm
- **Search and filter** by name, village, phone or crop, with a live summary
  (farmers, hectares, crops)
- **Edit** a farmer to fix a typo or update farm size
- **WhatsApp, call and map** buttons on every farmer
- **Two roles**
  - *Agent*: register, search and edit farmers
  - *Admin*: everything an agent can do, plus remove farmers (with a recorded
    reason), export to CSV, manage the team, and read the activity log
- **Individual logins** with hashed passwords, forced password change on first
  login, account lockout after repeated failures, and instant disabling of accounts
- **Activity log** of logins, additions, edits, removals, exports and blocked
  actions, which never stores farmers' names or phone numbers
- **Removed farmers screen**: the reason is kept, personal details are deleted for good

## Built with

Next.js (App Router) and React, Tailwind CSS, TypeScript, PostgreSQL on
[Neon](https://neon.com) through its serverless driver, hosted on Vercel.

## Running it yourself

You need Node.js 20.6 or newer and a free Neon database.

1. Install the packages

   ```bash
   npm install
   ```

2. Create the tables. In the Neon SQL Editor, run the contents of
   [`db/schema.sql`](db/schema.sql).

3. Create `.env.local` from the example and fill it in

   ```bash
   cp .env.example .env.local
   ```

4. Create the first admin from your terminal. You will be asked for a password
   (hidden, at least 10 characters):

   ```bash
   node --env-file=.env.local scripts/create-user.mjs add yourusername "Your Name" admin
   ```

   Other commands: `list`, `password <username>`, `disable <username>`,
   `enable <username>`. After that, admins can add people from **Menu > Team**.

5. Start it

   ```bash
   npm run dev
   ```

   Then open http://localhost:3000.

## Deploying

Import the repository into Vercel and set two environment variables there:
`DATABASE_URL` and `SESSION_SECRET` (see `.env.example`). Nothing else is needed.

## Security notes

- Secrets live only in environment variables. `.env.local` is ignored by git.
- Passwords are hashed with scrypt (N=2^17, r=8, p=1). Login cookies are
  `httpOnly`, signed, and checked against the database on every request.
- The database is only reachable from the server. The browser never talks to it.
- If you find a security problem, please open a private security advisory on
  GitHub instead of a public issue.

## Licence

No licence has been chosen yet, so by default all rights are reserved: you may
read the code, but not reuse it. Open an issue if you would like to use it.
