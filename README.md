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
- `js/asset-order.js` — Per-user asset-ordering/hide-show module (see below).
- `js/auth.js` — Client-side login gate and the 10-user credential table (see below).

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

## Login (read this before relying on it)

**This is not real security.** There is no server, so every page ships a login gate that checks the entered ID/password against a table sitting in plain text in `js/auth.js` — anyone can view-source the page and read every password, including Admin's, and every page is still directly reachable by URL no matter what the login state is. What this *does* do: it organizes who's using the dashboard and gives each of up to 10 people their own 3 customization slots. Treat it as a courtesy gate for a small trusted group, not access control.

**The 10 accounts** (username / password / role):

| Username | Password | Role |
|---|---|---|
| Admin | `Ku5vZpt5` | admin |
| FocusAI-1 | `feyCMXgX` | user |
| FocusAI-2 | `cr9aFok2` | user |
| FocusAI-3 | `3tdxt9b2` | user |
| FocusAI-4 | `k6rMpfGV` | user |
| FocusAI-5 | `sS4qCpTV` | user |
| FocusAI-6 | `WtNQcgcM` | user |
| FocusAI-7 | `AVizdhuP` | user |
| FocusAI-8 | `bLYEmbYa` | user |
| FocusAI-9 | `PSApEknt` | user |

To change a password or add/remove a user, edit the `USERS` table at the top of `js/auth.js` directly (max 10 slots by design, matching the 10 named accounts above).

Login state is stored in `localStorage` per browser (not per visit), so a visitor stays logged in until they click "로그아웃". Any logged-in user — admin or regular — can open `archive.html` and read past briefs; what's actually admin-only is *archiving itself*, and that's not a button anyone clicks anyway — it's the fully automated weekly GitHub Action. There's no UI action a regular user could use to trigger or edit archiving in the first place.

## Custom asset order & visibility (3 save slots per user)

On the dashboard, the "정렬 슬롯" bar lets the logged-in user pick one of **3 independent slots** (reduced from an earlier global-10-slot design once accounts existed to scope them to) and click "✎ 순서 편집" to drag tiles into whatever order they prefer (equities and commodities reorder independently within their own section). "＋／－ 자산 추가·삭제" opens a checklist to show/hide any of the 14 tracked assets per slot — unchecking one removes it from that slot's dashboard tiles and brief tables; it isn't deleted from the underlying data, just hidden from view. "이 슬롯 초기화" clears the active slot back to the default order with everything visible.

Each user's 3 slots are stored independently in that browser's `localStorage`, keyed by username — logging in as a different user shows that user's own slots, never another user's. `brief.html` reads the logged-in user's active slot (via `js/asset-order.js`) and reorders/filters its own index/commodity tables to match on load, so a user's preferences apply consistently across both pages. This is purely a client-side display preference: `data/market_history.xlsx` and the underlying numbers are never reordered or deleted, and the weekly-generated brief always renders with all 14 assets in the canonical order before each user's browser customizes it locally. Already-archived briefs are frozen historical snapshots and do not pick up this feature retroactively.
