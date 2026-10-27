// api/src/db.js
import pg from "pg";
export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // connessioni massime
idleTimeoutMillis: 30_000,
});
// helper: una query singola
export const query = (text, params) => pool.query(text, params)
