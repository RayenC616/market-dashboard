/* Shared asset-ordering module for index.html (dashboard, read/write) and
   brief.html (read-only, reorders table rows). 10 independent save slots,
   each storing its own equity-group and commodity-group order, persisted
   in this browser's localStorage. */

const ASSET_ORDER_KEY = "marketDashboardAssetOrder_v1";
const ASSET_ORDER_SLOT_COUNT = 10;
const DEFAULT_EQUITY_ORDER = ["SPX", "NDX", "STOXX", "NKY", "HSI", "KOSPI"];
const DEFAULT_COMMODITY_ORDER = ["WTI", "GOLD", "SILVER", "COPPER", "NICKEL", "CORN", "WHEAT", "SOY"];

function defaultOrderFor(group) {
  return (group === "equity" ? DEFAULT_EQUITY_ORDER : DEFAULT_COMMODITY_ORDER).slice();
}

function loadOrderState() {
  try {
    const raw = localStorage.getItem(ASSET_ORDER_KEY);
    if (!raw) return { activeSlot: 1, slots: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { activeSlot: 1, slots: {} };
    return { activeSlot: parsed.activeSlot || 1, slots: parsed.slots || {} };
  } catch (e) {
    return { activeSlot: 1, slots: {} };
  }
}

function saveOrderState(state) {
  try { localStorage.setItem(ASSET_ORDER_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

function getActiveSlot() {
  return loadOrderState().activeSlot;
}

function setActiveSlot(n) {
  const state = loadOrderState();
  state.activeSlot = n;
  saveOrderState(state);
}

function isSlotCustomized(n) {
  const state = loadOrderState();
  return !!state.slots[n];
}

/* Returns the active slot's saved order for a group, falling back to the
   default order — and folding in any asset keys the saved order predates
   (e.g. if the tracked asset list grows later) so nothing goes missing. */
function getOrder(group) {
  const state = loadOrderState();
  const slot = state.slots[state.activeSlot];
  const fallback = defaultOrderFor(group);
  if (!slot || !slot[group]) return fallback;
  const saved = slot[group].filter(k => fallback.includes(k));
  const missing = fallback.filter(k => !saved.includes(k));
  return saved.concat(missing);
}

function setOrder(group, orderArray) {
  const state = loadOrderState();
  if (!state.slots[state.activeSlot]) state.slots[state.activeSlot] = {};
  state.slots[state.activeSlot][group] = orderArray.slice();
  saveOrderState(state);
}

function resetActiveSlot() {
  const state = loadOrderState();
  delete state.slots[state.activeSlot];
  saveOrderState(state);
}

/* For brief.html: reorders a table's data rows (marked with data-key) to
   match the active slot's saved order for that group. Rows without a
   matching key (e.g. an older archived brief's discontinued commodities)
   are left in place. No-op if the table or rows aren't present. */
function applyOrderToTable(tableSelector, group) {
  const table = document.querySelector(tableSelector);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tr[data-key]"));
  if (!rows.length) return;
  const rowByKey = {};
  rows.forEach(r => { rowByKey[r.getAttribute("data-key")] = r; });
  getOrder(group).forEach(key => {
    const row = rowByKey[key];
    if (row) row.parentNode.appendChild(row);
  });
}
