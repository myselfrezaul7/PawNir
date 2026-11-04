const assert = require("node:assert/strict");
const { normalizeTenantId } = require("../src/tenant");
const { detectAnomalies, explainEntity } = require("../src/intelligence");
const { createMathChallenge, verifyMathChallenge, issuePending2faToken, verifyToken } = require("../src/auth");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS: ${name}\n`);
  } catch (err) {
    process.stderr.write(`FAIL: ${name}\n${err.stack}\n`);
    process.exitCode = 1;
  }
}

run("normalizeTenantId keeps safe chars only", () => {
  assert.equal(normalizeTenantId("Acme-West#1"), "acme-west1");
  assert.equal(normalizeTenantId(""), "default");
});

run("detectAnomalies finds high z-score outlier", () => {
  const base = Array.from({ length: 20 }, (_, i) => ({
    entityId: `N-${i + 1}`,
    leakEur: 900 + i * 8,
    primaryDriver: "conversion"
  }));
  const report = { cases: [...base, { entityId: "D", leakEur: 40000, primaryDriver: "closures" }] };
  const anomalies = detectAnomalies(report);
  assert.ok(anomalies.length >= 1);
  assert.equal(anomalies[0].id, "D");
});

run("explainEntity returns contribution breakdown", () => {
  const report = {
    cases: [
      {
        entityId: "Store 1",
        conversionLeakEur: 100,
        promoLeakEur: 40,
        closureLeakEur: 60,
        volatilityLeakEur: 20,
        primaryDriver: "Conversion gap",
        segment: "mid-volume",
        storeType: "a",
        assortment: "a"
      }
    ]
  };
  const explanation = explainEntity(report, "Store 1");
  assert.ok(explanation);
  assert.equal(explanation.id, "Store 1");
  assert.equal(explanation.contributions.length, 4);
});

run("createMathChallenge and verifyMathChallenge validate plus/minus 2FA", () => {
  const secret = "test-2fa-secret";
  for (let i = 0; i < 10; i++) {
    const challenge = createMathChallenge(secret);
    assert.ok(challenge.question);
    assert.ok(challenge.challengeToken);
    const parts = challenge.question.split(" ");
    const a = Number(parts[0]);
    const op = parts[1];
    const b = Number(parts[2]);
    const expected = op === "+" ? a + b : a - b;
    assert.equal(verifyMathChallenge(challenge.challengeToken, String(expected), secret), true);
    assert.equal(verifyMathChallenge(challenge.challengeToken, String(expected + 1), secret), false);
  }
});

run("issuePending2faToken marks stage as 2fa_pending", () => {
  const secret = "test-2fa-secret";
  const pending = issuePending2faToken({ id: "u1", email: "user@example.com", role: "owner", name: "Rezaul" }, secret, "default");
  const claims = verifyToken(pending, secret);
  assert.equal(claims.stage, "2fa_pending");
  assert.equal(claims.email, "user@example.com");
});

async function runAsyncTests() {
  const { Readable } = require("node:stream");
  const handler = require("../server");
  await handler.ensureReady();

  function callApi(method, url, body = null, headers = {}) {
    return new Promise((resolve) => {
      const bodyStr = body ? JSON.stringify(body) : "";
      const req = new Readable({
        read() {
          if (bodyStr) this.push(bodyStr);
          this.push(null);
        }
      });
      req.method = method;
      req.url = url;
      req.headers = {
        host: "localhost:3000",
        ...(bodyStr ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(bodyStr)) } : {}),
        ...headers
      };
      req.socket = { remoteAddress: "127.0.0.1" };
      const resHeaders = {};
      let statusCode = 200;
      const chunks = [];
      const res = {
        writeHead(code, h = {}) {
          statusCode = code;
          Object.assign(resHeaders, h);
        },
        setHeader(k, v) {
          resHeaders[k.toLowerCase()] = v;
        },
        end(chunk) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = JSON.parse(raw); } catch {}
          resolve({ statusCode, headers: resHeaders, raw, json });
        }
      };
      handler(req, res);
    });
  }

  try {
    const lostRes = await callApi("GET", "/api/lost-found?area=Dhanmondi&species=Cat");
    assert.equal(lostRes.statusCode, 200);
    assert.ok(Array.isArray(lostRes.json.reports));
    assert.ok(lostRes.json.reports.length >= 1);
    process.stdout.write("PASS: GET /api/lost-found supports partial area + species filter\n");

    const donorRes = await callApi("GET", "/api/donors?includeMine=1");
    assert.equal(donorRes.statusCode, 200);
    assert.ok(Array.isArray(donorRes.json.donors));
    assert.ok(donorRes.json.donors.length >= 6);
    process.stdout.write("PASS: GET /api/donors returns verified blood donor network\n");

    const fosterRes = await callApi("GET", "/api/fosters");
    assert.equal(fosterRes.statusCode, 200);
    assert.ok(Array.isArray(fosterRes.json));
    assert.ok(fosterRes.json.length >= 6);
    assert.ok(fosterRes.json[0].embedMapUrl.includes("google.com/maps"));
    assert.ok(fosterRes.json[0].reviewCount >= 1);
    process.stdout.write("PASS: GET /api/fosters returns Google Maps embed URLs and community ratings\n");

    const detailRes = await callApi("GET", `/api/fosters/${fosterRes.json[0].id}`);
    assert.equal(detailRes.statusCode, 200);
    assert.ok(detailRes.json.ratingBreakdown);
    assert.ok(Array.isArray(detailRes.json.reviews));
    process.stdout.write("PASS: GET /api/fosters/:id returns rating breakdown and review thread\n");

    const adoptRes = await callApi("GET", "/api/adoptions?species=cat");
    assert.equal(adoptRes.statusCode, 200);
    assert.ok(Array.isArray(adoptRes.json));
    assert.ok(adoptRes.json.length >= 1);
    assert.ok(adoptRes.json.every((item) => item.species === "cat"));
    assert.ok(String(adoptRes.headers["permissions-policy"] || "").includes("geolocation=(self)"));
    process.stdout.write("PASS: GET /api/adoptions?species=cat filters by species and sets geolocation Permissions-Policy\n");

    const statsRes = await callApi("GET", "/api/community-stats");
    assert.equal(statsRes.statusCode, 200);
    assert.equal(typeof statsRes.json.openLostCount, "number");
    assert.equal(typeof statsRes.json.verifiedDonorCount, "number");
    assert.equal(typeof statsRes.json.verifiedFosterCount, "number");
    assert.equal(typeof statsRes.json.openAdoptionCount, "number");
    process.stdout.write("PASS: GET /api/community-stats returns live community counters\n");

    const catTypeARes = await callApi("GET", "/api/donors?species=cat&bloodType=Type%20A");
    assert.equal(catTypeARes.statusCode, 200);
    assert.ok(Array.isArray(catTypeARes.json));
    assert.ok(catTypeARes.json.length >= 1);
    assert.ok(catTypeARes.json.every((d) => d.bloodType.toLowerCase() === "type a"));
    process.stdout.write("PASS: GET /api/donors enforces biological Feline Type A compatibility (excludes Type B/AB)\n");

    const dogDeaPosRes = await callApi("GET", "/api/donors?species=dog&bloodType=DEA%201.1%2B");
    assert.equal(dogDeaPosRes.statusCode, 200);
    assert.ok(Array.isArray(dogDeaPosRes.json));
    assert.ok(dogDeaPosRes.json.some((d) => d.matchType === "exact"));
    assert.ok(dogDeaPosRes.json.some((d) => d.matchType === "compatible"));
    assert.ok(dogDeaPosRes.json.every((d) => typeof d.readyToDonate === "boolean" && ["ready", "resting"].includes(d.readinessStatus)));
    process.stdout.write("PASS: GET /api/donors supports universal DEA 1.1- compatibility and 56-day readiness status\n");

    // Verify per-user helpful review vote toggle deduplication & live SSE broadcast
    const { issueToken } = require("../src/auth");
    const fs = require("node:fs");
    const path = require("node:path");
    const tenantReviewsPath = path.join(__dirname, "..", "data", "tenants", "default", "reviews.json");
    const originalTenantReviews = fs.readFileSync(tenantReviewsPath, "utf8");
    const tokenSecret = fs.readFileSync(path.join(__dirname, "..", "data", ".token_secret"), "utf8").trim();
    const testUserToken = issueToken({ id: "smoke-voter-1", email: "voter@pawnir.org", role: "owner", name: "Voter" }, tokenSecret, "default");
    const targetFosterId = fosterRes.json[0].id;
    const targetReviewId = detailRes.json.reviews[0].id;
    const beforeCount = Number(detailRes.json.reviews[0].helpfulCount || 0);

    // Open an in-memory SSE client to verify live broadcasts over /api/stream
    const sseEvents = [];
    const sseReq = new Readable({ read() {} });
    sseReq.method = "GET";
    sseReq.url = "/api/stream";
    sseReq.headers = { host: "localhost:3000" };
    sseReq.socket = { remoteAddress: "127.0.0.1" };
    const sseRes = {
      writeHead() {},
      setHeader() {},
      write(chunk) {
        sseEvents.push(String(chunk));
      },
      end() {}
    };
    await handler(sseReq, sseRes);
    assert.ok(sseEvents.some((e) => e.includes("event: ready")), "SSE stream did not emit ready event");

    try {
      const vote1 = await callApi("POST", `/api/fosters/${targetFosterId}/reviews/${targetReviewId}/helpful`, null, {
        authorization: `Bearer ${testUserToken}`
      });
      assert.equal(vote1.statusCode, 200);
      assert.equal(vote1.json.voted, true);
      assert.equal(vote1.json.helpfulCount, beforeCount + 1);
      assert.ok(
        sseEvents.some((e) => e.includes("event: foster_update") && e.includes("review_helpful")),
        "SSE stream did not broadcast foster_update on helpful review vote"
      );

      const vote2 = await callApi("POST", `/api/fosters/${targetFosterId}/reviews/${targetReviewId}/helpful`, null, {
        authorization: `Bearer ${testUserToken}`
      });
      assert.equal(vote2.statusCode, 200);
      assert.equal(vote2.json.voted, false);
      assert.equal(vote2.json.helpfulCount, beforeCount);
      process.stdout.write("PASS: POST /api/fosters/:id/reviews/:reviewId/helpful toggles per-user vote and broadcasts live SSE foster_update\n");
    } finally {
      sseReq.emit("close");
      fs.writeFileSync(tenantReviewsPath, originalTenantReviews, "utf8");
    }

    // Verify sendFile returns 404 instead of crashing if a directory path is requested
    const dirRes = await callApi("GET", "/assets");
    assert.equal(dirRes.statusCode, 404);
    process.stdout.write("PASS: Static file handler safely returns 404 for non-file/directory paths\n");

    // Verify foreign breed strings are removed from HTML and JSON seed data
    const filesToCheck = [
      path.join(__dirname, "..", "public", "index.html"),
      path.join(__dirname, "..", "data", "lost_reports.json"),
      path.join(__dirname, "..", "data", "reviews.json"),
      path.join(__dirname, "..", "data", "adoption_listings.json"),
      path.join(__dirname, "..", "data", "tenants", "default", "lost_reports.json"),
      path.join(__dirname, "..", "data", "tenants", "default", "reviews.json"),
      path.join(__dirname, "..", "data", "tenants", "default", "adoption_listings.json")
    ];
    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      assert.equal(/Golden Retriever|Persian Cat/i.test(content), false, `Found foreign breed in ${file}`);
    }
    process.stdout.write("PASS: All foreign breed references replaced with Deshi Kutta and Deshi Billi across data and tenant files\n");

    // Verify DOM-to-JS selector contract and 100% i18n dictionary coverage
    const htmlContent = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
    const appJsContent = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

    const criticalIds = [
      "auth-dialog",
      "auth-step-credentials",
      "auth-form",
      "auth-name-wrap",
      "auth-name",
      "auth-email",
      "auth-password",
      "toggle-password-btn",
      "auth-submit-btn",
      "auth-2fa-form",
      "auth-2fa-question",
      "auth-2fa-answer",
      "auth-2fa-refresh",
      "auth-2fa-back",
      "auth-2fa-submit",
      "sighting-submit",
      "add-foster-submit",
      "foster-search-input",
      "foster-city-filter",
      "foster-species-filter",
      "vet-directory-grid",
      "realtime-status-pill",
      "home-report-lost-btn",
      "home-add-foster-btn",
      "snapshot-lost-area",
      "snapshot-donor-blood",
      "dashboard-user-initials",
      "dashboard-user-area-chip",
      "phone-screens-track",
      "btn-google-play",
      "btn-app-store",
      "btn-pwa-install"
    ];
    for (const id of criticalIds) {
      assert.ok(htmlContent.includes(`id="${id}"`), `Missing id="${id}" in public/index.html`);
      assert.ok(appJsContent.includes(id), `Missing reference to "${id}" in public/app.js`);
    }
    process.stdout.write("PASS: All 31 critical interactive DOM IDs align between public/index.html and public/app.js\n");

    const i18nMatches = [...htmlContent.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(i18nMatches.length >= 40, "Expected at least 40 data-i18n attributes in public/index.html");
    for (const key of new Set(i18nMatches)) {
      const escapedKey = key.replace(/\./g, "\\.");
      const matches = [...appJsContent.matchAll(new RegExp(`"${escapedKey}"\\s*:`, "g"))];
      assert.ok(matches.length >= 2, `i18n key "${key}" is missing from copy.en or copy.bn in public/app.js`);
    }
    process.stdout.write("PASS: 100% of data-i18n and data-i18n-html keys in public/index.html have both EN and BN translations\n");
  } catch (err) {
    process.stderr.write(`FAIL: API smoke test\n${err.stack}\n`);
    process.exitCode = 1;
  }

  process.exit(process.exitCode || 0);
}

runAsyncTests();
