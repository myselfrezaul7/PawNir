# PawNir animal safety and care network

PawNir is a Bangladesh-focused animal safety and care network. The public homepage explains the broader mission: nearby lost-pet alerts, safer adoption, blood donor discovery, local animal communities, emergency veterinary support, foster/shelter discovery, and pet supplies. The working release provides persisted veterinarian directory data, owner registration/login, pet profiles, authenticated booking with duplicate-slot protection, and working community workflows with privacy, consent, and verification controls.

## PawNir portal API

- `GET /api/vets?q=&specialty=&city=&mode=` — verified vet directory search
- `GET /api/vets/:vetId/availability?date=YYYY-MM-DD&mode=online|clinic` — real schedule slots with booked times removed
- `POST /api/auth/register` — create a pet-owner account (`email`, `password`, `name`)
- `POST /api/auth/login` — authenticate an existing account
- `GET /api/auth/me` — inspect the current bearer session
- `GET /auth/google/start` — start Google OpenID Connect sign-in when configured
- `GET /auth/google/callback` — validate the Google callback and establish a PawNir session
- `GET /api/bookings` — list authenticated owner bookings
- `POST /api/bookings` — create a booking (`vetId`, `date`, `time`, `mode`)
- `GET/POST /api/pets` — list or create authenticated pet profiles
- `GET /api/lost-found?area=&type=lost|found|all` — public open nearby reports using approximate area matching
- `POST /api/lost-found` — create an authenticated lost/found report with an optional JPG, PNG, or WebP photo up to 5 MB; matching opted-in area subscribers receive in-app notifications
- `PATCH /api/lost-found/:reportId` — resolve or close a report owned by the authenticated reporter
- Authenticated reporters can review their own reports in the homepage and mark an animal as reunited, removing it from the open nearby feed.
- `POST /api/lost-found/subscribe` — subscribe an authenticated user to nearby alerts for an approximate area
- `GET /api/notifications` — list authenticated in-app nearby-alert notifications
- `POST /api/notifications/read` — mark the authenticated user's nearby alerts read
- `GET /api/donors?area=&species=&bloodType=` — list consented, verified, available animal donors without exact contact details
- `POST /api/donors` — register an owner-managed donor for operator verification
- `POST /api/donors/:donorId/requests` — send a consent-based donor connection request
- `GET /api/adoptions` — list verified open adoption listings
- `POST /api/adoptions` — submit an authenticated responsible-adoption application
- `GET /api/adoptions/:applicationId/pdf` — download the authenticated applicant's PawNir-branded adoption application PDF
- `GET /api/auth/me` — read the authenticated PawNir profile
- `PATCH /api/auth/me` — update the authenticated profile name, area, and bio
- `GET /api/fosters?city=&species=` — list verified foster/shelter records with map links and genuine review aggregates
- `GET /api/fosters/:fosterId` — view a verified foster record and published reviews
- `POST /api/fosters/:fosterId/requests` — submit an authenticated foster-care request
- `GET /api/foster-requests` — view the authenticated user's foster requests
- `POST /api/fosters/:fosterId/reviews` — publish a review only after an operator verifies a completed foster interaction
- `PATCH /api/foster-requests/:requestId` — operator-only request verification transition (`accepted`, `completed`, or `declined`)
- `POST /api/payments` — create a payment record for a booking; returns an explicit provider-required state until a gateway is configured
- `GET/POST /api/consultations` — list owner consultations or create a vet/operator consultation record
- `GET/POST /api/prescriptions` — list owner prescriptions or issue one from an authorized consultation

The initial directory is seeded from `data/portal_vets.json` into the tenant data store. Each seeded vet includes weekly availability in Bangladesh time (`Asia/Dhaka`); the availability endpoint removes pending/confirmed bookings before returning slots. Set `DATA_DIR` to use a persistent data location in production. All booking writes are audit logged and reject unavailable or duplicate vet/date/time slots.

### Google sign-in setup

Create a Google Cloud OAuth client of type **Web application**, configure the OAuth consent screen, and add these values to the environment:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain.example/auth/google/callback
```

Add the exact redirect URI to the Google client. For local development use `http://localhost:3000/auth/google/callback`; production must use HTTPS. The integration only accepts verified Google email identities, uses a short-lived server-side OAuth state, and returns PawNir's existing tenant-bound session token. Never expose `GOOGLE_CLIENT_SECRET` in frontend code or commit it.

## PawNir family links

The public footer includes a responsive PawNir family panel with safe new-tab links to:

- [Kuttawaala](https://www.kuttawaala.com) — dog lovers of Bangladesh
- [Catwaala](https://www.catwaala.com) — cat lovers of Bangladesh
- [PetBhai](https://www.petbhai.com) — pet shop

PawNir directs pet-accessory shopping and animal transport requests to the PetBhai partner service. PawNir does not claim to process PetBhai inventory, checkout, delivery, or transport bookings inside the PawNir app.

## Required production integrations

The API deliberately does not claim successful payment or calling without provider configuration. Configure `PAYMENT_PROVIDER` and `CALL_PROVIDER`, then implement the corresponding signed webhook/token adapters before production launch. Until then, payment records remain `requires_provider` and consultations have no external room reference. This keeps failures visible instead of producing false confirmations.

PawNir connects Bangladesh's pet families with trusted veterinary care, online booking, consultations, prescriptions, and long-term pet records.

## Supported datasets

1. Synthetic process event logs (`data/events.json`)
2. Rossmann real sales data (`train.csv`) via prebuilt analytics report (`data/rossmann_report.json`)

If `data/rossmann_report.json` exists, the app will automatically use it.

## Run with Rossmann `train.csv`

```bash
node src/buildRossmannReport.js "C:\Users\mysel\OneDrive\Desktop\Azure\rossmann-store-sales\train.csv" "C:\Users\mysel\OneDrive\Desktop\Azure\rossmann-store-sales\store.csv"
node server.js
```

Open: <http://localhost:3000>

## Run with synthetic process data

```bash
node src/generateSampleData.js
node server.js
```

## API endpoints

- `GET /api/health`
- `POST /api/auth/login` (`email`, `password`)
- `GET /api/auth/me`
- `GET /api/report`
- `GET /api/summary`
- `GET /api/bottlenecks`
- `GET /api/cases`
- `GET /api/recommendations`
- `GET /api/live`
- `GET /api/simulate?promo=10&closure=5&conversion=12`
- `GET /api/copilot?q=why%20is%20leakage%20high`
- `GET /api/geo`
- `GET /api/forecast`
- `GET /api/story`
- `GET /api/interventions`
- `POST /api/interventions`
- `GET /api/export/brief`
- `GET /api/export/actions.csv`
- `GET /api/export/brief-html`
- `GET /api/pipeline-status`
- `POST /api/rebuild`
- `GET /api/data/control`
- `GET /api/data/template`
- `POST /api/data/import-report`
- `GET /api/anomalies`
- `GET /api/impact-ranking`
- `GET /api/root-cause-clusters`
- `GET /api/scenarios`
- `POST /api/scenarios`
- `GET /api/scenarios/compare?base=<id>&candidate=<id>`
- `GET /api/decision-studio?q=...`
- `GET /api/stream` (SSE realtime feed)
- `GET /api/approvals`
- `POST /api/approvals`
- `POST /api/approvals/action`
- `GET /api/audit`
- `POST /api/alerts/refresh`
- `GET /api/alerts`
- `GET /api/explain?entityId=Store%201`
- `POST /api/integrations/task`
- `GET /api/tasks`
- `GET /api/digest/latest`
- `GET /api/tenants`

Most endpoints support multi-tenant routing via query (`?tenant=default`) or header (`x-tenant-id`).

## Advanced modules in UI

- Live command center with alert feed and leak ticker
- AI copilot for executive Q&A
- What-if simulator with recovery estimate
- Geo-intelligence heat layer
- Risk radar timeline (30-day forward view)
- Intervention tracking loop (baseline/window/actual uplift)
- Auto story generator for board-ready narrative
- Role switch modes (`CEO`, `Ops Lead`, `Store Manager`)
- Export layer (`txt` brief, `csv` action plan, PDF-ready brief page)
- Auto-ingestion pipeline watcher (rebuilds report when source CSV files change)

## Platform upgrades (implemented)

1. Foundation:
- Tenant-aware storage under `data/tenants/<tenant>/...`
- Optional PostgreSQL adapter (fallback to file storage if unavailable)
- TTL caching and structured request logs
- CI workflow + smoke tests

2. Security:
- Token-based auth (`/api/auth/login`)
- API-level RBAC support for sensitive routes (`AUTH_REQUIRED=true`)

3. Intelligence:
- Statistical anomaly detection (`/api/anomalies`)
- Explainability endpoint (`/api/explain`)
- Alert generation (`/api/alerts`)
- Impact scoring + root-cause clustering
- AI Decision Studio orchestration

4. ROI science:
- Counterfactual and confidence scoring for interventions

5. Execution + reporting:
- Integration task handoff endpoint (`/api/integrations/task`)
- Scheduled digest automation (`/api/digest/latest`)
- Existing export layer retained
- Scenario versioning + comparison
- Approval workflow + compliance audit timeline

6. Scale primitives:
- Multi-tenant API context
- Cache invalidation on writes/rebuild
- Health and observability improvements
- Realtime SSE updates and mobile command view

## Dynamic data workflow

### A) Browser-first (easiest for beginners)

1. Open **Data Control Center** in the dashboard.
2. Click **Download template** to see required report JSON structure.
3. Generate or edit your report JSON.
4. Click **Import report JSON** and select the file.
5. Dashboard updates live (SSE + API refresh).

### B) CSV-to-report workflow (recommended for Rossmann raw data)

1. Build a new report from CSV locally:
```bash
node src/buildRossmannReport.js "C:\path\to\train.csv" "C:\path\to\store.csv"
```
2. This writes `data/rossmann_report.json`.
3. Import that JSON in the UI (Data Control Center) for instant update, or commit/push to deploy permanently.

### C) Local auto-pipeline mode

1. Place/replace `train.csv` and `store.csv` where pipeline can read them.
2. Watcher auto-detects changes and triggers rebuild.
3. You can also trigger manual rebuild via `POST /api/rebuild`.

## Vercel persistence note

- Vercel serverless runtime uses ephemeral filesystem (`/tmp`) at runtime.
- Runtime imports are great for live sessions, but for long-term persistence you should:
  1. commit generated JSON to GitHub, or
  2. connect durable storage (Postgres / managed DB).

## Auth and RBAC quick start

- New deployments do not seed privileged demo users by default. Use a controlled provisioning flow or set `SEED_DEMO_USERS=true` only for isolated development.
- Set a unique high-entropy `AUTH_TOKEN_SECRET` in every deployed environment. When omitted, the server generates a per-process random secret, invalidating sessions after restart.
- Pass bearer token in header: `Authorization: Bearer <token>`.
- Tokens are tenant-bound; changing the tenant query/header does not switch an authenticated session into another tenant.

## Rossmann leak logic (store-level)

- Conversion leak: low sales per customer vs baseline
- Promo leak: underperforming promo uplift
- Closure leak: avoidable non-holiday closures
- Volatility leak: unstable daily sales profile

## Next evolution (thesis/startup path)

1. Add joins with `store.csv` for assortment, competition, and promo intervals.
2. Add per-store action plans with expected savings simulation.
3. Add automatic anomaly alerts for sudden leak spikes.
4. Add user roles: executive summary, operations detail, store manager view.
