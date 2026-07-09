# Global Markets Dashboard (글로벌 마켓 대시보드)

Static market dashboard and weekly brief generator, in Korean. No app backend — plain HTML/CSS/JS, safe to host on GitHub Pages. Two scheduled GitHub Actions jobs keep it current: one fetches prices daily, the other writes a new brief every Monday using Claude.

- `index.html` — Equity & commodity heat map with a Day/Week toggle (site homepage). Click any tile for its price chart with a Week/1M/3M/1Y/3Y range selector. Reads all prices from `data/market_history.xlsx`.
- `brief.html` — Latest weekly market brief: executive summary, market drivers, S&P 500 best/worst weekly performers, sources, and Save as HTML / Save as PDF buttons.
- `archive.html` — Links to every previously published brief (stored under `archive/`).
- `data/market_history.xlsx` — Single source of truth for all 14 tracked assets' daily closes (S&P 500 back to 1998, most commodities to 2010). One row per date, one column per asset.
- `scripts/update_market_data.py` — Runs daily: fetches the latest close for all 14 assets and appends a row if today's date isn't already present. Equity indices come from Yahoo Finance; all 8 commodities come from investing.com (matching the historical CSVs the dataset was seeded from — Yahoo's futures occasionally use a different contract-roll convention, which would otherwise create a visible seam).
- `scripts/generate_weekly_brief.py` + `scripts/brief_template.html` — Runs weekly: computes the past week's stats and S&P 500 movers from the Excel file, asks Claude (with web search) to research the week's real news and write the narrative in Korean, renders it into `brief.html`, and archives the previous one.
- `.github/workflows/update-market-data.yml` — Daily cron (22:00 UTC / 07:00 KST).
- `.github/workflows/weekly-brief.yml` — Weekly cron, Monday 07:00 KST (22:00 UTC Sunday).
- `js/market.js` — Ticker metadata, stats/chart logic, and the in-browser Excel parser (via SheetJS).
- `js/asset-order.js` — Shared client-side module for the custom asset-ordering feature (see below).

## How the data flow works

1. Daily, GitHub Actions runs `update_market_data.py`, which fetches each asset's close exactly once and commits the new row to `data/market_history.xlsx`.
2. Every visitor's browser just reads that same committed file — no per-visitor API calls, no CORS proxy, no rate limits. The dashboard's "Refresh Data" button re-fetches the Excel file (cache-busted) rather than calling Yahoo/investing.com itself.
3. Weekly (Monday mornings), `generate_weekly_brief.py` reads the same Excel file, asks Claude to research and write that week's brief, and archives the outgoing one automatically.

## One-time setup

**For the daily price updater:** Settings → Actions → General → Workflow permissions → select "Read and write permissions" → Save. Without this, the Action can fetch data but can't push the commit back.

**For the weekly brief:** the same workflow-permissions step above, plus an API key:
1. Create a key at [console.anthropic.com](https://console.anthropic.com) (requires a funded Anthropic Console account — this calls the API per-brief, at real cost).
2. In the repo: Settings → Secrets and variables → Actions → New repository secret → name it `ANTHROPIC_API_KEY`, paste the key.
3. Before relying on this in production, confirm `web_search_20250305` is still the current web-search tool identifier in [Anthropic's tool-use docs](https://docs.anthropic.com) — this was written against the API as documented at the time and the identifier may have since changed.

You can trigger either workflow immediately instead of waiting for its schedule: **Actions tab → (workflow name) → Run workflow**.

## Notes on the weekly brief

- The narrative (executive summary, drivers, stock commentary, sources) is genuinely researched and written by Claude each run — it is not templated filler. The price tables and best/worst-performer rankings are computed directly from data, not from the model.
- The very first run archives the hand-written `brief.html` currently in the repo; after that, every run's brief embeds a `<!-- BRIEF_META -->` comment so the next run can correctly label it in the archive.

## Custom asset order (10 save slots)

On the dashboard, the "정렬 슬롯" bar lets a visitor pick one of 10 independent slots and click "✎ 순서 편집" to drag tiles into whatever order they prefer (equities and commodities reorder independently within their own section). The chosen order is saved to that browser's `localStorage` — it's per-visitor, not global, and there's no account system. "이 슬롯 초기화" clears the active slot back to the default order.

`brief.html` reads the same `localStorage` slot (via `js/asset-order.js`) and reorders its own index/commodity tables to match on load — so a visitor's preferred order applies consistently across both pages. This is purely a client-side display preference: `data/market_history.xlsx` and the underlying numbers are never reordered, and the weekly-generated brief always renders in the canonical order before each visitor's browser reorders it locally. Already-archived briefs are frozen historical snapshots and do not pick up this feature retroactively.
