# Global Markets Dashboard

Static market dashboard and daily brief generator. No app backend — plain HTML/CSS/JS, safe to host on GitHub Pages. The only server-side piece is a scheduled GitHub Actions job that keeps the price data current.

- `dashboard.html` — Equity & commodity heat map with a Day/Week toggle. Click any tile for its 1-year price chart. Reads all prices from `data/market_history.xlsx`.
- `brief.html` — Latest daily market brief: executive summary, market drivers, S&P 500 best/worst performers, sources, and Save as HTML / Save as PDF buttons.
- `archive.html` — Links to every previously published brief (stored under `archive/`).
- `data/market_history.xlsx` — Single source of truth for all 14 tracked assets' daily closes. One row per date, one column per asset.
- `scripts/update_market_data.py` — Fetches the latest close for all 14 assets and appends a row to the Excel file if today's date isn't already present.
- `.github/workflows/update-market-data.yml` — Runs the script once a day (22:00 UTC / 07:00 KST) and auto-commits the updated Excel file.
- `js/market.js` — Ticker metadata, stats/chart logic, and the in-browser Excel parser (via SheetJS).
- `index.html` — Unrelated: a stock-personality quiz from an earlier task, left in place at the site root.

## How the data flow works

1. Once a day, GitHub Actions runs `scripts/update_market_data.py`, which hits Yahoo Finance directly (13 tickers) and investing.com (Nickel) exactly once, then commits the new row to `data/market_history.xlsx`.
2. Every visitor's browser just reads that same committed file — no per-visitor API calls, no CORS proxy, no rate limits.
3. The dashboard's "Refresh Data" button re-fetches `market_history.xlsx` (cache-busted) to pick up whatever the Action last committed — it does not call Yahoo/investing.com itself.

### One-time setup for the Action to work

In the GitHub repo: **Settings → Actions → General → Workflow permissions** → select "Read and write permissions" → Save. Without this, the Action can fetch data but can't push the commit back.

You can trigger the first run immediately instead of waiting for the schedule: **Actions tab → Update Market Data → Run workflow**.

## Publishing a new brief

1. Regenerate `brief.html` with the new session's data.
2. Copy the previous `brief.html` into `archive/market_brief_<session-date>.html`.
3. Add an entry for it at the top of `archive.html`.
