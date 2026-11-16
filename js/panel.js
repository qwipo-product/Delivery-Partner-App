/* Side panel + device chrome for the replica (not part of the app itself). */
(function () {
  "use strict";
  const C = window.DPControl;
  const D = window.DPDevice;
  const API = window.DPServer;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const params = new URLSearchParams(location.search);
  const bare = params.has("bare");
  if (bare) document.body.classList.add("bare");

  // ---------- fit the phone to the window ----------
  const scaleBox = $("#deviceScale");
  const device = $("#device");
  function fit() {
    if (bare) { scaleBox.style.transform = "none"; return; }
    const w = device.offsetWidth;
    const h = device.offsetHeight;
    const narrow = window.innerWidth <= 900;
    const availH = narrow ? Infinity : window.innerHeight - 32;
    const availW = window.innerWidth - 32;
    const s = Math.min(1, availH / h, availW / w);
    scaleBox.style.transform = `scale(${s})`;
    scaleBox.style.width = w * s + "px";
    scaleBox.style.height = h * s + "px";
  }
  window.addEventListener("resize", fit);
  fit();

  // ---------- status bar clock ----------
  function tick() {
    const d = new Date();
    $("#sbTime").textContent = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  tick();
  setInterval(tick, 15000);

  // ---------- navigation bar ----------
  $("#navBack").addEventListener("click", () => C.back());
  $("#navHome").addEventListener("click", () => C.home());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); C.back(); }
  });

  // ---------- tabs ----------
  document.querySelectorAll("[data-ptab]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-ptab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.ptab; });
    if (b.dataset.ptab === "inbox") { unread = 0; badge(); }
  }));

  // ---------- personas ----------
  const LANDS = {
    "9876543210": "Lands on Hops (Driver). Has a trip in progress, one not started, one completed and one cancelled.",
    "9123456780": "Lands on Hops (Helper). Same trips as Ravi.",
    "9000011111": "Lands on Trips (any type other than Driver/Helper). One trip with every hop done, ready to finish.",
    "9000022222": "Lands on Hops (Helper on Mahesh's trips).",
    "9988776655": "Inactive partner: sees the “Thank You” screen with Home / My Account footer.",
    "9012345678": "No trips today: empty Trips and Hops screens.",
  };
  const personas = API.partners();
  $("#personas").innerHTML = personas.map((p) => `
    <div class="persona">
      <div class="name">${esc(p.name)}<span class="tag">${esc(p.delivery_partner_type)}</span>${p.status !== "active" ? '<span class="tag off">Inactive</span>' : ""}</div>
      <div class="meta mono">${esc(p.phone)}</div>
      <button type="button" class="btn primary" data-signin="${esc(p.phone)}">Sign in</button>
      <div class="lands">${esc(LANDS[p.phone] || "")}</div>
    </div>`).join("");
  $("#personas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-signin]");
    if (b) C.signInAs(b.dataset.signin);
  });

  // ---------- jump list ----------
  const jumps = C.jumps;
  let html = "";
  let group = null;
  jumps.forEach((j, i) => {
    if (j.group !== group) {
      if (group !== null) html += "</div>";
      group = j.group;
      html += `<div class="jgroup">${esc(group)}</div><div class="jlist">`;
    }
    html += `<button type="button" data-jump="${i}">${esc(j.label)}</button>`;
  });
  html += "</div>";
  $("#jumps").innerHTML = html;
  $("#jumps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump]");
    if (!b) return;
    document.querySelectorAll("[data-jump]").forEach((x) => x.classList.toggle("cur", x === b));
    C.jumpTo(Number(b.dataset.jump));
  });

  // ---------- device controls ----------
  document.querySelectorAll('input[name="loc"]').forEach((r) => r.addEventListener("change", () => { D.location = r.value; renderState(); }));
  $("#outdated").addEventListener("change", (e) => { D.outdated = e.target.checked; });
  $("#goOffline").addEventListener("click", () => C.goOffline());
  $("#relaunch").addEventListener("click", () => C.launch());
  $("#signOut").addEventListener("click", () => C.signOut());
  $("#resetAll").addEventListener("click", () => {
    if (window.confirm("Reset every trip, hop and order to the starting data and sign out?")) C.resetAll();
  });

  // ---------- state readout ----------
  function renderState() {
    const st = C.appState;
    const hop = st && st.hop;
    const cache = C.returnCache();
    const pending = Object.keys(cache).map((k) => {
      const h = API.hopById(k);
      const qty = cache[k].returnOrders.reduce((s, x) => s + Number(x.quantity || 0), 0);
      return `${esc(h ? h.pointName : k)} (${qty} units)`;
    });
    const who = st && st.deliveryPartner && st.deliveryPartner.name;
    $("#state").innerHTML = `
      <div>Screen: <b>${esc(C.route || "app closed")}</b></div>
      <div>Signed in: <b>${esc(who || "nobody")}</b></div>
      ${hop ? `<div>Open hop: <b>${esc(hop.pointName)}</b> · ${esc(hop.status)} · OTP <b class="mono">${esc(hop.otp)}</b></div>` : ""}
      <div>Pending returns on device: <b>${pending.length ? pending.join(", ") : "none"}</b></div>`;
  }

  // ---------- inbox ----------
  let unread = 0;
  function badge() {
    const b = $("#inboxBadge");
    b.hidden = unread === 0;
    b.textContent = String(unread);
  }
  function addMsg(to, text) {
    const li = document.createElement("li");
    const t = new Date();
    li.innerHTML = `<small>To ${esc(to)} · ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}</small>${esc(text)}`;
    $("#inbox").prepend(li);
    const visible = !$('[data-pane="inbox"]').hidden;
    if (!visible) { unread++; badge(); }
  }

  D.listeners.push((type, data) => {
    if (type === "sms") addMsg(data.to, data.text);
    if (type === "route" || type === "cache" || type === "launch") setTimeout(renderState, 0);
  });
  setInterval(renderState, 1500);
  renderState();
})();
