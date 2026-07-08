# Global Markets Dashboard

Static, client-side market dashboard and daily brief generator. No backend or build step — plain HTML/CSS/JS, safe to host on GitHub Pages.

- `dashboard.html` — Equity & commodity heat map with a Day/Week toggle. Click any tile for its 1-year price chart. The "Refresh Data" button pulls live prices from Yahoo Finance (and investing.com for Nickel, which Yahoo doesn't list) directly in the browser.
- `brief.html` — Latest daily market brief: executive summary, market drivers, S&P 500 best/worst performers, sources, and Save as HTML / Save as PDF buttons.
- `archive.html` — Links to every previously published brief (stored under `archive/`).
- `js/market.js` / `js/raw_data.js` — Shared ticker metadata, stats/chart logic, and the baked-in price snapshot used before the first live refresh.
- `index.html` — Unrelated: a stock-personality quiz from an earlier task, left in place at the site root.

## Live data note

There's no server here, so "Refresh Data" fetches Yahoo Finance / investing.com through a free public CORS proxy (`api.allorigins.win`) straight from your browser. That proxy is not fully reliable — tickers that fail to refresh keep their last cached value and are called out in a warning banner rather than failing silently.

## Publishing a new brief

1. Regenerate `brief.html` with the new session's data.
2. Copy the previous `brief.html` into `archive/market_brief_<session-date>.html`.
3. Add an entry for it at the top of `archive.html`.
