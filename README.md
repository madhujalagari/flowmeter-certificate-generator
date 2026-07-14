# Flowmeter Calibration Certificate Generator

Upload an Excel sheet (one row per flowmeter) → preview the data →
download an individually generated PDF certificate per row.

## How it works
- `pages/index.js` — upload UI, parses Excel client-side with `xlsx`, shows a
  preview table with one "Download PDF" button per row.
- `pages/api/generate-pdf.js` — serverless function that takes one row of
  JSON data, renders it into HTML, and uses Puppeteer to convert it to a PDF.
- `lib/certificateTemplate.js` — the actual certificate design (HTML/CSS).
  **This is a placeholder layout — replace the logo, colors, and fields to
  match your real certificate.**
- `middleware.js` + `pages/login.js` + `pages/api/login.js` — simple shared
  password gate using a cookie. Password is set via the `SITE_PASSWORD`
  environment variable.

## Expected Excel columns
Each **row** in the Excel is one **test-point reading**. Rows that share
the same `SerialNo` are automatically grouped into **one certificate**,
with each row becoming a line in that certificate's Results table — this
matches how a real calibration certificate has multiple Qm/Qc readings
per flowmeter.

**Header-level fields** (should be the same on every row for a given flowmeter):
```
CertificateNo | OANo | CalibrationDate | DueDate | Product | SerialNo |
CustomerName | FlowmeterType | PowerSupply | LineSize | Accuracy |
CalibrationFactor | OutputSignal | CalibratedRange | Flange |
CalibratedBy | VerifiedBy
```

**Per-test-point fields** (different on each row for the same SerialNo):
```
MasterFlowRate | CalculatedFlowRate
```

**Deviation % is calculated automatically** — `(Qc - Qm) / Qc × 100` —
matching the formula printed on the certificate. No need to include it
in the Excel.

Example: a flowmeter with 3 test points needs 3 rows in the Excel, all
sharing the same `SerialNo`, but with different `MasterFlowRate` /
`CalculatedFlowRate` values on each row.

## Certificate layout
`lib/certificateTemplate.js` replicates the real Mirrant calibration
certificate: logo + company header, certificate details, flowmeter
details, formulae, nomenclature, calibration method/traceability text,
a Results table (one row per test point), signatures, and the
guarantee paragraph. The logo is embedded directly in
`lib/logoBase64.js` as a base64 data URI (extracted from the sample
certificate), so no external image hosting is needed.


## Local setup
```bash
npm install
cp .env.local.example .env.local
# edit .env.local and set your own SITE_PASSWORD
npm run dev
```
Open http://localhost:3000 — it'll redirect to /login first.

Note: locally, the API route uses regular `puppeteer` (downloads its own
Chromium automatically on `npm install`) — no Browserless account needed
for local dev. In production on Vercel, it connects to Browserless's
hosted Chrome instead (see below for why).

## Deploy to Vercel
1. **Sign up for Browserless** (free): go to https://www.browserless.io,
   create an account (no credit card needed for the free tier — 1,000
   sessions/month), and copy your API token from the dashboard.

   *Why Browserless is needed:* running Chromium directly inside Vercel's
   serverless functions hit a persistent `libnss3.so` shared-library error
   in this environment — tried three different packaging approaches, same
   error every time. That points to a Vercel-runtime issue, not something
   fixable from app code. Browserless sidesteps it entirely: Vercel just
   opens a WebSocket connection to an already-running Chrome instance
   elsewhere, instead of trying to launch its own.

2. Push this project to a GitHub repo.
3. Import the repo in Vercel.
4. In Vercel Project Settings → Environment Variables, add:
   - `SITE_PASSWORD` = your chosen password
   - `BROWSERLESS_TOKEN` = the API token from step 1
5. Deploy.

## Customizing the certificate layout
Open `lib/certificateTemplate.js` — it's plain HTML + CSS. Replace:
- The logo `<img>` src with your actual logo (either a hosted URL or a
  base64-embedded image in `/public`)
- Field labels/order to match your real certificate
- Colors, fonts, footer text, accreditation numbers, etc.

Once you send over the real Word certificate (screenshot or file) and your
logo, this template can be updated to match it closely.

## Google Drive setup (optional)
Every generated certificate can also be auto-uploaded into a shared Google
Drive folder, in addition to the person's local download. If you don't set
this up, the app just skips it silently and works exactly as before.

1. **Create a Google Cloud project** (free) at https://console.cloud.google.com
2. **Enable the Google Drive API** for that project (APIs & Services → Enable APIs → search "Google Drive API").
3. **Create a service account**: APIs & Services → Credentials → Create Credentials → Service Account. Give it any name (e.g. `cert-uploader`).
4. **Create a key for it**: open the service account → Keys → Add Key → Create new key → JSON. This downloads a `.json` file — keep it safe, don't commit it to git.
5. From that JSON file, you need two values:
   - `client_email` → this is `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (copy it exactly, including the `\n` characters, wrapped in quotes)
6. **Create (or pick) a folder in Google Drive** where certificates should land. Open it, and share it with the service account's email (the `client_email` value) — give it **Editor** access, same as sharing with any teammate.
7. **Get the folder ID**: open the folder in your browser, the URL looks like `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz` — the part after `/folders/` is `GOOGLE_DRIVE_FOLDER_ID`.
8. Add all three values to `.env.local` (local dev) and to Vercel's Environment Variables (production).

Once set, every "Download PDF" click also silently drops a copy into that
Drive folder, named the same way as the local download
(`CAL-CERT-SN1234.pdf`), so there's a running record without anyone having
to manually upload anything.

## Known limitations to be aware of
- **Requires a Browserless account for production.** The free tier (1,000
  sessions/month, no card needed) is enough for well over 30 certificates/day
  — but if `BROWSERLESS_TOKEN` isn't set in Vercel, PDF generation will fail
  with a clear error message telling you so.
- Each PDF generation makes a network round-trip to Browserless, so
  certificates take a bit longer to generate than they would with a fully
  local Chromium — still well under a few seconds each in practice.
- The password cookie is a simple flag, not a signed/encrypted token. Fine
  for a low-stakes internal tool; can be hardened if needed.
- No data is stored anywhere — nothing persists after you close the tab.
