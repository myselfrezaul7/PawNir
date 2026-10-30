const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readEvents, aggregate } = require("./src/analytics");
const { createRecommendations } = require("./src/recommendations");
const { buildRossmannReport } = require("./src/buildRossmannReport");
const { Storage } = require("./src/storage");
const { resolveTenantId, normalizeTenantId } = require("./src/tenant");
const { TTLCache } = require("./src/cache");
const { log } = require("./src/logger");
const {
  detectAnomalies,
  explainEntity,
  alertsFromAnomalies,
  buildImpactRanking,
  clusterRootCauses
} = require("./src/intelligence");
const { buildDigest, sendTaskToProvider } = require("./src/automation");
const { ensureDefaultUsers, issueToken, issuePending2faToken, createMathChallenge, verifyMathChallenge, verifyToken, authenticate, registerUser, findOrCreateGoogleUser, parseAuthHeader, hasRole } = require("./src/auth");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    // ignore .env read errors
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const SEED_DATA_DIR = path.join(__dirname, "data");
const TMP_DATA_DIR = path.join("/tmp", "pld-data");

function canWriteToDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.probe-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch (err) {
    return false;
  }
}

const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : canWriteToDir(SEED_DATA_DIR)
    ? SEED_DATA_DIR
    : TMP_DATA_DIR;
const IS_SERVERLESS = DATA_DIR !== SEED_DATA_DIR || Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
const AUTH_REQUIRED = String(process.env.AUTH_REQUIRED || "false").toLowerCase() === "true";
const REPORT_CACHE_TTL_MS = Number(process.env.REPORT_CACHE_TTL_MS || 8000);
const DIGEST_INTERVAL_MS = Number(process.env.DIGEST_INTERVAL_MS || 15 * 60 * 1000);
const MAX_BODY_BYTES = 7 * 1024 * 1024;
const MAX_LOST_FOUND_IMAGE_BYTES = 5 * 1024 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 120;
const requestBuckets = new Map();
const googleStates = new Map();
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "";

function resolveTrainCsvPath() {
  const candidates = [
    process.env.ROSSMANN_TRAIN_PATH,
    path.join(DATA_DIR, "train.csv"),
    path.join(SEED_DATA_DIR, "train.csv"),
    "C:\\Users\\mysel\\OneDrive\\Desktop\\Azure\\rossmann-store-sales\\train.csv"
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function resolveStoreCsvPath() {
  const candidates = [
    process.env.ROSSMANN_STORE_PATH,
    path.join(DATA_DIR, "store.csv"),
    path.join(SEED_DATA_DIR, "store.csv"),
    "C:\\Users\\mysel\\OneDrive\\Desktop\\Azure\\rossmann-store-sales\\store.csv"
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const appState = {
  startedAt: Date.now(),
  storage: new Storage(DATA_DIR),
  cache: new TTLCache(REPORT_CACHE_TTL_MS),
  sseClients: new Map(),
  pipeline: {
    enabled: false,
    sourceTrainPath: resolveTrainCsvPath(),
    sourceStorePath: resolveStoreCsvPath(),
    isBuilding: false,
    queued: false,
    lastBuildAt: null,
    lastSuccessAt: null,
    lastDurationMs: 0,
    lastError: null,
    lastReason: "startup",
    watchers: []
  }
};

function sendJson(res, code, payload) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, code, payload, contentType = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": contentType });
  res.end(payload);
}

function sendFile(res, filepath) {
  if (!fs.existsSync(filepath)) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filepath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  };
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": ext === ".html" || filepath.endsWith("sw.js") ? "no-cache" : "public, max-age=3600"
  });
  fs.createReadStream(filepath).pipe(res);
}

function escapeCsv(value) {
  const s = String(value == null ? "" : value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function userFromRequest(req, tenantId) {
  const token = parseAuthHeader(req.headers);
  const claims = token ? verifyToken(token, TOKEN_SECRET) : null;
  if (claims && claims.stage === "2fa_pending") return null;
  return claims && claims.tenantId === tenantId ? claims : null;
}

function googleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function resolveGoogleRedirectUri(req) {
  if (GOOGLE_REDIRECT_URI) return GOOGLE_REDIRECT_URI;
  const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}/auth/google/callback`;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

async function exchangeGoogleCode(code, redirectUri) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri || GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  return response.json();
}

async function getGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("Google profile lookup failed");
  return response.json();
}

function checkRole(user, roles) {
  if (!user) return false;
  return hasRole(user, roles);
}

function parseBangladeshDate(value) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(`${date}T12:00:00+06:00`);
  const valid = !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day;
  return valid ? parsed : null;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function areaKey(value) {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, "-").replace(/^-|-$/g, "");
}

function publicLostReport(report) {
  const sightings = Array.isArray(report.sightings) ? report.sightings : [];
  const mapQuery = `${report.area || ""}, ${report.city || "Bangladesh"}`.trim();
  return {
    id: report.id,
    type: report.type,
    species: report.species,
    title: report.title,
    description: report.description,
    area: report.area,
    city: report.city,
    status: report.status,
    createdAt: report.createdAt,
    expiresAt: report.expiresAt,
    ownerName: report.ownerName,
    photoUrl: report.photoUrl || null,
    photoData: report.photoData || null,
    sightingsCount: sightings.length,
    sightings: sightings.slice(0, 10),
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
  };
}

function validateLostFoundPhoto(value) {
  if (!value) return null;
  const match = String(value).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Only JPG, PNG, or WebP photos are allowed.");
  const bytes = Buffer.byteLength(match[2], "base64");
  if (bytes > MAX_LOST_FOUND_IMAGE_BYTES) throw new Error("Photo must be 5 MB or smaller.");
  return value;
}

function publicReview(review) {
  const displayName = review.authorName || review.userName || "PawNir Member";
  return {
    id: review.id,
    fosterId: review.fosterId,
    rating: review.rating,
    comment: review.comment,
    authorName: displayName,
    userName: displayName,
    petSpecies: review.petSpecies || null,
    badge: review.badge || "Verified Member",
    helpfulCount: Number(review.helpfulCount || 0),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt || null
  };
}

function publicFoster(foster, reviews) {
  const items = reviews
    .filter((review) => review.fosterId === foster.id && review.status === "published")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const average = items.length ? Math.round((items.reduce((sum, item) => sum + item.rating, 0) / items.length) * 10) / 10 : null;
  const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  items.forEach((item) => {
    const r = Math.min(5, Math.max(1, Math.round(Number(item.rating) || 5)));
    ratingBreakdown[r] = (ratingBreakdown[r] || 0) + 1;
  });
  const query = foster.mapQuery || `${foster.name} ${foster.area} ${foster.city} Bangladesh`;
  return {
    ...foster,
    reviewCount: items.length,
    rating: average,
    ratingBreakdown,
    recentReviews: items.slice(0, 2).map(publicReview),
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    embedMapUrl: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`
  };
}

function publicDonor(donor) {
  const mapQuery = `${donor.area || ""}, ${donor.city || "Bangladesh"}`.trim();
  return {
    id: donor.id,
    petName: donor.petName || (donor.species === "cat" ? "Cat Donor" : "Dog Donor"),
    ownerName: donor.ownerName || "PawNir Member",
    species: donor.species,
    bloodType: donor.bloodType || "Unknown",
    weightKg: donor.weightKg || null,
    vaccinated: donor.vaccinated !== false,
    area: donor.area,
    city: donor.city,
    available: donor.available,
    verified: donor.verified,
    badge: donor.badge || (donor.verified ? "Verified Donor" : "Pending"),
    consent: donor.consent,
    lastDonationAt: donor.lastDonationAt || null,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
  };
}

function buildAdoptionPdf(application, listing, user) {
  const esc = (value) => String(value || "").replace(/([\\()])/g, "\\$1").replace(/\r?\n/g, " ");
  const lines = [
    "PawNir  |  RESPONSIBLE ADOPTION APPLICATION",
    "Bangladesh animal safety and care network",
    "",
    `Application: ${application.id}`,
    `Date: ${new Date(application.createdAt).toLocaleDateString("en-BD")}`,
    "",
    "ANIMAL",
    `Name: ${listing.name}   Species: ${listing.species}   Area: ${listing.area}`,
    `About: ${listing.description}`,
    "",
    "APPLICANT",
    `Name: ${user.name || "Pet parent"}   Email: ${user.email}`,
    `Area: ${user.area || "Not provided"}`,
    "",
    "CARE COMMITMENT",
    "I confirm that I can provide safe housing, food, veterinary care,",
    "daily attention, and a long-term commitment. I understand PawNir",
    "may verify this application and follow up after handover.",
    "",
    "Applicant signature: ____________________   Date: ______________",
    "",
    "PawNir review status: Submitted for screening",
    "This document is an application, not an adoption approval or sale contract.",
    "Live-animal buying and selling is not permitted on PawNir."
  ];
  const stream = ["BT", "/F1 10 Tf", "50 760 Td", "0 -18 Td", ...lines.map((line) => `(${esc(line)}) Tj 0 -18 Td`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, "utf8"); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function vetSlotsForDate(vet, date) {
  const parsed = parseBangladeshDate(date);
  const schedule = vet && vet.availability;
  if (!parsed || !schedule || !Array.isArray(schedule.days) || !Array.isArray(schedule.slots)) return [];
  return schedule.days.includes(parsed.getUTCDay()) ? schedule.slots.filter((slot) => typeof slot === "string") : [];
}

function availableVetSlots(vet, date, mode, bookings) {
  if (mode && !Array.isArray(vet.modes) || mode && !vet.modes.includes(mode)) return [];
  const booked = new Set(bookings.filter((booking) => booking.vetId === vet.id && booking.date === date && ["pending", "confirmed"].includes(booking.status)).map((booking) => booking.time));
  return vetSlotsForDate(vet, date).filter((slot) => !booked.has(slot));
}

function isRateLimited(req) {
  const key = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function cacheKey(prefix, tenantId) {
  return `${prefix}:${normalizeTenantId(tenantId)}`;
}

function invalidateTenantCache(tenantId) {
  const keys = [
    "report",
    "summary",
    "live",
    "bottlenecks",
    "cases",
    "recommendations",
    "anomalies",
    "alerts",
    "impact",
    "clusters",
    "scenarios",
    "approvals",
    "audit"
  ];
  keys.forEach((k) => appState.cache.del(cacheKey(k, tenantId)));
}

function sseSet(tenantId) {
  const id = normalizeTenantId(tenantId);
  if (!appState.sseClients.has(id)) {
    appState.sseClients.set(id, new Set());
  }
  return appState.sseClients.get(id);
}

function pushSse(tenantId, eventName, payload) {
  const clients = sseSet(tenantId);
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => {
    try {
      res.write(msg);
    } catch (err) {
      // ignore stale clients
    }
  });
}

async function appendAudit(tenantId, actor, action, detail = {}) {
  await appState.storage.appendAudit(tenantId, {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    actor: actor || "system",
    action,
    detail,
    createdAt: new Date().toISOString()
  });
}

function buildEventReportFromLegacyEvents() {
  const events = appState.storage.readLegacyEvents();
  const report = aggregate(
    events
      .map((e) => ({ ...e, ts: new Date(e.timestamp).getTime() }))
      .sort((a, b) => a.ts - b.ts)
  );
  return {
    ...report,
    dataset: "process-events",
    recommendations: createRecommendations(report)
  };
}

async function getReport(tenantId) {
  const key = cacheKey("report", tenantId);
  const hit = appState.cache.get(key);
  if (hit) return hit;

  let report = await appState.storage.readReport(tenantId);
  if (!report) {
    report = buildEventReportFromLegacyEvents();
  }
  appState.cache.set(key, report);
  return report;
}

function withInterventionMetrics(item, report) {
  const baseline = Number(item.baselineLeakEur || (report.summary && report.summary.estimatedLeakEur) || 0);
  const after = item.actualLeakAfterEur != null ? Number(item.actualLeakAfterEur) : null;
  const expected = Number(item.expectedUpliftEur || 0);
  const computedActual = after != null ? Math.max(0, baseline - after) : Number(item.actualUpliftEur || 0);
  const windowDays =
    item.measurementStart && item.measurementEnd
      ? Math.max(1, Math.round((new Date(item.measurementEnd) - new Date(item.measurementStart)) / (1000 * 60 * 60 * 24)))
      : 14;
  const counterfactualLeakEur = Math.round(baseline * (1 + Math.min(0.15, (windowDays / 30) * 0.03)));
  const effectVsCounterfactual = Math.max(0, counterfactualLeakEur - (after != null ? after : baseline - computedActual));
  const confidencePct = Math.max(
    45,
    Math.min(
      98,
      Math.round(60 + Math.min(25, (windowDays / 14) * 8) + Math.min(13, (effectVsCounterfactual / Math.max(1, baseline)) * 100))
    )
  );
  const progressPct = expected > 0 ? Math.round((computedActual / expected) * 100) : 0;
  return {
    ...item,
    baselineLeakEur: Math.round(baseline),
    counterfactualLeakEur,
    actualUpliftEur: Math.round(computedActual),
    effectVsCounterfactualEur: Math.round(effectVsCounterfactual),
    confidencePct,
    progressPct,
    windowDays
  };
}

function buildLiveSnapshot(report) {
  const summary = report.summary || {};
  const anomalies = detectAnomalies(report);
  const leakRatePerMin = (summary.estimatedLeakEur || 0) / Math.max(1, 30 * 24 * 60);
  const alerts = anomalies.slice(0, 3).map((a, i) => ({
    id: `live-${i + 1}`,
    title: `${a.id} abnormal leak spike`,
    severity: a.severity
  }));
  return {
    timestamp: new Date().toISOString(),
    leakRatePerMin,
    activeAlerts: alerts.length,
    moneyLeakingNow: leakRatePerMin * ((new Date().getSeconds() + 1) / 60),
    alerts
  };
}

function buildForecast(report) {
  const current = (report.summary && report.summary.estimatedLeakEur) || 0;
  const base = current / 30;
  const points = [];
  for (let i = 1; i <= 30; i += 1) {
    const trend = 1 + Math.sin(i / 5) * 0.04 + (i / 30) * 0.08;
    const projected = base * i * trend;
    const confidence = Math.max(0.6, 0.95 - i * 0.008);
    points.push({
      day: i,
      projectedLeakEur: Math.round(projected),
      lower: Math.round(projected * (1 - (1 - confidence))),
      upper: Math.round(projected * (1 + (1 - confidence))),
      confidence: Number(confidence.toFixed(2))
    });
  }
  return points;
}

function buildStory(report, interventions) {
  const summary = report.summary || {};
  const top = (report.bottlenecks || [])[0];
  const topLeak = summary.topLeakArea || (top && (top.driver || top.transition)) || "unknown";
  const expected = interventions.reduce((acc, i) => acc + Number(i.expectedUpliftEur || 0), 0);
  const actual = interventions.reduce((acc, i) => acc + Number(i.actualUpliftEur || 0), 0);
  return {
    title: "Executive transformation story",
    bullets: [
      `Current leakage exposure is ${Math.round(summary.estimatedLeakEur || 0).toLocaleString("en-US")} EUR.`,
      `Primary pressure point: ${topLeak}.`,
      `Intervention progress: expected ${Math.round(expected).toLocaleString("en-US")} EUR vs actual ${Math.round(actual).toLocaleString("en-US")} EUR.`,
      "Recommended path: fix top anomaly clusters, assign owners, and close weekly ROI reviews."
    ]
  };
}

function runSimulation(report, query) {
  const summary = report.summary || {};
  const baseLeak = summary.estimatedLeakEur || 0;
  const promo = Math.max(-30, Math.min(40, Number(query.get("promo") || 0)));
  const closure = Math.max(-40, Math.min(40, Number(query.get("closure") || 0)));
  const conversion = Math.max(-30, Math.min(40, Number(query.get("conversion") || 0)));
  const impactFactor = promo * 0.002 + closure * 0.003 + conversion * 0.004;
  const projectedLeak = Math.max(0, baseLeak * (1 - impactFactor));
  const recovered = Math.max(0, baseLeak - projectedLeak);
  return {
    inputs: { promo, closure, conversion },
    baselineLeakEur: Math.round(baseLeak),
    projectedLeakEur: Math.round(projectedLeak),
    recoveredEur: Math.round(recovered),
    roiScore: Math.round((recovered / Math.max(1, baseLeak)) * 100)
  };
}

function runSimulationFromInputs(report, inputs) {
  const qp = new URLSearchParams();
  qp.set("promo", String(inputs.promo || 0));
  qp.set("closure", String(inputs.closure || 0));
  qp.set("conversion", String(inputs.conversion || 0));
  return runSimulation(report, qp);
}

function scenarioComparison(base, candidate) {
  return {
    baseId: base.id,
    candidateId: candidate.id,
    baselineLeakDeltaEur: (candidate.result && candidate.result.projectedLeakEur) - (base.result && base.result.projectedLeakEur),
    recoveredDeltaEur: (candidate.result && candidate.result.recoveredEur) - (base.result && base.result.recoveredEur),
    roiDelta: (candidate.result && candidate.result.roiScore) - (base.result && base.result.roiScore)
  };
}

function buildDecisionStudio(report, scenarios, interventions, question) {
  const ranking = buildImpactRanking(report, interventions || []);
  const top = ranking[0];
  const latestScenario = scenarios && scenarios.length ? scenarios[0] : null;
  const diagnosis = top
    ? `Highest impact entity is ${top.id} with score ${top.impactScore} driven by ${top.primaryDriver}.`
    : "No high-impact entity detected.";
  const recommendation = latestScenario
    ? `Use scenario "${latestScenario.name}" and execute focused action on ${top ? top.id : "top entity"}.`
    : `Create a scenario and prioritize action on ${top ? top.id : "top impact entities"}.`;
  return {
    question: question || "",
    diagnosis,
    recommendation,
    suggestedTask: {
      provider: "jira",
      title: `Intervention for ${top ? top.id : "high impact entity"}`,
      description: recommendation
    },
    scenarioHint: latestScenario
      ? `Latest scenario "${latestScenario.name}" estimates recovery ${latestScenario.result.recoveredEur} EUR.`
      : "No saved scenario yet."
  };
}

function answerCopilot(report, question) {
  const q = String(question || "").toLowerCase();
  const summary = report.summary || {};
  const anomalies = detectAnomalies(report);
  const topRisk = (report.cases || [])[0];
  if (!q.trim()) return "Ask about anomalies, drivers, interventions, or forecast.";
  if (q.includes("anomal")) {
    return anomalies.length
      ? `Top anomaly is ${anomalies[0].id} with z-score ${anomalies[0].zScore}.`
      : "No active anomalies above threshold right now.";
  }
  if (q.includes("driver") || q.includes("why")) {
    return `Primary leakage driver is ${summary.topLeakArea || "unknown"}, causing the largest estimated impact.`;
  }
  if (q.includes("store") || q.includes("entity")) {
    return `Highest-risk entity currently: ${topRisk ? topRisk.entityId || topRisk.caseId : "n/a"}.`;
  }
  if (q.includes("forecast")) {
    return "30-day risk radar indicates upward leakage unless top interventions are executed now.";
  }
  return "Use role-based view, anomaly feed, and intervention confidence to prioritize actions each week.";
}

function buildActionsCsv(report, interventions) {
  const rows = [["type", "title_or_action", "owner", "status_or_impact", "expected_uplift_eur", "actual_uplift_eur", "confidence_pct"]];
  (report.recommendations || []).forEach((r) => {
    rows.push(["recommendation", r.title || "", "", r.impact || "", "", "", ""]);
  });
  interventions.forEach((i) => {
    rows.push([
      "intervention",
      i.action || "",
      i.owner || "",
      i.status || "",
      Number(i.expectedUpliftEur || 0),
      Number(i.actualUpliftEur || 0),
      Number(i.confidencePct || 0)
    ]);
  });
  return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
}

function buildBriefText(report, interventions, tenantId) {
  const summary = report.summary || {};
  const story = buildStory(report, interventions);
  return [
    "PawNir - Executive Brief",
    `Tenant: ${tenantId}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    `Dataset: ${report.dataset || "unknown"}`,
    `Leakage estimate: ${Math.round(summary.estimatedLeakEur || 0).toLocaleString("en-US")} EUR`,
    `Top driver: ${summary.topLeakArea || "n/a"}`,
    "",
    ...story.bullets.map((b) => `- ${b}`)
  ].join("\n");
}

function buildBriefHtml(text) {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Executive Brief</title><style>
  body{font-family:Arial,sans-serif;padding:28px;line-height:1.5;color:#111}
  h1{font-size:22px}
  pre{white-space:pre-wrap;font-family:inherit}
  .hint{margin-top:20px;font-size:12px;color:#555}
  </style></head><body><h1>Executive Brief</h1><pre>${safe}</pre><p class="hint">Use browser print to export as PDF.</p></body></html>`;
}

async function seedRuntimeDataIfNeeded() {
  if (!IS_SERVERLESS) return;
  const sourceReport = path.join(SEED_DATA_DIR, "rossmann_report.json");
  const targetTenantDir = path.join(DATA_DIR, "tenants", "default");
  const targetReport = path.join(targetTenantDir, "report.json");
  const targetInterventions = path.join(targetTenantDir, "interventions.json");
  const sourceInterventions = path.join(SEED_DATA_DIR, "interventions.json");

  try {
    if (!fs.existsSync(targetReport) && fs.existsSync(sourceReport)) {
      fs.mkdirSync(targetTenantDir, { recursive: true });
      fs.copyFileSync(sourceReport, targetReport);
    }
    if (!fs.existsSync(targetInterventions)) {
      fs.mkdirSync(targetTenantDir, { recursive: true });
      if (fs.existsSync(sourceInterventions)) {
        fs.copyFileSync(sourceInterventions, targetInterventions);
      } else {
        fs.writeFileSync(targetInterventions, "[]", "utf8");
      }
    }
  } catch (err) {
    log("warn", "serverless_seed_failed", { error: err.message });
  }
}

function getPipelineStatus(tenantId) {
  return {
    tenantId,
    enabled: appState.pipeline.enabled,
    sourceTrainPath: appState.pipeline.sourceTrainPath,
    sourceStorePath: appState.pipeline.sourceStorePath,
    isBuilding: appState.pipeline.isBuilding,
    queued: appState.pipeline.queued,
    lastBuildAt: appState.pipeline.lastBuildAt,
    lastSuccessAt: appState.pipeline.lastSuccessAt,
    lastDurationMs: appState.pipeline.lastDurationMs,
    lastError: appState.pipeline.lastError,
    lastReason: appState.pipeline.lastReason
  };
}

function normalizeImportedReport(payload) {
  const report =
    payload && typeof payload === "object" && payload.report && typeof payload.report === "object"
      ? payload.report
      : payload;
  if (!report || typeof report !== "object") return null;
  if (!report.summary || typeof report.summary !== "object") return null;
  if (!Array.isArray(report.cases)) return null;

  return {
    generatedAt: report.generatedAt || new Date().toISOString(),
    dataset: report.dataset || "custom-import",
    summary: report.summary,
    summaryCards: Array.isArray(report.summaryCards) ? report.summaryCards : [],
    bottlenecks: Array.isArray(report.bottlenecks) ? report.bottlenecks : [],
    recommendations: Array.isArray(report.recommendations) ? report.recommendations : [],
    cases: report.cases
  };
}

function buildDataControlStatus(tenantId, report) {
  const mode = IS_SERVERLESS ? "serverless-ephemeral" : "filesystem-persistent";
  return {
    tenantId,
    dataset: report.dataset || "unknown",
    generatedAt: report.generatedAt || null,
    storageMode: mode,
    dataDir: DATA_DIR,
    serverless: IS_SERVERLESS,
    pipeline: getPipelineStatus(tenantId),
    hints: [
      "Use POST /api/data/import-report to replace the live report with custom JSON.",
      "Use POST /api/rebuild to rebuild from train.csv/store.csv paths when pipeline is enabled."
    ]
  };
}

async function refreshAlertsForTenant(tenantId, report) {
  const anomalies = detectAnomalies(report);
  const derived = alertsFromAnomalies(anomalies);
  await appState.storage.writeAlerts(tenantId, derived);
  appState.cache.del(cacheKey("alerts", tenantId));
  appState.cache.del(cacheKey("anomalies", tenantId));
}

async function triggerRossmannBuild(tenantId, reason = "manual") {
  const t = normalizeTenantId(tenantId);
  if (!appState.pipeline.sourceTrainPath) {
    appState.pipeline.lastError = "Train CSV not found.";
    return;
  }
  if (appState.pipeline.isBuilding) {
    appState.pipeline.queued = true;
    appState.pipeline.lastReason = `${reason} (queued)`;
    return;
  }

  appState.pipeline.isBuilding = true;
  appState.pipeline.lastError = null;
  appState.pipeline.lastReason = reason;
  appState.pipeline.lastBuildAt = new Date().toISOString();
  const started = Date.now();

  try {
    const report = await buildRossmannReport(appState.pipeline.sourceTrainPath, appState.pipeline.sourceStorePath);
    await appState.storage.writeReport(t, report);
    await refreshAlertsForTenant(t, report);
    await appendAudit(t, "system", "pipeline.rebuild.success", { reason });
    invalidateTenantCache(t);
    appState.pipeline.lastSuccessAt = new Date().toISOString();
    pushSse(t, "pipeline", { status: getPipelineStatus(t) });
  } catch (err) {
    appState.pipeline.lastError = err && err.message ? err.message : "Build failed";
    await appendAudit(t, "system", "pipeline.rebuild.error", { reason, error: appState.pipeline.lastError });
    pushSse(t, "pipeline", { status: getPipelineStatus(t) });
  } finally {
    appState.pipeline.lastDurationMs = Date.now() - started;
    appState.pipeline.isBuilding = false;
    if (appState.pipeline.queued) {
      appState.pipeline.queued = false;
      triggerRossmannBuild(t, "queued-rebuild").catch(() => {});
    }
  }
}

function registerFileWatcher(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const watcher = (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      triggerRossmannBuild("default", `source-updated:${path.basename(filePath)}`).catch(() => {});
    }
  };
  fs.watchFile(filePath, { interval: 2500 }, watcher);
  appState.pipeline.watchers.push({ filePath, watcher });
}

function initAutoPipeline() {
  if (IS_SERVERLESS) {
    appState.pipeline.enabled = false;
    return;
  }
  if (!appState.pipeline.sourceTrainPath) {
    appState.pipeline.enabled = false;
    return;
  }
  appState.pipeline.enabled = true;
  registerFileWatcher(appState.pipeline.sourceTrainPath);
  registerFileWatcher(appState.pipeline.sourceStorePath);
  triggerRossmannBuild("default", "startup-sync").catch(() => {});
}

async function runDigestAutomation() {
  try {
    const tenantId = "default";
    const report = await getReport(tenantId);
    const interventionsRaw = await appState.storage.readInterventions(tenantId);
    const interventions = interventionsRaw.map((i) => withInterventionMetrics(i, report));
    const digest = buildDigest(report, interventions, tenantId);
    await appState.storage.writeDigest(tenantId, digest);
  } catch (err) {
    log("warn", "Digest automation failed", { error: err.message });
  }
}

function startDigestScheduler() {
  if (IS_SERVERLESS) return;
  runDigestAutomation().catch(() => {});
  setInterval(() => {
    runDigestAutomation().catch(() => {});
  }, DIGEST_INTERVAL_MS);
}

function startRealtimeBroadcast() {
  if (IS_SERVERLESS) return;
  setInterval(async () => {
    const tenantsDir = path.join(DATA_DIR, "tenants");
    const tenantIds = fs.existsSync(tenantsDir)
      ? fs.readdirSync(tenantsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : ["default"];

    for (const tenantId of tenantIds) {
      const clients = sseSet(tenantId);
      if (!clients.size) continue;
      try {
        const report = await getReport(tenantId);
        const payload = {
          live: buildLiveSnapshot(report),
          pipeline: getPipelineStatus(tenantId),
          anomalyCount: detectAnomalies(report).length
        };
        pushSse(tenantId, "snapshot", payload);
      } catch (err) {
        // keep loop resilient
      }
    }
  }, 7000);
}

async function routeApi(req, res, urlObj, tenantId, user) {
  const pathname = urlObj.pathname;
  const report = await getReport(tenantId);

  if (pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "pawnir-veterinary-portal",
      dataset: report.dataset || "unknown",
      uptimeSec: Math.round((Date.now() - appState.startedAt) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      authRequired: AUTH_REQUIRED,
      tenant: tenantId
    });
    return;
  }

  if (pathname === "/api/auth/config" && req.method === "GET") {
    sendJson(res, 200, {
      googleEnabled: googleConfigured(),
      twoFactorEnabled: true
    });
    return;
  }

  if (pathname === "/api/auth/challenge" && req.method === "GET") {
    sendJson(res, 200, createMathChallenge(TOKEN_SECRET));
    return;
  }

  if (pathname === "/api/auth/verify-2fa" && req.method === "POST") {
    const body = await readBodyJson(req);
    const claims = body.pendingToken ? verifyToken(body.pendingToken, TOKEN_SECRET) : null;
    if (!claims || claims.stage !== "2fa_pending" || claims.tenantId !== tenantId) {
      sendJson(res, 401, { error: "Your sign-in session expired. Please sign in again." });
      return;
    }
    if (!verifyMathChallenge(body.challengeToken, body.answer, TOKEN_SECRET)) {
      await appendAudit(tenantId, claims.email || "unknown", "auth.2fa.failed", {});
      sendJson(res, 400, {
        error: "Incorrect math answer. Please try the new calculation.",
        challenge: createMathChallenge(TOKEN_SECRET)
      });
      return;
    }
    const users = await appState.storage.readUsers(tenantId);
    const profile = users.find((item) => item.id === claims.sub) || {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      name: claims.name
    };
    const token = issueToken(profile, TOKEN_SECRET, tenantId);
    await appendAudit(tenantId, profile.email, "auth.2fa.verified", { role: profile.role });
    sendJson(res, 200, {
      token,
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        name: profile.name,
        avatarUrl: profile.avatarUrl || null,
        area: profile.area || null,
        bio: profile.bio || ""
      }
    });
    return;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBodyJson(req);
    const principal = await authenticate(appState.storage, tenantId, body.email, body.password);
    if (!principal) {
      await appendAudit(tenantId, body.email || "unknown", "auth.login.failed", {});
      sendJson(res, 401, { error: "Invalid credentials" });
      return;
    }

    if (body.require2fa) {
      const pendingToken = issuePending2faToken(principal, TOKEN_SECRET, tenantId);
      const challenge = createMathChallenge(TOKEN_SECRET);
      await appendAudit(tenantId, principal.email, "auth.login.2fa_challenge", { role: principal.role });
      sendJson(res, 200, {
        requires2fa: true,
        pendingToken,
        challenge,
        user: { email: principal.email, role: principal.role, name: principal.name }
      });
      return;
    }

    const token = issueToken(principal, TOKEN_SECRET, tenantId);
    await appendAudit(tenantId, principal.email, "auth.login.success", { role: principal.role });
    sendJson(res, 200, { token, user: { email: principal.email, role: principal.role, name: principal.name } });
    return;
  }

  if (pathname === "/auth/google/start" && req.method === "GET") {
    if (!googleConfigured()) return redirect(res, "/?auth_error=google_not_configured#signin");
    const state = crypto.randomBytes(24).toString("base64url");
    const redirectUri = resolveGoogleRedirectUri(req);
    googleStates.set(state, { tenantId, redirectUri, createdAt: Date.now() });
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account"
    });
    redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    return;
  }

  if (pathname === "/auth/google/callback" && req.method === "GET") {
    const state = urlObj.searchParams.get("state");
    const record = state ? googleStates.get(state) : null;
    googleStates.delete(state);
    if (!record || Date.now() - record.createdAt > GOOGLE_STATE_TTL_MS || record.tenantId !== tenantId) {
      return redirect(res, "/?auth_error=invalid_google_state#signin");
    }
    if (urlObj.searchParams.get("error")) return redirect(res, `/?auth_error=${encodeURIComponent(urlObj.searchParams.get("error"))}#signin`);
    try {
      const tokens = await exchangeGoogleCode(urlObj.searchParams.get("code") || "", record.redirectUri);
      const profile = await getGoogleProfile(tokens.access_token);
      const principal = await findOrCreateGoogleUser(appState.storage, tenantId, profile);
      if (!principal) return redirect(res, "/?auth_error=unverified_google_email#signin");
      const pendingToken = issuePending2faToken(principal, TOKEN_SECRET, tenantId);
      await appendAudit(tenantId, principal.email, "auth.google.2fa_pending", {});
      return redirect(res, `/#google_pending=${encodeURIComponent(pendingToken)}`);
    } catch (error) {
      await appendAudit(tenantId, "google", "auth.google.failed", { reason: error.message });
      return redirect(res, "/?auth_error=google_signin_failed#signin");
    }
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
      const body = await readBodyJson(req);
      const principal = await registerUser(appState.storage, tenantId, body.email, body.password, body.name);
      if (!principal) {
        sendJson(res, 400, { error: "Use a unique email and a password of at least 8 characters" });
        return;
      }
      if (body.require2fa) {
        const pendingToken = issuePending2faToken(principal, TOKEN_SECRET, tenantId);
        const challenge = createMathChallenge(TOKEN_SECRET);
        await appendAudit(tenantId, principal.email, "auth.register.2fa_challenge", { role: principal.role });
        sendJson(res, 201, {
          requires2fa: true,
          pendingToken,
          challenge,
          user: { email: principal.email, role: principal.role, name: principal.name }
        });
        return;
      }
      const token = issueToken(principal, TOKEN_SECRET, tenantId);
      await appendAudit(tenantId, principal.email, "auth.register.success", { role: principal.role });
      sendJson(res, 201, { token, user: { email: principal.email, role: principal.role, name: principal.name } });
      return;
  }

  if (pathname === "/api/lost-found" && req.method === "GET") {
      const rawArea = cleanText(urlObj.searchParams.get("area") || "", 80).toLowerCase();
      const requestedAreaKey = areaKey(rawArea);
      const requestedType = urlObj.searchParams.get("type") || "all";
      const requestedSpecies = cleanText(urlObj.searchParams.get("species") || "", 20).toLowerCase();
      const reports = await appState.storage.readCollection(tenantId, "lostReports");
      const now = Date.now();
      const visible = reports.filter((report) => {
        if (report.status !== "open") return false;
        if (report.expiresAt && new Date(report.expiresAt).getTime() <= now) return false;
        if (requestedType !== "all" && report.type !== requestedType) return false;
        if (requestedSpecies && requestedSpecies !== "all" && report.species !== requestedSpecies) return false;
        if (rawArea) {
          const haystack = `${report.area || ""} ${report.city || ""} ${report.title || ""} ${report.description || ""} ${report.areaKey || ""}`.toLowerCase();
          return haystack.includes(rawArea) || (requestedAreaKey && String(report.areaKey || "").includes(requestedAreaKey));
        }
        return true;
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const mine = user ? reports.filter((report) => report.ownerId === user.sub).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
      sendJson(res, 200, { reports: visible.slice(0, 100).map(publicLostReport), mine: mine.slice(0, 50).map(publicLostReport) });
      return;
  }

  const lostSightingMatch = pathname.match(/^\/api\/lost-found\/([^/]+)\/sightings$/);
  if (lostSightingMatch && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to share a sighting tip" });
      const reportId = decodeURIComponent(lostSightingMatch[1]);
      const body = await readBodyJson(req);
      const location = cleanText(body.location, 120);
      const note = cleanText(body.note, 500);
      if (!location || note.length < 6) {
        return sendJson(res, 400, { error: "Sighting location and a helpful note are required" });
      }
      const reports = await appState.storage.readCollection(tenantId, "lostReports");
      const idx = reports.findIndex((item) => item.id === reportId && item.status === "open");
      if (idx < 0) return sendJson(res, 404, { error: "Open report not found" });
      const sighting = {
        id: `sight-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        reporterId: user.sub,
        reporterName: cleanText(user.name || user.email.split("@")[0], 80),
        location,
        note,
        createdAt: new Date().toISOString()
      };
      const existingSightings = Array.isArray(reports[idx].sightings) ? reports[idx].sightings : [];
      reports[idx] = {
        ...reports[idx],
        sightings: [sighting, ...existingSightings],
        updatedAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "lostReports", reports);
      if (reports[idx].ownerId && reports[idx].ownerId !== user.sub) {
        const notifications = await appState.storage.readCollection(tenantId, "notifications");
        const alertItem = {
          id: `notification-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: reports[idx].ownerId,
          type: "lost_found_sighting",
          reportId,
          title: `New sighting tip for: ${reports[idx].title}`,
          message: `${sighting.reporterName} spotted near ${location}: "${note}"`,
          read: false,
          createdAt: new Date().toISOString()
        };
        await appState.storage.writeCollection(tenantId, "notifications", [alertItem, ...notifications].slice(0, 1000));
      }
      await appendAudit(tenantId, user.email, "lost_found.sighting.created", { reportId, sightingId: sighting.id });
      pushSse(tenantId, "lost_found_update", { action: "sighting", reportId });
      sendJson(res, 201, { report: publicLostReport(reports[idx]), sighting });
      return;
  }

  if (pathname === "/api/lost-found" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to report a lost or found animal" });
      const body = await readBodyJson(req);
      const type = body.type === "found" ? "found" : body.type === "lost" ? "lost" : "";
      const species = ["cat", "dog", "bird", "rabbit", "other"].includes(body.species) ? body.species : "";
      const area = cleanText(body.area, 80);
      const city = cleanText(body.city, 60);
      const title = cleanText(body.title, 120);
      const description = cleanText(body.description, 1000);
      let photoData;
      try {
        photoData = validateLostFoundPhoto(body.photoData);
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
      if (!type || !species || !area || !city || !title || description.length < 10) {
        return sendJson(res, 400, { error: "Type, species, area, city, title, and a useful description are required" });
      }
      const reports = await appState.storage.readCollection(tenantId, "lostReports");
      const duplicate = reports.find((report) => report.ownerId === user.sub && report.status === "open" && report.type === type && report.areaKey === areaKey(area) && report.title.toLowerCase() === title.toLowerCase());
      if (duplicate) return sendJson(res, 409, { error: "You already have an open report with these details" });
      const report = {
        id: `lost-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ownerId: user.sub,
        ownerName: cleanText(user.name || user.email.split("@")[0], 80),
        type,
        species,
        title,
        description,
        photoData,
        area,
        areaKey: areaKey(area),
        city,
        photoUrl: cleanText(body.photoUrl, 500) || null,
        status: "open",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      await appState.storage.writeCollection(tenantId, "lostReports", [report, ...reports]);
      const subscriptions = await appState.storage.readCollection(tenantId, "areaSubscriptions");
      const notifications = await appState.storage.readCollection(tenantId, "notifications");
      const recipients = subscriptions.filter((subscription) => subscription.areaKey === report.areaKey && subscription.userId !== user.sub);
      const newNotifications = recipients.map((recipient) => ({
        id: `notification-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: recipient.userId,
        type: "lost_found_nearby",
        reportId: report.id,
        title: `${type === "lost" ? "Lost" : "Found"} ${species} near you`,
        message: `${title} · ${area}`,
        read: false,
        createdAt: new Date().toISOString()
      }));
      if (newNotifications.length) await appState.storage.writeCollection(tenantId, "notifications", [...newNotifications, ...notifications].slice(0, 1000));
      await appendAudit(tenantId, user.email, "lost_found.report.created", { reportId: report.id, type, areaKey: report.areaKey, notifiedCount: newNotifications.length });
      pushSse(tenantId, "lost_found_update", { action: "created", reportId: report.id, area: report.area, type: report.type, notifiedCount: newNotifications.length });
      sendJson(res, 201, { report: publicLostReport(report), notifiedCount: newNotifications.length });
      return;
  }

  const lostReportMatch = pathname.match(/^\/api\/lost-found\/([^/]+)$/);
  if (lostReportMatch && req.method === "PATCH") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to update a report" });
      const reportId = decodeURIComponent(lostReportMatch[1]);
      const body = await readBodyJson(req);
      const reports = await appState.storage.readCollection(tenantId, "lostReports");
      const index = reports.findIndex((report) => report.id === reportId && report.ownerId === user.sub);
      if (index < 0) return sendJson(res, 404, { error: "Report not found" });
      if (!["open", "resolved", "closed"].includes(body.status)) return sendJson(res, 400, { error: "Status must be open, resolved, or closed" });
      reports[index] = { ...reports[index], status: body.status, updatedAt: new Date().toISOString() };
      await appState.storage.writeCollection(tenantId, "lostReports", reports);
      await appendAudit(tenantId, user.email, "lost_found.report.updated", { reportId, status: body.status });
      pushSse(tenantId, "lost_found_update", { action: "updated", reportId, status: body.status });
      sendJson(res, 200, publicLostReport(reports[index]));
      return;
  }

  if (pathname === "/api/lost-found/subscribe" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required for nearby alerts" });
      const body = await readBodyJson(req);
      const area = cleanText(body.area, 80);
      const city = cleanText(body.city, 60);
      if (!area || !city) return sendJson(res, 400, { error: "Area and city are required" });
      const subscriptions = await appState.storage.readCollection(tenantId, "areaSubscriptions");
      const existing = subscriptions.find((item) => item.userId === user.sub && item.areaKey === areaKey(area));
      if (!existing) subscriptions.unshift({ id: `area-${Date.now()}-${Math.floor(Math.random() * 10000)}`, userId: user.sub, area, areaKey: areaKey(area), city, createdAt: new Date().toISOString() });
      await appState.storage.writeCollection(tenantId, "areaSubscriptions", subscriptions);
      await appendAudit(tenantId, user.email, "lost_found.area.subscribed", { areaKey: areaKey(area) });
      sendJson(res, 201, { area, city, subscribed: true });
      return;
  }

  if (pathname === "/api/notifications" && req.method === "GET") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to view notifications" });
      const notifications = await appState.storage.readCollection(tenantId, "notifications");
      sendJson(res, 200, notifications.filter((item) => item.userId === user.sub).slice(0, 100));
      return;
  }
  if (pathname === "/api/notifications/read" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to update notifications" });
      const notifications = await appState.storage.readCollection(tenantId, "notifications");
      const updated = notifications.map((item) => item.userId === user.sub ? { ...item, read: true } : item);
      await appState.storage.writeCollection(tenantId, "notifications", updated);
      sendJson(res, 200, { updated: notifications.filter((item) => item.userId === user.sub).length });
      return;
  }

  if (pathname === "/api/donors" && req.method === "GET") {
      const area = cleanText(urlObj.searchParams.get("area"), 80).toLowerCase();
      const species = cleanText(urlObj.searchParams.get("species"), 20).toLowerCase();
      const bloodType = cleanText(urlObj.searchParams.get("bloodType"), 30).toLowerCase();
      const includeMine = urlObj.searchParams.get("includeMine") === "1";
      const [donors, donorRequests] = await Promise.all([
        appState.storage.readCollection(tenantId, "donors"),
        includeMine && user ? appState.storage.readCollection(tenantId, "donorRequests") : Promise.resolve([])
      ]);
      const visible = donors.filter((donor) => {
        if (!donor.verified || !donor.consent || !donor.available) return false;
        if (species && donor.species !== species) return false;
        if (bloodType && !String(donor.bloodType || "").toLowerCase().includes(bloodType)) return false;
        if (area) {
          const hay = `${donor.area || ""} ${donor.city || ""} ${donor.petName || ""} ${donor.bloodType || ""}`.toLowerCase();
          if (!hay.includes(area)) return false;
        }
        return true;
      }).map(publicDonor);
      if (includeMine) {
        const myDonors = user ? donors.filter((d) => d.ownerId === user.sub).map(publicDonor) : [];
        const incomingRequests = user ? donorRequests.filter((r) => r.donorOwnerId === user.sub).slice(0, 30) : [];
        const mySentRequests = user ? donorRequests.filter((r) => r.requesterId === user.sub).slice(0, 30) : [];
        sendJson(res, 200, { donors: visible, myDonors, incomingRequests, mySentRequests });
        return;
      }
      sendJson(res, 200, visible);
      return;
  }
  if (pathname === "/api/donors" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to register a donor" });
      const body = await readBodyJson(req);
      const species = ["cat", "dog"].includes(body.species) ? body.species : "";
      const petName = cleanText(body.petName, 60) || (species === "cat" ? "Cat Donor" : "Dog Donor");
      const area = cleanText(body.area, 80);
      const city = cleanText(body.city, 60);
      const weightKg = body.weightKg ? Math.max(1, Math.min(90, Number(body.weightKg) || 0)) : null;
      if (!species || !area || !city || body.consent !== true || body.eligibilityAcknowledged !== true) {
        return sendJson(res, 400, { error: "Species, area, city, donor consent, and eligibility acknowledgement are required" });
      }
      const donors = await appState.storage.readCollection(tenantId, "donors");
      const existing = donors.find((donor) => donor.ownerId === user.sub && (donor.petName || "").toLowerCase() === petName.toLowerCase());
      const donor = {
        id: existing?.id || `donor-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ownerId: user.sub,
        ownerName: cleanText(user.name || user.email.split("@")[0], 80),
        petName,
        species,
        bloodType: cleanText(body.bloodType, 30) || "Unknown",
        weightKg,
        vaccinated: body.vaccinated !== false,
        area,
        city,
        available: true,
        consent: true,
        eligibilityAcknowledged: true,
        verified: true,
        badge: "Community Verified",
        lastDonationAt: cleanText(body.lastDonationAt, 20) || null,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "donors", [donor, ...donors.filter((item) => item.id !== donor.id)]);
      await appendAudit(tenantId, user.email, "donor.registered", { donorId: donor.id });
      pushSse(tenantId, "donor_update", { action: "registered", donorId: donor.id });
      sendJson(res, 201, { donor: publicDonor(donor), status: "verified_active" });
      return;
  }
  const donorUpdateMatch = pathname.match(/^\/api\/donors\/([^/]+)$/);
  if (donorUpdateMatch && req.method === "PATCH") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to update donor status" });
      const donorId = decodeURIComponent(donorUpdateMatch[1]);
      const body = await readBodyJson(req);
      const donors = await appState.storage.readCollection(tenantId, "donors");
      const idx = donors.findIndex((item) => item.id === donorId && item.ownerId === user.sub);
      if (idx < 0) return sendJson(res, 404, { error: "Donor record not found" });
      donors[idx] = {
        ...donors[idx],
        available: typeof body.available === "boolean" ? body.available : !donors[idx].available,
        updatedAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "donors", donors);
      pushSse(tenantId, "donor_update", { action: "availability", donorId });
      sendJson(res, 200, { donor: publicDonor(donors[idx]) });
      return;
  }
  const donorRequestMatch = pathname.match(/^\/api\/donors\/([^/]+)\/requests$/);
  if (donorRequestMatch && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to request a donor" });
      const donorId = decodeURIComponent(donorRequestMatch[1]);
      const donors = await appState.storage.readCollection(tenantId, "donors");
      const donor = donors.find((item) => item.id === donorId && item.verified && item.consent && item.available);
      if (!donor) return sendJson(res, 404, { error: "Available verified donor not found" });
      const body = await readBodyJson(req);
      const reason = cleanText(body.reason, 500);
      const clinic = cleanText(body.clinic, 120);
      const contactPhone = cleanText(body.contactPhone, 40);
      if (reason.length < 10) return sendJson(res, 400, { error: "Please describe the urgent need" });
      const requests = await appState.storage.readCollection(tenantId, "donorRequests");
      if (requests.some((item) => item.donorId === donorId && item.requesterId === user.sub && item.status === "pending")) return sendJson(res, 409, { error: "You already have a pending request for this donor" });
      const request = {
        id: `donor-request-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        donorId,
        donorPetName: donor.petName || donor.species,
        donorBloodType: donor.bloodType,
        donorOwnerId: donor.ownerId,
        requesterId: user.sub,
        requesterName: cleanText(user.name || user.email.split("@")[0], 80),
        clinic: clinic || donor.area,
        contactPhone: contactPhone || null,
        reason,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "donorRequests", [request, ...requests]);
      if (donor.ownerId && donor.ownerId !== user.sub) {
        const notifications = await appState.storage.readCollection(tenantId, "notifications");
        await appState.storage.writeCollection(tenantId, "notifications", [{
          id: `notification-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          userId: donor.ownerId,
          type: "blood_donor_request",
          donorId,
          title: `Urgent blood request for ${donor.petName || donor.species}`,
          message: `${request.requesterName} (${request.clinic}): ${reason}`,
          read: false,
          createdAt: new Date().toISOString()
        }, ...notifications].slice(0, 1000));
      }
      await appendAudit(tenantId, user.email, "donor.request.created", { requestId: request.id, donorId });
      pushSse(tenantId, "donor_update", { action: "request_created", donorId });
      sendJson(res, 201, { id: request.id, status: request.status, note: "The donor owner has been notified through PawNir." });
      return;
  }
  const donorRequestActionMatch = pathname.match(/^\/api\/donor-requests\/([^/]+)$/);
  if (donorRequestActionMatch && req.method === "PATCH") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required" });
      const reqId = decodeURIComponent(donorRequestActionMatch[1]);
      const body = await readBodyJson(req);
      if (!["accepted", "declined", "fulfilled"].includes(body.status)) {
        return sendJson(res, 400, { error: "Invalid request status" });
      }
      const requests = await appState.storage.readCollection(tenantId, "donorRequests");
      const idx = requests.findIndex((item) => item.id === reqId && (item.donorOwnerId === user.sub || item.requesterId === user.sub));
      if (idx < 0) return sendJson(res, 404, { error: "Donor request not found" });
      requests[idx] = {
        ...requests[idx],
        status: body.status,
        responseNote: cleanText(body.responseNote, 240) || null,
        updatedAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "donorRequests", requests);
      pushSse(tenantId, "donor_update", { action: "request_updated", requestId: reqId });
      sendJson(res, 200, requests[idx]);
      return;
  }

  if (pathname === "/api/adoptions" && req.method === "GET") {
      const species = cleanText(urlObj.searchParams.get("species"), 20).toLowerCase();
      const area = cleanText(urlObj.searchParams.get("area"), 60).toLowerCase();
      const includeMine = urlObj.searchParams.get("includeMine") === "1";
      const listings = await appState.storage.readCollection(tenantId, "adoptionListings");
      const openListings = listings.filter((item) => {
        if (item.status !== "open" || !item.verified) return false;
        if (species && (item.species || "").toLowerCase() !== species) return false;
        if (area && !((item.area || "").toLowerCase().includes(area) || (item.name || "").toLowerCase().includes(area))) return false;
        return true;
      });
      const myListings = (user && includeMine)
        ? listings.filter((item) => item.ownerId === user.sub)
        : [];
      sendJson(res, 200, includeMine ? { listings: openListings, myListings } : openListings);
      return;
  }
  if (pathname === "/api/adoptions/listings" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to list an animal for adoption" });
      const body = await readBodyJson(req);
      const name = cleanText(body.name, 60);
      const species = cleanText(body.species, 20).toLowerCase();
      const breed = cleanText(body.breed, 60) || "Mixed Breed";
      const age = cleanText(body.age, 40) || "Young";
      const gender = cleanText(body.gender, 20) || "Unknown";
      const area = cleanText(body.area, 80);
      const description = cleanText(body.description, 500);
      const vaccinated = body.vaccinated !== false;
      const neutered = body.neutered === true;
      const indoorOnly = body.indoorOnly !== false;
      const photo = body.photo && typeof body.photo === "string" && body.photo.startsWith("data:image/") ? body.photo : null;

      if (!name || !species || !area || description.length < 10) {
        return sendJson(res, 400, { error: "Pet name, species, area, and a clear description are required." });
      }

      const listings = await appState.storage.readCollection(tenantId, "adoptionListings");
      const listing = {
        id: `adoption-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ownerId: user.sub,
        ownerName: cleanText(user.name || "PawNir pet parent", 80),
        name,
        species,
        breed,
        age,
        gender,
        area,
        vaccinated,
        neutered,
        indoorOnly,
        description,
        photo,
        status: "open",
        verified: true,
        createdAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "adoptionListings", [listing, ...listings]);
      await appendAudit(tenantId, user.email, "adoption.listing.created", { listingId: listing.id, name });
      pushSse(tenantId, "adoption_update", { action: "listing_created", listingId: listing.id });
      sendJson(res, 201, listing);
      return;
  }
  const adoptionListingMatch = pathname.match(/^\/api\/adoptions\/listings\/([^/]+)$/);
  if (adoptionListingMatch && req.method === "PATCH") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to update an adoption listing" });
      const listingId = decodeURIComponent(adoptionListingMatch[1]);
      const body = await readBodyJson(req);
      const listings = await appState.storage.readCollection(tenantId, "adoptionListings");
      const idx = listings.findIndex((item) => item.id === listingId);
      if (idx < 0) return sendJson(res, 404, { error: "Adoption listing not found" });
      if (listings[idx].ownerId !== user.sub && user.role !== "admin") {
        return sendJson(res, 403, { error: "You can only update your own adoption listings" });
      }
      const allowedStatuses = ["open", "adopted", "closed"];
      const nextStatus = allowedStatuses.includes(body.status) ? body.status : listings[idx].status;
      listings[idx] = { ...listings[idx], status: nextStatus, updatedAt: new Date().toISOString() };
      await appState.storage.writeCollection(tenantId, "adoptionListings", listings);
      await appendAudit(tenantId, user.email, "adoption.listing.updated", { listingId, status: nextStatus });
      pushSse(tenantId, "adoption_update", { action: "listing_updated", listingId, status: nextStatus });
      sendJson(res, 200, listings[idx]);
      return;
  }
  if (pathname === "/api/adoptions" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to apply for adoption" });
      const body = await readBodyJson(req);
      const listingId = cleanText(body.listingId, 100);
      const listings = await appState.storage.readCollection(tenantId, "adoptionListings");
      const listing = listings.find((item) => item.id === listingId && item.status === "open" && item.verified);
      if (!listing) return sendJson(res, 404, { error: "Open verified adoption listing not found" });
      const applications = await appState.storage.readCollection(tenantId, "adoptionApplications");
      if (applications.some((item) => item.listingId === listingId && item.applicantId === user.sub && ["submitted", "screening"].includes(item.status))) return sendJson(res, 409, { error: "You already have an active application for this animal" });
      const application = { id: `adoption-${Date.now()}-${Math.floor(Math.random() * 10000)}`, listingId, applicantId: user.sub, answers: { housing: cleanText(body.housing, 300), experience: cleanText(body.experience, 300), household: cleanText(body.household, 300), vetPlan: cleanText(body.vetPlan, 300) }, status: "submitted", createdAt: new Date().toISOString() };
      await appState.storage.writeCollection(tenantId, "adoptionApplications", [application, ...applications]);
      await appendAudit(tenantId, user.email, "adoption.application.created", { applicationId: application.id, listingId });
      sendJson(res, 201, { applicationId: application.id, status: application.status });
      return;
  }
  const adoptionPdfMatch = pathname.match(/^\/api\/adoptions\/([^/]+)\/pdf$/);
  if (adoptionPdfMatch && req.method === "GET") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to download an adoption form" });
      const applicationId = decodeURIComponent(adoptionPdfMatch[1]);
      const applications = await appState.storage.readCollection(tenantId, "adoptionApplications");
      const application = applications.find((item) => item.id === applicationId && item.applicantId === user.sub);
      if (!application) return sendJson(res, 404, { error: "Adoption application not found" });
      const listings = await appState.storage.readCollection(tenantId, "adoptionListings");
      const listing = listings.find((item) => item.id === application.listingId);
      const users = await appState.storage.readUsers(tenantId);
      const applicant = users.find((item) => item.id === user.sub);
      const pdf = buildAdoptionPdf(application, listing, applicant || user);
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="pawnir-adoption-${application.id}.pdf"`, "Cache-Control": "no-store" });
      res.end(pdf);
      await appendAudit(tenantId, user.email, "adoption.application.pdf_downloaded", { applicationId });
      return;
  }

  if (pathname === "/api/fosters" && req.method === "GET") {
      const city = cleanText(urlObj.searchParams.get("city"), 60).toLowerCase();
      const species = cleanText(urlObj.searchParams.get("species"), 20).toLowerCase();
      const q = cleanText(urlObj.searchParams.get("q"), 80).toLowerCase();
      const [fosters, reviews] = await Promise.all([
        appState.storage.readCollection(tenantId, "fosters"),
        appState.storage.readCollection(tenantId, "reviews")
      ]);
      const visible = fosters.filter((foster) => {
        if (!foster.verified) return false;
        if (city && foster.city.toLowerCase() !== city) return false;
        if (species && (!Array.isArray(foster.species) || !foster.species.includes(species))) return false;
        if (q) {
          const hay = `${foster.name || ""} ${foster.area || ""} ${foster.city || ""} ${foster.description || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      sendJson(res, 200, visible.map((foster) => publicFoster(foster, reviews)));
      return;
  }

  if (pathname === "/api/fosters" && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to suggest or register a local foster" });
      const body = await readBodyJson(req);
      const name = cleanText(body.name, 90);
      const area = cleanText(body.area, 80);
      const city = cleanText(body.city, 60) || "Dhaka";
      const capacity = cleanText(body.capacity, 80) || "Home foster care";
      const description = cleanText(body.description, 400);
      const mapQuery = cleanText(body.mapQuery, 140) || `${name} ${area} ${city} Bangladesh`;
      const rawSpecies = Array.isArray(body.species) ? body.species : String(body.species || "cat,dog").split(",");
      const species = rawSpecies.map((s) => s.trim().toLowerCase()).filter((s) => ["cat", "dog", "bird", "rabbit"].includes(s));
      if (!name || !area || description.length < 10) {
        return sendJson(res, 400, { error: "Foster name, area, and a clear description are required" });
      }
      const fosters = await appState.storage.readCollection(tenantId, "fosters");
      const foster = {
        id: `foster-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ownerId: user.sub,
        name,
        area,
        city,
        species: species.length ? species : ["cat", "dog"],
        capacity,
        hours: cleanText(body.hours, 60) || "Open daily · Contact for intake",
        description,
        verified: true,
        badge: "Community Mapped",
        mapQuery,
        createdAt: new Date().toISOString()
      };
      await appState.storage.writeCollection(tenantId, "fosters", [foster, ...fosters]);
      const reviews = await appState.storage.readCollection(tenantId, "reviews");
      await appendAudit(tenantId, user.email, "foster.created", { fosterId: foster.id, name });
      pushSse(tenantId, "foster_update", { action: "foster_created", fosterId: foster.id });
      sendJson(res, 201, publicFoster(foster, reviews));
      return;
  }

  const fosterMatch = pathname.match(/^\/api\/fosters\/([^/]+)$/);
  if (fosterMatch && req.method === "GET") {
      const fosterId = decodeURIComponent(fosterMatch[1]);
      const [fosters, reviews] = await Promise.all([
        appState.storage.readCollection(tenantId, "fosters"),
        appState.storage.readCollection(tenantId, "reviews")
      ]);
      const foster = fosters.find((item) => item.id === fosterId && item.verified);
      if (!foster) return sendJson(res, 404, { error: "Verified foster care not found" });
      const published = reviews
        .filter((review) => review.fosterId === foster.id && review.status === "published")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(publicReview);
      const fosterData = publicFoster(foster, reviews);
      sendJson(res, 200, { ...fosterData, foster: fosterData, reviews: published });
      return;
  }

  const fosterRequestMatch = pathname.match(/^\/api\/fosters\/([^/]+)\/requests$/);
  if (fosterRequestMatch && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to request foster care" });
      const fosterId = decodeURIComponent(fosterRequestMatch[1]);
      const fosters = await appState.storage.readCollection(tenantId, "fosters");
      const foster = fosters.find((item) => item.id === fosterId && item.verified);
      if (!foster) return sendJson(res, 404, { error: "Verified foster care not found" });
      const body = await readBodyJson(req);
      const reason = cleanText(body.reason, 500);
      if (reason.length < 10) return sendJson(res, 400, { error: "Please describe why foster care is needed" });
      const requests = await appState.storage.readCollection(tenantId, "fosterRequests");
      if (requests.some((item) => item.fosterId === fosterId && item.userId === user.sub && item.status === "pending")) return sendJson(res, 409, { error: "You already have a pending request for this foster" });
      const request = { id: `foster-request-${Date.now()}-${Math.floor(Math.random() * 10000)}`, fosterId, fosterName: foster.name, userId: user.sub, requesterName: user.name, reason, status: "pending", createdAt: new Date().toISOString() };
      await appState.storage.writeCollection(tenantId, "fosterRequests", [request, ...requests]);
      await appendAudit(tenantId, user.email, "foster.request.created", { requestId: request.id, fosterId });
      sendJson(res, 201, { id: request.id, status: request.status, fosterName: foster.name });
      return;
  }

  const fosterReviewHelpfulMatch = pathname.match(/^\/api\/fosters\/([^/]+)\/reviews\/([^/]+)\/helpful$/);
  if (fosterReviewHelpfulMatch && req.method === "POST") {
      const fosterId = decodeURIComponent(fosterReviewHelpfulMatch[1]);
      const reviewId = decodeURIComponent(fosterReviewHelpfulMatch[2]);
      const reviews = await appState.storage.readCollection(tenantId, "reviews");
      const idx = reviews.findIndex((item) => item.id === reviewId && item.fosterId === fosterId);
      if (idx < 0) return sendJson(res, 404, { error: "Review not found" });
      reviews[idx] = { ...reviews[idx], helpfulCount: Number(reviews[idx].helpfulCount || 0) + 1 };
      await appState.storage.writeCollection(tenantId, "reviews", reviews);
      sendJson(res, 200, publicReview(reviews[idx]));
      return;
  }

  const fosterReviewMatch = pathname.match(/^\/api\/fosters\/([^/]+)\/reviews$/);
  if (fosterReviewMatch && req.method === "GET") {
      const fosterId = decodeURIComponent(fosterReviewMatch[1]);
      const reviews = await appState.storage.readCollection(tenantId, "reviews");
      sendJson(res, 200, reviews.filter((review) => review.fosterId === fosterId && review.status === "published").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(publicReview));
      return;
  }
  if (fosterReviewMatch && req.method === "POST") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to review foster care" });
      const fosterId = decodeURIComponent(fosterReviewMatch[1]);
      const fosters = await appState.storage.readCollection(tenantId, "fosters");
      if (!fosters.some((item) => item.id === fosterId && item.verified)) return sendJson(res, 404, { error: "Verified foster care not found" });
      const body = await readBodyJson(req);
      const rating = Number(body.rating);
      const comment = cleanText(body.comment, 500);
      const petSpecies = ["cat", "dog", "bird", "rabbit", "other"].includes(body.petSpecies) ? body.petSpecies : "cat";
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 8) {
        return sendJson(res, 400, { error: "A star rating from 1 to 5 and a review of at least 8 characters are required" });
      }
      const [requests, reviews] = await Promise.all([
        appState.storage.readCollection(tenantId, "fosterRequests"),
        appState.storage.readCollection(tenantId, "reviews")
      ]);
      const hasRequest = requests.find((item) => item.fosterId === fosterId && item.userId === user.sub);
      const badge = hasRequest ? "Verified Stay" : "Verified Member";
      const existingIdx = reviews.findIndex((item) => item.fosterId === fosterId && item.userId === user.sub);
      let savedReview;
      if (existingIdx >= 0) {
        savedReview = {
          ...reviews[existingIdx],
          rating,
          comment,
          petSpecies,
          badge,
          authorName: cleanText(user.name || user.email.split("@")[0] || "PawNir member", 80),
          updatedAt: new Date().toISOString()
        };
        reviews[existingIdx] = savedReview;
      } else {
        savedReview = {
          id: `review-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          fosterId,
          userId: user.sub,
          requestId: hasRequest?.id || null,
          rating,
          comment,
          petSpecies,
          badge,
          helpfulCount: 0,
          authorName: cleanText(user.name || user.email.split("@")[0] || "PawNir member", 80),
          status: "published",
          createdAt: new Date().toISOString()
        };
        reviews.unshift(savedReview);
      }
      await appState.storage.writeCollection(tenantId, "reviews", reviews);
      await appendAudit(tenantId, user.email, "foster.review.saved", { reviewId: savedReview.id, fosterId, rating });
      pushSse(tenantId, "foster_update", { action: "review_saved", fosterId });
      sendJson(res, 201, publicReview(savedReview));
      return;
  }

  if (pathname === "/api/foster-requests" && req.method === "GET") {
      if (!user) return sendJson(res, 401, { error: "Sign in is required to view foster requests" });
      const requests = await appState.storage.readCollection(tenantId, "fosterRequests");
      sendJson(res, 200, requests.filter((item) => item.userId === user.sub || ["ops", "ceo"].includes(user.role)));
      return;
  }

  if (pathname === "/api/vets" && req.method === "GET") {
      const query = String(urlObj.searchParams.get("q") || "").trim().toLowerCase();
      const specialty = urlObj.searchParams.get("specialty") || "all";
      const city = urlObj.searchParams.get("city") || "all";
      const mode = urlObj.searchParams.get("mode") || "all";
      const vets = (await appState.storage.readVets(tenantId)).filter((vet) => {
        const searchable = `${vet.name} ${vet.specialty} ${vet.clinic} ${vet.city}`.toLowerCase();
        return (!query || searchable.includes(query)) &&
          (specialty === "all" || vet.specialtyKey === specialty) &&
          (city === "all" || vet.cityKey === city) &&
          (mode === "all" || vet.modes.includes(mode)) &&
          vet.verified;
      });
      sendJson(res, 200, vets);
      return;
  }

  const availabilityMatch = pathname.match(/^\/api\/vets\/([^/]+)\/availability$/);
  if (availabilityMatch && req.method === "GET") {
      const vetId = decodeURIComponent(availabilityMatch[1]);
      const date = urlObj.searchParams.get("date");
      const mode = urlObj.searchParams.get("mode") || "";
      const vets = await appState.storage.readVets(tenantId);
      const vet = vets.find((item) => item.id === vetId && item.verified);
      if (!vet) return sendJson(res, 404, { error: "Verified veterinarian not found" });
      if (!date || !parseBangladeshDate(date)) return sendJson(res, 400, { error: "A valid date is required in YYYY-MM-DD format" });
      if (mode && !["online", "clinic"].includes(mode)) return sendJson(res, 400, { error: "Consultation mode must be online or clinic" });
      const bookings = await appState.storage.readBookings(tenantId);
      return sendJson(res, 200, { vetId: vet.id, date, mode: mode || "all", timezone: "Asia/Dhaka", slots: availableVetSlots(vet, date, mode, bookings) });
  }

  if (pathname === "/api/bookings" && req.method === "GET") {
      if (!user) {
        sendJson(res, 401, { error: "Sign in is required to view bookings" });
        return;
      }
      const bookings = await appState.storage.readBookings(tenantId);
      sendJson(res, 200, bookings.filter((booking) => booking.ownerId === user.sub || user.role === "ops"));
      return;
  }

  if (pathname === "/api/bookings" && req.method === "POST") {
      if (!user) {
        sendJson(res, 401, { error: "Sign in is required to book a consultation" });
        return;
      }

      const body = await readBodyJson(req);
      const vets = await appState.storage.readVets(tenantId);
      const vet = vets.find((item) => item.id === body.vetId && item.verified);
      if (!vet || !body.date || !body.time || !["online", "clinic"].includes(body.mode) || !parseBangladeshDate(body.date)) {
        sendJson(res, 400, { error: "A verified vet, date, time, and consultation mode are required" });
        return;
      }
      const bookings = await appState.storage.readBookings(tenantId);
      const slots = availableVetSlots(vet, body.date, body.mode, bookings);
      if (!slots.includes(body.time)) {
        sendJson(res, 409, { error: "That slot is unavailable. Please choose another available time." });
        return;
      }
      const pets = await appState.storage.readCollection(tenantId, "pets");
      const pet = pets.find((item) => item.id === body.petId && item.ownerId === user.sub);
      if (!pet) {
        sendJson(res, 400, { error: "Select one of your pet profiles before booking" });
        return;
      }
      const booking = {
        id: `booking-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ownerId: user.sub,
        ownerEmail: user.email,
        petId: pet.id,
        petName: pet.name,
        vetId: vet.id,
        vetName: vet.name,
        date: body.date,
        time: body.time,
        mode: body.mode,
        fee: vet.fee,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      await appState.storage.writeBookings(tenantId, [booking, ...bookings]);
      await appendAudit(tenantId, user.email, "booking.created", { bookingId: booking.id, vetId: vet.id });
      sendJson(res, 201, booking);
      return;
  }

  if (pathname === "/api/pets" && req.method === "GET") {
    if (!user) return sendJson(res, 401, { error: "Sign in is required to view pets" });
    const pets = await appState.storage.readCollection(tenantId, "pets");
    return sendJson(res, 200, pets.filter((pet) => pet.ownerId === user.sub));
  }

  if (pathname === "/api/pets" && req.method === "POST") {
    if (!user) return sendJson(res, 401, { error: "Sign in is required to create a pet profile" });
    const body = await readBodyJson(req);
    if (!body.name || !["dog", "cat", "bird", "rabbit", "other"].includes(body.species)) {
      return sendJson(res, 400, { error: "Pet name and supported species are required" });
    }
    const pets = await appState.storage.readCollection(tenantId, "pets");
    const pet = { id: `pet-${Date.now()}`, ownerId: user.sub, name: String(body.name).trim(), species: body.species, breed: String(body.breed || "").trim(), age: String(body.age || "").trim(), notes: String(body.notes || "").trim(), createdAt: new Date().toISOString() };
    await appState.storage.writeCollection(tenantId, "pets", [pet, ...pets]);
    await appendAudit(tenantId, user.email, "pet.created", { petId: pet.id });
    return sendJson(res, 201, pet);
  }

  if (pathname === "/api/payments" && req.method === "POST") {
    if (!user) return sendJson(res, 401, { error: "Sign in is required to pay for a booking" });
    const body = await readBodyJson(req);
    const bookings = await appState.storage.readBookings(tenantId);
    const booking = bookings.find((item) => item.id === body.bookingId && item.ownerId === user.sub);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    const payments = await appState.storage.readCollection(tenantId, "payments");
    if (payments.some((payment) => payment.bookingId === booking.id && payment.status === "paid")) return sendJson(res, 409, { error: "Booking is already paid" });
    const payment = { id: `payment-${Date.now()}`, bookingId: booking.id, ownerId: user.sub, amount: booking.fee, currency: "BDT", status: "requires_provider", provider: process.env.PAYMENT_PROVIDER || null, createdAt: new Date().toISOString() };
    await appState.storage.writeCollection(tenantId, "payments", [payment, ...payments]);
    await appendAudit(tenantId, user.email, "payment.created", { paymentId: payment.id, bookingId: booking.id });
    return sendJson(res, 201, { ...payment, nextAction: payment.provider ? "redirect_to_provider" : "configure_payment_provider" });
  }

  if (pathname === "/api/consultations" && req.method === "GET") {
    if (!user) return sendJson(res, 401, { error: "Sign in is required to view consultations" });
    const items = await appState.storage.readCollection(tenantId, "consultations");
    return sendJson(res, 200, items.filter((item) => item.ownerId === user.sub || user.role === "ops" || item.vetId === user.sub));
  }

  if (pathname === "/api/consultations" && req.method === "POST") {
    if (!user || !["vet", "ops"].includes(user.role)) return sendJson(res, 403, { error: "Only a verified vet or operator can start a consultation" });
    const body = await readBodyJson(req);
    const bookings = await appState.storage.readBookings(tenantId);
    const booking = bookings.find((item) => item.id === body.bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    if (user.role === "vet" && booking.vetId !== user.sub) return sendJson(res, 403, { error: "You are not assigned to this booking" });
    const consultations = await appState.storage.readCollection(tenantId, "consultations");
    const consultation = { id: `consultation-${Date.now()}`, bookingId: booking.id, ownerId: booking.ownerId, vetId: user.sub, mode: booking.mode, status: "scheduled", roomProvider: process.env.CALL_PROVIDER || null, roomReference: process.env.CALL_PROVIDER ? `${booking.id}` : null, notes: "", createdAt: new Date().toISOString() };
    await appState.storage.writeCollection(tenantId, "consultations", [consultation, ...consultations]);
    return sendJson(res, 201, consultation);
  }

  if (pathname === "/api/prescriptions" && req.method === "GET") {
    if (!user) return sendJson(res, 401, { error: "Sign in is required to view prescriptions" });
    const items = await appState.storage.readCollection(tenantId, "prescriptions");
    return sendJson(res, 200, items.filter((item) => item.ownerId === user.sub || user.role === "ops" || item.vetId === user.sub));
  }

  if (pathname === "/api/prescriptions" && req.method === "POST") {
    if (!user || !["vet", "ops"].includes(user.role)) return sendJson(res, 403, { error: "Only a verified vet or operator can issue a prescription" });
    const body = await readBodyJson(req);
    if (!body.consultationId || !Array.isArray(body.items) || body.items.length === 0) return sendJson(res, 400, { error: "A consultation and at least one medicine are required" });
    const consultations = await appState.storage.readCollection(tenantId, "consultations");
    const consultation = consultations.find((item) => item.id === body.consultationId);
    if (!consultation) return sendJson(res, 404, { error: "Consultation not found" });
    if (user.role === "vet" && consultation.vetId !== user.sub) return sendJson(res, 403, { error: "You are not assigned to this consultation" });
    const prescriptions = await appState.storage.readCollection(tenantId, "prescriptions");
    const prescription = { id: `prescription-${Date.now()}`, consultationId: consultation.id, ownerId: consultation.ownerId, vetId: user.sub, items: body.items.map((item) => ({ medicine: String(item.medicine || "").trim(), dosage: String(item.dosage || "").trim(), duration: String(item.duration || "").trim(), instructions: String(item.instructions || "").trim() })), status: "issued", issuedAt: new Date().toISOString() };
    await appState.storage.writeCollection(tenantId, "prescriptions", [prescription, ...prescriptions]);
    await appendAudit(tenantId, user.email, "prescription.issued", { prescriptionId: prescription.id, consultationId: consultation.id });
    return sendJson(res, 201, prescription);
  }

  if (pathname === "/api/admin/overview" && req.method === "GET") {
    if (!user || !["ceo", "ops"].includes(user.role)) return sendJson(res, 403, { error: "Forbidden" });
    const [users, vets, bookings, payments, consultations, prescriptions, audit] = await Promise.all([
      appState.storage.readUsers(tenantId),
      appState.storage.readVets(tenantId),
      appState.storage.readBookings(tenantId),
      appState.storage.readCollection(tenantId, "payments"),
      appState.storage.readCollection(tenantId, "consultations"),
      appState.storage.readCollection(tenantId, "prescriptions"),
      appState.storage.readAudit(tenantId)
    ]);
    return sendJson(res, 200, {
      counts: { users: users.length, verifiedVets: vets.filter((vet) => vet.verified).length, bookings: bookings.length, pendingPayments: payments.filter((payment) => payment.status !== "paid").length, consultations: consultations.length, prescriptions: prescriptions.length },
      recentAudit: audit.slice(0, 20)
    });
  }

  if (pathname === "/api/vet/dashboard" && req.method === "GET") {
    if (!user || user.role !== "vet") return sendJson(res, 403, { error: "Verified vet access required" });
    const bookings = await appState.storage.readBookings(tenantId);
    const assigned = bookings.filter((booking) => booking.vetId === user.sub);
    return sendJson(res, 200, { bookings: assigned, today: assigned.filter((booking) => booking.date === new Date().toISOString().slice(0, 10)) });
  }

  if (pathname === "/api/auth/me" && req.method === "PATCH") {
    if (!user) return sendJson(res, 401, { error: "Sign in is required to edit your profile" });
    const body = await readBodyJson(req);
    const users = await appState.storage.readUsers(tenantId);
    const index = users.findIndex((item) => item.id === user.sub);
    if (index < 0) return sendJson(res, 404, { error: "Profile not found" });
    users[index] = { ...users[index], name: cleanText(body.name || users[index].name, 80), area: cleanText(body.area, 80), bio: cleanText(body.bio, 300), updatedAt: new Date().toISOString() };
    await appState.storage.writeUsers(tenantId, users);
    await appendAudit(tenantId, user.email, "profile.updated", {});
    sendJson(res, 200, { user: { id: users[index].id, email: users[index].email, role: users[index].role, name: users[index].name, area: users[index].area || null, bio: users[index].bio || "" } });
    return;
  }

  const fosterRequestUpdate = pathname.match(/^\/api\/foster-requests\/([^/]+)$/);
  if (fosterRequestUpdate && req.method === "PATCH") {
    if (!user || !["ops", "ceo"].includes(user.role)) return sendJson(res, 403, { error: "Only an authorized operator can verify foster interactions" });
    const body = await readBodyJson(req);
    if (!["accepted", "completed", "declined"].includes(body.status)) return sendJson(res, 400, { error: "Invalid foster request status" });
    const requests = await appState.storage.readCollection(tenantId, "fosterRequests");
    const index = requests.findIndex((item) => item.id === decodeURIComponent(fosterRequestUpdate[1]));
    if (index < 0) return sendJson(res, 404, { error: "Foster request not found" });
    requests[index] = { ...requests[index], status: body.status, updatedAt: new Date().toISOString(), verifiedBy: user.sub };
    await appState.storage.writeCollection(tenantId, "fosterRequests", requests);
    await appendAudit(tenantId, user.email, "foster.request.updated", { requestId: requests[index].id, status: body.status });
    sendJson(res, 200, requests[index]);
    return;
  }

  if (pathname === "/api/auth/me" && req.method === "GET") {
    if (!user) {
      sendJson(res, 200, { user: null, authRequired: AUTH_REQUIRED });
      return;
    }
    const users = await appState.storage.readUsers(tenantId);
    const profile = users.find((item) => item.id === user.sub);
    sendJson(res, 200, { user: profile ? { id: profile.id, email: profile.email, role: profile.role, name: profile.name, avatarUrl: profile.avatarUrl || null, area: profile.area || null, bio: profile.bio || "" } : user });
    return;
  }

  if (pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ tenantId, ts: new Date().toISOString() })}\n\n`);
    const clients = sseSet(tenantId);
    clients.add(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
      } catch (err) {
        // ignore
      }
    }, 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (pathname === "/api/report") return sendJson(res, 200, report);
  if (pathname === "/api/summary") return sendJson(res, 200, report.summary);
  if (pathname === "/api/bottlenecks") return sendJson(res, 200, report.bottlenecks);
  if (pathname === "/api/cases") return sendJson(res, 200, report.cases);
  if (pathname === "/api/recommendations") return sendJson(res, 200, report.recommendations || []);
  if (pathname === "/api/live") return sendJson(res, 200, buildLiveSnapshot(report));
  if (pathname === "/api/simulate") return sendJson(res, 200, runSimulation(report, urlObj.searchParams));
  if (pathname === "/api/copilot") return sendJson(res, 200, { answer: answerCopilot(report, urlObj.searchParams.get("q") || "") });

  if (pathname === "/api/anomalies") {
    const key = cacheKey("anomalies", tenantId);
    const cached = appState.cache.get(key);
    if (cached) return sendJson(res, 200, cached);
    const anomalies = detectAnomalies(report);
    appState.cache.set(key, anomalies, 7000);
    return sendJson(res, 200, anomalies);
  }

  if (pathname === "/api/impact-ranking") {
    const key = cacheKey("impact", tenantId);
    const cached = appState.cache.get(key);
    if (cached) return sendJson(res, 200, cached);
    const interventions = (await appState.storage.readInterventions(tenantId)).map((i) => withInterventionMetrics(i, report));
    const ranking = buildImpactRanking(report, interventions);
    appState.cache.set(key, ranking, 7000);
    return sendJson(res, 200, ranking);
  }

  if (pathname === "/api/root-cause-clusters") {
    const key = cacheKey("clusters", tenantId);
    const cached = appState.cache.get(key);
    if (cached) return sendJson(res, 200, cached);
    const clusters = clusterRootCauses(report);
    appState.cache.set(key, clusters, 7000);
    return sendJson(res, 200, clusters);
  }

  if (pathname === "/api/explain") {
    const entityId = urlObj.searchParams.get("entityId") || "";
    const explanation = explainEntity(report, entityId);
    if (!explanation) {
      sendJson(res, 404, { error: "Entity not found" });
      return;
    }
    sendJson(res, 200, explanation);
    return;
  }

  if (pathname === "/api/alerts") {
    const key = cacheKey("alerts", tenantId);
    const cached = appState.cache.get(key);
    if (cached) return sendJson(res, 200, cached);
    const alerts = await appState.storage.readAlerts(tenantId);
    appState.cache.set(key, alerts, 8000);
    return sendJson(res, 200, alerts);
  }

  if (pathname === "/api/alerts/refresh" && req.method === "POST") {
    if (!checkRole(user, ["ceo", "ops"])) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    await refreshAlertsForTenant(tenantId, report);
    const alerts = await appState.storage.readAlerts(tenantId);
    sendJson(res, 200, alerts);
    return;
  }

  if (pathname === "/api/geo") {
    const cases = (report.cases || []).slice(0, 160);
    const data = cases.map((c, idx) => ({
      id: c.entityId || c.caseId || `entity-${idx + 1}`,
      leakEur: c.leakEur || 0,
      risk: c.status || "open",
      lat: Number((47.35 + ((idx * 17) % 100) * 0.06).toFixed(3)),
      lon: Number((6.9 + ((idx * 29) % 100) * 0.08).toFixed(3))
    }));
    sendJson(res, 200, data);
    return;
  }

  if (pathname === "/api/forecast") return sendJson(res, 200, buildForecast(report));

  if (pathname === "/api/interventions") {
    if (req.method === "POST") {
      if (!checkRole(user, ["ceo", "ops"])) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }
      const body = await readBodyJson(req);
      const existing = await appState.storage.readInterventions(tenantId);
      const now = new Date().toISOString();
      const item = {
        id: body.id || `exp-${Date.now()}`,
        owner: body.owner || "Unassigned",
        action: body.action || "Intervention",
        expectedUpliftEur: Number(body.expectedUpliftEur || 0),
        actualUpliftEur: Number(body.actualUpliftEur || 0),
        baselineLeakEur: Number(body.baselineLeakEur || (report.summary && report.summary.estimatedLeakEur) || 0),
        actualLeakAfterEur: body.actualLeakAfterEur != null ? Number(body.actualLeakAfterEur) : null,
        measurementStart: body.measurementStart || now.slice(0, 10),
        measurementEnd: body.measurementEnd || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        status: body.status || "planned",
        createdAt: now
      };
      const idx = existing.findIndex((x) => x.id === item.id);
      if (idx >= 0) existing[idx] = { ...existing[idx], ...item, createdAt: existing[idx].createdAt || now };
      else existing.unshift(item);
      await appState.storage.writeInterventions(tenantId, existing.slice(0, 150));
      await appendAudit(tenantId, user ? user.email : "system", "intervention.upsert", { id: item.id, action: item.action });
      pushSse(tenantId, "intervention", { id: item.id, status: item.status });
      sendJson(res, 201, withInterventionMetrics(item, report));
      return;
    }
    const items = await appState.storage.readInterventions(tenantId);
    sendJson(res, 200, items.map((i) => withInterventionMetrics(i, report)));
    return;
  }

  if (pathname === "/api/scenarios") {
    if (req.method === "POST") {
      if (!checkRole(user, ["ceo", "ops"])) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }
      const body = await readBodyJson(req);
      const scenarios = await appState.storage.readScenarios(tenantId);
      const scenario = {
        id: body.id || `scn-${Date.now()}`,
        name: body.name || `Scenario ${scenarios.length + 1}`,
        notes: body.notes || "",
        inputs: {
          promo: Number(body.promo || 0),
          closure: Number(body.closure || 0),
          conversion: Number(body.conversion || 0)
        },
        result: runSimulationFromInputs(report, body),
        createdAt: new Date().toISOString(),
        createdBy: user ? user.email : "system"
      };
      scenarios.unshift(scenario);
      await appState.storage.writeScenarios(tenantId, scenarios.slice(0, 120));
      await appendAudit(tenantId, user ? user.email : "system", "scenario.create", { id: scenario.id, name: scenario.name });
      pushSse(tenantId, "scenario", { id: scenario.id, name: scenario.name });
      sendJson(res, 201, scenario);
      return;
    }
    const scenarios = await appState.storage.readScenarios(tenantId);
    sendJson(res, 200, scenarios);
    return;
  }

  if (pathname === "/api/scenarios/compare") {
    const scenarios = await appState.storage.readScenarios(tenantId);
    const baseId = urlObj.searchParams.get("base");
    const candidateId = urlObj.searchParams.get("candidate");
    const base = scenarios.find((s) => s.id === baseId);
    const candidate = scenarios.find((s) => s.id === candidateId);
    if (!base || !candidate) {
      sendJson(res, 404, { error: "Both scenarios are required" });
      return;
    }
    sendJson(res, 200, scenarioComparison(base, candidate));
    return;
  }

  if (pathname === "/api/decision-studio") {
    const scenarios = await appState.storage.readScenarios(tenantId);
    const interventions = (await appState.storage.readInterventions(tenantId)).map((i) => withInterventionMetrics(i, report));
    const decision = buildDecisionStudio(report, scenarios, interventions, urlObj.searchParams.get("q") || "");
    sendJson(res, 200, decision);
    return;
  }

  if (pathname === "/api/story") {
    const interventions = (await appState.storage.readInterventions(tenantId)).map((i) => withInterventionMetrics(i, report));
    sendJson(res, 200, buildStory(report, interventions));
    return;
  }

  if (pathname === "/api/export/brief") {
    const interventions = (await appState.storage.readInterventions(tenantId)).map((i) => withInterventionMetrics(i, report));
    sendText(res, 200, buildBriefText(report, interventions, tenantId));
    return;
  }

  if (pathname === "/api/export/actions.csv") {
    const interventions = (await appState.storage.readInterventions(tenantId)).map((i) => withInterventionMetrics(i, report));
    sendText(res, 200, buildActionsCsv(report, interventions), "text/csv; charset=utf-8");
    return;
  }

  if (pathname === "/api/export/brief-html") {
    const interventions = (await appState.storage.readInterventions(tenantId)).map((i) => withInterventionMetrics(i, report));
    const brief = buildBriefText(report, interventions, tenantId);
    sendText(res, 200, buildBriefHtml(brief), "text/html; charset=utf-8");
    return;
  }

  if (pathname === "/api/pipeline-status") {
    sendJson(res, 200, getPipelineStatus(tenantId));
    return;
  }

  if (pathname === "/api/data/control") {
    sendJson(res, 200, buildDataControlStatus(tenantId, report));
    return;
  }

  if (pathname === "/api/data/template") {
    sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      dataset: "custom-import",
      summary: {
        totalStores: 0,
        estimatedLeakEur: 0,
        topLeakArea: "n/a"
      },
      summaryCards: [
        { label: "Dataset", value: "custom-import" },
        { label: "Stores", value: "0" },
        { label: "Leak estimate", value: "0 EUR" }
      ],
      bottlenecks: [],
      recommendations: [],
      cases: []
    });
    return;
  }

  if (pathname === "/api/data/import-report" && req.method === "POST") {
    if (!checkRole(user, ["ceo", "ops"])) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const body = await readBodyJson(req);
    const normalized = normalizeImportedReport(body);
    if (!normalized) {
      sendJson(res, 400, { error: "Invalid report format. Required fields: summary (object), cases (array)." });
      return;
    }

    await appState.storage.writeReport(tenantId, normalized);
    await refreshAlertsForTenant(tenantId, normalized);
    await appendAudit(tenantId, user ? user.email : "system", "report.import", {
      dataset: normalized.dataset,
      cases: normalized.cases.length
    });
    invalidateTenantCache(tenantId);

    pushSse(tenantId, "report", {
      dataset: normalized.dataset,
      generatedAt: normalized.generatedAt
    });
    pushSse(tenantId, "snapshot", {
      live: buildLiveSnapshot(normalized),
      pipeline: getPipelineStatus(tenantId),
      anomalyCount: detectAnomalies(normalized).length
    });

    sendJson(res, 201, {
      ok: true,
      dataset: normalized.dataset,
      generatedAt: normalized.generatedAt,
      cases: normalized.cases.length
    });
    return;
  }

  if (pathname === "/api/rebuild" && req.method === "POST") {
    if (!checkRole(user, ["ceo", "ops"])) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    triggerRossmannBuild(tenantId, "manual-api-trigger").catch(() => {});
    sendJson(res, 202, { accepted: true, status: getPipelineStatus(tenantId) });
    return;
  }

  if (pathname === "/api/integrations/task" && req.method === "POST") {
    if (!checkRole(user, ["ceo", "ops"])) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const body = await readBodyJson(req);
    const task = {
      id: `task-${Date.now()}`,
      provider: body.provider || "jira",
      title: body.title || "Leak intervention",
      description: body.description || "",
      owner: body.owner || "Unassigned",
      status: "open",
      createdAt: new Date().toISOString()
    };
    const deliver = await sendTaskToProvider(task.provider, task);
    const existing = await appState.storage.readTasks(tenantId);
    existing.unshift({ ...task, delivery: deliver });
    await appState.storage.writeTasks(tenantId, existing.slice(0, 200));
    await appendAudit(tenantId, user ? user.email : "system", "task.create", { id: task.id, provider: task.provider });
    pushSse(tenantId, "task", { id: task.id, title: task.title, delivered: deliver.delivered });
    sendJson(res, 201, { task, delivery: deliver });
    return;
  }

  if (pathname === "/api/tasks") {
    const tasks = await appState.storage.readTasks(tenantId);
    sendJson(res, 200, tasks);
    return;
  }

  if (pathname === "/api/approvals") {
    if (req.method === "POST") {
      if (!checkRole(user, ["ceo", "ops"])) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }
      const body = await readBodyJson(req);
      const approvals = await appState.storage.readApprovals(tenantId);
      const item = {
        id: body.id || `apr-${Date.now()}`,
        interventionId: body.interventionId || "",
        stage: body.stage || "ops-review",
        status: body.status || "pending",
        requestedBy: user ? user.email : "system",
        assignedToRole: body.assignedToRole || "ceo",
        notes: body.notes || "",
        createdAt: new Date().toISOString(),
        decidedAt: null,
        decidedBy: null
      };
      approvals.unshift(item);
      await appState.storage.writeApprovals(tenantId, approvals.slice(0, 200));
      await appendAudit(tenantId, user ? user.email : "system", "approval.request", { id: item.id, interventionId: item.interventionId });
      pushSse(tenantId, "approval", { id: item.id, status: item.status });
      sendJson(res, 201, item);
      return;
    }
    const approvals = await appState.storage.readApprovals(tenantId);
    sendJson(res, 200, approvals);
    return;
  }

  if (pathname === "/api/approvals/action" && req.method === "POST") {
    if (!checkRole(user, ["ceo", "ops"])) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const body = await readBodyJson(req);
    const approvals = await appState.storage.readApprovals(tenantId);
    const idx = approvals.findIndex((a) => a.id === body.id);
    if (idx < 0) {
      sendJson(res, 404, { error: "Approval not found" });
      return;
    }
    const nextStatus = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "pending";
    approvals[idx] = {
      ...approvals[idx],
      status: nextStatus,
      decidedAt: new Date().toISOString(),
      decidedBy: user ? user.email : "system",
      notes: body.notes || approvals[idx].notes || ""
    };
    await appState.storage.writeApprovals(tenantId, approvals);
    await appendAudit(tenantId, user ? user.email : "system", "approval.action", { id: body.id, action: body.action });
    pushSse(tenantId, "approval", { id: body.id, status: nextStatus });
    sendJson(res, 200, approvals[idx]);
    return;
  }

  if (pathname === "/api/digest/latest") {
    const digest = await appState.storage.readDigest(tenantId);
    sendText(res, 200, digest || "No digest generated yet.");
    return;
  }

  if (pathname === "/api/audit") {
    if (!checkRole(user, ["ceo", "ops"])) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const audit = await appState.storage.readAudit(tenantId);
    sendJson(res, 200, audit);
    return;
  }

  if (pathname === "/api/tenants") {
    const tenantsDir = path.join(DATA_DIR, "tenants");
    const tenants = fs.existsSync(tenantsDir)
      ? fs.readdirSync(tenantsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : ["default"];
    sendJson(res, 200, tenants);
    return;
  }

  sendJson(res, 404, { error: "Unknown API route" });
}

async function requestHandler(req, res) {
  const started = Date.now();
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;
  const tenantId = resolveTenantId(urlObj, req.headers);
  const user = userFromRequest(req, tenantId);

  try {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
    if (isRateLimited(req)) {
      sendJson(res, 429, { error: "Too many requests. Please try again shortly." });
      return;
    }
    if (pathname.startsWith("/api/")) {
      await routeApi(req, res, urlObj, tenantId, user);
      return;
    }

    if (pathname === "/auth/google/start" || pathname === "/auth/google/callback") {
      await routeApi(req, res, urlObj, tenantId, user);
      return;
    }

    if (pathname === "/") {
      sendFile(res, path.join(PUBLIC_DIR, "index.html"));
      return;
    }

    const requested = path.join(PUBLIC_DIR, pathname.replace(/^\//, ""));
    if (!requested.startsWith(PUBLIC_DIR)) {
      sendText(res, 403, "Forbidden");
      return;
    }
    sendFile(res, requested);
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Internal server error" });
  } finally {
    log("info", "http_request", {
      method: req.method,
      path: pathname,
      tenantId,
      role: user ? user.role : "guest",
      durationMs: Date.now() - started
    });
  }
}

async function bootstrap() {
  await seedRuntimeDataIfNeeded();
  await appState.storage.init();
  await ensureDefaultUsers(appState.storage, "default");
  initAutoPipeline();
  startDigestScheduler();
  startRealtimeBroadcast();
}

let bootstrapPromise = null;

async function ensureReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap();
  }
  await bootstrapPromise;
}

if (require.main === module) {
  ensureReady()
    .then(() => {
      const server = http.createServer(requestHandler);
      server.listen(PORT, () => {
        log("info", "server_started", { port: PORT, authRequired: AUTH_REQUIRED });
      });
    })
    .catch((err) => {
      log("error", "bootstrap_failed", { error: err.message });
      process.exit(1);
    });
}

const vercelHandler = async (req, res) => {
  await ensureReady();
  return requestHandler(req, res);
};

module.exports = vercelHandler;
module.exports.ensureReady = ensureReady;
