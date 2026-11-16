/*
 * Qwipo Delivery Partner – front-end replica.
 * Every screen, flow, message and quirk below is ported from
 * qwipo-delivery-partners (main) src/app/**. Comments name the source file.
 */
(function () {
  "use strict";

  const API = window.DPServer;
  const deviceEl = document.getElementById("device");
  const screenEl = document.getElementById("screen");
  const ovEl = document.getElementById("overlays");
  const sysEl = document.getElementById("system");
  const IMG = "assets/images/";
  const APP_VERSION = "1.0.0"; // App_Resources/Android/app.gradle versionName

  // ---------------------------------------------------------------- enums (common/enums.common.ts)
  const NavigatedFrom = { Trip: 1, Non_Trip: 2, None: 99 };
  const PointMode = { PICKUP: 1, DELIVERY: 2, RETURN: 3, NONE: 99 };
  const PointType = { VENDOR: 1, CUSTOMER: 2, WAREHOUSE: 3, NONE: 99 };
  const HopStatus = { Created: "Created", InProgress: "InProgress", Completed: "Completed", Cancelled: "Cancelled" };
  const TripStatus = { CREATED: "Created", IN_PROGRESS: "InProgress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  const RRC = {
    STORE_NOT_ACCEPTING_ORDER: 150, STORE_REJECTED_ORDER: 151, PACKED_ORDER_NOT_COMPLETE: 100, RETAIL_BUYER_CANCELLED_ORDER: 152,
    RIDER_NOT_ASSIGNED: 153, PICKUP_TAT_BREACH: 154, REASSIGNED_TO_ANOTHER_LSP: 155, FRAUDULENT_RIDER_BEHAVIOR: 156,
    RIDER_NOT_AVAILABLE: 101, PICKUP_ADDRESS_INCORRECT: 102, STORE_CLOSED_OR_UNAVAILABLE: 103, STORE_DENIED_PICKUP: 104,
    ORDER_NOT_READY_FOR_PICKUP: 105, DELIVERY_TAT_BREACH: 175, WRONG_PRODUCT_DELIVERED: 125, RETAIL_BUYER_NOT_FOUND: 126,
    RETAIL_BUYER_REFUSED_DELIVERY: 127, DELIVERY_ADDRESS_INCORRECT: 128, FORCE_MAJEURE: 129, DELIVERY_NOT_POSSIBLE_VEHICLE_ISSUES: 130,
    ORDER_LOST_OR_DAMAGED: 131, ORDER_PICKED_BY_ANOTHER_LSP: 132, RETAIL_BUYER_REFUSED_COD_PAYMENT: 133,
  };
  const REASON_NAMES = {
    150: "Store Not Accepting Order", 151: "Store Rejected Order", 100: "Order Not Complete", 152: "Buyer Cancelled Order",
    153: "Rider Not Assigned", 154: "Pickup TAT Breach", 155: "Reassigned To Another LSP", 156: "Fraudulent Rider Behavior",
    101: "Rider Not Available", 102: "Pickup Address Incorrect", 103: "Store Closed/Unavailable", 104: "Store Denied Pickup",
    105: "Order Not Ready For Pickup", 175: "Delivery TAT Breach", 125: "Wrong Product Delivered", 126: "Buyer Not Found",
    127: "Buyer Refused Delivery", 128: "Delivery Address Incorrect", 129: "Force Majeure", 130: "Delivery Not Possible (Vehicle Issues)",
    131: "Order Lost or Damaged", 132: "Order Picked By Another LSP", 133: "Buyer Refused COD Payment",
  };
  const REASON_ORDER = [150, 151, 100, 152, 153, 154, 155, 156, 101, 102, 103, 104, 105, 175, 125, 126, 127, 128, 129, 130, 131, 132, 133];
  const allReturnReasons = () => REASON_ORDER.map((c) => ({ id: c, name: REASON_NAMES[c] || "Other Reason", isSelected: false, code: c }));
  const webViewSrcAssets = {
    1: { srcId: 1, webUrl: "terms-conditions", title: "Terms & Conditions" },
    2: { srcId: 2, webUrl: "privacy-policy", title: "Privacy Policy" },
  };

  // ---------------------------------------------------------------- small utils
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* no storage */ } },
  };
  function txt(v) {
    if (v === undefined || v === null || v === "") return "&#8203;";
    // icon-font glyphs are written as character references (e.g. "&#xf054;")
    if (/^\s*(&#x[0-9a-f]+;\s*)+$/i.test(String(v))) return String(v);
    return esc(v);
  }
  // NativeScript Label: single line unless textWrap="true"
  const L = (text, cls = "", attrs = "") => `<div class="lbl ${cls}" ${attrs}>${txt(text)}</div>`;
  const W = (text, cls = "", attrs = "") => `<div class="lbl wrap ${cls}" ${attrs}>${txt(text)}</div>`;
  const spinner = (cls = "", style = "") => `<div class="spinner ${cls}" style="${style}"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="18"/></svg></div>`;

  // value-converters/*
  function weightPipe(value) {
    if (typeof value !== "number" || isNaN(value)) return "";
    const parts = value.toFixed(2).split(".");
    let i = parts[0];
    const d = parts.length > 1 ? "." + parts[1] : ".00";
    if (i.length > 3) {
      const last = i.substring(i.length - 3);
      const other = i.substring(0, i.length - 3);
      i = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last;
    }
    return `${i}${d} kgs`;
  }
  function replaceCommas(value) {
    const num = Number(value);
    if (!isNaN(num) && typeof num === "number") {
      const result = num.toFixed(2).toString().split(".");
      let lastThree = result[0].substring(result[0].length - 3);
      const other = result[0].substring(0, result[0].length - 3);
      if (other !== "") lastThree = "," + lastThree;
      let output = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
      if (result.length > 1) output += "." + result[1];
      return "₹ " + output;
    }
    return "₹ 0";
  }
  const pointModeLabel = (m) => ({ 1: "Pickup", 2: "Delivery", 3: "Return", 99: "None" }[m]);
  const concatenateLabel = (m) => ({ 1: "From", 2: "To", 3: "To", 99: "None" }[m]);
  const pointTypeLabel = (t) => ({ 1: "Seller", 2: "Retailer", 3: "WareHouse", 99: "None" }[t]);
  function convertToDDMMYYYY(s) {
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  }
  function semverGte(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return true;
      if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return true;
  }
  const isValidMobileNumber = (v) => /^[6-9]\d{9}$/.test(v);
  const isValidOTPNumber = (v) => /^[0-9]\d{5}$/.test(v);
  const containsSpecialChars = (s) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(s);
  const validateSpecialCharacters = (s) => /[a-zA-Z]+.*\d+|\d+.*[a-zA-Z]+/.test(s);
  const validateOnlyNumbers = (s) => /^\d+$/.test(s);
  const validateText = (s) => /^[A-Za-z\s]+$/.test(s);
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const rad = (d) => d * (Math.PI / 180);
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
  }

  // ---------------------------------------------------------------- simulated device (driven from the side panel)
  const device = (window.DPDevice = { location: "atVendor", online: true, outdated: false, listeners: [] });
  const panelEvent = (type, data) => device.listeners.forEach((fn) => fn(type, data));

  // ---------------------------------------------------------------- services
  const userService = {
    loggedInUser: () => store.get("dp_loggedInUser", null),
    setLoggedInNumber: (n) => store.set("dp_loggedInUser", n),
    logOutUser: () => store.del("dp_loggedInUser"),
  };
  // store/return.repository.ts (backed by local cache)
  const RC_KEY = "dp_return_cache";
  const returnRepository = {
    _all: () => store.get(RC_KEY, {}),
    _save: (o) => store.set(RC_KEY, o),
    async getReturnById(id) { return this._all()[id]; },
    async getAllReturns() {
      const all = this._all();
      return Object.keys(all).map((k) => ({ hopId: k, tripId: all[k].tripId, returnOrders: all[k].returnOrders }));
    },
    async deleteCacheReturnByHopId(hopId) {
      appState.isWholeOrderReturn = false;
      const all = this._all();
      delete all[hopId];
      this._save(all);
      panelEvent("cache");
    },
    async upsertStoreReturn(item) {
      const all = this._all();
      const existing = all[item.hopId];
      if (existing) {
        const updated = existing.returnOrders.slice();
        item.returnOrders.forEach((n) => {
          const idx = updated.findIndex((o) => o.orderNumber === n.orderNumber && o.itemId === n.itemId && o.vendorName === n.vendorName);
          if (idx !== -1) {
            const e = updated[idx];
            updated[idx] = Object.assign({}, e, { quantity: e.quantity + n.quantity, pieces: e.pieces + n.pieces, cases: e.cases + n.cases });
          } else {
            updated.push(n);
          }
        });
        all[item.hopId] = { hopId: existing.hopId, tripId: existing.tripId, returnOrders: updated };
      } else {
        all[item.hopId] = item;
      }
      this._save(all);
      panelEvent("cache");
    },
  };

  function mapDeliveryPartner(d) {
    return {
      id: d.id, sellerId: d.seller_id, deliveryPartnerType: d.delivery_partner_type, name: d.name, phone: d.phone, email: d.email,
      licenseNumber: d.license_number, experienceYears: d.experience_years, status: d.status, bloodGroup: d.blood_group,
    };
  }

  // user.service.ts getCurrentLocation()
  async function getCurrentLocation() {
    let perm = store.get("dp_loc_perm", null);
    if (perm !== "granted" && perm !== "denied_forever") {
      perm = await askLocationPermission();
    }
    if (perm !== "granted" || device.location === "disabled") return { lat: 0, long: 0, isEnableLocation: false, isMockLocation: false };
    await wait(350);
    const ref = vendorCoords();
    if (device.location === "mock") return { lat: ref.lat, long: ref.lng, isMockLocation: true, isEnableLocation: true };
    if (device.location === "away") return { lat: ref.lat + 0.018, long: ref.lng + 0.011, isMockLocation: false, isEnableLocation: true };
    return { lat: ref.lat + 0.00031, long: ref.lng + 0.00022, isMockLocation: false, isEnableLocation: true };
  }
  function vendorCoords() {
    const db = API.snapshot();
    const tripId = appState.tripId || (appState.hop && appState.hop.tripId);
    const hop = db.hops.find((h) => h.tripId === tripId && h.pointMode === 1) || db.hops[0];
    return { lat: Number(hop.pointLat), lng: Number(hop.pointLng) };
  }

  // ---------------------------------------------------------------- app state (common/application-state.common.ts)
  let appState = null;
  function freshAppState() {
    return {
      deliveryPartner: {}, hop: null, appSettings: null, deviceAppVersion: APP_VERSION, isBottomSheetOpen: false,
      loginMobileNumber: "", subFooter: false, isNavigatedFrom: 2, env: "prod", tripId: "", isWholeOrderReturn: false, isHopDetailsPage: false,
    };
  }
  window.DPApp = { get appState() { return appState; } };

  // ---------------------------------------------------------------- router
  let route = null;
  let view = {};
  let navToken = 0;
  let history = [];
  let currentQuery = null;
  let appRunning = false;

  function navigate(path, query) {
    if (!appRunning) return;
    if (path === route && !query) return; // Angular ignores same-URL navigation
    if (route) history.push({ path: route, query: currentQuery });
    if (history.length > 30) history.shift();
    route = path;
    currentQuery = query || null;
    view = {};
    navToken++;
    const tok = navToken;
    const screen = SCREENS[path];
    try { store.set("dp_currentRoute", path); } catch (e) { /* ignore */ }
    clearTimers();
    screenEl.innerHTML = "";
    let pending = null;
    if (screen && screen.init) {
      try { pending = screen.init(view, () => tok === navToken && appRunning, query); } catch (e) { console.error(e); }
    }
    if (tok === navToken) renderScreen(true);
    if (pending && pending.catch) pending.catch((e) => console.error(e));
    panelEvent("route", path);
  }
  function backToPreviousPage() {
    const prev = history.pop();
    if (!prev) return;
    route = null;
    navigate(prev.path, prev.query);
    history.pop();
  }
  // child component mount helper (*ngIf creates a fresh component each time)
  function mount(v, key, state, init) {
    v[key] = state;
    const tok = navToken;
    const alive = () => tok === navToken && v[key] === state && appRunning;
    if (init) init(state, alive);
    return state;
  }

  // timers belonging to a page (OTP countdown)
  let timers = [];
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

  // ---------------------------------------------------------------- rendering
  function renderScreen(reset) {
    if (!route) { screenEl.innerHTML = ""; return; }
    const screen = SCREENS[route];
    const scrolls = {};
    if (!reset) screenEl.querySelectorAll("[data-sk]").forEach((el) => { scrolls[el.dataset.sk] = el.scrollTop; });
    const ae = document.activeElement;
    let fk = null, s0 = null, s1 = null;
    if (!reset && ae && screenEl.contains(ae) && ae.dataset && ae.dataset.fk) {
      fk = ae.dataset.fk;
      try { s0 = ae.selectionStart; s1 = ae.selectionEnd; } catch (e) { /* ignore */ }
    }
    let html = "";
    try { html = screen ? screen.render(view) : ""; } catch (e) { console.error("render", route, e); html = screenEl.innerHTML; }
    screenEl.innerHTML = html;
    screenEl.querySelectorAll("[data-sk]").forEach((el) => { if (scrolls[el.dataset.sk] != null) el.scrollTop = scrolls[el.dataset.sk]; });
    if (fk) {
      const el = screenEl.querySelector(`[data-fk="${fk}"]`);
      if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(s0, s1); } catch (e) { /* ignore */ } }
    }
  }
  const render = () => renderScreen(false);

  // ================================================================ OVERLAYS
  function layer(cls) {
    const el = document.createElement("div");
    el.className = "ov " + (cls || "");
    ovEl.appendChild(el);
    return el;
  }

  // ---- toast (@triniwiz/nativescript-toasty, SHORT) ----
  let toastEl = null, toastTimer = null;
  function showToast(message) {
    if (toastEl) toastEl.remove();
    clearTimeout(toastTimer);
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    // Android 12+ system toast: light pill with the app icon
    toastEl.innerHTML = `<img src="assets/icon.png" alt=""><span>${esc(message)}</span>`;
    ovEl.appendChild(toastEl);
    requestAnimationFrame(() => toastEl && toastEl.classList.add("in"));
    const el = toastEl;
    toastTimer = setTimeout(() => { el.classList.remove("in"); setTimeout(() => el.remove(), 250); if (toastEl === el) toastEl = null; }, 2000);
  }

  // ---- loader (@nstudio/nativescript-loading-indicator) ----
  let loaderEl = null;
  const loader = {
    show(message) {
      if (!loaderEl) loaderEl = layer("ld-layer");
      // loaderOptions.android.progressStyle = 1 → horizontal indeterminate bar
      loaderEl.innerHTML = `<div class="ld-wrap"><div class="ld"><div class="ld-bar"><span></span></div><div class="ld-msg">${esc(message)}</div></div></div>`;
    },
    hide() { if (loaderEl) { loaderEl.remove(); loaderEl = null; } },
  };

  // ---- TNSFancyAlert (SweetAlertDialog on Android) ----
  // TNSFancyAlert on Android: coloured header with a V-shaped lower edge, white ring icon
  // (open near 4 o'clock), bold title, left-aligned body and an outlined button.
  const RING = `<path d="M33.6 42.2 A19.5 19.5 0 1 1 41.1 36.3" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>`;
  const ICONS = {
    success: `<svg class="fa-icon" viewBox="0 0 49 49">${RING}<path d="M16.2 25.4 L21.9 31 L32.6 19.6" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg class="fa-icon" viewBox="0 0 49 49">${RING}<path d="M18.4 18.4 L30.6 30.6 M30.6 18.4 L18.4 30.6" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/></svg>`,
    warning: `<svg class="fa-icon" viewBox="0 0 49 49">${RING}<path d="M24.5 13.6 V27.5" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/><circle cx="24.5" cy="33.8" r="1.6" fill="#fff"/></svg>`,
  };
  function fancy(type, title, detail, button = "OK") {
    return new Promise((resolve) => {
      const el = layer("sa-layer");
      el.innerHTML = `<div class="sa-wrap"><div class="sa-dim"></div><div class="fa fa-${type}"><div class="fa-head"><svg class="fa-band" viewBox="0 0 288 85" preserveAspectRatio="none"><path d="M0 0 H288 V75 L144 85 L0 75 Z"/></svg>${ICONS[type]}</div><div class="fa-title">${esc(title)}</div><div class="fa-text">${esc(detail)}</div><div class="fa-btn" data-sa="ok">${esc(button)}</div></div></div>`;
      el.querySelector("[data-sa]").addEventListener("click", (e) => { e.stopPropagation(); el.remove(); resolve(); });
      panelEvent("alert", { type, title, detail });
    });
  }
  const showSuccess = (t, d, b) => fancy("success", t, d, b);
  const showWarning = (t, d, b) => fancy("warning", t, d, b);
  const showError = (t, d, b) => fancy("error", t, d, b);

  // ---- dialogs.confirm (native AlertDialog) ----
  function confirmDialog(message, okText, cancelText) {
    return new Promise((resolve) => {
      const el = layer("ad-layer");
      el.innerHTML = `<div class="sa-wrap"><div class="sa-dim ad-dim" data-ad="out"></div><div class="ad"><div class="ad-msg">${esc(message)}</div><div class="ad-btns"><div data-ad="no">${esc(cancelText)}</div><div data-ad="yes">${esc(okText)}</div></div></div></div>`;
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ad]");
        if (!b) return;
        e.stopPropagation();
        el.remove();
        resolve(b.dataset.ad === "yes");
      });
    });
  }

  // ---- runtime location permission ----
  function askLocationPermission() {
    return new Promise((resolve) => {
      const el = layer("perm-layer");
      let precise = true;
      // Android 16 runtime permission dialog (the reference device runs the system dark theme)
      const roads = (c) => `<path d="M0 22 L124 8 M0 52 L124 40 M0 80 L124 70 M20 0 L34 92 M58 0 L70 92 M96 0 L104 92 M0 34 L60 92" stroke="${c}" stroke-width="2.4" fill="none"/>`;
      const preciseMap = `<svg viewBox="0 0 124 92" class="pmap"><rect width="124" height="92" rx="6" fill="#4b4446"/>${roads("#e8e8e8")}<path d="M62 60c-9-12-14-19-14-26a14 14 0 0 1 28 0c0 7-5 14-14 26z" fill="#4f8ef7"/><circle cx="62" cy="34" r="5" fill="#fff"/><ellipse cx="62" cy="62" rx="9" ry="3" fill="#fff" opacity=".85"/></svg>`;
      const approxMap = `<svg viewBox="0 0 124 92" class="pmap"><rect width="124" height="92" rx="6" fill="#4b4446"/>${roads("#f2c94c")}<circle cx="64" cy="46" r="22" fill="#4f8ef7" opacity=".45"/></svg>`;
      el.innerHTML = `<div class="sa-wrap"><div class="sa-dim perm-dim"></div><div class="perm">
        <svg class="perm-ico" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 21s-6.5-6.6-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 14.4 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <div class="perm-title">Allow <b>Qwipo DP</b> to access this device’s location?</div>
        <div class="perm-maps">
          <div class="opt sel" data-pm="precise"><div class="opt-h"><span class="chk"></span>Precise</div>${preciseMap}</div>
          <div class="opt" data-pm="approx"><div class="opt-h"><span class="chk"></span>Approximate</div>${approxMap}</div>
        </div>
        <div class="perm-btn" data-pa="while">While using the app</div>
        <div class="perm-btn" data-pa="once">Only this time</div>
        <div class="perm-btn" data-pa="deny">Don’t allow</div></div></div>`;
      el.addEventListener("click", (e) => {
        const pm = e.target.closest("[data-pm]");
        if (pm) {
          precise = pm.dataset.pm === "precise";
          el.querySelectorAll("[data-pm]").forEach((o) => o.classList.toggle("sel", o === pm));
          return;
        }
        const b = e.target.closest("[data-pa]");
        if (!b) return;
        e.stopPropagation();
        el.remove();
        if (b.dataset.pa === "deny") {
          const n = store.get("dp_loc_deny", 0) + 1;
          store.set("dp_loc_deny", n);
          if (n >= 2) store.set("dp_loc_perm", "denied_forever");
          resolve("denied");
        } else {
          if (b.dataset.pa === "while") store.set("dp_loc_perm", "granted");
          resolve("granted");
        }
      });
    });
  }

  // ---- snackbar (connectivity lost) ----
  function showSnack() {
    const el = layer("snack-layer");
    el.style.pointerEvents = "none";
    el.innerHTML = `<div class="snack"><span>Internet Connection Lost.</span><span class="act" style="pointer-events:auto">Check Connection</span></div>`;
    const s = el.firstChild;
    requestAnimationFrame(() => s.classList.add("in"));
    setTimeout(() => { s.classList.remove("in"); setTimeout(() => el.remove(), 300); }, 4000);
  }

  // ---- phone dialer (nativescript-phone dial(number, true)) ----
  let dialerEl = null;
  function dial(number) {
    if (dialerEl) dialerEl.remove();
    dialerEl = document.createElement("div");
    dialerEl.className = "dialer";
    const keys = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
    dialerEl.innerHTML = `<div class="num">${esc(number)}</div><div class="pad">${keys.map(([k, s]) => `<div class="key">${k}<small>${s}&nbsp;</small></div>`).join("")}</div><div class="call"><svg width="28" height="28" viewBox="0 0 24 24"><path fill="#fff" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg></div>`;
    sysEl.appendChild(dialerEl);
    panelEvent("log", `Phone app opened with ${number}`);
  }

  // ================================================================ UIService + Bottomsheet (services/ui-service.ts, shared/Bottomsheet)
  const ui = { isBottomSheetOpen: false, callback: null, layer: null, sheetView: null, shade: null };
  let sheet = null;

  function showBottomSheet(input, callback) {
    ui.callback = callback;
    sheet = createSheetState(input || {});
    const el = layer("sheet-layer");
    el.innerHTML = `<div class="shade"></div><div class="sheet-view"></div>`;
    ui.layer = el;
    ui.shade = el.querySelector(".shade");
    ui.sheetView = el.querySelector(".sheet-view");
    renderSheet();
    requestAnimationFrame(() => requestAnimationFrame(() => { ui.shade.classList.add("in"); ui.sheetView.classList.add("in"); }));
    setTimeout(() => { ui.isBottomSheetOpen = true; appState.isBottomSheetOpen = ui.isBottomSheetOpen; }, 300);
  }
  function closeBottomSheet(data) {
    if (!ui.layer) return;
    const el = ui.layer;
    const cb = ui.callback;
    ui.shade.classList.remove("in");
    ui.sheetView.classList.remove("in");
    ui.layer = null;
    setTimeout(() => { el.remove(); sheet = null; if (cb) cb(data); }, 300);
  }
  function closeAllSheets() {
    if (ui.layer) { ui.layer.remove(); ui.layer = null; sheet = null; }
  }
  function closeRoute(routeName) {
    if (ui.isBottomSheetOpen) {
      closeAllSheets();
      appState.isBottomSheetOpen = !appState.isBottomSheetOpen;
      navigate(routeName[0]);
    }
  }

  function createSheetState(input) {
    const s = {
      type: input.type, items: input.items, reasons: allReturnReasons(), wholeOrderReturns: allReturnReasons(),
      form: { reasonId: "", returnQuantity: "" }, touched: { reasonId: false, returnQuantity: false },
      selectedReason: null, isSelectedReason: false, showReturnRequestList: false, otpNumber: null, hopSummary: null, retailerOrderOtp: [],
      returnQuantity: 0, otpInput: "",
    };
    // calculatePopupHeight()
    switch (s.type) {
      case 10002:
        s.returnQuantity = Number(input.items[0].orderedQty) - input.items[0].totalReturnQty;
        s.form.returnQuantity = String(s.returnQuantity);
        break;
      case 10003:
        s.otpNumber = input.items[0].otpCode;
        break;
      case 10006:
        s.hopSummary = input.items[0];
        s.retailerOrderOtp = [{ retailerName: s.hopSummary.pointName, mobileNumber: `+91${s.hopSummary.pointPhone}`, otp: appState.hop.otp, orderId: [] }];
        break;
      default:
    }
    return s;
  }

  function sheetReasonBlock(s, withQty) {
    const reasonList = s.wholeOrderReturns;
    const qtyInvalid = !(Number(s.form.returnQuantity) >= 1) || s.form.returnQuantity === "";
    const qtyBox = withQty ? `
      <div class="col bg-search border-1-grey pl-4">
        <div class="row">${W("Enter Return Quantity", "s12 c-muted pt-2")}${s.touched.returnQuantity && qtyInvalid ? L("&#xf069;", "fas s10 pt-2 pl-1 c-danger") : ""}</div>
        <div class="col pr-2" style="height:40px;justify-content:center"><input class="tf s14 c-black" style="padding:0 4px" inputmode="numeric" data-sinput="qty" data-fk="sheetQty" value="${esc(s.form.returnQuantity)}"></div>
      </div>` : "";
    return `
      <div class="col mt-4 mx-5">${qtyBox}
        <div class="col bg-search border-1-grey pl-4 mt-4" data-stap="toggleReasons">
          <div class="row">${W("Reason", "s12 pt-2")}<div class="lbl fas s10 pt-2 pl-1 ${!s.selectedReason && s.touched.reasonId ? "c-danger" : ""}">&#xf069;</div></div>
          <div class="col pt-2 pr-1 pb-1">${L(s.isSelectedReason ? s.selectedReason.name : "Select Reason for Return", "c-black s14 mb-2")}</div>
        </div>
      </div>
      ${s.showReturnRequestList ? `<div class="col mt-5 pb-5" style="height:400px;flex:none"><div class="scroll border-1-grey bg-search mx-5" style="max-height:100%">
        ${reasonList.map((r) => `<div class="border-b-2 p-1" style="height:50px;display:grid;grid-template-columns:auto 1fr;align-items:center;flex:none">
           <div class="col pl-5" data-stap="selectReason" data-arg="${r.id}">${W(r.name, "c-black tl s14")}</div>
           <div class="mr-5" style="justify-self:end" data-stap="selectReason" data-arg="${r.id}"><img src="${IMG}redesign/icons/${r.isSelected ? "radio-selected" : "radio-before"}.svg" style="width:16px;height:16px"></div>
        </div>`).join("")}
      </div></div>` : ""}`;
  }

  function sheetHeader(title) {
    return `<div class="bg-white px-5" style="display:grid;grid-template-columns:minmax(0,1fr) 50px;align-items:center;flex:none">
      ${L(title, "c-black s16 pl-3 w700")}
      <div class="lbl fas s24 c-secondary tc" data-stap="close">&#xf00d;</div></div>`;
  }

  function sheetHtml(s) {
    const close = `<div class="sheet-close" data-stap="close"><div class="circle">${L("&#xf00d;", "fas s16 c-black tc")}</div>${L("Close", "s16 c-white mt-2")}</div>`;
    let body = "";
    const twoBtns = (leftLabel, leftTap, rightLabel, rightTap, rightBg, rightTxt) => `
      <div class="row p-2 mt-10">
        <div class="col" style="${pct(0.5)}"><div class="row border-1 bg-search ax-c" style="border-radius:11.43px" data-stap="${leftTap}"><div class="row p-3 px-5">${L(leftLabel, "c-black s14 w500 tc")}</div></div></div>
        <div class="col" style="${pct(0.5)}${CLAMP}"><div class="row ax-c ${rightBg}" style="border:1px solid #d6d4d4;border-radius:11.43px" data-stap="${rightTap}"><div class="row p-3 px-5">${L(rightLabel, `${rightTxt} s14 w500 tc`)}</div></div></div>
      </div>`;
    switch (s.type) {
      case 10001: // Logout
        body = `<div class="col pb-5 bg-white" style="height:250px">
          <div class="col border-bottom px-5 w-full">${L("Logout", "s20 tc w500 p-5")}</div>
          <div class="col ax-c mt-10">${L("Do you want to Logout ?", "c-black s16 w500")}</div>
          ${twoBtns("Cancel", "close0", "Logout", "logout", "bg-info", "c-white")}
        </div>`;
        break;
      case 10002: // Reason for return (single product)
      case 10004: // whole order return
        body = `<div class="col bg-white" style="height:550px"><div class="col border-bottom pt-5 pb-5 w-full" style="height:100%">
          ${sheetHeader("Reason For Return")}
          <div class="col fill" style="overflow:hidden">${sheetReasonBlock(s, s.type === 10002)}</div>
          <div class="col mt-2" style="height:70px;flex:none;justify-content:center"><div class="gbtn p3" style="height:50px;margin-top:20px" data-stap="${s.type === 10002 ? "submit" : "submitWhole"}">${L("Submit", "s14")}</div></div>
        </div></div>`;
        break;
      case 10003: // Please Enter OTP Number
        body = `<div class="col pb-5 px-5 bg-white" style="height:600px">
          <div class="col p-5">${W("Please Enter OTP Number", "c-black tl w700 s22 mt-5")}</div>
          <div class="fill"><div class="bg-search border-1-grey mx-5 p-2 ax-c" style="height:40px;width:50%;margin-left:auto;margin-right:auto"><input class="tf c-black tc s18" style="padding:0" inputmode="numeric" data-sinput="otp" data-fk="sheetOtp" value="${esc(s.otpInput)}"></div></div>
          <div class="col mx-5 mt-10" style="height:70px;flex:none"><div class="lbl c-white bg-info rfull tc w500 s14 ff-file ax-c mt-5 p-3" style="width:85%;height:44px;min-width:200px" data-stap="otpSubmit">Submit</div></div>
        </div>`;
        break;
      case 10005: // Pending Returns
        body = `<div class="col pb-5 bg-white" style="height:350px">
          <div class="col border-bottom px-5 w-full">${L("Pending Returns", "s20 tc w500 p-5")}</div>
          <div class="col ax-c mt-10">${L("You have pending returns,", "c-black s16 w500 tc")}${L("do you want to delete the changes", "c-black s16 w500 tc")}</div>
          ${twoBtns("No", "pendingNo", "Yes", "pendingYes", "bg-black", "c-white")}
        </div>`;
        break;
      case 10006: // Action -> OTP
        body = `<div class="col bg-white" style="height:550px">
          <div style="height:70px;flex:none" class="col"><div class="bg-white mt-5 pb-4 border-b-2" style="height:50px;display:grid;grid-template-columns:minmax(0,1fr) 50px;align-items:center">${L("Action", "c-black s16 pl-3 w700")}<div class="lbl fas s24 c-secondary tc" data-stap="close">&#xf00d;</div></div></div>
          <div class="fill" style="display:grid;grid-template-columns:2fr 3fr">
            <div class="col"><div class="col border-1x"><div class="row bg-white" style="height:50px;align-items:center">${W("OTP", "tl c-black pl-5")}</div></div></div>
            <div class="col ml-2"><div style="height:50px;display:grid;grid-template-columns:10px 1fr 40px 5px;align-items:center"><div style="grid-column:2">${W("Resend OTP", "c-black tl s14")}</div><div><img src="${IMG}redesign/icons/radio-selected.svg" style="width:16px;height:16px"></div></div></div>
          </div>
          <div class="fill col" style="justify-content:center"><div class="col mt-2" style="height:70px;justify-content:center"><div class="gbtn p3" style="height:50px;margin-top:20px" data-stap="sendOtp">${L("Send", "s14")}</div></div></div>
        </div>`;
        break;
      default:
        body = "";
    }
    return `${close}<div class="sheet-body">${body}</div>`;
  }
  function renderSheet() {
    if (!ui.sheetView || !sheet) return;
    const ae = document.activeElement;
    const fk = ae && ui.sheetView.contains(ae) ? ae.dataset.fk : null;
    let s0 = null;
    try { s0 = fk ? ae.selectionStart : null; } catch (e) { /* ignore */ }
    const sc = ui.sheetView.querySelector(".scroll");
    const st = sc ? sc.scrollTop : 0;
    ui.sheetView.innerHTML = sheetHtml(sheet);
    const sc2 = ui.sheetView.querySelector(".scroll");
    if (sc2) sc2.scrollTop = st;
    if (fk) {
      const el = ui.sheetView.querySelector(`[data-fk="${fk}"]`);
      if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(s0, s0); } catch (e) { /* ignore */ } }
    }
  }

  const SHEET_ACTIONS = {
    close() { closeBottomSheet(""); },
    close0() { closeBottomSheet(undefined); },
    async logout() {
      closeBottomSheet("");
      userService.logOutUser();
      appState.loginMobileNumber = "";
      appState.deliveryPartner = {};
      navigate("/login");
    },
    toggleReasons() { sheet.showReturnRequestList = !sheet.showReturnRequestList; renderSheet(); },
    selectReason(arg) {
      const list = sheet.type === 10004 ? sheet.wholeOrderReturns : sheet.reasons;
      list.forEach((r) => { r.isSelected = false; });
      // the template always renders wholeOrderReturns
      const r = sheet.wholeOrderReturns.find((x) => String(x.id) === String(arg));
      r.isSelected = true;
      sheet.selectedReason = r;
      sheet.isSelectedReason = true;
      sheet.form.reasonId = r.id;
      sheet.showReturnRequestList = false;
      renderSheet();
    },
    submit() {
      sheet.touched.reasonId = true;
      sheet.touched.returnQuantity = true;
      const q = sheet.form.returnQuantity;
      const qtyRequired = q === "" || q === null;
      const qtyMin = !qtyRequired && Number(q) < 1;
      const invalid = !sheet.form.reasonId || qtyRequired || qtyMin;
      renderSheet();
      if (invalid) {
        if (!sheet.selectedReason) { showWarning("Warning", "Please select a reason"); return; }
        if (qtyRequired) { showWarning("Warning", "Please enter return quantity"); return; }
        if (qtyMin) { showWarning("Warning", "Return quantity cannot be negative"); return; }
        return;
      }
      const qty = parseInt(String(q), 10);
      if (qty > sheet.returnQuantity) { showWarning("Warning", "Return quantity cannot be greater than ordered quantity"); return; }
      closeBottomSheet({ qty, name: sheet.selectedReason.code });
    },
    submitWhole() {
      if (!sheet.selectedReason) { showWarning("Warning", "Please select a reason"); return; }
      closeBottomSheet({ name: sheet.selectedReason.code });
    },
    otpSubmit() {
      const otp = sheet.otpInput;
      if (!otp) { showWarning("Warning", "Please enter OTP"); return; }
      if (sheet.otpNumber != otp) { showWarning("Warning", "Invalid OTP"); return; }
      closeBottomSheet(true);
    },
    pendingNo() { closeBottomSheet(false); },
    pendingYes() { closeBottomSheet(true); },
    async sendOtp() {
      try {
        const res = await API.sendRetailerOrderOtp(sheet.retailerOrderOtp);
        const r = sheet.retailerOrderOtp[0];
        panelEvent("sms", { to: r.mobileNumber, text: `Dear ${r.retailerName}, your Qwipo delivery OTP is ${r.otp}. Share it with the delivery partner only after receiving your order.` });
        closeBottomSheet({ isOtpSent: res });
      } catch (e) {
        closeBottomSheet({ isOtpSent: false });
      }
    },
  };

  // ================================================================ shared components
  function footerBar(sel) {
    const item = (n, on, off, label, tap) => `<div class="item ${sel === n ? "c-black" : ""}" data-tap="${tap}"><img src="${IMG}redesign/${sel === n ? on : off}" alt=""><div class="lbl wrap">${label}</div></div>`;
    return `<div class="footer">${item(1, "deliverytruck-black-icon.svg", "deliverytruck-icon.svg", "Trips", "footerTrips")}${item(2, "hopfooter.svg", "hopfooterdark.svg", "Hops", "footerHops")}${item(3, "account-black-icon.svg", "account-icon.svg", "My Account", "footerAccount")}</div>`;
  }
  function subFooter(sel) {
    return `<div class="subfooter">
      <div class="item ${sel === 6 ? "c-black" : ""}" data-tap="subHome">${L("&#xf015;", `fas s20 tc ax-c ${sel != 8 ? "c-black" : "c-grey"}`)}${W("Home", "ff-file s10")}</div>
      <div class="item ${sel === 8 ? "c-black" : ""}" data-tap="subAccount">${L("&#xf2bd;", `fas s20 tc ax-c ${sel === 8 ? "c-black" : "c-grey"}`)}${W("My Account", "ff-file s10 ax-c")}</div>
    </div>`;
  }
  function backHeader(title, tap) {
    return `<div class="row p-2" style="flex:none" data-tap="${tap}">${L("&#xf053;", "back-arrow")}${L(title, "title shrink")}</div>`;
  }
  function pageLoading() {
    return `<div class="fill center-box">${spinner("", "width:50px")}${L("Loading....", "tc w500 s14 pl-3")}</div>`;
  }
  function blockLoading() {
    return `<div class="fill center-box"><div class="col center-box" style="height:100px">${spinner()}${L("Loading....", "tc")}</div></div>`;
  }
  // noservice.png at h-[30%] w-[40%]: NativeScript takes 30% of the height left in the parent
  // after the wrapper's mt-5, so the image box is measured against this container (cqh)
  function emptyState(message, centered) {
    return `<div class="col fill" style="container-type:size;${centered ? "justify-content:center" : ""}"><div class="col mt-5 ax-c" style="width:100%;align-items:center">
      <img src="${IMG}noservice.png" style="width:40%;height:calc((100cqh - 20.19px) * 0.3);object-fit:contain;flex:none">
      ${W(message, "c-black s16 mt-2 w500 tc")}</div></div>`;
  }
  // label column / value column rows used in all detail cards
  // NativeScript resolves w-[N%] against the parent's full width (padding included),
  // and the last child of a horizontal StackLayout is squeezed into the space that is left.
  const pct = (p, pad = 16) => `width:calc((100% + ${pad}px) * ${p});`;
  const CLAMP = "flex:0 1 auto;min-width:0;";
  const kvDirect = (labels, values, lp, vp) => `<div class="col" style="${pct(lp)}">${labels.map((l) => W(l, "c-secondary s14 w500 pt-1")).join("")}</div><div class="col" style="${pct(vp)}${CLAMP}">${values.map((v) => L(v, "s14 c-black w500 pt-1 ax-r")).join("")}</div>`;
  const kv = (labels, values, lw = "w50p", vw = "w50p") => `<div class="row" style="width:100%"><div class="col ${lw}">${labels.map((l) => W(l, "c-secondary s14 w500 pt-1")).join("")}</div><div class="col ${vw}">${values.map((v) => L(v, "s14 c-black w500 pt-1 ax-r")).join("")}</div></div>`;

  // ================================================================ SCREENS
  const SCREENS = {};

  // ---------------- pages/auth/login
  SCREENS["/login"] = {
    async init(v, alive) {
      v.showLoading = true;
      render();
      const loggedInUser = userService.loggedInUser();
      if (loggedInUser) {
        const dp = await API.getDeliveryPartner(loggedInUser);
        if (!alive()) return;
        await navigateAfterVerification(v, dp ? mapDeliveryPartner(dp) : null, alive);
      } else {
        navigate("/mobile-number-component");
      }
    },
    render(v) {
      if (!v.showLoading) return "";
      return `<div class="page"><div class="fill col bg-accent">${pageLoading()}</div></div>`;
    },
  };
  async function navigateAfterVerification(v, dp, alive) {
    try {
      const appSettings = await API.getAppSettings(device.outdated);
      if (!alive()) return;
      appState.appSettings = appSettings;
      appState.deviceAppVersion = APP_VERSION;
      const min = (appSettings && appSettings.appMinVersion && appSettings.appMinVersion.android) || "1.0.0";
      const isOldVersion = semverGte(APP_VERSION, min);
      userService.setLoggedInNumber(dp.phone);
      appState.deliveryPartner = dp;
      if (!isOldVersion) { v.showLoading = false; navigate("/app-version-check"); return; }
      if (dp.status == "active") {
        await navigateActiveDeliveryPartner(dp, alive);
      } else {
        v.showLoading = false;
        navigate("/greeting");
      }
    } catch (e) {
      v.showLoading = false;
      navigate("/mobile-number-component");
    }
  }
  async function navigateActiveDeliveryPartner(dp, alive) {
    let r = "/trip-list";
    const cache = await returnRepository.getAllReturns();
    if (cache.length > 0) {
      const hopData = await API.getHopsByHopId(cache[0].hopId);
      if (!alive()) return;
      if (hopData != null && hopData[0]) {
        if (hopData[0].status === HopStatus.Created) {
          appState.hop = hopData[0];
          appState.tripId = hopData[0].tripId;
          r = "/hops";
        }
      }
    } else if (dp.deliveryPartnerType === "Driver" || dp.deliveryPartnerType === "Helper") {
      r = "/hop-list";
    }
    navigate(r);
  }

  // ---------------- pages/auth/mobile-number
  SCREENS["/mobile-number-component"] = {
    init(v) { v.text = ""; v.enable = false; },
    render(v) {
      const t = v.text || "";
      const valid = isValidMobileNumber(t);
      return `<div class="page bg-white">
        <div class="col" style="height:70%;flex:none"><div class="col mx-2 p-2" style="height:70%;overflow:hidden">
          <img class="ax-c" src="${IMG}qwipo-bg.png" style="width:90px;height:60px;object-fit:contain;flex:none">
          ${W("Enter mobile number", "c-black ff-file fake-bold s16 mt-10 pl-3")}
          <div class="cell bg-search border-1-grey pl-4 mt-2" style="flex:none">
            ${W("Mobile number", "s12 c-muted pt-2 ay-t")}
            <div class="pt-5" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto">
              <div class="row mt-1">${L("+91", "c-black s14 bg-search ay-c")}</div>
              <div class="col mt-1" style="justify-content:center"><input class="tf c-black s14 bg-search" style="padding-left:8px" inputmode="numeric" maxlength="10" data-input="mobile" data-fk="mobile" value="${esc(t)}" autocomplete="off"></div>
              <div class="row mt-1 mr-3" style="align-items:center">${L("IND", "c-black s14 bg-search")}${L("&#xf054;", "c-black fas s16 pl-1")}</div>
            </div>
          </div>
          <div class="col" style="flex:none">
            ${L((t.length || 0) + "/10", "s14 c-secondary pt-2 pl-5")}
            ${t && !valid ? `<div class="lbl wrap pt-5 pl-2 s14">Please enter valid 10-digit phone number.<span class="fas">&#xf05a;</span></div>` : ""}
          </div>
        </div></div>
        <div class="col" style="height:30%;flex:none">
          <div class="col ax-c">${L("By proceeding, you are agreeing to Qwipo's", "s14 c-secondary pt-5 tc")}${L("Terms & Conditions", "s14 c-black pt-2 w700 tc", 'data-tap="openTerms"')}</div>
          <div class="col" style="height:60px;flex:none;justify-content:flex-end"><div class="nbtn ${v.enable ? "p2" : "s2"} mt-5" style="height:48px;min-height:48px" ${v.enable ? 'data-tap="sendOtp"' : ""}>Continue</div></div>
        </div>
      </div>`;
    },
  };

  // ---------------- pages/auth/mobile-otp
  SCREENS["/mobile-otp-component"] = {
    init(v, alive) {
      v.fields = ["", "", "", "", "", ""];
      v.otpDigits = ["", "", "", "", "", ""];
      v.enable = false;
      v.timer = 30;
      v.done = false;
      v.number = appState.loginMobileNumber;
      startOtpTimer(v, alive);
      setTimeout(() => { if (alive()) focusOtp(0); }, 50);
    },
    render(v) {
      const box = (i) => `<input class="otp-box ${i === 1 ? "sq" : ""}" inputmode="numeric" maxlength="1" placeholder="0" data-input="otp" data-arg="${i}" data-fk="otp${i}" value="${esc(v.fields[i])}" autocomplete="one-time-code">`;
      return `<div class="page bg-white">
        <div class="col" style="height:70%;flex:none"><div class="col mx-2 p-2" style="height:70%;overflow:hidden">
          <img class="ax-c" src="${IMG}qwipo-bg.png" style="width:90px;height:60px;object-fit:contain;flex:none">
          ${W("Enter 6-digit OTP", "c-black ff-file fake-bold s16 mt-10 pl-3")}
          <div class="col px-3" style="flex:none">
            <div style="padding-top:23px;display:grid;grid-template-columns:1fr 5px 1fr 5px 1fr 5px 1fr 5px 1fr 5px 1fr">
              ${box(0)}<span></span>${box(1)}<span></span>${box(2)}<span></span>${box(3)}<span></span>${box(4)}<span></span>${box(5)}
            </div>
            <div class="col ax-c" style="padding-top:21.2px">${W("00:" + String(v.timer).padStart(2, "0"), "s14", "data-otp-timer")}</div>
            <div class="row between" style="padding-top:19.4px">
              ${W("Resend OTP", `s14 ff-file ${v.done ? "c-black" : "c-secondary"}`, `data-tap="resendOtp" data-otp-resend style="${v.done ? "" : "opacity:.25"}"`)}
              <div class="row" style="align-items:flex-start">${v.number ? W(v.number, "s14 c-secondary mr-2") : ""}<img src="${IMG}redesign/Edit.png" style="width:16px;height:16px" data-tap="editNumber"></div>
            </div>
          </div>
        </div></div>
        <div class="col" style="height:30%;flex:none">
          <div class="col ax-c">${L("By proceeding, you are agreeing to Qwipo's", "s14 c-secondary pt-5 tc")}${L("Terms & Conditions", "s14 c-black pt-2 w700 tc", 'data-tap="openTerms"')}</div>
          <div class="col" style="height:60px;flex:none;justify-content:flex-end"><div class="nbtn ${v.enable ? "p2" : "s2"} mt-5" style="height:48px;min-height:48px" ${v.enable ? 'data-tap="verifyOtp"' : ""}>Continue</div></div>
        </div>
      </div>`;
    },
  };
  function startOtpTimer(v, alive) {
    const id = setInterval(() => {
      if (!alive()) { clearInterval(id); return; }
      v.timer--;
      if (v.timer <= 0) { v.done = true; clearInterval(id); }
      // update just the countdown and the Resend OTP state (no full re-render)
      const t = screenEl.querySelector("[data-otp-timer]");
      if (t) t.textContent = "00:" + String(v.timer).padStart(2, "0");
      const r = screenEl.querySelector("[data-otp-resend]");
      if (r) {
        r.classList.toggle("c-black", v.done);
        r.classList.toggle("c-secondary", !v.done);
        r.style.opacity = v.done ? "" : ".25";
      }
    }, 1000);
    timers.push(id);
  }
  function focusOtp(i) {
    const el = screenEl.querySelector(`[data-fk="otp${i}"]`);
    if (el) el.focus({ preventScroll: true });
  }

  // ---------------- pages/auth/app-version-check
  SCREENS["/app-version-check"] = {
    init() { appState.subFooter = true; },
    render() {
      return `<div class="page">
        <div class="fill col"><div class="col bg-white" style="height:95%">
          <img class="ax-c mt-5" src="${IMG}qwipo-bg.png" style="width:90px;height:40px;object-fit:contain;flex:none">
          <div class="col ax-c" style="width:300px;height:300px;flex:none"><img src="${IMG}update_img.png" style="width:100%;height:100%;object-fit:contain" alt=""></div>
          <div class="col ax-c">
            ${L(" We have an update! ", "w700 s24 pt-2 pl-5 c-black ff-file fake-bold", 'style="white-space:pre"')}
            <div class="col ax-c">
              ${L(" Our current mobile app has been", "w700 pt-3 ff-file fake-bold pl-5", 'style="white-space:pre"')}
              ${L(" revamped with new exiting/ additional  ", "w700 ff-file fake-bold pt-1", 'style="white-space:pre"')}
              ${L(" features. ", "w700 ff-file fake-bold pl-20 pt-1", 'style="white-space:pre"')}
            </div>
          </div>
          <div class="col ax-c mt-20" style="width:100%"><div class="gbtn p3" style="height:50px" data-tap="playStore">${L("Update", "s14")}</div></div>
        </div></div>
        ${subFooter(7)}
      </div>`;
    },
  };

  // ---------------- pages/auth/greeting
  SCREENS["/greeting"] = {
    init(v) {
      appState.subFooter = true;
      v.number = appState.appSettings && appState.appSettings.contact ? appState.appSettings.contact.number : undefined;
      v.dp = appState.deliveryPartner;
    },
    render(v) {
      const line = (t, extra = "") => L(t, `s18 c-black ff-file tc pt-1 ${extra}`);
      return `<div class="page">
        <div class="fill col bg-white">
          <img class="ax-c mt-5" src="${IMG}qwipo-bg.png" style="width:90px;height:60px;object-fit:contain;flex:none">
          <div class="col ax-c pt-10">${L("&#xf164;", "c-black fas s50 pt-5 tc")}</div>
          <div class="col ax-c pt-2">
            ${L("Thank You", "s18 c-black ff-file tc pt-5")}
            ${L(v.dp && v.dp.name, "s18 w800 c-black tc pt-1")}
            ${line("for signing up with us.")}
            ${line("Our Representative will get")}
            ${line("in touch with you shortly.")}
            ${L("We are reachable at", "s18 c-black ff-file tc mt-10")}
            ${L(v.number, "s18 c-black w800 tc pt-1", `data-tap="dial" data-arg="${esc(v.number)}"`)}
            ${line("for any questions in the meantime")}
          </div>
        </div>
        ${subFooter(7)}
      </div>`;
    },
  };

  // ---------------- pages/account/my-info
  SCREENS["/my-info"] = {
    init(v) {
      v.name = (appState.deliveryPartner && appState.deliveryPartner.name) || "Not Avaliable";
      v.mobile = (appState.deliveryPartner && appState.deliveryPartner.phone) || "Not Avaliable";
      v.subFooter = appState.subFooter;
    },
    render(v) {
      return `<div class="page">
        <div class="fill col bg-search"><div class="fill col px-4">
          <div class="col pt-2 ax-l" style="flex:none"><div class="bg-search"><img src="${IMG}redesign/qwipologo.svg" style="width:70px;height:70px"></div></div>
          <div class="fill col">
            <div class="pt-2 pl-2 pb-2" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto 5px;grid-template-rows:2px auto">
              <div class="bg-white rfull p-2" style="grid-row:2;grid-column:1;align-self:center"><img src="${IMG}redesign/blank-image.jpg" class="rfull" style="width:50px;height:50px;object-fit:cover"></div>
              <div class="col pl-5 pt-2 pb-2" style="grid-row:2;grid-column:2;align-self:center" data-tap="profile">${W(v.name, "c-black s20 w500")}${L(v.mobile, "c-secondary s16")}</div>
              <div style="grid-row:2;grid-column:3;align-self:center">${L(" &#xf054;", "c-black fas s20", 'style="white-space:pre"')}</div>
            </div>
          </div>
          <div class="col" style="flex:none">
            <div class="col pl-4">${L("Contact Us", "s14 c-black mb-2", 'data-tap="contactUs"')}</div>
            <div class="col pl-4" data-tap="terms">${L("Terms & Conditions", "s14 c-black mb-2")}</div>
            <div class="col pl-4 pb-1" data-tap="logout"><div class="row"><img src="${IMG}redesign/logout.svg" style="width:24px;height:24px">${L("Logout", "mb-1 s14 c-danger pl-2")}</div></div>
          </div>
        </div></div>
        ${v.subFooter ? subFooter(8) : footerBar(3)}
      </div>`;
    },
  };

  // ---------------- pages/account/profile
  SCREENS["/profile"] = {
    init(v) { v.dp = appState.deliveryPartner || {}; v.version = appState.deviceAppVersion; },
    render(v) {
      const card = (label, value) => `<div class="col p-4 border-1-grey bg-white" style="flex:none">${L(label, "s12 c-muted")}${L(value, "py-1 pt-2 s14 c-black")}</div>`;
      return `<div class="page bg-search">
        <div class="col" style="flex:none">
          ${backHeader("Profile", "myInfo")}
          <div class="col m-5 center-box"><img src="${IMG}redesign/blank-image.jpg" class="rfull" style="width:120px;height:120px;object-fit:cover"></div>
        </div>
        <div class="fill col p-5">
          ${card("Name", v.dp.name)}<div style="height:10px;flex:none"></div>
          ${card("Mobile Number", v.dp.phone)}<div style="height:10px;flex:none"></div>
          ${card("Email Id", v.dp.email)}
        </div>
        <div class="col" style="height:50px;flex:none;justify-content:flex-end;align-items:center">${L("v " + (v.version || ""), "s12 c-muted p-2")}</div>
      </div>`;
    },
  };

  // ---------------- pages/account/contact-us
  SCREENS["/contact-us"] = {
    init(v) {
      const c = appState.appSettings && appState.appSettings.contact;
      v.email = (c && c.email) || "info@qwipo.com";
      v.number = (c && c.number) || "";
    },
    render(v) {
      // the rows' container has space-y-2 (8 dp between rows); the logos' row has space-x-2
      const row = (icon, title, value, tapAttr = "", first = false) => `<div class="row ml-4 border-top p-2" style="align-items:center;${first ? "" : "margin-top:8px"}">
          <div class="bg-white rfull p-4" style="width:50px;height:50px;display:flex;justify-content:center;align-items:center;flex:none"><img src="${IMG}redesign/icons/${icon}.svg" style="width:20px;height:20px;background:#fff"></div>
          <div class="col ml-4" style="flex:1;min-width:0">${L(title, "s14 c-black")}${L(value, "s16 pt-1 w600 c-black", tapAttr)}</div>
        </div>`;
      return `<div class="page bg-search">
        ${backHeader("Contact Us", "back")}
        <div class="col mt-4 ml-4" style="flex:none">${L("If you have any query or need any further help", "s14 ff-file w600 c-gray400")}</div>
        <div class="col ax-c" style="width:250px;height:250px;flex:none"><img src="${IMG}Contactus_mid.png" style="width:100%;height:100%;object-fit:contain" alt=""></div>
        <div class="row ml-4" style="align-items:center;flex:none"><img src="${IMG}Contact_Qwipo_Logo_top.png" style="width:48px;height:48px;object-fit:contain"><img src="${IMG}Contact_Qwipo_Logo_bg.png" style="width:48px;height:48px;object-fit:contain;margin-left:8px"></div>
        <div class="fill col mt-4">
          ${row("clock", "Office Timing", "09:00 AM to 6:00 PM - IST", "", true)}
          ${row("email", "Email Address", v.email)}
          ${row("mobile", "Customer Care Number", v.number, `data-tap="dial" data-arg="${esc(v.number)}"`)}
        </div>
      </div>`;
    },
  };

  // ---------------- pages/account/web-view
  SCREENS["/web-view"] = {
    init(v, alive, q) {
      v.title = "QWIPO";
      v.src = "";
      if (q && q.srcId) {
        v.title = q.title || "";
        v.src = q.longUrl ? q.longUrl : `https://qwipo.com/${q.webUrl}`;
      } else if (q) {
        v.src = `${q.webUrl}`;
      }
    },
    render(v) {
      return `<div class="page">
        <div class="actionbar"><div class="nav" data-tap="webBack"><svg width="28" height="28" viewBox="0 0 28 28"><path d="M3 14 L13 4.5 V10 H25 V18 H13 V23.5 Z" fill="#fff" stroke="#8a8a8a" stroke-width="1.3" stroke-linejoin="round"/></svg></div>${L(v.title, "s14 tc", 'style="position:absolute;left:0;right:0;pointer-events:none"')}</div>
        <div class="fill col p-5"><div class="fill relative">${v.src ? `<iframe src="${esc(v.src)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff" referrerpolicy="no-referrer"></iframe>` : ""}</div></div>
      </div>`;
    },
  };

  // ---------------- pages/components/trip/trip-list
  SCREENS["/trip-list"] = {
    async init(v, alive) {
      v.isLoading = true;
      v.tripList = [];
      render();
      const dp = appState.deliveryPartner;
      let list = [];
      try {
        const res = await API.getTripList({ startDate: "", endDate: "", tripId: [], statusId: [], pageNumber: 1, pageSize: 50, deliveryPartnerId: dp.id, deliveryPartnerMobileNumber: "" });
        if (res && res.length > 0) {
          const pr = (s) => (s === TripStatus.CREATED ? 2 : s === TripStatus.COMPLETED ? 3 : s === TripStatus.IN_PROGRESS ? 1 : 4);
          list = res.map(mapTrip).sort((a, b) => pr(a.status) - pr(b.status) || new Date(b.creationDate) - new Date(a.creationDate));
        }
      } catch (e) { list = []; }
      if (!alive()) return;
      v.tripList = list;
      v.isLoading = false;
      render();
    },
    render(v) {
      let body;
      if (v.isLoading) body = blockLoading();
      else if (v.tripList.length > 0) {
        body = `<div class="fill col bg-search">
          <div class="row p-2" style="flex:none"><img src="${IMG}qwipo-bg.png" style="width:90px;height:41px;object-fit:contain"></div>
          <div class="fill scroll mt-2" data-sk="trips">${v.tripList.map(tripCard).join("")}</div>
        </div>`;
      } else body = emptyState("No Trips found", true);
      return `<div class="page"><div class="fill col">${body}</div>${footerBar(1)}</div>`;
    },
  };
  function mapTrip(t) {
    const n = (x) => x || "N/A";
    return {
      logisticsOrderId: n(t.orderId), tripId: n(t.tripId), tripCode: n(t.tripCode), status: n(t.status), creationDate: n(t.creationDate),
      totalWeightKg: +t.totalWeightKg || 0, pickupHops: +t.pickupHops || 0, deliveryHops: +t.deliveryHops || 0, returnHops: +t.returnHops || 0,
      vehicleType: n(t.vehicleType), vehicleRegistrationNumber: n(t.vehicleRegistrationNumber), driver: n(t.driver), phone: n(t.phone),
      helperName: n(t.helperName), helperPhone: n(t.helperPhone),
    };
  }
  function tripCard(t) {
    const g = (l) => W(l, "c-secondary s14 w500 pt-1");
    const val = (x) => L(x, "s14 c-black w500 pt-1 ax-r");
    const vall = (x) => L(x, "s14 c-black w500 pt-1");
    return `<div class="col px-2"><div class="col bg-white m-2 r16" style="margin-bottom:8px">
      <div class="row p-2">
        <div class="ay-c bg-search p-2 rfull"><img src="${IMG}redesign/deliverytruck-black-icon.svg" style="width:30.1px;height:30.1px"></div>
        <div class="col ay-c" style="${pct(0.65)}">${W(t.tripCode, "s14 tc c-black w500")}</div>
        <div class="pill-blue ay-c vmid tc" style="height:40px;${pct(0.2)}${CLAMP}" data-tap="tripDetails" data-arg="${esc(t.tripId)}">${L("Details", "c-white s12 w500 tc", 'style="width:100%"')}</div>
      </div>
      <div class="row p-2 border-top-grey">
        <div class="col" style="${pct(0.4)}">${["Order Number", "Driver", "Driver Number", "Helper", "Helper Number", "Weight", "Type", "Vehicle Number"].map(g).join("")}</div>
        <div class="col" style="${pct(0.6)}${CLAMP}">${[t.logisticsOrderId, t.driver, t.phone, t.helperName, t.helperPhone, weightPipe(t.totalWeightKg), t.vehicleType, t.vehicleRegistrationNumber].map(val).join("")}</div>
      </div>
      <div class="row p-2 border-top-grey">
        <div class="row" style="${pct(0.5)}"><div class="col w50p">${g("Pickups")}${g("Deliveries")}</div><div class="col w50p">${vall(t.pickupHops)}${vall(t.deliveryHops)}</div></div>
        <div class="row" style="${pct(0.5)}${CLAMP}"><div class="col w50p">${g("Returns")}${g("Status")}</div><div class="col w50p">${vall(t.returnHops)}${vall(t.status)}</div></div>
      </div>
    </div></div>`;
  }

  // ---------------- pages/components/trip/trips (Summary | Hops)
  SCREENS["/trips"] = {
    init(v) {
      v.isHopsActive = true;
      v.isTripSummaryActive = false;
      if (appState.isNavigatedFrom === NavigatedFrom.Trip && appState.isHopDetailsPage) {
        appState.isHopDetailsPage = false;
        tripsShowHops(v, true);
      } else {
        tripsShowSummary(v, true);
      }
    },
    render(v) {
      return `<div class="page bg-search">
        <div class="row p-2" style="flex:none" data-tap="tripsBack">${L("&#xf053;", "back-arrow")}${v.isTripSummaryActive ? L("Trip Summary", "title") : ""}${v.isHopsActive ? L("Hops List", "title") : ""}</div>
        <div class="row p-2 tabs-row" style="flex:none">
          <div class="tab w50p ${v.isTripSummaryActive ? "on" : "off"}" data-tap="tripsSummaryTab">${L("Summary", "tc s16")}</div>
          <div class="tab w50p ${v.isHopsActive ? "on" : "off"}" data-tap="tripsHopsTab">${L("Hops", "tc s16")}</div>
        </div>
        <div class="fill col mt-2">${v.isTripSummaryActive && v.summary ? tripSummaryRender(v.summary) : ""}${v.isHopsActive && v.hopList ? hopListRender(v.hopList, true) : ""}</div>
      </div>`;
    },
  };
  function tripsShowSummary(v, force) {
    const was = v.isTripSummaryActive;
    v.isHopsActive = false;
    v.isTripSummaryActive = true;
    v.hopList = null;
    if (!was || force) mount(v, "summary", { isLoading: true, tripSummary: null, hops: [], vendorRangeLimit: 0 }, tripSummaryInit);
    render();
  }
  function tripsShowHops(v, force) {
    const was = v.isHopsActive && v.hopList;
    v.isHopsActive = true;
    v.isTripSummaryActive = false;
    v.summary = null;
    if (!was || force) mount(v, "hopList", { isLoading: true, hopList: [], mainHopList: [], searchText: "" }, hopListInit);
    render();
  }

  // trip-summary.component
  async function tripSummaryInit(c, alive) {
    c.isLoading = true;
    render();
    try {
      const res = await API.getTripSummaryByTripId(appState.tripId);
      if (!alive()) return;
      c.tripSummary = res.length === 0 ? null : mapTripSummary(res[0]);
      if (c.tripSummary) {
        c.hops = (await API.getHopsByFilters({ tripId: c.tripSummary.tripId, pageNumber: 1, pageSize: 50, deliveryPartnerId: "" })).map(mapHop);
        c.vendorRangeLimit = (appState.appSettings && appState.appSettings.tripRangeLimit) || 150;
      }
    } finally {
      if (alive()) { c.isLoading = false; render(); }
    }
  }
  function mapTripSummary(t) {
    const n = (x) => x || "N/A";
    return {
      logisticsOrderId: n(t.orderId), tripId: n(t.tripId), tripCode: n(t.tripCode), status: n(t.status), totalWeight: +t.totalWeight || 0,
      products: +t.products || 0, pickups: +t.pickups || 0, deliveries: +t.deliveries || 0, returns: +t.returns || 0, isHopsCompleted: t.isHopsCompleted || false,
    };
  }
  function tripSummaryRender(c) {
    if (c.isLoading) return pageLoading();
    const ts = c.tripSummary;
    let btn = "";
    if (ts) {
      if (ts.status == "Created") btn = `<div class="gbtn p3" style="height:50px" data-tap="changeTripStatus">${L("Start", "s14")}</div>`;
      else if (ts.status == "InProgress") btn = `<div class="gbtn p3" style="height:50px" data-tap="changeTripStatus">${L("In-Progress", "s14")}</div>`;
      else if (ts.status == "Completed") btn = `<div class="gbtn s2" style="height:50px;margin-top:auto">${L("Trip Completed", "s14")}</div>`;
    }
    return `<div class="fill col">
      <div class="fill col px-2"><div class="col bg-white m-2 r16" style="flex:none">
        <div class="p-2">${W("Trip Details", "c-black s16 w500")}</div>
        ${ts ? `<div class="row p-2 border-top-grey">${kv(["Trip Number", "Order Number", "Pickups", "Returns", "Weight (Kgs)", "Deliveries", "Products"], [ts.tripCode, ts.logisticsOrderId, ts.pickups, ts.returns, weightPipe(ts.totalWeight), ts.deliveries, ts.products])}</div>` : ""}
      </div></div>
      ${ts ? `<div class="col mb-30" style="height:70px;flex:none">${btn}</div>` : ""}
    </div>`;
  }
  async function changeTripStatus() {
    const c = view.summary;
    if (!c || !c.tripSummary) return;
    const tripId = c.tripSummary.tripId;
    const status = c.tripSummary.status;
    try {
      c.isLoading = true;
      render();
      const { lat, long, isMockLocation, isEnableLocation } = await getCurrentLocation();
      if (!isEnableLocation) { c.isLoading = false; render(); showWarning("Location is disabled", "Please enable location to change trip status", "OK"); return; }
      if (isMockLocation) { c.isLoading = false; render(); showWarning("Mock location is enabled", "Please disable mock location to change trip status", "OK"); return; }
      const pickUpHop = c.hops.filter((h) => h.pointMode == PointMode.PICKUP && h.pointType == PointType.VENDOR)[0];
      const returnHop = c.hops.filter((h) => h.pointMode == PointMode.RETURN && h.pointType == PointType.VENDOR)[0];
      const d = calculateDistance(+(pickUpHop && pickUpHop.pointLat), +(pickUpHop && pickUpHop.pointLng), lat, long);
      if (status == TripStatus.CREATED) {
        if (d > c.vendorRangeLimit) {
          c.isLoading = false; render();
          showWarning("Oya...!", `You must be at the vendor’s pickup location to start this trip.Please go to a shop nearby, within ${c.vendorRangeLimit} meters`, "Okay");
          return;
        }
      } else if (status == TripStatus.IN_PROGRESS) {
        if (d > c.vendorRangeLimit && returnHop) {
          c.isLoading = false; render();
          showWarning("Oya...!", `You must be at the vendor’s location to start a return trip.Please go to a shop nearby, within ${c.vendorRangeLimit} meters`, "Okay");
          return;
        }
        if (d > c.vendorRangeLimit) {
          c.isLoading = false; render();
          showWarning("Oya...!", `You must be at the vendor’s pickup location to start this trip. Please go to a shop nearby, within ${c.vendorRangeLimit} meters`, "Okay");
          return;
        }
      }
      const next = { Created: "InProgress", InProgress: "Completed" }[status];
      if (!next) { c.isLoading = false; render(); return; }
      if (next == TripStatus.COMPLETED && !c.tripSummary.isHopsCompleted) {
        c.isLoading = false; render();
        showWarning("Warning", "All Hops are not completed, Please try again later", "OK");
        return;
      }
      const ok = await API.updateTripStatus({ tripId, status: next, latitude: +lat, longitude: +long, deliveryPartnerId: appState.deliveryPartner.id });
      if (ok && c.tripSummary) {
        c.tripSummary.status = next;
        c.isLoading = false;
        showSuccess("Success", `Trip is ${next === TripStatus.IN_PROGRESS ? "in-progress" : "completed"}`, "Ok");
        navigate("/trip-list");
      } else {
        c.isLoading = false; render();
        showWarning("Something Went Wrong !", "Please try after sometime.", "OK");
      }
    } catch (e) {
      c.isLoading = false; render();
      showWarning("Something Went Wrong !", "Please try after sometime.", "OK");
    }
  }

  // ---------------- pages/components/hop/hop-list (page + embedded in trips)
  SCREENS["/hop-list"] = {
    init(v) { mount(v, "hopList", { isLoading: true, hopList: [], mainHopList: [], searchText: "" }, hopListInit); },
    render(v) { return `<div class="page">${hopListRender(v.hopList, false)}</div>`; },
  };
  function mapHop(h) {
    return {
      id: h.id, tripId: h.tripId, hopType: h.hopType, pointName: h.pointName, pointPhone: h.pointPhone, pointLat: h.pointLat, pointLng: h.pointLng,
      pointMode: h.pointMode, pointType: h.pointType, status: h.status, stopNumber: h.stopNumber, pointAddress: h.pointAddress,
      pointPincode: h.pointPincode, fulfillmentId: h.fulfillmentId, otp: h.otp,
    };
  }
  function sortHops(list) {
    const pr = { InProgress: 1, Created: 2, Completed: 3 };
    return list.sort((a, b) => ((pr[a.status] || 4) - (pr[b.status] || 4)) || (Number(a.stopNumber) - Number(b.stopNumber)));
  }
  async function hopListInit(c, alive) {
    c.isLoading = true;
    render();
    const payload = {
      tripId: appState.isNavigatedFrom === NavigatedFrom.Trip ? appState.tripId : "",
      deliveryPartnerId: appState.isNavigatedFrom === NavigatedFrom.Non_Trip ? appState.deliveryPartner.id : "",
      pageNumber: 1, pageSize: 50,
    };
    let list = [];
    try { list = sortHops((await API.getHopsByFilters(payload)).map(mapHop)); } catch (e) { list = []; }
    if (!alive()) return;
    c.hopList = c.mainHopList = list;
    c.isLoading = false;
    render();
  }
  function hopListRender(c, embedded) {
    if (!c) return "";
    let body;
    if (c.isLoading) body = blockLoading();
    else if (c.mainHopList && c.mainHopList.length > 0) {
      body = `<div class="fill col">
        <div class="w98p px-2 ax-c" style="flex:none">
          <div class="bg-white r20" style="height:50px;display:grid;grid-template-columns:minmax(0,1fr) 50px">
            <div class="row pl-2 pt-2 pb-2" style="min-width:0">${L("&#xf002;", "fas s16 c-secondary")}<input class="tf s14 ml-2 c-black w800" style="padding:0;flex:1;min-width:0" placeholder="Search with Customer Name or MobileNumber" data-input="hopSearch" data-fk="hopSearch" value="${esc(c.searchText)}" autocomplete="off"></div>
            ${c.searchText && c.searchText.length > 0 ? `<div class="col" style="justify-content:center;align-items:flex-end" data-tap="clearSearch">${L("&#xf057;", "fas s14 c-black tr mr-2")}</div>` : "<div></div>"}
          </div>
        </div>
        ${c.hopList.length > 0 ? `<div class="fill scroll mt-2" data-sk="hoplist">${c.hopList.map(hopCard).join("")}</div>` : ""}
        ${!c.hopList || c.hopList.length === 0 ? emptyState("No matching customers found", false) : ""}
      </div>`;
    } else body = emptyState("No active hops found. Please go to trips list page.", false);
    // the GridLayout (rows="*") inside the bg-searchBg StackLayout stretches, so the
    // component fills its slot in both the Hops page and the Trips "Hops" tab
    return `<div class="fill col"><div class="fill col bg-search"><div class="fill col mt-5">${body}</div></div>${footerBar(2)}</div>`;
  }
  function hopCard(h) {
    const mode = `${pointModeLabel(h.pointMode)} ${concatenateLabel(h.pointMode)} ${pointTypeLabel(h.pointType)}`;
    return `<div class="col p-2"><div class="col bg-white m-2 r16" style="margin-bottom:8px">
      <div class="row p-2">
        <div class="ay-c bg-search p-2 rfull"><img src="${IMG}redesign/deliverytruck-black-icon.svg" style="width:30.1px;height:30.1px"></div>
        <div class="col pl-2 ay-c" style="${pct(0.65)}">${W(h.pointName, "s14 c-black w500")}${L("+91" + h.pointPhone, "c-black s14 pt-1", `data-tap="dial" data-arg="${esc(h.pointPhone)}"`)}</div>
        <div class="pill-blue ay-c vmid tc" style="height:40px;${pct(0.2)}${CLAMP}" data-tap="viewHop" data-arg="${esc(h.id)}">${L("View", "c-white s12 w500 tc", 'style="width:100%"')}</div>
      </div>
      <div class="row p-2 border-top-grey"><div style="display:grid;grid-template-columns:minmax(0,1fr) 75px;width:100%">
        <div class="col ay-c">${L("Address", "s14 c-black w500")}${W(h.pointAddress, "c-black s14 pt-1")}</div>
        <div class="ay-c" data-tap="openMap" data-arg="${esc(h.pointLat)},${esc(h.pointLng)}"><img src="${IMG}redesign/Map.svg" style="width:50px;height:50px"></div>
      </div></div>
      <div class="row p-2 border-top-grey">
        <div class="row" style="${pct(0.5)}"><div class="col w50p">${L("Status", "c-secondary s14 w500 pt-1")}</div><div class="col w50p">${L(h.status, "s14 c-black w500 pt-1")}</div></div>
        <div class="row" style="${pct(0.5)}${CLAMP}"><div class="col w50p">${L("Hop", "c-secondary s14 w500 pt-1")}</div><div class="col w50p">${L(h.stopNumber, "s14 c-black w500 pt-1")}</div></div>
      </div>
      <div class="row p-2 border-top-grey"><div class="col" style="${pct(0.5)}">${L("Hop Mode", "s14 c-black w500")}</div><div class="col" style="${pct(0.5)}${CLAMP}">${L(mode, "s14 c-black w500 ax-r")}</div></div>
    </div></div>`;
  }
  function searchHops(c, raw) {
    const searchText = raw.trim();
    try {
      if (containsSpecialChars(searchText) && !searchText.startsWith("0")) { showToast("Search Valid Text or Mobile Number."); return; }
      if (validateSpecialCharacters(searchText)) { showToast("Search Either By Business Name or Mobile Number."); return; }
      if (validateText(searchText)) {
        if (searchText.length > 1 && searchText.length != 0) {
          c.hopList = c.mainHopList.filter((h) => h.pointName.toLowerCase().includes(searchText.toLowerCase()));
          return;
        }
      }
      if (validateOnlyNumbers(searchText) && !searchText.startsWith("0")) {
        if (searchText.length > 8) {
          if (searchText.length !== 10 && searchText.length > 8 && searchText !== "0") { showToast("Please Enter 10 Digit Mobile Number."); return; }
          c.hopList = c.mainHopList.filter((h) => h.pointPhone.includes(searchText));
          return;
        }
      }
      if (searchText.trim() === "") { c.hopList = c.mainHopList; return; }
    } catch (e) {
      c.hopList = c.mainHopList;
    }
  }

  // ---------------- pages/components/hop/hops (Summary | Products | Returns)
  SCREENS["/hops"] = {
    init(v) {
      const h = appState.hop;
      v.hop = h;
      v.isDeliveryHop = (h.pointType === PointType.CUSTOMER && h.pointMode === PointMode.DELIVERY) || (h.pointMode === PointMode.RETURN && h.pointType === PointType.VENDOR);
      v.isReturnHop = h.pointType === PointType.VENDOR && h.pointMode === PointMode.RETURN;
      v.isPickupHop = h.pointType === PointType.VENDOR && h.pointMode === PointMode.PICKUP;
      v.tab = "summary";
      mount(v, "hs", newHopSummaryState(), hopSummaryInit);
    },
    render(v) {
      const tabs = [{ key: "summary", label: "Summary" }];
      if (!v.isReturnHop) tabs.push({ key: "products", label: "Products" });
      if (v.isDeliveryHop) tabs.push({ key: "returns", label: "Returns" });
      const wcls = v.isReturnHop || v.isPickupHop ? "w48p" : "w32p";
      let comp = "";
      if (v.tab === "summary" && v.hs) comp = hopSummaryRender(v.hs);
      if (v.tab === "products" && v.op) comp = orderProductsRender(v.op);
      if (v.tab === "returns" && v.rt) comp = returnsRender(v.rt);
      return `<div class="page bg-search">
        <div class="row p-2" style="flex:none" data-tap="hopsBack">${L("&#xf053;", "back-arrow")}${L(v.hop && v.hop.pointName, "title shrink")}</div>
        <div class="row p-2 tabs-row" style="flex:none">${tabs.map((t) => `<div class="tab ${wcls} ${v.tab === t.key ? "on" : "off"}" data-tap="hopTab" data-arg="${t.key}">${L(t.label, "tc s16")}</div>`).join("")}</div>
        <div class="fill col mt-2">${comp}</div>
      </div>`;
    },
  };
  function hopsSetTab(v, key) {
    if (v.tab === key) return;
    v.tab = key;
    v.hs = v.op = v.rt = null;
    if (key === "summary") mount(v, "hs", newHopSummaryState(), hopSummaryInit);
    if (key === "products") mount(v, "op", { isLoading: true, isOrderWise: false, hopOrders: [], hopProducts: [], orderProducts: [], returns: [], storeReturnValue: undefined }, orderProductsInit);
    if (key === "returns") mount(v, "rt", { isLoading: true, hopProducts: [] }, returnsInit);
    render();
  }

  // hop-summary.component
  const newHopSummaryState = () => ({ isLoading: true, hopSummary: null, isDeliveryHop: false, isReturnHop: false });
  async function hopSummaryInit(c, alive) {
    c.isLoading = true;
    render();
    try {
      const r = await API.getHopSummary(appState.hop.id);
      if (!alive()) return;
      c.hopSummary = r ? {
        id: r.id, tripId: r.tripId, hopType: r.hopType, pointName: r.pointName, pointPhone: r.pointPhone, pointLat: r.pointLat, pointLng: r.pointLng,
        pointMode: r.pointMode, pointType: r.pointType, stopNumber: r.stopNumber, pointAddress: r.pointAddress, pointPincode: r.pointPincode,
        status: r.status, pickUps: r.pickUps, deliveries: r.deliveries, returns: r.returns, products: r.products, weight: +r.weight || 0,
        tripStatus: r.tripStatus, customerBusinessName: r.customerBusinessName || "N/A", customerNumber: r.customerMobileNumber || "N/A",
        isPickupHopCompleted: r.isPickupHopCompleted || false,
      } : null;
      c.isDeliveryHop = c.hopSummary.pointType === PointType.CUSTOMER && c.hopSummary.pointMode === PointMode.DELIVERY;
      c.isReturnHop = c.hopSummary.pointType === PointType.VENDOR && c.hopSummary.pointMode === PointMode.RETURN;
    } catch (e) { /* error fetching hop summary */ } finally {
      if (alive()) { c.isLoading = false; render(); }
    }
  }
  function hopSummaryRender(c) {
    if (c.isLoading) return `<div class="fill col pr-2">${pageLoading()}</div>`;
    const hs = c.hopSummary;
    if (!hs) return "";
    const countVal = hs.pointMode == 1 ? hs.pickUps : hs.pointMode == 2 ? hs.deliveries : hs.pointMode == 3 ? hs.returns : undefined;
    const values = [];
    if (countVal !== undefined) values.push(countVal);
    values.push(weightPipe(hs.weight), hs.products, hs.status);
    let bottom = "";
    if (!c.isDeliveryHop) {
      bottom = `<div class="col mb-30" style="height:70px;flex:none;justify-content:flex-end">
        ${hs.status == "Created" ? `<div class="gbtn p2" style="height:50px" data-tap="hopComplete">${L("Complete", "s14")}</div>` : ""}
        ${hs.status == "Completed" ? `<div class="gbtn s2" style="height:50px">${L("Hop Completed", "s14")}</div>` : ""}
      </div>`;
    } else {
      bottom = `<div class="mb-30" style="height:120px;flex:none;display:grid;grid-template-columns:5px 1fr 5px 1fr 5px;align-items:center">
        <div style="grid-column:2;display:flex;flex-direction:column" data-tap="hopArrived"><div class="nbtn px-2 ${hs.status == "Created" ? "p2" : "s2"}" style="width:calc(80% - 7.4px)">Arrived at Location</div></div>
        <div style="grid-column:4;display:flex;flex-direction:column"><div class="nbtn px-2 ${hs.status == "InProgress" ? "p2" : "s2"}" style="width:calc(80% - 7.4px)" ${hs.status === "InProgress" ? 'data-tap="hopCompleteDelivery"' : ""}>${hs.status === "Completed" ? "Hop Completed" : "Complete"}</div></div>
      </div>`;
    }
    return `<div class="fill col">
      <div class="fill col pr-2" style="overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;flex:none" class="mx-2">
          ${c.isDeliveryHop ? `<div class="row" style="grid-column:2;justify-content:flex-end"><div class="row action-pill"><div class="row p-1" style="align-items:center">${L("Action", "c-black s14 w500 tc pl-1 pr-1", 'data-tap="hopAction"')}${L("&#xf0d7;", "fas s14 c-black p-1")}</div></div></div>` : ""}
        </div>
        <div class="col pt-2"><div class="col px-2">
          <div class="col bg-white m-2 r16">
            <div class="p-2">${W("Hop Details", "c-black s16 w500")}</div>
            <div class="row p-2 border-top-grey">${kv([pointModeLabel(hs.pointMode), "Weight (Kgs)", "Products", "Status"], values)}</div>
          </div>
          ${c.isReturnHop ? `<div class="col bg-white m-2 r16">
            <div class="p-2">${W("Customer Details", "c-black s16 w500")}</div>
            <div class="col p-2 border-top-grey">
              <div class="row"><div class="col w50p">${W("Business Name", "c-secondary s14 w500 pt-1")}</div><div class="col w50p">${W(hs.customerBusinessName, "s14 c-black w500 pt-1 tr ax-r")}</div></div>
              <div class="row"><div class="col w50p">${W("Customer Number", "c-secondary s14 w500 pt-1")}</div><div class="col w50p">${W(hs.customerNumber, "s14 c-black w500 pt-1 tr ax-r")}</div></div>
            </div>
          </div>` : ""}
        </div></div>
      </div>
      ${bottom}
    </div>`;
  }
  async function hopUpdateStatus(hopStatus) {
    const c = view.hs;
    if (!c || !c.hopSummary) return;
    const hopId = c.hopSummary.id;
    try {
      c.isLoading = true;
      render();
      if (c.isDeliveryHop && !c.hopSummary.isPickupHopCompleted) {
        c.isLoading = false; render();
        showWarning("Warning", "Please complete the pickup hop first .", "Ok");
        return;
      }
      const loc = await getCurrentLocation();
      if (!loc.isEnableLocation) { c.isLoading = false; render(); showError("Error", "Please enable your location", "Ok"); return; }
      if (loc.isMockLocation) { c.isLoading = false; render(); showError("Error", "You are using Fake GPS app. Please Uninstall app and try again later", "Ok"); return; }
      if (c.hopSummary.tripStatus !== TripStatus.IN_PROGRESS) { c.isLoading = false; render(); showError("Error", "Trip is not in progress", "Ok"); return; }
      const locationData = { lat: loc.lat, long: loc.long };
      if (hopStatus === HopStatus.Created) { await changeHopStatus(c, hopId, hopStatus, locationData); return; }
      if (appState.isWholeOrderReturn) {
        appState.isWholeOrderReturn = false;
        await handleRegularHopCompletion(c, hopId, locationData, true);
      } else {
        await handleRegularHopCompletion(c, hopId, locationData, false);
      }
    } catch (e) {
      c.isLoading = false; render();
      showError("Error", "Failed to update hop status", "Ok");
    }
  }
  async function handleRegularHopCompletion(c, hopId, locationData, isWholeOrderReturn) {
    c.isLoading = false;
    render();
    if (isWholeOrderReturn) {
      try { c.isLoading = true; render(); await changeHopStatus(c, hopId, HopStatus.Completed, locationData); } catch (e) { showError("Error", "Failed to complete hop", "Ok"); }
      return;
    }
    showBottomSheet({ type: 10003, items: [{ hopId: appState.hop.id, otpCode: appState.hop.otp }] }, async (res) => {
      if (!res) return;
      try { c.isLoading = true; render(); await changeHopStatus(c, hopId, HopStatus.Completed, locationData); } catch (e) { showError("Error", "Failed to complete hop", "Ok"); }
    });
  }
  async function changeHopStatus(c, hopId, hopStatus, locationData) {
    const newStatus = hopStatus === HopStatus.Created ? HopStatus.InProgress : HopStatus.Completed;
    if (newStatus === HopStatus.Completed) await processReturnOrders();
    const ok = await API.updateHopStatus({ hopId, status: newStatus, latitude: +locationData.lat, longitude: +locationData.long, deliveryPartnerId: appState.deliveryPartner.id });
    c.isLoading = false;
    if (ok) {
      showSuccess("Success", newStatus === HopStatus.InProgress ? "Arrival Confirmed" : "Hop Completed Successfully", "Ok");
      c.hopSummary.status = newStatus;
      appState.hop.status = newStatus;
      render();
      if (newStatus === HopStatus.Completed) navigate(appState.isNavigatedFrom === NavigatedFrom.Trip ? "/trips" : "/hop-list");
    } else {
      render();
      showError("Error", "Failed to update hop status", "Ok");
    }
  }
  async function processReturnOrders() {
    const all = await returnRepository.getAllReturns();
    if (all.length === 0) return;
    const r = all[0];
    const payload = {
      tripId: appState.hop.tripId, fulfillmentId: appState.hop.fulfillmentId, hopId: appState.hop.id,
      cancellationReasonId: r.returnOrders && r.returnOrders[0] && r.returnOrders[0].returnReason !== undefined ? String(r.returnOrders[0].returnReason) : undefined,
      returnItems: (r.returnOrders || []).map((i) => ({ quantity: +i.quantity, linkedOrderItemId: i.linkedOrderItemId, linkedOrderId: i.linkedOrderId })),
    };
    panelEvent("log", `POST /hops/return → ${payload.returnItems.length} item(s), reason ${payload.cancellationReasonId}`);
    await Promise.all([API.returnHopOrders(payload), returnRepository.deleteCacheReturnByHopId(appState.hop.id)]);
  }

  // order-products.component
  async function orderProductsInit(c, alive) {
    c.isLoading = true;
    render();
    const hop = appState.hop;
    c.isDeliveryHop = hop.pointType === PointType.CUSTOMER && hop.pointMode === PointMode.DELIVERY;
    c.isReturnHop = hop.pointType === PointType.VENDOR && hop.pointMode === PointMode.RETURN;
    c.showEditButton = hop.status == HopStatus.InProgress && hop.pointType === PointType.CUSTOMER && hop.pointMode === PointMode.DELIVERY;
    try {
      const response = await API.getHopOrdersWithItems(hop.id);
      if (!alive()) return;
      if (response && response.length > 0) {
        c.hopOrders = response.map((o) => ({ orderNumber: o.orderNumber || "", orderAmount: +o.orderAmount || 0, orderDate: convertToDDMMYYYY(o.orderDate) || "", status: o.status || "", weight: +Number(o.weight).toFixed(2) || 0 }));
        c.hopProducts = response.map((o) => ({ orderNumber: o.orderNumber, products: (c.isReturnHop ? o.returnProducts : o.deliveryProducts) || [] })).filter((g) => g.products.length > 0);
      }
      c.orderProducts = response || [];
      c.orderProducts.forEach((o) => o.deliveryProducts.forEach((p) => { p.totalReturnQty = 0; }));
      c.storeReturnValue = await returnRepository.getReturnById(hop.id);
      if (c.storeReturnValue === undefined || c.storeReturnValue === null) {
        c.returns = consolidate(c.orderProducts.flatMap((o) => o.returnProducts.map(mapToHopReturnItem)));
      } else {
        appState.tripId = c.storeReturnValue.tripId;
        c.returns = c.storeReturnValue.returnOrders;
      }
      updateProductsWithReturnQuantities(c);
    } catch (e) { /* error fetching order products */ } finally {
      if (alive()) { c.isLoading = false; render(); }
    }
  }
  function mapToHopReturnItem(p) {
    return {
      id: p.id, orderNumber: p.orderNumber, itemId: p.itemId, imageUrl: p.imageUrl, mrp: Number(p.mrp), sellingPrice: Number(p.saleValue), upc: p.upc,
      quantity: Number(p.orderedQty), itemName: p.name, pieces: Number(p.pcs), cases: Number(p.cases), createdTimeStamp: Date.now(), vendorName: p.sellerName,
      itemKey: p.itemKey, originalQuantity: Number(p.orderedQty), returnReason: undefined, linkedOrderId: p.linkedOrderId, linkedOrderItemId: p.linkedOrderItemId,
    };
  }
  function consolidate(items) {
    const g = {};
    items.forEach((i) => { const k = `${i.orderNumber}-${i.itemId}`; if (g[k]) g[k].quantity += i.quantity; else g[k] = Object.assign({}, i); });
    return Object.values(g);
  }
  function updateProductsWithReturnQuantities(c) {
    const m = new Map();
    if (c.storeReturnValue && c.storeReturnValue.returnOrders) c.storeReturnValue.returnOrders.forEach((r) => m.set(r.itemKey, (m.get(r.itemKey) || 0) + r.quantity));
    c.orderProducts.forEach((o) => (o.returnProducts || []).forEach((r) => m.set(r.itemKey, (m.get(r.itemKey) || 0) + Number(r.orderedQty))));
    c.orderProducts.forEach((o) => o.deliveryProducts.forEach((p) => { p.totalReturnQty = m.get(p.itemKey) || 0; }));
  }
  function findProduct(c, linkedOrderItemId) {
    for (const g of c.hopProducts) { const p = g.products.find((x) => x.linkedOrderItemId === linkedOrderItemId); if (p) return p; }
    return null;
  }
  function orderProductsRender(c) {
    if (c.isLoading) return `<div class="fill col bg-search center-box">${spinner("", "width:50px;color:#fff")}</div>`;
    // rows="40": the inner GridLayout is verticalAlignment="top", so its row is as tall as its
    // tallest child (the 32 dp Action pill) and the switch StackLayout stretches to that height
    const top = `<div style="height:40px;flex:none" class="col"><div style="display:grid;grid-template-columns:1fr 1fr" class="mx-2">
        <div class="row">
          <div class="nsswitch mt-1 ${c.isOrderWise ? "on" : ""}" data-tap="toggleOrderWise"><div class="track"></div><div class="thumb"></div></div>
          ${L(c.isOrderWise ? "Order Wise" : "Product Wise", "c-black s14 mt-1")}
        </div>
        ${c.showEditButton ? `<div class="row" style="justify-content:flex-end;align-items:flex-start"><div class="row action-pill"><div class="row p-1" style="align-items:center">${L("Action", "c-black s14 w500 tc pl-1 pr-1", 'data-tap="wholeHopReturn"')}${L("&#xf0d7;", "fas s14 c-black p-1")}</div></div></div>` : ""}
      </div></div>`;
    let list = "";
    if (c.isOrderWise && c.hopOrders.length > 0) {
      list = `<div class="fill scroll" data-sk="orders">${c.hopOrders.map((o) => `<div class="col px-2 pb-10"><div class="col bg-white r16 m-2">
          <div class="col bg-white r16 p-2">${W(o.orderNumber, "s16 c-black w600 ff-file mt-2")}</div>
          <div class="row p-2 border-top-grey">${kvDirect(["Order Date", "Order Status", "Order Weight", "Order Total"], [o.orderDate, o.status, weightPipe(o.weight), replaceCommas(o.orderAmount)], 0.25, 0.75)}</div>
        </div></div>`).join("")}</div>`;
    } else if (!c.isOrderWise && c.hopProducts.length > 0) {
      list = `<div class="fill scroll" data-sk="products">${c.hopProducts.map((g) => `<div class="col px-2">
          <div class="cell bg-white r16 m-2 p-2">
            <div class="row w70p ax-l">${W("#" + g.orderNumber, "s16 c-black w600 ff-file mt-2")}</div>
            ${c.showEditButton ? `<div class="row pill-blue ax-r ay-t" style="width:77px;height:32px;justify-content:center"><div class="lbl s11 tc w500 c-white ff-file p-1 vmid tc" style="height:32px;width:100%" data-tap="editWholeOrder" data-arg="${esc(g.orderNumber)}">Edit</div></div>` : ""}
          </div>
          <div class="col mt-2">${g.products.map((p) => productCard(c, p, false)).join("")}</div>
        </div>`).join("")}</div>`;
    }
    let empty = "";
    if (c.isOrderWise && c.hopOrders.length == 0) empty = emptyState("No Orders found. Please go to trips list page.", false);
    if (!c.isOrderWise && c.hopProducts.length == 0) empty = emptyState("No Products found. Please go to trips list page.", false);
    return `<div class="fill col bg-search">${top}<div class="fill col">${list}${empty}</div><div style="height:10px;flex:none"></div></div>`;
  }
  function productCard(c, p, isReturnsTab) {
    const labels = ["MRP", "Cases", "Pieces", "Sale Value", isReturnsTab ? "Return Qty" : "Ordered Qty"];
    const values = [replaceCommas(p.mrp), p.cases, p.pcs, replaceCommas(p.saleValue), p.orderedQty];
    if (!isReturnsTab && c.isDeliveryHop) { labels.push("Return Qty"); values.push(p.totalReturnQty); }
    const valCls = (i) => (isReturnsTab && i === 4 ? "c-danger" : "c-black");
    // Edit pill: label w-[70%] of the 30% column, centred in it
    const edit = !isReturnsTab && c.showEditButton ? `<div class="row pill-blue ay-t" style="width:calc((100% - 4px) * .7);justify-content:center"><div class="lbl s11 tc w500 c-white ff-file p-1 vmid tc" style="height:40px;width:100%" data-tap="editProduct" data-arg="${esc(p.linkedOrderItemId)}">Edit</div></div>` : "";
    // image column is squeezed to the space left after the 70% label column (+ ml-5),
    // so the 100x100 image is cut off on the right
    return `<div class="col bg-white r16 m-2 ${isReturnsTab ? "" : "p-2"}" style="${isReturnsTab ? "margin-bottom:8px" : ""}">
      <div class="row mb-2">
        <div class="row ${isReturnsTab ? "p-2" : "w70p"}">${W(p.name + " - MRP " + p.mrp, "s16 c-black w500 ff-file")}</div>
        ${isReturnsTab ? "" : `<div class="row w30p" style="justify-content:center">${edit}</div>`}
      </div>
      <div class="row p-2 border-top-grey">
        <div class="col" style="${pct(0.7)}"><div class="row between">
          <div class="col">${labels.map((l) => L(l, "c-secondary s14 w500 pt-1")).join("")}</div>
          <div class="col">${values.map((v, i) => L(v, `s14 ${valCls(i)} w500 pt-1 ax-r`)).join("")}</div>
        </div></div>
        <div class="col ml-5" style="${pct(0.29)}${CLAMP}justify-content:center;overflow:hidden">
          <img src="${p.imageUrl}" class="bg-search" style="width:100px;height:100px;object-fit:cover;flex:none;max-width:none;border-radius:11.43px">
        </div>
      </div>
      ${!isReturnsTab && !c.isReturnHop ? `<div class="row mt-2 pt-2 border-top-grey">${W("Seller: " + p.sellerName, "s14 c-black w500 ay-c")}</div>` : ""}
    </div>`;
  }
  function editProduct(c, product) {
    if (product.totalReturnQty >= Number(product.orderedQty)) { showSuccess("Error", "Product Return Quantity Exceeded", "Ok"); return; }
    showBottomSheet({ type: 10002, items: [product] }, async (res) => {
      if (!res) return;
      const item = {
        id: product.id, orderNumber: product.orderNumber, itemId: product.itemId, imageUrl: product.imageUrl, mrp: Number(product.mrp),
        sellingPrice: Number(product.saleValue), upc: product.upc, quantity: res.qty, itemName: product.name, pieces: Number(product.pcs),
        cases: Number(product.cases), createdTimeStamp: Date.now(), vendorName: product.sellerName, itemKey: product.itemKey, reason: res.name,
        originalQuantity: Number(product.orderedQty), returnReason: res.name, linkedOrderId: product.linkedOrderId, linkedOrderItemId: product.linkedOrderItemId,
      };
      await returnRepository.upsertStoreReturn({ hopId: appState.hop.id, tripId: appState.tripId, returnOrders: [item] });
      const updated = await returnRepository.getReturnById(appState.hop.id);
      if (updated) { c.storeReturnValue = updated; c.returns = updated.returnOrders; updateProductsWithReturnQuantities(c); render(); }
      showSuccess("Success", "Product Return Added Successfully", "Ok");
    });
  }
  function editWholeOrder(c, group) {
    const remaining = group.products.filter((p) => Number(p.orderedQty) > (p.totalReturnQty || 0));
    if (remaining.length === 0) { showSuccess("Error", "No products available for return", "Ok"); return; }
    showBottomSheet({ type: 10004 }, async (res) => {
      if (!res || !res.name) return;
      const items = [];
      for (const p of group.products) {
        const rem = Number(p.orderedQty) - (p.totalReturnQty || 0);
        if (rem <= 0) continue;
        items.push({
          id: p.id, orderNumber: group.orderNumber, itemId: p.itemId, imageUrl: p.imageUrl, mrp: Number(p.mrp), sellingPrice: Number(p.saleValue), upc: p.upc,
          quantity: rem, itemName: p.name, pieces: Number(p.pcs), cases: Number(p.cases), createdTimeStamp: Date.now(), vendorName: p.sellerName, itemKey: p.itemKey,
          reason: res.name, originalQuantity: Number(p.orderedQty), returnReason: res.name, linkedOrderId: p.linkedOrderId, linkedOrderItemId: p.linkedOrderItemId,
        });
      }
      if (items.length === 0) { showSuccess("Error", "No products available for return", "Ok"); return; }
      await returnRepository.upsertStoreReturn({ hopId: appState.hop.id, tripId: appState.tripId, returnOrders: items });
      const updated = await returnRepository.getReturnById(appState.hop.id);
      if (updated) { c.storeReturnValue = updated; c.returns = updated.returnOrders; updateProductsWithReturnQuantities(c); render(); }
      showSuccess("Success", "Order Returns Added Successfully", "Ok");
    });
  }
  function wholeHopReturn(c) {
    const all = c.hopProducts.flatMap((g) => g.products.filter((p) => Number(p.orderedQty) > (p.totalReturnQty || 0)));
    if (all.length === 0) { showSuccess("Error", "No products available for return", "Ok"); return; }
    showBottomSheet({ type: 10004 }, async (res) => {
      if (!res || !res.name) return;
      const items = all.map((p) => ({
        id: p.id, orderNumber: p.orderNumber, itemId: p.itemId, imageUrl: p.imageUrl, mrp: Number(p.mrp), upc: p.upc,
        quantity: Number(p.orderedQty) - (p.totalReturnQty || 0), itemName: p.name, pieces: Number(p.pcs), cases: Number(p.cases),
        createdTimeStamp: Date.now(), vendorName: p.sellerName, itemKey: p.itemKey || `${p.itemId}-${p.orderNumber}`, reason: res.name,
        originalQuantity: Number(p.orderedQty), returnReason: res.name, linkedOrderId: p.linkedOrderId, linkedOrderItemId: p.linkedOrderItemId,
        sellingPrice: Number(p.saleValue),
      }));
      await returnRepository.upsertStoreReturn({ hopId: appState.hop.id, tripId: appState.tripId, returnOrders: items });
      const updated = await returnRepository.getReturnById(appState.hop.id);
      if (updated) { c.storeReturnValue = updated; c.returns = updated.returnOrders; appState.isWholeOrderReturn = true; updateProductsWithReturnQuantities(c); render(); }
      showSuccess("Success", "All Orders Returns Added Successfully", "Ok");
    });
  }

  // returns.component
  async function returnsInit(c, alive) {
    c.isLoading = true;
    render();
    try {
      c.storeReturnValue = await returnRepository.getReturnById(appState.hop.id);
      if (c.storeReturnValue == undefined) {
        const orders = await API.getHopOrdersWithItems(appState.hop.id);
        if (!alive()) return;
        if (orders && orders.length > 0) c.hopProducts = orders.reduce((acc, o) => acc.concat((o.returnProducts || []).map((p) => Object.assign({}, p, { id: p.linkedOrderItemId }))), []);
      } else {
        c.hopProducts = c.storeReturnValue.returnOrders.map((p) => ({
          id: p.id || p.linkedOrderItemId, linkedOrderItemId: p.linkedOrderItemId, itemId: p.itemId, name: p.itemName, mrp: String(p.mrp), cases: String(p.cases),
          pcs: String(p.pieces), saleValue: String(p.sellingPrice), orderedQty: String(p.quantity), sellerName: p.vendorName, imageUrl: p.imageUrl,
          orderNumber: p.orderNumber, upc: p.upc, itemKey: p.itemKey, linkedOrderId: p.linkedOrderId,
        }));
      }
    } catch (e) { /* error */ } finally {
      if (alive()) { c.isLoading = false; render(); }
    }
  }
  function returnsRender(c) {
    if (c.isLoading) return `<div class="fill col mt-2">${blockLoading()}</div>`;
    return `<div class="fill col mt-2">
      ${c.hopProducts && c.hopProducts.length === 0 ? emptyState("No return orders found.", false) : ""}
      <div class="fill scroll" data-sk="returns">${c.hopProducts.map((p) => `<div class="col px-2">${productCard(c, p, true)}</div>`).join("")}</div>
    </div>`;
  }

  // ================================================================ ACTIONS (taps)
  const ACTIONS = {
    // auth
    openTerms() { navigate("/web-view", webViewSrcAssets[1]); },
    async sendOtp() {
      const v = view;
      if (!v.enable) return;
      const number = v.text.replace(/\D/g, "").slice(0, 10);
      appState.loginMobileNumber = number;
      loader.show("Sending OTP.....");
      try {
        const res = await API.sendOTPCode(number);
        if (!res) { loader.hide(); showToast("Something went wrong to send verification code."); return; }
        appState.loginMobileNumber = number;
        showToast(`OTP Sent Successfully to your Mobile Number (${appState.loginMobileNumber}).`);
        panelEvent("sms", { to: "+91" + number, text: `${API.LOGIN_OTP} is your OTP to log in to Qwipo DP. Do not share it with anyone.` });
        loader.hide();
        navigate("/mobile-otp-component");
      } catch (e) { loader.hide(); showToast("Something went wrong to send verification code."); }
    },
    async resendOtp() {
      const v = view;
      if (!v.done) return;
      v.timer = 30;
      v.done = false;
      const tok = navToken;
      startOtpTimer(v, () => tok === navToken);
      render();
      loader.show("Sending OTP.....");
      try {
        const res = await API.sendOTPCode(appState.loginMobileNumber);
        if (res) {
          showToast("OTP Sent Successfully to your Mobile Number (" + appState.loginMobileNumber + ").");
          panelEvent("sms", { to: "+91" + appState.loginMobileNumber, text: `${API.LOGIN_OTP} is your OTP to log in to Qwipo DP. Do not share it with anyone.` });
        } else showToast("Something went wrong to send verification code.");
      } catch (e) { showToast("Something went wrong to send verification code."); }
      loader.hide();
    },
    async verifyOtp() {
      const v = view;
      try {
        loader.show("Verifying OTP.....");
        const otpCode = v.otpDigits.join("");
        if (otpCode.length !== 6) { loader.hide(); showToast("Please enter OTP"); return; }
        const response = await API.verifyOtp(appState.loginMobileNumber, otpCode);
        if (!response.isValid) { loader.hide(); showToast("Invalid OTP. Please try again."); return; }
        const fieldAgent = await API.getDeliveryPartner(appState.loginMobileNumber);
        if (!fieldAgent) { loader.hide(); showToast("Field Agent not found. Please register."); navigate("/mobile-number-component"); return; }
        loader.hide();
        userService.setLoggedInNumber(fieldAgent.phone);
        navigate("/login");
      } catch (e) { loader.hide(); showToast("Something went wrong. Please try again."); }
    },
    editNumber() { navigate("/mobile-number-component"); },
    playStore() { window.open("https://play.google.com/store/apps/details?id=com.qwipo.dp", "_blank", "noopener"); },
    dial(arg) { dial(arg); },
    openMap(arg) { const [lat, lng] = String(arg).split(","); window.open(`https://maps.google.com/maps?q=${lat},${lng}`, "_blank", "noopener"); },

    // footers
    footerTrips() { navigate("/trip-list"); },
    footerHops() { appState.isNavigatedFrom = NavigatedFrom.Non_Trip; navigate("/hop-list"); },
    footerAccount() { navigate("/my-info"); },
    subHome() { navigate("/app-version-check"); },
    subAccount() { navigate("/my-info"); },

    // account
    profile() { navigate("/profile"); },
    contactUs() { navigate("/contact-us"); },
    terms() { navigate("/web-view", webViewSrcAssets[1]); },
    logout() { showBottomSheet({ type: 10001 }, () => {}); },
    myInfo() { navigate("/my-info"); },
    back() { navigate("/my-info"); },
    webBack() { backToPreviousPage(); },

    // trips
    tripDetails(tripId) { appState.tripId = tripId; appState.isNavigatedFrom = NavigatedFrom.Trip; navigate("/trips"); },
    tripsBack() { navigate("/trip-list"); },
    tripsSummaryTab() { tripsShowSummary(view); },
    tripsHopsTab() { tripsShowHops(view); },
    changeTripStatus() { changeTripStatus(); },

    // hop list
    viewHop(id) {
      const c = view.hopList;
      const hop = c && c.hopList.find((h) => h.id === id);
      if (!hop) return;
      appState.hop = hop;
      appState.tripId = hop.tripId;
      if (appState.isNavigatedFrom === NavigatedFrom.Trip) appState.isHopDetailsPage = true;
      navigate("/hops");
    },
    clearSearch() { const c = view.hopList; c.searchText = ""; c.hopList = c.mainHopList; render(); },

    // hops
    hopTab(key) { hopsSetTab(view, key); },
    async hopsBack() {
      const storeCache = await returnRepository.getReturnById(appState.hop && appState.hop.id);
      const goBack = () => navigate(appState.isNavigatedFrom === NavigatedFrom.Trip ? "/trips" : "/hop-list");
      if (storeCache != undefined && appState.hop.pointMode == PointMode.DELIVERY && appState.hop.pointType == PointType.CUSTOMER) {
        showBottomSheet({ type: 10005 }, (res) => {
          appState.isBottomSheetOpen = false;
          if (res) { returnRepository.deleteCacheReturnByHopId(appState.hop.id); goBack(); }
        });
      } else goBack();
    },
    hopComplete() { hopUpdateStatus(undefined); },
    hopArrived() { const hs = view.hs && view.hs.hopSummary; if (hs) hopUpdateStatus(hs.status); },
    hopCompleteDelivery() { const hs = view.hs && view.hs.hopSummary; if (hs) hopUpdateStatus(hs.status); },
    hopAction() {
      const c = view.hs;
      showBottomSheet({ type: 10006, items: [c.hopSummary] }, (res) => {
        if (!res) return;
        if (res.isOtpSent) { c.isLoading = false; render(); showSuccess("Success", "OTP Sent Successfully", "Ok"); }
      });
    },
    toggleOrderWise() { const c = view.op; c.isOrderWise = !c.isOrderWise; render(); },
    editProduct(id) { const c = view.op; const p = findProduct(c, id); if (p) editProduct(c, p); },
    editWholeOrder(orderNumber) { const c = view.op; const g = c.hopProducts.find((x) => x.orderNumber === orderNumber); if (g) editWholeOrder(c, g); },
    wholeHopReturn() { wholeHopReturn(view.op); },
  };

  const INPUTS = {
    mobile(value, el) {
      const digits = value.replace(/\D/g, "").slice(0, 10);
      if (digits !== value) el.value = digits;
      view.text = digits;
      view.enable = isValidMobileNumber(digits);
      render();
    },
    otp(value, el, arg) {
      const v = view;
      const index = Number(arg);
      const inputValue = value;
      v.fields[index] = inputValue;
      if (inputValue.length === 1) {
        if (isNaN(Number(inputValue))) { showWarning("Warning !", "Please enter a valid number.", "OK"); return; }
        v.otpDigits[index] = inputValue;
        if (index < 5) focusOtp(index + 1);
        else joinOtpDigits(v);
      } else if (inputValue.length === 0) {
        setTimeout(() => focusOtp(Math.max(0, index - 1)), 20);
        joinOtpDigits(v);
      }
    },
    hopSearch(value) {
      const c = view.hopList;
      c.searchText = value;
      searchHops(c, value);
      render();
    },
  };
  function joinOtpDigits(v) {
    const code = v.fields.join("");
    const before = v.enable;
    v.enable = isValidOTPNumber(code);
    if (before !== v.enable) render();
  }

  // ================================================================ event wiring
  deviceEl.addEventListener("click", (e) => {
    if (dialerEl && dialerEl.contains(e.target)) return;
    const st = e.target.closest("[data-stap]");
    if (st && ui.sheetView && ui.sheetView.contains(st)) {
      const fn = SHEET_ACTIONS[st.dataset.stap];
      if (fn) fn(st.dataset.arg);
      return;
    }
    const t = e.target.closest("[data-tap]");
    if (!t || !screenEl.contains(t)) return;
    if (ovEl.querySelector(".sheet-layer, .sa-layer, .ad-layer, .perm-layer, .ld-layer")) return;
    const fn = ACTIONS[t.dataset.tap];
    if (fn) fn(t.dataset.arg, t, e);
  });
  deviceEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.sinput && sheet) {
      if (t.dataset.sinput === "qty") { sheet.form.returnQuantity = t.value; }
      if (t.dataset.sinput === "otp") { sheet.otpInput = t.value; }
      return;
    }
    if (t.dataset.input && INPUTS[t.dataset.input]) INPUTS[t.dataset.input](t.value, t, t.dataset.arg);
  });
  deviceEl.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.input === "otp" && e.key === "Enter") {
      const i = Number(t.dataset.arg);
      if (i < 5) focusOtp(i + 1); else t.blur();
    }
  });

  // ================================================================ Android back button (app.component.ts onBackPressed)
  async function onBackPressed() {
    if (dialerEl) { dialerEl.remove(); dialerEl = null; return; }
    if (!appRunning) return;
    // native dialogs consume back first
    const top = ovEl.querySelector(".ad-layer:last-child, .sa-layer:last-child, .perm-layer:last-child");
    if (top) {
      if (top.classList.contains("sa-layer")) { top.remove(); return; }
      if (top.classList.contains("ad-layer")) { top.querySelector('[data-ad="out"]').click(); return; }
      return;
    }
    if (loaderEl) return;
    try {
      const currentRoute = route || "";
      switch (currentRoute) {
        case "/mobile-number-component": exitApp(); break;
        case "/mobile-otp-component": navigate("/mobile-number-component"); break;
        case "/trip-list":
          if (appState.isBottomSheetOpen) { closeRoute(["/trip-list"]); return; }
          navigate("/my-info");
          break;
        case "/profile": navigate("/my-info"); break;
        case "/my-info":
          if (appState.isBottomSheetOpen) { closeRoute(["/my-info"]); return; }
          if (await confirmDialog("Do you want to exit from Qwipo?", "Yes", "No")) exitApp();
          break;
        case "/hop-list":
          if (appState.isBottomSheetOpen) { closeRoute(["/hop-list"]); return; }
          navigate("/my-info");
          break;
        case "/hops": {
          if (appState.isBottomSheetOpen) { closeRoute(["/hops"]); return; }
          const storeCache = await returnRepository.getReturnById(appState.hop && appState.hop.id);
          if (storeCache != undefined && appState.hop.pointMode == PointMode.DELIVERY && appState.hop.pointType == PointType.CUSTOMER) {
            showBottomSheet({ type: 10005 }, (res) => {
              appState.isBottomSheetOpen = false;
              if (res) { returnRepository.deleteCacheReturnByHopId(appState.hop.id); navigate("/hop-list"); }
            });
            return;
          }
          if (appState.isBottomSheetOpen) { closeRoute(["/hops"]); return; }
          navigate(appState.isNavigatedFrom === NavigatedFrom.Trip ? "/trips" : "/hop-list");
          return;
        }
        case "/trips":
          if (appState.isBottomSheetOpen) { closeRoute(["/trips"]); return; }
          navigate("/trip-list");
          return;
        default:
          // every other page cancels the back press
          break;
      }
    } catch (e) { /* ignore */ }
  }

  // ================================================================ app lifecycle
  let splashTimer = null;
  function closeAllOverlays() {
    ovEl.innerHTML = "";
    loaderEl = null;
    toastEl = null;
    ui.layer = null;
    sheet = null;
  }
  function launchApp() {
    appRunning = false;
    clearTimers();
    closeAllOverlays();
    if (dialerEl) { dialerEl.remove(); dialerEl = null; }
    sysEl.innerHTML = `<div class="splash"></div>`;
    deviceEl.classList.add("splashing");
    route = null;
    history = [];
    screenEl.innerHTML = "";
    appState = freshAppState();
    ui.isBottomSheetOpen = false;
    clearTimeout(splashTimer);
    splashTimer = setTimeout(() => {
      sysEl.innerHTML = "";
      deviceEl.classList.remove("splashing");
      appRunning = true;
      navigate("/login");
    }, 1400);
    panelEvent("launch");
  }
  function exitApp() {
    appRunning = false;
    clearTimers();
    closeAllOverlays();
    route = null;
    screenEl.innerHTML = "";
    showLauncher("Qwipo DP was closed.");
  }
  let suspendedRoute = null;
  function homeButton() {
    if (!appRunning) return;
    suspendedRoute = route;
    appRunning = false;
    showLauncher("Qwipo DP is in the background. Tap the icon to resume.", true);
  }
  function showLauncher(hint, resumable) {
    if (dialerEl) { dialerEl.remove(); dialerEl = null; }
    sysEl.innerHTML = `<div class="launcher"><div class="appicon" data-launch="${resumable ? "resume" : "launch"}"><img src="assets/icon.png" alt="Qwipo DP"></div><div class="name">Qwipo DP</div><div class="hint">${esc(hint)}</div></div>`;
    sysEl.querySelector("[data-launch]").addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.currentTarget.dataset.launch === "resume" && suspendedRoute) {
        sysEl.innerHTML = "";
        appRunning = true;
        onResume();
      } else {
        launchApp();
      }
    });
    panelEvent("route", null);
  }
  // app.component.ts setupAndroidHandlers() activityResumedEvent
  async function onResume() {
    const loggedIn = userService.loggedInUser();
    if (loggedIn) {
      const dp = await API.getDeliveryPartner(loggedIn);
      if (dp) appState.deliveryPartner = mapDeliveryPartner(dp);
    }
    const cache = await returnRepository.getAllReturns();
    if (cache.length > 0) {
      const hopData = await API.getHopsByHopId(cache[0].hopId);
      if (hopData && hopData[0] && hopData[0].status === HopStatus.Created) {
        appState.hop = hopData[0];
        appState.tripId = hopData[0].tripId;
        route = suspendedRoute;
        navigate("/hops");
        return;
      }
    }
    panelEvent("route", route);
  }

  // ---------------------------------------------------------------- jump list (side panel)
  const RAVI = "9876543210", MAHESH = "9000011111", KIRAN = "9012345678", ANIL = "9988776655";
  const JUMPS = [
    { group: "Sign in", label: "Mobile number", route: "/mobile-number-component" },
    { group: "Sign in", label: "Enter OTP", route: "/mobile-otp-component", otpFor: RAVI },
    { group: "Sign in", label: "Update required", phone: RAVI, route: "/app-version-check" },
    { group: "Sign in", label: "Thank you (inactive partner)", phone: ANIL, route: "/greeting" },
    { group: "Driver · Ravi", label: "Hops list (all active hops)", phone: RAVI, route: "/hop-list" },
    { group: "Driver · Ravi", label: "Trips list", phone: RAVI, route: "/trip-list" },
    { group: "Driver · Ravi", label: "Trip summary · In progress", phone: RAVI, trip: "TRP-HYD-0142", route: "/trips" },
    { group: "Driver · Ravi", label: "Trip summary · Not started", phone: RAVI, trip: "TRP-HYD-0157", route: "/trips" },
    { group: "Driver · Ravi", label: "Trip summary · Completed", phone: RAVI, trip: "TRP-HYD-0119", route: "/trips" },
    { group: "Driver · Ravi", label: "Trip summary · Cancelled", phone: RAVI, trip: "TRP-HYD-0128", route: "/trips" },
    { group: "Driver · Ravi", label: "Trip → Hops tab", phone: RAVI, trip: "TRP-HYD-0142", route: "/trips", tab: "hops" },
    { group: "Hop details", label: "Pickup from seller (done)", phone: RAVI, trip: "TRP-HYD-0142", hopMode: 1, route: "/hops" },
    { group: "Hop details", label: "Delivery · arrived (edit returns)", phone: RAVI, trip: "TRP-HYD-0142", hopName: "Sai Ram Supermarket", route: "/hops" },
    { group: "Hop details", label: "Delivery · arrived → Products", phone: RAVI, trip: "TRP-HYD-0142", hopName: "Sai Ram Supermarket", route: "/hops", tab: "products" },
    { group: "Hop details", label: "Delivery · not arrived yet", phone: RAVI, trip: "TRP-HYD-0142", hopName: "Venkateswara Provision Store", route: "/hops" },
    { group: "Hop details", label: "Delivery · done with a return → Returns", phone: RAVI, trip: "TRP-HYD-0142", hopName: "Balaji Kirana & General Stores", route: "/hops", tab: "returns" },
    { group: "Hop details", label: "Return to seller", phone: RAVI, trip: "TRP-HYD-0142", hopMode: 3, route: "/hops" },
    { group: "Hop details", label: "Pickup on a trip not started", phone: RAVI, trip: "TRP-HYD-0157", hopMode: 1, route: "/hops" },
    { group: "Hop details", label: "Delivery with no orders → Products", phone: RAVI, trip: "TRP-HYD-0157", hopName: "Fresh Basket Mini Mart", route: "/hops", tab: "products" },
    { group: "My Account", label: "My Account", phone: RAVI, route: "/my-info" },
    { group: "My Account", label: "Profile", phone: RAVI, route: "/profile" },
    { group: "My Account", label: "Contact Us", phone: RAVI, route: "/contact-us" },
    { group: "My Account", label: "Terms & Conditions", phone: RAVI, route: "/web-view", query: webViewSrcAssets[1] },
    { group: "Other roles", label: "Rider · trips list", phone: MAHESH, route: "/trip-list" },
    { group: "Other roles", label: "Rider · trip ready to complete", phone: MAHESH, trip: "TRP-HYD-0163", route: "/trips" },
    { group: "Other roles", label: "No trips today · trips", phone: KIRAN, route: "/trip-list" },
    { group: "Other roles", label: "No trips today · hops", phone: KIRAN, route: "/hop-list" },
  ];
  async function jumpTo(i) {
    const j = JUMPS[i];
    if (!j) return;
    clearTimeout(splashTimer);
    sysEl.innerHTML = "";
    deviceEl.classList.remove("splashing");
    clearTimers();
    closeAllOverlays();
    if (dialerEl) { dialerEl.remove(); dialerEl = null; }
    appRunning = true;
    appState = freshAppState();
    ui.isBottomSheetOpen = false;
    if (j.phone) {
      store.set("dp_loggedInUser", j.phone);
      const dp = await API.getDeliveryPartner(j.phone);
      appState.deliveryPartner = mapDeliveryPartner(dp);
      appState.appSettings = await API.getAppSettings(device.outdated);
    }
    if (j.otpFor) appState.loginMobileNumber = j.otpFor;
    const db = API.snapshot();
    if (j.trip) {
      const t = db.trips.find((x) => x.tripCode === j.trip);
      appState.tripId = t.tripId;
      appState.isNavigatedFrom = NavigatedFrom.Trip;
    }
    if (j.hopMode || j.hopName) {
      const h = db.hops.find((x) => x.tripId === appState.tripId && (j.hopMode ? x.pointMode === j.hopMode : x.pointName === j.hopName));
      appState.hop = mapHop(JSON.parse(JSON.stringify(h)));
      appState.isNavigatedFrom = NavigatedFrom.Trip;
    }
    if (j.route === "/hop-list") appState.isNavigatedFrom = NavigatedFrom.Non_Trip;
    route = null;
    history = [];
    navigate(j.route, j.query);
    if (j.tab === "hops") tripsShowHops(view);
    else if (j.tab) hopsSetTab(view, j.tab);
  }

  // public hooks for the side panel / device chrome
  window.DPControl = {
    jumps: JUMPS,
    jumpTo,
    launch: launchApp,
    back: onBackPressed,
    home: homeButton,
    recents: homeButton,
    goOffline() { device.online = false; if (appRunning) showSnack(); },
    goOnline() { device.online = true; },
    signInAs(phone) {
      store.set("dp_loggedInUser", phone);
      launchApp();
    },
    signOut() { store.del("dp_loggedInUser"); launchApp(); },
    resetAll() {
      ["dp_loggedInUser", RC_KEY, "dp_loc_perm", "dp_loc_deny", "dp_currentRoute"].forEach(store.del);
      API.reset();
      launchApp();
    },
    clearReturnCache() { store.del(RC_KEY); panelEvent("cache"); },
    get route() { return route; },
    get appState() { return appState; },
    returnCache: () => store.get(RC_KEY, {}),
  };

  launchApp();
})();
