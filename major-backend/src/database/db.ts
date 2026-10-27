import pkg, { QueryResultRow } from "pg";
const { Pool } = pkg;
import { env } from "../config/env.js";

let pool: pkg.Pool | null = null;
let isConnected = false;

export const getPool = (): pkg.Pool => {
    if (!pool) {
        const connectionString = env.SUPABASE_DATABASE_URL;
        pool = new Pool({
            connectionString: connectionString || undefined,
            ssl: connectionString && !connectionString.includes("localhost")
                ? { rejectUnauthorized: false }
                : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 15000
        });

        pool.on("error", (err) => {
            console.error("Unexpected error on idle PostgreSQL client", err);
        });
    }
    return pool;
};

export const checkDatabaseHealth = async (): Promise<{ status: "connected" | "disconnected"; error?: string }> => {
    try {
        const p = getPool();
        const res = await p.query("SELECT 1 AS health");
        isConnected = res.rows?.[0]?.health === 1;
        return { status: "connected" };
    } catch (err: any) {
        isConnected = false;
        return { status: "disconnected", error: err?.message || "Unknown database error" };
    }
};

export const isDbConnected = (): boolean => isConnected;

export const query = async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<pkg.QueryResult<T>> => {
    const p = getPool();
    return await p.query<T>(text, params);
};

export const withTransaction = async <T>(
    callback: (client: pkg.PoolClient) => Promise<T>
): Promise<T> => {
    const p = getPool();
    const client = await p.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
