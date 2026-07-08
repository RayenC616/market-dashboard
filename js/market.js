/* Ticker metadata + stats + live-refresh logic shared by dashboard.html and any future pages. */

const ASSETS = {
  SPX:    { name: "S&P 500",        group: "equity",    yahoo: "^GSPC",  currency: "USD", decimals: 2, unit: "" },
  NDX:    { name: "Nasdaq Composite", group: "equity",  yahoo: "^IXIC",  currency: "USD", decimals: 2, unit: "" },
  STOXX:  { name: "STOXX Europe 600", group: "equity",  yahoo: "^STOXX", currency: "EUR", decimals: 2, unit: "" },
  NKY:    { name: "Nikkei 225",      group: "equity",    yahoo: "^N225",  currency: "JPY", decimals: 2, unit: "" },
  HSI:    { name: "Hang Seng",       group: "equity",    yahoo: "^HSI",   currency: "HKD", decimals: 2, unit: "" },
  KOSPI:  { name: "KOSPI",          group: "equity",    yahoo: "^KS11",  currency: "KRW", decimals: 2, unit: "" },
  WTI:    { name: "WTI Crude Oil",   group: "commodity", yahoo: "CL=F",  currency: "USD", decimals: 2, unit: "$/bbl" },
  GOLD:   { name: "Gold",           group: "commodity", yahoo: "GC=F",  currency: "USD", decimals: 2, unit: "$/oz" },
  SILVER: { name: "Silver",         group: "commodity", yahoo: "SI=F",  currency: "USD", decimals: 3, unit: "$/oz" },
  COPPER: { name: "Copper",         group: "commodity", yahoo: "HG=F",  currency: "USD", decimals: 4, unit: "$/lb" },
  NICKEL: { name: "Nickel",         group: "commodity", yahoo: null,    currency: "USD", decimals: 2, unit: "$/t", source: "investing.com" },
  CORN:   { name: "Corn",           group: "commodity", yahoo: "ZC=F",  currency: "USX", decimals: 2, unit: "¢/bu" },
  WHEAT:  { name: "Wheat",          group: "commodity", yahoo: "ZW=F",  currency: "USX", decimals: 2, unit: "¢/bu" },
  SOY:    { name: "Soybean",        group: "commodity", yahoo: "ZS=F",  currency: "USX", decimals: 2, unit: "¢/bu" },
};

const CORS_PROXY = (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
const NICKEL_PAGE_URL = "https://www.investing.com/commodities/nickel";
const LS_KEY = "marketDashboardCache_v1";

function loadCachedRaw() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !parsed.savedAt) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveCachedRaw() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ savedAt: Date.now(), data: RAW }));
  } catch (e) { /* storage full or unavailable, ignore */ }
}

function initData() {
  const cached = loadCachedRaw();
  if (cached) {
    for (const key in cached.data) {
      RAW[key] = cached.data[key];
    }
    return cached.savedAt;
  }
  return null;
}

function lastNonNullIndex(arr, fromIdx) {
  for (let i = fromIdx; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return i;
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

  const idx1 = lastNonNullIndex(c, lastIdx - 1);
  const idx5 = lastNonNullIndex(c, Math.max(0, lastIdx - 5));
  const idx21 = lastNonNullIndex(c, Math.max(0, lastIdx - 21));
  const idx252 = lastIdx - 252 >= 0 ? lastNonNullIndex(c, lastIdx - 252) : -1;

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
    limitedHistory: !!d.limitedHistory,
    source: d.source || "Yahoo Finance",
  };
}

function getChartSeries(key) {
  const d = RAW[key];
  if (!d) return { labels: [], values: [] };
  const t = d.t.slice(-252);
  const c = d.c.slice(-252);
  const labels = t.map(ts => new Date(ts * 1000).toISOString().slice(0, 10));
  return { labels, values: c };
}

async function fetchViaProxy(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(CORS_PROXY(url));
      if (res.ok) return await res.text();
    } catch (e) { /* retry */ }
  }
  throw new Error("proxy fetch failed: " + url);
}

async function refreshYahooTicker(key) {
  const meta = ASSETS[key];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahoo)}?range=2y&interval=1d`;
  const text = await fetchViaProxy(url);
  const json = JSON.parse(text);
  const result = json.chart.result[0];
  const t = result.timestamp.slice();
  const c = result.indicators.quote[0].close.slice();

  const now = Date.now() / 1000;
  const period = result.meta.currentTradingPeriod && result.meta.currentTradingPeriod.regular;
  if (period && now < period.end && t[t.length - 1] >= period.start) {
    t.pop();
    c.pop();
  }

  RAW[key] = { name: ASSETS[key].name, currency: result.meta.currency, t, c };
}

async function refreshNickel() {
  const html = await fetchViaProxy(NICKEL_PAGE_URL);
  const priceMatch = html.match(/"last":([0-9.]+),"changePcr":(-?[0-9.]+)/);
  if (!priceMatch) throw new Error("could not parse nickel price");
  const price = parseFloat(priceMatch[1]);

  const d = RAW.NICKEL;
  const t = d.t.slice();
  const c = d.c.slice();
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = new Date(t[t.length - 1] * 1000).toISOString().slice(0, 10);
  if (lastDate === today) {
    c[c.length - 1] = price;
  } else {
    t.push(Math.floor(Date.now() / 1000));
    c.push(price);
  }
  RAW.NICKEL = { name: "Nickel", currency: "USD", limitedHistory: true, source: "investing.com", t, c };
}

async function refreshAll(onProgress) {
  const keys = Object.keys(ASSETS);
  const results = await Promise.allSettled(keys.map(async key => {
    if (key === "NICKEL") await refreshNickel();
    else await refreshYahooTicker(key);
    if (onProgress) onProgress(key, true);
  }));

  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") failed.push(keys[i]);
  });

  if (failed.length < keys.length) saveCachedRaw();
  return { succeeded: keys.length - failed.length, failed };
}
