// Manage users from the terminal. Run from the project root:
//
//   node --env-file=.env.local scripts/create-user.mjs add <username> "<Display Name>" <admin|agent>
//   node --env-file=.env.local scripts/create-user.mjs password <username>
//   node --env-file=.env.local scripts/create-user.mjs disable <username>
//   node --env-file=.env.local scripts/create-user.mjs enable <username>
//   node --env-file=.env.local scripts/create-user.mjs list
//
// Passwords are typed at a hidden prompt, so they never appear in your
// shell history. Keep the hashing settings the same as lib/password.ts.

import { randomBytes, scrypt } from "node:crypto";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const LOG_N = 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 256 * 1024 * 1024;

export function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: 2 ** LOG_N, r: R, p: P, maxmem: MAX_MEMORY },
      (err, key) =>
        err
          ? reject(err)
          : resolve(
              ["scrypt", LOG_N, R, P, salt.toString("base64"), key.toString("base64")].join("$")
            )
    );
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    rl._writeToOutput = () => {}; // hide what is typed
  });
}

async function askNewPassword(username) {
  const first = await askHidden("New password (at least 10 characters): ");
  if (first.length < 10) throw new Error("Password must be at least 10 characters.");
  if (first.toLowerCase() === username.toLowerCase()) {
    throw new Error("Password must not be the same as the username.");
  }
  const second = await askHidden("Type it again: ");
  if (first !== second) throw new Error("The two passwords did not match.");
  return first;
}

function usage() {
  console.log(`Usage:
  add <username> "<Display Name>" <admin|agent>
  password <username>
  disable <username>
  enable <username>
  list`);
  process.exit(1);
}

async function audit(sql, action, target, extra = {}) {
  await sql`
    insert into activity_log (username, action, details)
    values ('terminal', ${action}::text,
            ${JSON.stringify({ user: target, ...extra })}::jsonb)`;
}

async function main() {
  const [command, usernameArg, displayName, role] = process.argv.slice(2);
  if (!command) usage();

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is missing. Run with: node --env-file=.env.local scripts/create-user.mjs ...");
    process.exit(1);
  }
  const sql = neon(url);

  if (command === "list") {
    const rows = await sql`
      select username, display_name, role, active, created_at
      from users order by created_at`;
    if (rows.length === 0) console.log("No users yet.");
    for (const r of rows) {
      console.log(
        `${r.username.padEnd(20)} ${r.role.padEnd(6)} ${r.active ? "active  " : "DISABLED"} ${r.display_name}`
      );
    }
    return;
  }

  if (!usernameArg) usage();
  const username = usernameArg.trim().toLowerCase();

  if (command === "add") {
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new Error("Username must be 3 to 30 characters: letters, numbers, dot, dash or underscore.");
    }
    if (!displayName || displayName.trim().length < 2) throw new Error("Give a display name in quotes.");
    if (role !== "admin" && role !== "agent") throw new Error("Role must be admin or agent.");

    const password = await askNewPassword(username);
    const hash = await hashPassword(password);
    try {
      await sql`
        insert into users (username, display_name, role, password_hash)
        values (${username}, ${displayName.trim()}, ${role}, ${hash})`;
    } catch (err) {
      if (err && err.code === "23505") throw new Error(`The username "${username}" is already taken.`);
      throw err;
    }
    await audit(sql, "user.create", username, { role });
    console.log(`Created ${role} "${username}".`);
    return;
  }

  if (command === "password") {
    const password = await askNewPassword(username);
    const hash = await hashPassword(password);
    const rows = await sql`
      update users set password_hash = ${hash}, session_version = session_version + 1
      where lower(username) = ${username}::text returning id`;
    if (rows.length === 0) throw new Error(`No user called "${username}".`);
    await audit(sql, "user.password_change", username);
    console.log(`Password changed for "${username}".`);
    return;
  }

  if (command === "disable" || command === "enable") {
    const active = command === "enable";
    const rows = await sql`
      update users set active = ${active}
      where lower(username) = ${username}::text returning id`;
    if (rows.length === 0) throw new Error(`No user called "${username}".`);
    await audit(sql, active ? "user.enable" : "user.disable", username);
    console.log(`${active ? "Enabled" : "Disabled"} "${username}".`);
    return;
  }

  usage();
}

// Only run when called from the terminal (not when imported by a test)
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  });
}
