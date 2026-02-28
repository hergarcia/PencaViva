import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const dbUrl = process.env.SUPABASE_DB_URL;

/**
 * Flag indicating whether Supabase DB is available for integration tests.
 * When false, all supabase test suites should use describe.skip.
 */
export const isSupabaseAvailable = !!dbUrl;

/**
 * Shared connection pool for all supabase integration tests.
 * Only initialized when SUPABASE_DB_URL is set.
 */
export const pool: Pool | null = dbUrl
  ? new Pool({
      connectionString: dbUrl,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    })
  : null;

/**
 * Close the pool. Called from each test file's afterAll to ensure cleanup.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}
