# ATLAS NEXUS 2.0

Angular + PrimeNG Chart / Chart.js dashboard and Express API for private Google Sheets. Responsive Mac/iPhone interface with day/week/month/year/custom periods, baselines, signal overlays, event timeline, emotional measures and an auditable hypothesis list.

The repository intentionally includes **no sheet IDs, private data, passwords or Google credentials**. The Google Sheets service account must have read access to the NEXUS and ATLAS MIND workbooks.

## Render

Single Docker web service; `PORT` defaults to 8080 and `GET /healthz` is available for monitoring. Configure these Render secrets: `ATLAS_ACCESS_CODE` (at least 16 characters), `ATLAS_SESSION_SECRET` (at least 32 characters), `NEXUS_SHEET_ID`, `MIND_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`. `NODE_ENV=production` is required for secure cookies. Do not paste secrets into chat or commit any .env file.

## Local developer

`npm install`; `npm run build`; `npm start`. For Angular development: `npm run dev` with backend on port 8080.

Current Google Sheets API permissions are read-only. The WEEKLY analysis automation is separate from the web application. Data sync from health4ai to NEXUS is not built into this web service. This is a deployment candidate; live Google integration requires a service account and explicit sharing of the two private Google Sheets.
