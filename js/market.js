/* Ticker metadata + stats + Excel-backed data loading shared by dashboard.html. */

const ASSETS = {
  SPX:    { name: "S&P 500",        group: "equity",    currency: "USD", decimals: 2, unit: "" },
  NDX:    { name: "Nasdaq Composite", group: "equity",  currency: "USD", decimals: 2, unit: "" },
  STOXX:  { name: "STOXX Europe 600", group: "equity",  currency: "EUR", decimals: 2, unit: "" },
  NKY:    { name: "Nikkei 225",      group: "equity",    currency: "JPY", decimals: 2, unit: "" },
  HSI:    { name: "Hang Seng",       group: "equity",    currency: "HKD", decimals: 2, unit: "" },
  KOSPI:  { name: "KOSPI",          group: "equity",    currency: "KRW", decimals: 2, unit: "" },
  WTI:    { name: "WTI Crude Oil",   group: "commodity", currency: "USD", decimals: 2, unit: "$/bbl" },
  GOLD:   { name: "Gold",           group: "commodity", currency: "USD", decimals: 2, unit: "$/oz" },
  SILVER: { name: "Silver",         group: "commodity", currency: "USD", decimals: 3, unit: "$/oz" },
  COPPER: { name: "Copper",         group: "commodity", currency: "USD", decimals: 4, unit: "$/lb" },
  NICKEL: { name: "Nickel",         group: "commodity", currency: "USD", decimals: 2, unit: "$/t", source: "investing.com" },
  CORN:   { name: "Corn",           group: "commodity", currency: "USD", decimals: 2, unit: "¢/bu" },
  WHEAT:  { name: "Wheat",          group: "commodity", currency: "USD", decimals: 2, unit: "¢/bu" },
  SOY:    { name: "Soybean",        group: "commodity", currency: "USD", decimals: 2, unit: "¢/bu" },
};

const DATA_FILE = "data/market_history.xlsx";
const RAW = {};

async function loadMarketHistory(bustCache) {
  const url = bustCache ? `${DATA_FILE}?t=${Date.now()}` : DATA_FILE;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${DATA_FILE} (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets["Prices"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  const header = rows[0];
  const dateIdx = header.indexOf("Date");
  const colIdx = {};
  Object.keys(ASSETS).forEach(key => { colIdx[key] = header.indexOf(key); });

  const series = {};
  Object.keys(ASSETS).forEach(key => { series[key] = { t: [], c: [] }; });

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[dateIdx]) continue;
    const d = row[dateIdx] instanceof Date ? row[dateIdx] : new Date(row[dateIdx]);
    const dayMs = 86400000;
    const roundedDay = Math.round(d.getTime() / dayMs) * dayMs;
    const ts = roundedDay / 1000;
    Object.keys(ASSETS).forEach(key => {
      const v = row[colIdx[key]];
      series[key].t.push(ts);
      series[key].c.push(typeof v === "number" ? v : null);
    });
  }

  Object.keys(ASSETS).forEach(key => {
    RAW[key] = { name: ASSETS[key].name, currency: ASSETS[key].currency, ...series[key] };
  });

  const lastTs = series.SPX.t.length ? series.SPX.t[series.SPX.t.length - 1] : null;
  return lastTs !== null ? new Date(lastTs * 1000) : null;
}

function lastNonNullIndex(arr, fromIdx) {
  for (let i = fromIdx; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return i;
  }
  return -1;
}

/* Finds the index of the Nth non-null value strictly before fromIdx, skipping
   nulls (non-trading days for this asset) rather than counting raw array
   positions — required since all assets share one master date axis. */
function nonNullStepsBack(arr, fromIdx, steps) {
  let count = 0;
  for (let i = fromIdx - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) {
      count++;
      if (count === steps) return i;
    }
  }
  return -1;
}

function pctChange(cur, base) {
  if (base === null || base === undefined || base === 0) return null;
  return (cur - base) / base * 100;
}

function getStats(key) {
  const d = RAW[key];
  if (!d) return null;
  const c = d.c, t = d.t;
  const n = c.length;
  const lastIdx = lastNonNullIndex(c, n - 1);
  if (lastIdx < 0) return null;
  const last = c[lastIdx];

  const idx1 = nonNullStepsBack(c, lastIdx, 1);
  const idx5 = nonNullStepsBack(c, lastIdx, 5);
  const idx21 = nonNullStepsBack(c, lastIdx, 21);
  const idx252 = nonNullStepsBack(c, lastIdx, 252);

  const yearCutoff = Date.UTC(new Date(t[lastIdx] * 1000).getUTCFullYear(), 0, 1) / 1000;
  let ytdIdx = -1;
  for (let i = lastIdx; i >= 0; i--) {
    if (t[i] < yearCutoff) { ytdIdx = i; break; }
  }

  return {
    name: d.name,
    currency: d.currency,
    lastDate: new Date(t[lastIdx] * 1000),
    last: last,
    pct1D: idx1 >= 0 ? pctChange(last, c[idx1]) : null,
    pct1W: idx5 >= 0 ? pctChange(last, c[idx5]) : null,
    pct1M: idx21 >= 0 ? pctChange(last, c[idx21]) : null,
    pct1Y: idx252 >= 0 ? pctChange(last, c[idx252]) : null,
    ytd: ytdIdx >= 0 ? pctChange(last, c[ytdIdx]) : null,
    source: ASSETS[key].source || "Yahoo Finance",
  };
}

function getChartSeries(key) {
  const d = RAW[key];
  if (!d || !d.t.length) return { labels: [], values: [] };
  const oneYearMs = 366 * 86400000;
  const cutoff = d.t[d.t.length - 1] * 1000 - oneYearMs;
  let startIdx = d.t.findIndex(ts => ts * 1000 >= cutoff);
  if (startIdx < 0) startIdx = 0;
  const t = d.t.slice(startIdx);
  const c = d.c.slice(startIdx);
  const labels = t.map(ts => new Date(ts * 1000).toISOString().slice(0, 10));
  return { labels, values: c };
}
