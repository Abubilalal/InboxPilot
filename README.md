# InboxPilot — Email/Password Auth (replaces Kimi OAuth)

This package swaps the Kimi-platform login for self-contained email + password
auth that reuses your existing `jose` session cookie. No paid services, no
external auth provider.

## 1. Copy these files into your repo (overwrite existing)

    db/schema.ts                  (added: passwordHash, email now required+unique)
    api/lib/env.ts                (trimmed to APP_SECRET + DATABASE_URL only)
    api/queries/connection.ts     (Aiven TLS + standard MySQL mode)
    api/queries/users.ts          (findUserByEmail / createUser / countUsers)
    api/kimi/auth.ts              (now only reads the session cookie)
    api/auth/password.ts          (NEW — scrypt hashing, no dependencies)
    api/auth-router.ts            (NEW: register + login mutations)
    api/boot.ts                   (removed the OAuth callback route)
    src/pages/Login.tsx           (email/password form)

## 2. DELETE this file from your repo

    api/kimi/platform.ts          (Kimi profile fetch — no longer used)

## 3. Update your .env (local) and Render (production)

You now need only TWO variables. Delete all the APP_ID / VITE_* / KIMI_* lines.

    APP_SECRET=<run: openssl rand -base64 32>
    DATABASE_URL=mysql://avnadmin:PASSWORD@HOST.aivencloud.com:PORT/defaultdb

(See .env.example in this package.)

## 4. Create the database tables

With DATABASE_URL pointing at your Aiven database, run once from your machine:

    npm run db:push

## 5. Run / deploy

    npm install
    npm run build
    npm start            # local prod test (set NODE_ENV=production)

On Render: Build = `npm run build`, Start = `npm start`,
add APP_SECRET and DATABASE_URL as environment variables.

## How it works now

- Register/login are tRPC mutations at `auth.register` / `auth.login`.
- On success they set the same `jose` session cookie your app already used,
  so every existing authed route keeps working unchanged.
- The FIRST account that registers automatically becomes role = "admin".
- Passwords are hashed with Node's built-in scrypt (no bcrypt dependency).
- The password hash is never sent to the browser.

## Notes
- `api/queries/connection.ts` uses `ssl: { rejectUnauthorized: false }` for
  remote databases. The connection is still encrypted (TLS); certificate
  verification is skipped so you don't have to bundle Aiven's CA cert. Fine for
  a hobby project. To harden later, download Aiven's CA and pass it as
  `ssl: { ca: <cert> }`.
- The session cookie is still named `kimi_sid` (cosmetic only — rename in
  contracts/constants.ts if you like; it just logs everyone out once).
