import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt at the OWASP minimum: N=2^17, r=8, p=1 (about 128 MiB per hash).
// Keep these numbers the same in scripts/create-user.mjs.
const LOG_N = 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 256 * 1024 * 1024;
const DUMMY_SALT = Buffer.alloc(16, 7);

function derive(
  password: string,
  salt: Buffer,
  logN: number,
  r: number,
  p: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: 2 ** logN, r, p, maxmem: MAX_MEMORY },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, LOG_N, R, P);
  return [
    "scrypt",
    LOG_N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

// Pass null when the user does not exist. It still does the same amount of
// work, so response time does not reveal which usernames are real.
export async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) {
    await derive(password, DUMMY_SALT, LOG_N, R, P);
    return false;
  }
  const [scheme, logN, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;

  const cost = Number(logN);
  const block = Number(r);
  const parallel = Number(p);
  if (
    !Number.isInteger(cost) || cost < 10 || cost > 17 ||
    !Number.isInteger(block) || block < 1 || block > 8 ||
    !Number.isInteger(parallel) || parallel < 1 || parallel > 4
  ) {
    return false;
  }

  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(
    password,
    Buffer.from(saltB64, "base64"),
    cost,
    block,
    parallel
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
