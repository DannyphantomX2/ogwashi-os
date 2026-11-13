import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

// A request that hangs is worse than one that fails, so give up after 15 s.
neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, {
    ...init,
    signal: AbortSignal.timeout(Number(process.env.DB_TIMEOUT_MS) || 15000),
  });

type Sql = NeonQueryFunction<false, false>;

// Neon's free database goes to sleep when nobody has used it for a few
// minutes, and the first request afterwards can fail while it wakes up.
// Waiting a little and trying again is the recommended fix, so reads get
// three retries spread over about four seconds.
const RETRY_DELAYS_MS = [400, 1200, 2500];

// True for "could not reach the database right now" problems: dropped or
// timed-out connections and error replies that carry no database error code
// (like "service unavailable" while the database wakes up). Real database
// errors (bad SQL, a duplicate phone number, ...) always carry a code and
// are never treated as temporary.
export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === undefined || code === null || code === "") return true;
  const c = String(code);
  return (
    /^08/.test(c) || // connection problems
    ["57P01", "57P02", "57P03", "53300", "53400"].includes(c) || // shutting down, starting up, too many connections
    /^(E[A-Z0-9]+|UND_ERR\w*)$/.test(c) // network error codes such as ECONNRESET
  );
}

// Reads are retried automatically on temporary failures. Writes are not:
// if the connection drops after the database has already saved something,
// running it again could save it twice.
async function run(raw: Sql, strings: TemplateStringsArray, params: unknown[]) {
  const isRead = /^\s*select\b/i.test(strings[0] ?? "");
  for (let attempt = 0; ; attempt++) {
    try {
      return await raw(strings, ...params);
    } catch (err) {
      if (!isRead || attempt >= RETRY_DELAYS_MS.length || !isTransientDbError(err)) {
        throw err;
      }
      console.warn(`Database read failed (try ${attempt + 1}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL in .env.local");
  const raw = neon(url);
  const wrapped = (strings: TemplateStringsArray, ...params: unknown[]) =>
    run(raw, strings, params);
  return wrapped as unknown as Sql;
}
