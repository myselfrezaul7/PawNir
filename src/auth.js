const crypto = require("crypto");

const DEFAULT_USERS = [
  { email: "ceo@pld.local", role: "ceo", name: "CEO User", password: "ChangeMe123!" },
  { email: "ops@pld.local", role: "ops", name: "Ops Lead", password: "ChangeMe123!" },
  { email: "store@pld.local", role: "store", name: "Store Manager", password: "ChangeMe123!" }
];

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString("hex");
}

function buildUserRecord(user) {
  const salt = crypto.randomBytes(8).toString("hex");
  return {
    id: crypto.randomUUID(),
    email: user.email,
    role: user.role,
    name: user.name,
    salt,
    passwordHash: hashPassword(user.password, salt),
    passwordAlgorithm: "scrypt",
    createdAt: new Date().toISOString()
  };
}

async function ensureDefaultUsers(storage, tenantId) {
  const users = await storage.readUsers(tenantId);
  if (users.length > 0) return users;
  if (String(process.env.SEED_DEMO_USERS || "false").toLowerCase() !== "true") {
    await storage.writeUsers(tenantId, []);
    return [];
  }
  const seeded = DEFAULT_USERS.map(buildUserRecord);
  await storage.writeUsers(tenantId, seeded);
  return seeded;
}

function issueToken(user, secret, tenantId, ttlSeconds = 60 * 60 * 12) {
  const payloadObj = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    tenantId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const payload = base64Url(JSON.stringify(payloadObj));
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.exp && Date.now() / 1000 > parsed.exp) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

async function authenticate(storage, tenantId, email, password) {
  const users = await ensureDefaultUsers(storage, tenantId);
  const user = users.find((u) => String(u.email).toLowerCase() === String(email || "").toLowerCase());
  if (!user) return null;
  const hash = user.passwordAlgorithm === "scrypt"
    ? hashPassword(password || "", user.salt)
    : crypto.createHash("sha256").update(`${user.salt}:${password || ""}`).digest("hex");
  const expected = Buffer.from(user.passwordHash);
  const actual = Buffer.from(hash);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return user;
}

async function registerUser(storage, tenantId, email, password, name) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !String(password || "").trim() || String(password).length < 8) return null;
  const users = await storage.readUsers(tenantId);
  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) return null;
  const user = buildUserRecord({
    email: normalizedEmail,
    password,
    name: String(name || "Pet parent").trim() || "Pet parent",
    role: "owner"
  });
  await storage.writeUsers(tenantId, [...users, user]);
  return user;
}

async function findOrCreateGoogleUser(storage, tenantId, profile) {
  const email = String(profile.email || "").trim().toLowerCase();
  if (!email || profile.email_verified !== true) return null;
  const users = await storage.readUsers(tenantId);
  const existing = users.find((user) => user.email.toLowerCase() === email);
  if (existing) return existing;
  const user = {
    id: crypto.randomUUID(),
    email,
    role: "owner",
    name: String(profile.name || email.split("@")[0] || "Pet parent").trim(),
    avatarUrl: String(profile.picture || "").trim(),
    authProvider: "google",
    createdAt: new Date().toISOString()
  };
  await storage.writeUsers(tenantId, [...users, user]);
  return user;
}

function parseAuthHeader(headers) {
  const auth = headers && (headers.authorization || headers.Authorization);
  if (!auth) return null;
  const [scheme, token] = String(auth).split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function hasRole(user, requiredRoles) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

module.exports = {
  ensureDefaultUsers,
  issueToken,
  verifyToken,
  authenticate,
  registerUser,
  findOrCreateGoogleUser,
  parseAuthHeader,
  hasRole
};
