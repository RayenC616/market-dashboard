# Global Markets Dashboard (글로벌 마켓 대시보드)

Static market dashboard and brief generator, in Korean. No app backend — plain HTML/CSS/JS, safe to host on GitHub Pages. There are two ways a brief gets written: automatically every Monday (weekly), or on demand when the admin clicks a button (daily).

- `index.html` — Equity & commodity heat map with a Day/Week toggle (site homepage). Click any tile for its price chart with a Week/1M/3M/1Y/3Y range selector. Reads all prices from `data/market_history.xlsx`.
- `brief.html` — The latest brief, whichever was generated most recently (daily or weekly): executive summary, market drivers, S&P 500 best/worst performers, sources, and Save as HTML / Save as PDF buttons.
- `archive.html` — Two sections, **일간 브리프** (daily, admin-only) and **주간 브리프** (weekly, everyone) — see "Daily vs. weekly briefs" below.
- `data/market_history.xlsx` — Single source of truth for all 14 tracked assets' daily closes (S&P 500 back to 1998, most commodities to 2010). One row per date, one column per asset.
- `scripts/update_market_data.py` — Runs daily: fetches the latest close for all 14 assets and appends a row if today's date isn't already present. Equity indices come from Yahoo Finance; all 8 commodities come from investing.com (matching the historical CSVs the dataset was seeded from — Yahoo's futures occasionally use a different contract-roll convention, which would otherwise create a visible seam).
- `scripts/brief_common.py` — Shared logic used by both brief generators: stats/movers computation, the Claude call (with web search), HTML rendering, and archiving.
- `scripts/generate_weekly_brief.py` + `scripts/brief_template.html` — Weekly brief: 5-day mover lookback, a date-range period label, archived under `category="weekly"`.
- `scripts/generate_daily_brief.py` + `scripts/brief_template_daily.html` — Daily brief: 1-day mover lookback, a single-date period label, archived under `category="daily"`.
- `.github/workflows/update-market-data.yml` — Daily cron (22:00 UTC / 07:00 KST).
- `.github/workflows/weekly-brief.yml` — Weekly cron, Monday 07:00 KST (22:00 UTC Sunday).
- `.github/workflows/daily-brief.yml` — **No schedule** — `workflow_dispatch` only. The admin's dashboard button opens this workflow's GitHub Actions page so they can click "Run workflow" there directly (no separate infrastructure to deploy).
- `js/market.js` — Ticker metadata, stats/chart logic, and the in-browser Excel parser (via SheetJS).
- `js/asset-order.js` — Per-user asset-ordering/hide-show module (see below).
- `js/auth.js` — Client-side login gate and the 10-user credential table (see below).

## How the data flow works

1. Daily, GitHub Actions runs `update_market_data.py`, which fetches each asset's close exactly once and commits the new row to `data/market_history.xlsx`.
2. Every visitor's browser just reads that same committed file — no per-visitor API calls, no CORS proxy, no rate limits. The dashboard's "Refresh Data" button re-fetches the Excel file (cache-busted) rather than calling Yahoo/investing.com itself.
3. Weekly (Monday mornings), `generate_weekly_brief.py` reads the same Excel file, asks Claude to research and write that week's brief, and archives the outgoing one automatically.
4. On demand, the admin clicks "📝 오늘의 브리프 생성" on the dashboard, which opens `daily-brief.yml`'s GitHub Actions page in a new tab; clicking "Run workflow" there runs `generate_daily_brief.py` the same way. This requires being logged into GitHub with write access to the repo — the button is a shortcut to the right page, not a fully automated one-click trigger (that would need a server component to hold a GitHub token, which this static site intentionally has none of).

## One-time setup

**For the daily price updater:** Settings → Actions → General → Workflow permissions → select "Read and write permissions" → Save. Without this, the Action can fetch data but can't push the commit back.

**For either brief generator (daily or weekly):** the same workflow-permissions step above, plus an API key:
1. Create a key at [console.anthropic.com](https://console.anthropic.com) (requires a funded Anthropic Console account — this calls the API per-brief, at real cost).
2. In the repo: Settings → Secrets and variables → Actions → New repository secret → name it `ANTHROPIC_API_KEY`, paste the key.
3. Before relying on this in production, confirm `web_search_20250305` is still the current web-search tool identifier in [Anthropic's tool-use docs](https://docs.anthropic.com) — this was written against the API as documented at the time and the identifier may have since changed.

You can trigger any of the three workflows manually instead of waiting for a schedule (or a button click): **Actions tab → (workflow name) → Run workflow**.

## Daily vs. weekly briefs

- **Weekly** is fully automatic (Monday cron) and visible to everyone — this is the main, ongoing cadence.
- **Daily** only happens when the admin clicks the dashboard button, for an ad hoc same-day brief. Only the admin can see daily briefs, both the button that creates them and the archive section that lists them (`archive.html`'s "일간 브리프" section is hidden from non-admin users — same client-side-only caveat as the rest of the login system below). Regular users only ever see the "주간 브리프" section.
- Whichever brief (daily or weekly) was generated most recently is what shows at `brief.html` — generating a new one of either kind archives whatever was there before, tagged with its own category via a `<!-- BRIEF_META ... category="daily|weekly" -->` comment in the page.

## Notes on brief generation

- The narrative (executive summary, drivers, stock commentary, sources) is genuinely researched and written by Claude each run — it is not templated filler. The price tables and best/worst-performer rankings are computed directly from data, not from the model.
- The very first run (of either script) archives the hand-written `brief.html` currently in the repo (tagged `category="daily"`, since that's what it originally was) — after that, every generated brief embeds its own `BRIEF_META` so the next run can correctly label it in the archive.

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

Login state is stored in `localStorage` per browser (not per visit), so a visitor stays logged in until they click "로그아웃". Any logged-in user — admin or regular — can open `archive.html` and read past *weekly* briefs; daily briefs (both creating and viewing them) are admin-only, as described above.

## Custom asset order & visibility (3 save slots per user)

On the dashboard, the "정렬 슬롯" bar lets the logged-in user pick one of **3 independent slots** and click "✎ 순서 편집" to drag tiles into whatever order they prefer (equities and commodities reorder independently within their own section). "＋／－ 자산 추가·삭제" opens a checklist to show/hide any of the 14 tracked assets per slot — unchecking one removes it from that slot's dashboard tiles and brief tables; it isn't deleted from the underlying data, just hidden from view. "이 슬롯 초기화" clears the active slot back to the default order with everything visible.

Each user's 3 slots are stored independently in that browser's `localStorage`, keyed by username — logging in as a different user shows that user's own slots, never another user's. `brief.html` reads the logged-in user's active slot (via `js/asset-order.js`) and reorders/filters its own index/commodity tables to match on load, so a user's preferences apply consistently across both pages. This is purely a client-side display preference: `data/market_history.xlsx` and the underlying numbers are never reordered or deleted, and every generated brief always renders with all 14 assets in the canonical order before each user's browser customizes it locally. Already-archived briefs are frozen historical snapshots and do not pick up this feature retroactively.
