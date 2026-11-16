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
          for (const [k, v] of Object.entries(h)) {
            resHeaders[k.toLowerCase()] = v;
          }
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

  const fs = require("node:fs");
  const path = require("node:path");
  const { issueToken } = require("../src/auth");
  const tenantDefaultDir = path.join(__dirname, "..", "data", "tenants", "default");

  function snapshotTenantDir(dirPath) {
    const files = new Map();
    if (!fs.existsSync(dirPath)) return files;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isFile()) {
        const fullPath = path.join(dirPath, entry.name);
        files.set(entry.name, fs.readFileSync(fullPath));
      }
    }
    return files;
  }

  function restoreTenantDir(dirPath, snapshot) {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isFile()) {
        const fullPath = path.join(dirPath, entry.name);
        if (!snapshot.has(entry.name)) {
          fs.unlinkSync(fullPath);
        }
      }
    }
    for (const [name, content] of snapshot.entries()) {
      fs.writeFileSync(path.join(dirPath, name), content);
    }
  }

  function nextWeekdayDateString(targetUtcDay) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() !== targetUtcDay) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d.toISOString().slice(0, 10);
  }

  const tenantSnapshot = snapshotTenantDir(tenantDefaultDir);
  let sseReq = null;

  try {
    const tokenSecret = fs.readFileSync(path.join(__dirname, "..", "data", ".token_secret"), "utf8").trim();

    // Open an in-memory SSE client to verify live broadcasts over /api/stream
    const sseEvents = [];
    sseReq = new Readable({ read() {} });
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

    // Verify Digital Asset Links & Android configs
    const assetLinksRes = await callApi("GET", "/.well-known/assetlinks.json");
    assert.equal(assetLinksRes.statusCode, 200);
    assert.ok(String(assetLinksRes.headers["content-type"] || "").includes("application/json"));
    assert.ok(Array.isArray(assetLinksRes.json) && assetLinksRes.json.length >= 1);
    const linkEntry = assetLinksRes.json[0];
    assert.ok(Array.isArray(linkEntry.relation) && linkEntry.relation.includes("delegate_permission/common.handle_all_urls"));
    assert.equal(linkEntry.target.namespace, "android_app");
    assert.equal(linkEntry.target.package_name, "com.pawnir.app");
    assert.ok(Array.isArray(linkEntry.target.sha256_cert_fingerprints) && linkEntry.target.sha256_cert_fingerprints.length >= 1);
    assert.ok(/^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/i.test(linkEntry.target.sha256_cert_fingerprints[0]));
    const staticAssetLinks = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", ".well-known", "assetlinks.json"), "utf8"));
    assert.equal(staticAssetLinks[0].target.package_name, "com.pawnir.app");
    const capCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "capacitor.config.json"), "utf8"));
    assert.equal(capCfg.appId, "com.pawnir.app");
    const twaCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "twa-manifest.json"), "utf8"));
    assert.equal(twaCfg.packageId, "com.pawnir.app");
    process.stdout.write("PASS: GET /.well-known/assetlinks.json returns 200 with valid Android Digital Asset Links JSON for com.pawnir.app\n");

    // Verify Play Store Waitlist registration + count + SSE broadcast
    const waitlistBeforeRes = await callApi("GET", "/api/waitlist/count");
    assert.equal(waitlistBeforeRes.statusCode, 200);
    const waitlistInitialCount = Number(waitlistBeforeRes.json.count);
    const waitlistBadRes = await callApi("POST", "/api/waitlist", { email: "invalid-email", platform: "android" });
    assert.equal(waitlistBadRes.statusCode, 400);
    const sseBeforeWaitlist = sseEvents.length;
    const waitlistCreateRes = await callApi("POST", "/api/waitlist", {
      email: "smoke-beta@pawnir.org",
      platform: "android",
      area: "Dhanmondi"
    });
    assert.equal(waitlistCreateRes.statusCode, 201);
    assert.equal(waitlistCreateRes.json.ok, true);
    assert.equal(waitlistCreateRes.json.count, waitlistInitialCount + 1);
    assert.ok(
      sseEvents.slice(sseBeforeWaitlist).some((e) => e.includes("event: community_stats")),
      "POST /api/waitlist did not broadcast community_stats over SSE"
    );
    const waitlistDupRes = await callApi("POST", "/api/waitlist", { email: "smoke-beta@pawnir.org", platform: "ios" });
    assert.equal(waitlistDupRes.statusCode, 201);
    assert.equal(waitlistDupRes.json.count, waitlistInitialCount + 1);
    process.stdout.write("PASS: POST /api/waitlist registers early-access user, deduplicates emails, and broadcasts community_stats\n");

    // Verify per-user helpful review vote toggle deduplication & live SSE broadcast
    const testUserToken = issueToken({ id: "smoke-voter-1", email: "voter@pawnir.org", role: "owner", name: "Voter" }, tokenSecret, "default");
    const targetFosterId = fosterRes.json[0].id;
    const targetReviewId = detailRes.json.reviews[0].id;
    const beforeCount = Number(detailRes.json.reviews[0].helpfulCount || 0);

    const sseBeforeVote = sseEvents.length;
    const vote1 = await callApi("POST", `/api/fosters/${targetFosterId}/reviews/${targetReviewId}/helpful`, null, {
      authorization: `Bearer ${testUserToken}`
    });
    assert.equal(vote1.statusCode, 200);
    assert.equal(vote1.json.voted, true);
    assert.equal(vote1.json.helpfulCount, beforeCount + 1);
    assert.ok(
      sseEvents.slice(sseBeforeVote).some((e) => e.includes("event: foster_update") && e.includes("review_helpful")),
      "SSE stream did not broadcast foster_update on helpful review vote"
    );

    const vote2 = await callApi("POST", `/api/fosters/${targetFosterId}/reviews/${targetReviewId}/helpful`, null, {
      authorization: `Bearer ${testUserToken}`
    });
    assert.equal(vote2.statusCode, 200);
    assert.equal(vote2.json.voted, false);
    assert.equal(vote2.json.helpfulCount, beforeCount);
    process.stdout.write("PASS: POST /api/fosters/:id/reviews/:reviewId/helpful toggles per-user vote and broadcasts live SSE foster_update\n");

    // Verify Rich Pet Passports: POST /api/pets, PATCH /api/pets/:id, DELETE /api/pets/:id
    const petOwnerToken = issueToken({ id: "smoke-pet-owner-1", email: "petowner@pawnir.org", role: "owner", name: "Pet Owner" }, tokenSecret, "default");
    const otherOwnerToken = issueToken({ id: "smoke-pet-owner-2", email: "otherpet@pawnir.org", role: "owner", name: "Other Owner" }, tokenSecret, "default");
    const sseBeforePet = sseEvents.length;
    const createPetRes = await callApi(
      "POST",
      "/api/pets",
      {
        name: "Puchku",
        species: "cat",
        breed: "Deshi Billi",
        age: "2 years",
        bloodType: "Type A",
        weightKg: 3.8,
        vaccinated: true,
        microchip: "MC-99881"
      },
      { authorization: `Bearer ${petOwnerToken}` }
    );
    assert.equal(createPetRes.statusCode, 201);
    const createdPet = createPetRes.json;
    assert.ok(/^#BD-\d{5}$/.test(createdPet.passportId), `Expected #BD-XXXXX passportId, got ${createdPet.passportId}`);
    assert.equal(createdPet.bloodType, "Type A");
    assert.equal(createdPet.weightKg, 3.8);
    assert.equal(createdPet.vaccinated, true);
    assert.equal(createdPet.microchip, "MC-99881");
    assert.ok(sseEvents.slice(sseBeforePet).some((e) => e.includes("event: care_update") && e.includes("pet_created")));

    const listPetsRes = await callApi("GET", "/api/pets", null, { authorization: `Bearer ${petOwnerToken}` });
    assert.equal(listPetsRes.statusCode, 200);
    assert.ok(listPetsRes.json.some((p) => p.id === createdPet.id && p.passportId === createdPet.passportId));

    const patchPetOtherRes = await callApi("PATCH", `/api/pets/${createdPet.id}`, { weightKg: 5.0 }, { authorization: `Bearer ${otherOwnerToken}` });
    assert.equal(patchPetOtherRes.statusCode, 404);

    const patchPetRes = await callApi(
      "PATCH",
      `/api/pets/${createdPet.id}`,
      { weightKg: 4.1, vaccinated: false, bloodType: "Type B", notes: "Updated passport" },
      { authorization: `Bearer ${petOwnerToken}` }
    );
    assert.equal(patchPetRes.statusCode, 200);
    assert.equal(patchPetRes.json.weightKg, 4.1);
    assert.equal(patchPetRes.json.vaccinated, false);
    assert.equal(patchPetRes.json.bloodType, "Type B");
    assert.equal(patchPetRes.json.notes, "Updated passport");

    const delPetRes = await callApi("DELETE", `/api/pets/${createdPet.id}`, null, { authorization: `Bearer ${petOwnerToken}` });
    assert.equal(delPetRes.statusCode, 200);
    assert.equal(delPetRes.json.ok, true);
    assert.equal(delPetRes.json.deleted, true);
    const listPetsAfterDelRes = await callApi("GET", "/api/pets", null, { authorization: `Bearer ${petOwnerToken}` });
    assert.equal(listPetsAfterDelRes.statusCode, 200);
    assert.equal(listPetsAfterDelRes.json.some((p) => p.id === createdPet.id), false);
    process.stdout.write("PASS: Rich Pet Passports CRUD (POST /api/pets, PATCH /api/pets/:id, DELETE /api/pets/:id)\n");

    // Verify Vet Availability & Bookings: GET /api/vets/:id/availability, POST /api/bookings, PATCH /api/bookings/:id
    const bookingDate = nextWeekdayDateString(1); // Monday (in vet-nusrat-jahan availability days [1..6])
    const availBeforeRes = await callApi("GET", `/api/vets/vet-nusrat-jahan/availability?date=${bookingDate}&mode=online`);
    assert.equal(availBeforeRes.statusCode, 200);
    assert.equal(availBeforeRes.json.timezone, "Asia/Dhaka");
    assert.ok(Array.isArray(availBeforeRes.json.slots) && availBeforeRes.json.slots.length >= 1);
    const bookedSlot = availBeforeRes.json.slots[0];

    const sseBeforeBook = sseEvents.length;
    const createBookingRes = await callApi(
      "POST",
      "/api/bookings",
      {
        vetId: "vet-nusrat-jahan",
        petId: "quick",
        petName: "Bagha",
        petSpecies: "dog",
        date: bookingDate,
        time: bookedSlot,
        mode: "online"
      },
      { authorization: `Bearer ${petOwnerToken}` }
    );
    assert.equal(createBookingRes.statusCode, 201);
    const createdBooking = createBookingRes.json;
    assert.equal(createdBooking.status, "pending");
    assert.equal(createdBooking.petName, "Bagha");
    assert.equal(createdBooking.time, bookedSlot);
    assert.ok(sseEvents.slice(sseBeforeBook).some((e) => e.includes("event: care_update") && e.includes("booking_created")));

    const availDuringRes = await callApi("GET", `/api/vets/vet-nusrat-jahan/availability?date=${bookingDate}&mode=online`);
    assert.equal(availDuringRes.statusCode, 200);
    assert.equal(availDuringRes.json.slots.includes(bookedSlot), false, "Booked slot should no longer be available");

    const dupBookingRes = await callApi(
      "POST",
      "/api/bookings",
      {
        vetId: "vet-nusrat-jahan",
        petId: "quick",
        petName: "Choto",
        petSpecies: "cat",
        date: bookingDate,
        time: bookedSlot,
        mode: "online"
      },
      { authorization: `Bearer ${otherOwnerToken}` }
    );
    assert.equal(dupBookingRes.statusCode, 409);

    const cancelBookingRes = await callApi(
      "PATCH",
      `/api/bookings/${createdBooking.id}`,
      { status: "cancelled" },
      { authorization: `Bearer ${petOwnerToken}` }
    );
    assert.equal(cancelBookingRes.statusCode, 200);
    assert.equal(cancelBookingRes.json.status, "cancelled");

    const availAfterCancelRes = await callApi("GET", `/api/vets/vet-nusrat-jahan/availability?date=${bookingDate}&mode=online`);
    assert.equal(availAfterCancelRes.statusCode, 200);
    assert.equal(availAfterCancelRes.json.slots.includes(bookedSlot), true, "Cancelling booking must free the vet slot");
    process.stdout.write("PASS: Vet Availability & Bookings (GET availability, POST quick booking, PATCH cancel frees slot)\n");

    // Verify Adoption Applications Review: GET /api/adoptions/applications, PATCH /api/adoptions/applications/:id
    const adoptOwnerToken = issueToken({ id: "smoke-adopt-owner-1", email: "adoptowner@pawnir.org", role: "owner", name: "Listing Guardian" }, tokenSecret, "default");
    const applicantToken = issueToken({ id: "smoke-applicant-1", email: "applicant@pawnir.org", role: "owner", name: "Kind Applicant" }, tokenSecret, "default");
    const createListingRes = await callApi(
      "POST",
      "/api/adoptions/listings",
      {
        name: "Chotu",
        species: "cat",
        breed: "Deshi Billi",
        age: "4 months",
        area: "Banani",
        description: "Playful vaccinated Deshi Billi kitten rescued in Banani looking for an indoor home."
      },
      { authorization: `Bearer ${adoptOwnerToken}` }
    );
    assert.equal(createListingRes.statusCode, 201);
    const createdListing = createListingRes.json;

    const applyRes = await callApi(
      "POST",
      "/api/adoptions",
      {
        listingId: createdListing.id,
        housing: "Netted balcony apartment",
        experience: "Raised two Deshi Billi cats",
        household: "Two adults",
        vetPlan: "Pawfect Veterinary Clinic"
      },
      { authorization: `Bearer ${applicantToken}` }
    );
    assert.equal(applyRes.statusCode, 201);
    const applicationId = applyRes.json.applicationId || applyRes.json.id;
    assert.ok(applicationId);

    const applicantAppsRes = await callApi("GET", "/api/adoptions/applications", null, { authorization: `Bearer ${applicantToken}` });
    assert.equal(applicantAppsRes.statusCode, 200);
    assert.ok(applicantAppsRes.json.submitted.some((a) => a.id === applicationId && a.listingName === "Chotu" && a.listingArea === "Banani"));

    const ownerAppsRes = await callApi("GET", "/api/adoptions/applications", null, { authorization: `Bearer ${adoptOwnerToken}` });
    assert.equal(ownerAppsRes.statusCode, 200);
    assert.ok(ownerAppsRes.json.incoming.some((a) => a.id === applicationId && a.listingName === "Chotu"));

    const unauthorizedReviewRes = await callApi(
      "PATCH",
      `/api/adoptions/applications/${applicationId}`,
      { status: "approved" },
      { authorization: `Bearer ${applicantToken}` }
    );
    assert.equal(unauthorizedReviewRes.statusCode, 403);

    const sseBeforeAdoptApprove = sseEvents.length;
    const approveRes = await callApi(
      "PATCH",
      `/api/adoptions/applications/${applicationId}`,
      { status: "approved", reviewNote: "Verified safe indoor balcony" },
      { authorization: `Bearer ${adoptOwnerToken}` }
    );
    assert.equal(approveRes.statusCode, 200);
    assert.equal(approveRes.json.status, "approved");
    assert.equal(approveRes.json.listingStatus, "adopted");
    assert.ok(sseEvents.slice(sseBeforeAdoptApprove).some((e) => e.includes("event: adoption_update")));

    const openAdoptionsAfterRes = await callApi("GET", "/api/adoptions?species=cat");
    assert.equal(openAdoptionsAfterRes.statusCode, 200);
    assert.equal(openAdoptionsAfterRes.json.some((item) => item.id === createdListing.id), false);
    process.stdout.write("PASS: Adoption Applications Review (GET /api/adoptions/applications, PATCH /api/adoptions/applications/:id)\n");

    // Verify Google Play UGC Moderation: POST /api/moderation/block, DELETE /api/moderation/block/:id, POST /api/moderation/report
    const badAuthorToken = issueToken({ id: "smoke-bad-author-1", email: "badauthor@pawnir.org", role: "owner", name: "Author" }, tokenSecret, "default");
    const moderatorViewerToken = issueToken({ id: "smoke-viewer-1", email: "viewer@pawnir.org", role: "owner", name: "Viewer" }, tokenSecret, "default");
    const createLostRes = await callApi(
      "POST",
      "/api/lost-found",
      {
        type: "lost",
        species: "cat",
        title: "Moderation policy test kitten",
        area: "Mirpur 10",
        city: "Dhaka",
        description: "Smoke test post used to verify block filtering and commercial_sale auto-hide moderation."
      },
      { authorization: `Bearer ${badAuthorToken}` }
    );
    assert.equal(createLostRes.statusCode, 201);
    const targetLostReport = createLostRes.json.report;

    const blockRes = await callApi(
      "POST",
      "/api/moderation/block",
      { blockedUserId: "smoke-bad-author-1", reason: "Abusive listing" },
      { authorization: `Bearer ${moderatorViewerToken}` }
    );
    assert.equal(blockRes.statusCode, 201);
    assert.ok(blockRes.json.blockedUserIds.includes("smoke-bad-author-1"));

    const getBlocksRes = await callApi("GET", "/api/moderation/blocks", null, { authorization: `Bearer ${moderatorViewerToken}` });
    assert.equal(getBlocksRes.statusCode, 200);
    assert.ok(getBlocksRes.json.blockedUserIds.includes("smoke-bad-author-1"));

    const lostWhileBlockedRes = await callApi("GET", "/api/lost-found", null, { authorization: `Bearer ${moderatorViewerToken}` });
    assert.equal(lostWhileBlockedRes.statusCode, 200);
    assert.equal(lostWhileBlockedRes.json.reports.some((r) => r.id === targetLostReport.id), false, "Blocked author's post must be hidden");

    const unblockRes = await callApi("DELETE", "/api/moderation/block/smoke-bad-author-1", null, { authorization: `Bearer ${moderatorViewerToken}` });
    assert.equal(unblockRes.statusCode, 200);
    assert.equal(unblockRes.json.ok, true);
    assert.equal(unblockRes.json.unblocked, true);
    assert.equal(unblockRes.json.blockedUserIds.includes("smoke-bad-author-1"), false);

    const lostAfterUnblockRes = await callApi("GET", "/api/lost-found", null, { authorization: `Bearer ${moderatorViewerToken}` });
    assert.equal(lostAfterUnblockRes.statusCode, 200);
    assert.equal(lostAfterUnblockRes.json.reports.some((r) => r.id === targetLostReport.id), true, "Unblocked author's post should reappear");

    const sseBeforeMod = sseEvents.length;
    const modReportRes = await callApi(
      "POST",
      "/api/moderation/report",
      {
        targetType: "lost_report",
        targetId: targetLostReport.id,
        targetOwnerId: "smoke-bad-author-1",
        reason: "commercial_sale",
        details: "Attempting commercial animal sale"
      },
      { authorization: `Bearer ${moderatorViewerToken}` }
    );
    assert.equal(modReportRes.statusCode, 201);
    assert.equal(modReportRes.json.ok, true);
    assert.equal(modReportRes.json.autoHidden, true);
    assert.ok(
      sseEvents.slice(sseBeforeMod).some((e) => e.includes("event: lost_found_update") && e.includes("moderated")),
      "POST /api/moderation/report did not broadcast lost_found_update SSE"
    );
    assert.ok(
      sseEvents.slice(sseBeforeMod).some((e) => e.includes("event: community_stats")),
      "Auto-hidden moderation report did not broadcast community_stats SSE"
    );
    const lostAfterModRes = await callApi("GET", "/api/lost-found");
    assert.equal(lostAfterModRes.statusCode, 200);
    assert.equal(lostAfterModRes.json.reports.some((r) => r.id === targetLostReport.id), false, "commercial_sale flagged post must be auto-hidden");
    process.stdout.write("PASS: Google Play UGC Moderation (commercial_sale auto-hide + SSE, block, unblock)\n");

    // Verify Google Play Account Deletion: DELETE /api/auth/account
    const delEmail = "delete-cascade-smoke@pawnir.org";
    const delPass = "SmokePass123!";
    const regRes = await callApi("POST", "/api/auth/register", {
      email: delEmail,
      password: delPass,
      name: "Delete Cascade User"
    });
    assert.equal(regRes.statusCode, 201);
    const delToken = regRes.json.token;
    const delUserId = regRes.json.user.id;

    const cascadePetRes = await callApi(
      "POST",
      "/api/pets",
      { name: "CascadePet", species: "dog", breed: "Deshi Kutta", bloodType: "DEA 1.1+" },
      { authorization: `Bearer ${delToken}` }
    );
    assert.equal(cascadePetRes.statusCode, 201);
    const cascadeLostRes = await callApi(
      "POST",
      "/api/lost-found",
      {
        type: "lost",
        species: "dog",
        title: "Cascade Lost Dog",
        area: "Uttara",
        city: "Dhaka",
        description: "Temporary lost report created to test full cascade account deletion."
      },
      { authorization: `Bearer ${delToken}` }
    );
    assert.equal(cascadeLostRes.statusCode, 201);
    const cascadeDonorRes = await callApi(
      "POST",
      "/api/donors",
      {
        petName: "CascadeDonor",
        species: "dog",
        bloodType: "DEA 1.1-",
        weightKg: 18,
        area: "Uttara",
        city: "Dhaka",
        consent: true,
        eligibilityAcknowledged: true
      },
      { authorization: `Bearer ${delToken}` }
    );
    assert.equal(cascadeDonorRes.statusCode, 201);
    const cascadeWaitlistRes = await callApi(
      "POST",
      "/api/waitlist",
      { email: delEmail, platform: "android" },
      { authorization: `Bearer ${delToken}` }
    );
    assert.equal(cascadeWaitlistRes.statusCode, 201);

    const sseBeforeAccDel = sseEvents.length;
    const deleteAccountRes = await callApi("DELETE", "/api/auth/account", null, {
      authorization: `Bearer ${delToken}`
    });
    assert.equal(deleteAccountRes.statusCode, 200);
    assert.equal(deleteAccountRes.json.ok, true);
    assert.equal(deleteAccountRes.json.deleted, true);

    const postDeleteEvents = sseEvents.slice(sseBeforeAccDel);
    for (const evName of ["lost_found_update", "donor_update", "adoption_update", "foster_update", "care_update"]) {
      assert.ok(postDeleteEvents.some((e) => e.includes(`event: ${evName}`)), `Account deletion did not broadcast ${evName}`);
    }

    const reloginRes = await callApi("POST", "/api/auth/login", { email: delEmail, password: delPass });
    assert.equal(reloginRes.statusCode, 401);

    const diskUsers = JSON.parse(fs.readFileSync(path.join(tenantDefaultDir, "users.json"), "utf8"));
    const diskPets = JSON.parse(fs.readFileSync(path.join(tenantDefaultDir, "pets.json"), "utf8"));
    const diskLost = JSON.parse(fs.readFileSync(path.join(tenantDefaultDir, "lost_reports.json"), "utf8"));
    const diskDonors = JSON.parse(fs.readFileSync(path.join(tenantDefaultDir, "donors.json"), "utf8"));
    const diskWaitlist = JSON.parse(fs.readFileSync(path.join(tenantDefaultDir, "waitlist.json"), "utf8"));
    const diskAudit = JSON.parse(fs.readFileSync(path.join(tenantDefaultDir, "audit.json"), "utf8"));
    assert.equal(diskUsers.some((u) => u.id === delUserId || u.email === delEmail), false);
    assert.equal(diskPets.some((p) => p.ownerId === delUserId), false);
    assert.equal(diskLost.some((r) => r.ownerId === delUserId), false);
    assert.equal(diskDonors.some((d) => d.ownerId === delUserId), false);
    assert.equal(diskWaitlist.some((w) => w.userId === delUserId || w.email === delEmail), false);
    assert.ok(diskAudit.some((a) => a.action === "account.deleted" && a.actor === "anonymized"));
    process.stdout.write("PASS: DELETE /api/auth/account cascades deletion across user records and records anonymized audit\n");

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
      path.join(tenantDefaultDir, "lost_reports.json"),
      path.join(tenantDefaultDir, "reviews.json"),
      path.join(tenantDefaultDir, "adoption_listings.json")
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
      "btn-pwa-install",
      "app-notify-form",
      "app-notify-email",
      "app-notify-platform",
      "app-notify-submit",
      "app-notify-status",
      "pet-form",
      "pet-blood-type",
      "pet-weight",
      "pet-vaccinated",
      "dashboard-pets",
      "dashboard-bookings",
      "dashboard-foster-requests",
      "dashboard-adoption-applications",
      "dashboard-blocked-list",
      "delete-account-card",
      "delete-account-btn",
      "vet-booking-dialog",
      "vet-booking-form",
      "vet-booking-title",
      "vet-booking-clinic-meta",
      "booking-pet-select",
      "booking-quick-pet-wrap",
      "booking-pet-name",
      "booking-pet-species",
      "booking-mode",
      "booking-date",
      "booking-slots-grid",
      "booking-time",
      "booking-submit-btn",
      "vet-booking-status",
      "moderation-dialog",
      "moderation-form",
      "moderation-dialog-title",
      "moderation-reason",
      "moderation-details",
      "moderation-block-wrap",
      "moderation-block-user",
      "moderation-submit-btn",
      "moderation-status"
    ];
    for (const id of criticalIds) {
      assert.ok(htmlContent.includes(`id="${id}"`), `Missing id="${id}" in public/index.html`);
      assert.ok(appJsContent.includes(id), `Missing reference to "${id}" in public/app.js`);
    }
    for (const panelId of ["dash-panel-activity", "dash-panel-settings", "blocked-users-card", "policy-panel-privacy"]) {
      assert.ok(htmlContent.includes(`id="${panelId}"`), `Missing panel/card id="${panelId}" in public/index.html`);
    }
    for (const dynamicSel of [
      "dash-panel-",
      "policy-panel-",
      "data-open-delete-account",
      "data-mockup-action",
      "data-book-vet",
      "data-cancel-booking",
      "data-adopt-app-action",
      "data-foster-req-action",
      "data-passport-to-donor",
      "data-passport-to-lost",
      "data-delete-pet",
      "data-report-ugc",
      "data-unblock-user",
      "data-notif-id"
    ]) {
      assert.ok(appJsContent.includes(dynamicSel), `Missing selector/attribute "${dynamicSel}" in public/app.js`);
    }
    assert.ok(htmlContent.includes("data-open-delete-account"), "Missing data-open-delete-account in public/index.html");
    assert.ok(htmlContent.includes("data-mockup-action"), "Missing data-mockup-action in public/index.html");
    process.stdout.write(`PASS: All ${criticalIds.length} critical interactive DOM IDs and dynamic selectors align between public/index.html and public/app.js\n`);

    const i18nMatches = [...htmlContent.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(i18nMatches.length >= 40, "Expected at least 40 data-i18n attributes in public/index.html");
    const copyMatch = appJsContent.match(/const copy = (\{[\s\S]*?\n\});/);
    assert.ok(copyMatch, "Could not locate copy dictionary in public/app.js");
    const copyDict = new Function(`return ${copyMatch[1]}`)();
    assert.ok(copyDict && copyDict.en && copyDict.bn, "copy.en and copy.bn must exist in public/app.js");
    for (const key of new Set(i18nMatches)) {
      assert.equal(typeof copyDict.en[key], "string", `i18n key "${key}" is missing from copy.en in public/app.js`);
      assert.equal(typeof copyDict.bn[key], "string", `i18n key "${key}" is missing from copy.bn in public/app.js`);
      assert.ok(copyDict.en[key].length > 0 && copyDict.bn[key].length > 0, `Empty translation for "${key}"`);
    }
    const enOnly = Object.keys(copyDict.en).filter((k) => !(k in copyDict.bn));
    const bnOnly = Object.keys(copyDict.bn).filter((k) => !(k in copyDict.en));
    assert.deepEqual(enOnly, [], `Keys only in copy.en: ${enOnly.join(", ")}`);
    assert.deepEqual(bnOnly, [], `Keys only in copy.bn: ${bnOnly.join(", ")}`);
    process.stdout.write(`PASS: 100% of ${new Set(i18nMatches).size} data-i18n/data-i18n-html keys and ${Object.keys(copyDict.en).length} dictionary entries match across copy.en and copy.bn\n`);
  } catch (err) {
    process.stderr.write(`FAIL: API smoke test\n${err.stack}\n`);
    process.exitCode = 1;
  } finally {
    if (sseReq) sseReq.emit("close");
    restoreTenantDir(tenantDefaultDir, tenantSnapshot);
  }

  process.exit(process.exitCode || 0);
}

runAsyncTests();
