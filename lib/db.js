const { neon } = require("@neondatabase/serverless");
const { Pool } = require("pg");
const { loadLocalEnv } = require("./env");

loadLocalEnv();

class SetupError extends Error {
  constructor(message) {
    super(message);
    this.name = "SetupError";
    this.status = 503;
    this.code = "SETUP_REQUIRED";
  }
}

let sqlClient;
let sqlClientUrl;
let pgPool;
let pgPoolUrl;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new SetupError(
      "DRISHTI needs a real Postgres database. Set DATABASE_URL, then run npm run db:migrate."
    );
  }
  return url;
}

function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function shouldUseNeonHttp(url) {
  if (process.env.DRISHTI_DB_ADAPTER === "pg") return false;
  if (process.env.DRISHTI_DB_ADAPTER === "neon") return true;
  return /\.neon\.tech/i.test(url);
}

function getSql() {
  const url = getDatabaseUrl();
  if (!sqlClient || sqlClientUrl !== url) {
    sqlClient = neon(url);
    sqlClientUrl = url;
  }
  return sqlClient;
}

function getPgPool() {
  const url = getDatabaseUrl();
  if (!pgPool || pgPoolUrl !== url) {
    pgPool = new Pool({
      connectionString: url,
      max: Number(process.env.DRISHTI_DB_POOL_SIZE || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: process.env.VERCEL || /sslmode=require/i.test(url)
        ? { rejectUnauthorized: false }
        : false
    });
    pgPoolUrl = url;
  }
  return pgPool;
}

async function query(text, params = []) {
  const url = getDatabaseUrl();
  if (shouldUseNeonHttp(url)) {
    const sql = getSql();
    const rows = await sql(text, params);
    return { rows };
  }

  const result = await getPgPool().query(text, params);
  return { rows: result.rows };
}

async function closeDatabase() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    pgPoolUrl = null;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function jsonParam(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

module.exports = {
  SetupError,
  asArray,
  closeDatabase,
  hasDatabaseConfig,
  jsonParam,
  query
};
