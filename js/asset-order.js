/* Per-user asset customization: 3 independent save slots per logged-in user
   (see js/auth.js), each storing an equity order, a commodity order, and a
   set of hidden (deleted) asset keys. Shared by index.html (read/write) and
   brief.html (read-only, reorders + filters table rows). */

const ASSET_ORDER_KEY = "marketDashboardAssetOrder_v2";
const ASSET_ORDER_SLOT_COUNT = 3;
const DEFAULT_EQUITY_ORDER = ["SPX", "NDX", "STOXX", "NKY", "HSI", "KOSPI"];
const DEFAULT_COMMODITY_ORDER = ["WTI", "GOLD", "SILVER", "COPPER", "NICKEL", "CORN", "WHEAT", "SOY"];

function defaultOrderFor(group) {
  return (group === "equity" ? DEFAULT_EQUITY_ORDER : DEFAULT_COMMODITY_ORDER).slice();
}

function currentUsername() {
  const user = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  return user ? user.username : "__anonymous__";
}

function loadAllUsersState() {
  try {
    const raw = localStorage.getItem(ASSET_ORDER_KEY);
    if (!raw) return { users: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { users: {} };
    return { users: parsed.users || {} };
  } catch (e) {
    return { users: {} };
  }
}

function saveAllUsersState(state) {
  try { localStorage.setItem(ASSET_ORDER_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

function loadUserState() {
  const all = loadAllUsersState();
  const username = currentUsername();
  if (!all.users[username]) all.users[username] = { activeSlot: 1, slots: {} };
  return all.users[username];
}

function saveUserState(userState) {
  const all = loadAllUsersState();
  all.users[currentUsername()] = userState;
  saveAllUsersState(all);
}

function getActiveSlot() {
  return loadUserState().activeSlot;
}

function setActiveSlot(n) {
  const state = loadUserState();
  state.activeSlot = n;
  saveUserState(state);
}

function isSlotCustomized(n) {
  return !!loadUserState().slots[n];
}

function currentSlotData() {
  const state = loadUserState();
  return state.slots[state.activeSlot] || {};
}

/* Returns the active slot's saved order for a group, filtered to hidden
   assets removed, falling back to the default order — and folding in any
   asset keys the saved order predates so nothing goes missing. */
function getOrder(group) {
  const slot = currentSlotData();
  const fallback = defaultOrderFor(group);
  const hidden = new Set(slot.hidden || []);
  const base = slot[group] ? slot[group].filter(k => fallback.includes(k)) : fallback;
  const missing = fallback.filter(k => !base.includes(k));
  return base.concat(missing).filter(k => !hidden.has(k));
}

/* Returns ALL asset keys for a group in the active slot's order, including
   hidden ones — used to render the add/delete management list. */
function getAllOrder(group) {
  const slot = currentSlotData();
  const fallback = defaultOrderFor(group);
  const base = slot[group] ? slot[group].filter(k => fallback.includes(k)) : fallback;
  const missing = fallback.filter(k => !base.includes(k));
  return base.concat(missing);
}

function isHidden(key) {
  const slot = currentSlotData();
  return (slot.hidden || []).includes(key);
}

function setOrder(group, orderArray) {
  const state = loadUserState();
  if (!state.slots[state.activeSlot]) state.slots[state.activeSlot] = {};
  state.slots[state.activeSlot][group] = orderArray.slice();
  saveUserState(state);
}

function setHidden(key, hidden) {
  const state = loadUserState();
  if (!state.slots[state.activeSlot]) state.slots[state.activeSlot] = {};
  const slot = state.slots[state.activeSlot];
  const current = new Set(slot.hidden || []);
  if (hidden) current.add(key); else current.delete(key);
  slot.hidden = Array.from(current);
  saveUserState(state);
}

function resetActiveSlot() {
  const state = loadUserState();
  delete state.slots[state.activeSlot];
  saveUserState(state);
}

/* For brief.html: reorders a table's data rows (marked with data-key) to
   match the active slot's saved order for that group, and removes rows for
   assets the current user has hidden. Rows without a matching key (e.g. an
   older archived brief's discontinued commodities) are left in place. */
function applyOrderToTable(tableSelector, group) {
  const table = document.querySelector(tableSelector);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tr[data-key]"));
  if (!rows.length) return;
  const rowByKey = {};
  rows.forEach(r => { rowByKey[r.getAttribute("data-key")] = r; });
  const hidden = new Set(currentSlotData().hidden || []);
  getOrder(group).forEach(key => {
    const row = rowByKey[key];
    if (row) row.parentNode.appendChild(row);
  });
  rows.forEach(r => {
    const key = r.getAttribute("data-key");
    if (hidden.has(key)) r.style.display = "none";
  });
}
