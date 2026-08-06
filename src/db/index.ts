import { createClient, type Client, type InValue } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";

/**
 * DB client — libsql, so the SAME code runs in two places:
 *   - locally   → `file:db/cricket-auction.db` (the 62MB SQLite file, unchanged)
 *   - on Vercel → Turso, via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 *
 * Everything here is ASYNC. The `sqlite.prepare()` shim below keeps the
 * better-sqlite3 call shape (`.get()` / `.all()` / `.run()`) that ~190 call
 * sites already use, so migrating a route means adding `await` — not rewriting
 * the SQL. Read CLAUDE.md before touching anything that writes auction_pool.
 */

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "db", "cricket-auction.db");

const url = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

// A serverless deploy has no persistent local disk, so a `file:` URL there means the env vars were
// never set — fail loudly at boot rather than serving cryptic "no such table" errors on every route.
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !process.env.TURSO_DATABASE_URL &&
  (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. A cloud deploy has no local SQLite file — " +
      "run `npm run turso:push`, then set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the project's env."
  );
}

export const client: Client = createClient({ url, authToken });

/** True when talking to Turso (cloud) rather than the local file. */
export const isRemote = Boolean(process.env.TURSO_DATABASE_URL);

type Row = Record<string, unknown>;

/**
 * better-sqlite3 accepts both `.all(a, b)` and `.all([a, b])`. libsql wants a
 * single array, and rejects `undefined` where SQLite took it as NULL.
 */
function toArgs(args: unknown[]): InValue[] {
  const flat =
    args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
  return flat.map((v) => (v === undefined ? null : v)) as InValue[];
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Async stand-in for a better-sqlite3 prepared statement.
 * NOTE: these return Promises — every call site must `await`, and its enclosing
 * function must be async.
 */
export interface AsyncStatement {
  all<T = Row>(...args: unknown[]): Promise<T[]>;
  get<T = Row>(...args: unknown[]): Promise<T | undefined>;
  run(...args: unknown[]): Promise<RunResult>;
}

function statement(sql: string, exec: Pick<Client, "execute"> = client): AsyncStatement {
  return {
    async all<T = Row>(...args: unknown[]) {
      const r = await exec.execute({ sql, args: toArgs(args) });
      return r.rows as unknown as T[];
    },
    async get<T = Row>(...args: unknown[]) {
      const r = await exec.execute({ sql, args: toArgs(args) });
      return r.rows[0] as unknown as T | undefined;
    },
    async run(...args: unknown[]) {
      const r = await exec.execute({ sql, args: toArgs(args) });
      return {
        changes: r.rowsAffected,
        lastInsertRowid: Number(r.lastInsertRowid ?? 0),
      };
    },
  };
}

export const sqlite = {
  prepare: (sql: string) => statement(sql),
  /** Multi-statement DDL / scripts. */
  exec: (sql: string) => client.executeMultiple(sql),
};

/**
 * The handle the pool builders take. Replaces `Database.Database` from
 * better-sqlite3 — same `.prepare()` shape, async results.
 */
export type DbHandle = typeof sqlite;

/**
 * Atomic write block, replacing better-sqlite3's synchronous
 * `sqlite.transaction(fn)`. The callback gets a tx-scoped `prepare`, so the
 * statements actually run INSIDE the transaction — statements prepared off the
 * module-level `sqlite` would NOT be atomic.
 *
 *   await withTransaction(async (tx) => {
 *     await tx.prepare("UPDATE ...").run(a, b);
 *   });
 */
export async function withTransaction<T>(
  fn: (tx: { prepare: (sql: string) => AsyncStatement }) => Promise<T>
): Promise<T> {
  const tx = await client.transaction("write");
  try {
    const result = await fn({ prepare: (sql: string) => statement(sql, tx) });
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export const db = drizzle(client, { schema });
