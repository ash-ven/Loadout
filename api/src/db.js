import pg from "pg";

// Come pg traduce alcuni tipi di Postgres in valori JavaScript
pg.types.setTypeParser(1082, (v) => v);              // DATE    → testo "2026-11-08", senza fusi orari
pg.types.setTypeParser(1700, (v) => parseFloat(v));  // NUMERIC → numero (coordinate, kg)
pg.types.setTypeParser(20, (v) => parseInt(v, 10));  // BIGINT  → numero (COUNT, SUM)

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const query = (text, params) => pool.query(text, params);
