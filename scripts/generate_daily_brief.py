"""Daily market brief generator. Unlike the weekly brief, this only runs
when manually triggered (via the dashboard's admin-only button, through the
Cloudflare Worker proxy -> GitHub Actions workflow_dispatch — see worker/
and .github/workflows/daily-brief.yml), never on a schedule. See
scripts/brief_common.py for the shared logic; this script just supplies the
daily-specific framing (1-day mover lookback, a single-date period label,
and the "daily" archive category).
"""
from datetime import datetime, timezone

from brief_common import (
    BRIEF_PATH, archive_previous_brief, build_ytd_chart_data, call_claude,
    fetch_movers, fetch_sp500_tickers, load_all_stats, render_brief,
)


def main():
    stats, dates, series_by_asset = load_all_stats()
    last_date = dates[-1]
    period_label = last_date.strftime("%Y-%m-%d")
    session_date = last_date.date().isoformat()
    prepared_date = datetime.now(timezone.utc).date().isoformat()

    tickers = fetch_sp500_tickers()
    best, worst = fetch_movers(tickers, lookback_days=1)

    llm = call_claude(period_label, "오늘", "당일", stats, best, worst)
    chart_data = build_ytd_chart_data(dates, series_by_asset)

    archive_previous_brief(session_date)

    new_html = render_brief("brief_template_daily.html", "daily", period_label, session_date,
                             prepared_date, stats, best, worst, llm, chart_data)
    BRIEF_PATH.write_text(new_html, encoding="utf-8")

    print(f"Generated daily brief for {period_label}, session_date={session_date}")


if __name__ == "__main__":
    main()
