const crypto = require("crypto");
const { asArray, query } = require("./db");

const SESSION_COOKIE = "drishti_session";
const SESSION_DAYS = 14;

class AuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthError";
    this.status = 401;
    this.code = "AUTH_REQUIRED";
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator === -1) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$v1$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;

  const [, , salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return "";
}

function isSecureCookie() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function buildSessionCookie(token, expiresAt) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`
  ];
  if (isSecureCookie()) attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie() {
  const attributes = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];
  if (isSecureCookie()) attributes.push("Secure");
  return attributes.join("; ");
}

function publicUser(row, metrics = {}) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    grade: row.grade,
    district: row.district,
    level: row.level,
    languages: asArray(row.languages),
    goals: asArray(row.goals),
    interests: asArray(row.interests),
    pace: row.pace,
    offlineFirst: Boolean(row.offline_first),
    createdAt: row.created_at,
    xp: Number(metrics.xp || 0),
    streak: Number(metrics.streak || 0)
  };
}

async function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);

  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, expiresAt, userAgent]
  );

  return { token, expiresAt };
}

async function getSessionUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const { rows } = await query(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
      LIMIT 1`,
    [hashToken(token)]
  );

  return publicUser(rows[0]);
}

async function requireUser(req) {
  const user = await getSessionUser(req);
  if (!user) throw new AuthError();
  return user;
}

async function destroySession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return;
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

module.exports = {
  AuthError,
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  normalizeEmail,
  publicUser,
  requireUser,
  validatePassword,
  verifyPassword
};
