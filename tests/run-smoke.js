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
  } catch (err) {
    process.stderr.write(`FAIL: API smoke test\n${err.stack}\n`);
    process.exitCode = 1;
  }

  process.exit(process.exitCode || 0);
}

runAsyncTests();
