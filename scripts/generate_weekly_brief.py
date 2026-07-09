"""Weekly market brief generator, run by .github/workflows/weekly-brief.yml
every Monday at 07:00 KST. See scripts/brief_common.py for the shared logic;
this script just supplies the weekly-specific framing (5-day mover lookback,
a date-range period label, and the "weekly" archive category).
"""
from datetime import datetime, timedelta, timezone

from brief_common import (
    BRIEF_PATH, archive_previous_brief, build_ytd_chart_data, call_claude,
    fetch_movers, fetch_sp500_tickers, load_all_stats, render_brief,
)


def main():
    stats, dates, series_by_asset = load_all_stats()
    last_date = dates[-1]
    week_start = last_date - timedelta(days=4)
    period_label = f"{week_start.strftime('%Y-%m-%d')} ~ {last_date.strftime('%Y-%m-%d')}"
    session_date = last_date.date().isoformat()
    prepared_date = datetime.now(timezone.utc).date().isoformat()

    tickers = fetch_sp500_tickers()
    best, worst = fetch_movers(tickers, lookback_days=5)

    llm = call_claude(period_label, "이번 주", "주간", stats, best, worst)
    chart_data = build_ytd_chart_data(dates, series_by_asset)

    archive_previous_brief(session_date)

    new_html = render_brief("brief_template.html", "weekly", period_label, session_date,
                             prepared_date, stats, best, worst, llm, chart_data)
    BRIEF_PATH.write_text(new_html, encoding="utf-8")

    print(f"Generated weekly brief for {period_label}, session_date={session_date}")


if __name__ == "__main__":
    main()
