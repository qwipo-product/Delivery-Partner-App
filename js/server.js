/*
 * Synthetic backend for the Qwipo Delivery Partner replica.
 * Mirrors the endpoints the real app calls (logistics seller service, auth, cache service)
 * and returns data in the same shape the app's services map it into.
 * All people, stores, phone numbers and orders here are made up.
 */
(function () {
  const LS_KEY = "dp_replica_server_v3";
  const LOGIN_OTP = "123456";

  // ---------- helpers ----------
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const latency = () => wait(250 + Math.random() * 350);

  // ---------- product art (synthetic pack shots, no brand marks) ----------
  function packArt(kind, c1, c2, label) {
    const t = String(label).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let body = "";
    if (kind === "bag") {
      body = `<path d="M30 22 L90 22 L98 104 Q60 112 22 104 Z" fill="${c1}"/><rect x="30" y="16" width="60" height="10" rx="3" fill="${c2}"/><rect x="34" y="52" width="52" height="26" rx="4" fill="#fff" opacity=".9"/>`;
    } else if (kind === "bottle") {
      body = `<rect x="50" y="10" width="20" height="14" rx="3" fill="${c2}"/><path d="M44 24 H76 Q82 34 82 44 V102 Q82 108 76 108 H44 Q38 108 38 102 V44 Q38 34 44 24Z" fill="${c1}"/><rect x="42" y="56" width="36" height="24" rx="3" fill="#fff" opacity=".9"/>`;
    } else if (kind === "pouch") {
      body = `<path d="M32 18 H88 L94 106 H26 Z" fill="${c1}"/><path d="M32 18 H88 L86 30 H34Z" fill="${c2}"/><rect x="36" y="54" width="48" height="26" rx="4" fill="#fff" opacity=".9"/>`;
    } else if (kind === "jar") {
      body = `<rect x="38" y="16" width="44" height="12" rx="3" fill="${c2}"/><rect x="32" y="28" width="56" height="80" rx="10" fill="${c1}"/><rect x="38" y="52" width="44" height="26" rx="4" fill="#fff" opacity=".9"/>`;
    } else {
      body = `<rect x="26" y="26" width="68" height="78" rx="6" fill="${c1}"/><path d="M26 26 L40 14 H106 L94 26Z" fill="${c2}"/><path d="M94 26 L106 14 V92 L94 104Z" fill="${c2}" opacity=".8"/><rect x="32" y="52" width="56" height="26" rx="4" fill="#fff" opacity=".9"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#F4F4F4"/>${body}<text x="60" y="69" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="#333" text-anchor="middle">${t}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ---------- catalog ----------
  const CATALOG = [
    { id: "PRD-10021", name: "Sona Masoori Rice 25 kg", mrp: 1650, price: 1520, kg: 25, caseSize: 1, art: ["bag", "#E9D8A6", "#BB3E03", "RICE"] },
    { id: "PRD-10034", name: "Refined Sunflower Oil 1 L Pouch", mrp: 165, price: 148, kg: 0.91, caseSize: 10, art: ["pouch", "#FFD166", "#EF8A17", "OIL"] },
    { id: "PRD-10047", name: "Toor Dal 1 kg", mrp: 180, price: 162, kg: 1, caseSize: 10, art: ["pouch", "#F6BD60", "#84A59D", "DAL"] },
    { id: "PRD-10052", name: "Whole Wheat Atta 10 kg", mrp: 485, price: 445, kg: 10, caseSize: 2, art: ["bag", "#F5EBE0", "#D4A373", "ATTA"] },
    { id: "PRD-10068", name: "Iodised Salt 1 kg", mrp: 28, price: 24, kg: 1, caseSize: 25, art: ["pouch", "#CAF0F8", "#0077B6", "SALT"] },
    { id: "PRD-10073", name: "Premium Tea Dust 500 g", mrp: 290, price: 262, kg: 0.5, caseSize: 12, art: ["box", "#9C6644", "#7F5539", "TEA"] },
    { id: "PRD-10085", name: "Glucose Biscuits 75 g", mrp: 10, price: 8.5, kg: 0.075, caseSize: 48, art: ["box", "#FFE8D6", "#CB997E", "BISCUIT"] },
    { id: "PRD-10091", name: "Detergent Powder 1 kg", mrp: 120, price: 104, kg: 1, caseSize: 20, art: ["pouch", "#A2D2FF", "#3A86FF", "WASH"] },
    { id: "PRD-10102", name: "Toilet Soap 100 g (Pack of 4)", mrp: 160, price: 138, kg: 0.4, caseSize: 24, art: ["box", "#FFC8DD", "#CDB4DB", "SOAP"] },
    { id: "PRD-10118", name: "Sugar 5 kg", mrp: 245, price: 228, kg: 5, caseSize: 4, art: ["bag", "#FFFFFF", "#8ECAE6", "SUGAR"] },
    { id: "PRD-10123", name: "Chana Dal 500 g", mrp: 75, price: 66, kg: 0.5, caseSize: 20, art: ["pouch", "#FFE066", "#06D6A0", "CHANA"] },
    { id: "PRD-10137", name: "Instant Noodles 70 g", mrp: 14, price: 12, kg: 0.07, caseSize: 96, art: ["pouch", "#FFBE0B", "#FB5607", "NOODLES"] },
    { id: "PRD-10149", name: "Coconut Oil 500 ml", mrp: 210, price: 188, kg: 0.46, caseSize: 24, art: ["bottle", "#E9F5DB", "#2D6A4F", "COCONUT"] },
    { id: "PRD-10152", name: "Tomato Ketchup 1 kg", mrp: 150, price: 132, kg: 1, caseSize: 12, art: ["bottle", "#E63946", "#1D3557", "KETCHUP"] },
    { id: "PRD-10166", name: "Dishwash Bar 200 g", mrp: 20, price: 17, kg: 0.2, caseSize: 60, art: ["box", "#B7E4C7", "#40916C", "DISH"] },
    { id: "PRD-10171", name: "Mango Pickle 500 g", mrp: 130, price: 112, kg: 0.5, caseSize: 24, art: ["jar", "#F4A261", "#E76F51", "PICKLE"] },
  ];
  const P = Object.fromEntries(CATALOG.map((p) => [p.id, p]));

  // ---------- places ----------
  const SELLERS = {
    V1: { name: "Sri Lakshmi Ganapathi Traders", phone: "9849012345", address: "Plot 14, IDA Balanagar, Kukatpally Industrial Estate, Hyderabad, Telangana", pincode: "500037", lat: "17.4849", lng: "78.4138" },
    V2: { name: "Krishna FMCG Distributors", phone: "9866123450", address: "6-3-249, Road No 1, Banjara Hills, Hyderabad, Telangana", pincode: "500034", lat: "17.4126", lng: "78.4482" },
    V3: { name: "Annapurna Agro Foods", phone: "9700112233", address: "Survey No 45, Shamshabad Main Road, Rangareddy, Telangana", pincode: "501218", lat: "17.2403", lng: "78.4294" },
  };
  const RETAILERS = {
    R1: { name: "Balaji Kirana & General Stores", phone: "9912345601", address: "Shop 3, KPHB Colony Phase 1, Kukatpally, Hyderabad", pincode: "500072", lat: "17.4933", lng: "78.3990" },
    R2: { name: "Sai Ram Supermarket", phone: "9912345602", address: "1-2-45, Moosapet Main Road, Near Metro Pillar 812, Hyderabad", pincode: "500018", lat: "17.4691", lng: "78.4255" },
    R3: { name: "Venkateswara Provision Store", phone: "9912345603", address: "Plot 22, Sanath Nagar Main Road, Hyderabad", pincode: "500018", lat: "17.4568", lng: "78.4434" },
    R4: { name: "Annapurna Mart", phone: "9912345604", address: "Erragadda X Roads, Opp. ESI Hospital, Hyderabad", pincode: "500018", lat: "17.4566", lng: "78.4337" },
    R5: { name: "New Bharat Traders", phone: "9912345605", address: "7-1-28, Ameerpet Main Road, Hyderabad", pincode: "500016", lat: "17.4375", lng: "78.4482" },
    R6: { name: "Sri Durga Kirana", phone: "9912345606", address: "H.No 8-3-167, SR Nagar, Hyderabad", pincode: "500038", lat: "17.4416", lng: "78.4410" },
    R7: { name: "Fresh Basket Mini Mart", phone: "9912345607", address: "Plot 9, Ayyappa Society, Madhapur, Hyderabad", pincode: "500081", lat: "17.4483", lng: "78.3915" },
    R8: { name: "Lakshmi General Stores", phone: "9912345608", address: "Shamshabad Bus Stand Road, Rangareddy", pincode: "501218", lat: "17.2560", lng: "78.3900" },
    R9: { name: "Sri Sai Balaji Supermarket", phone: "9912345609", address: "RGIA Road, Shamshabad, Rangareddy", pincode: "501218", lat: "17.2471", lng: "78.4120" },
  };

  // ---------- partners (the roles) ----------
  const PARTNERS = [
    { id: "dp-1001", seller_id: "seller-01", delivery_partner_type: "Driver", name: "Ravi Teja Kumar", phone: "9876543210", email: "ravi.teja@example.in", status: "active", license_number: "TS0920190012345", experience_years: "6", blood_group: "B+" },
    { id: "dp-1002", seller_id: "seller-01", delivery_partner_type: "Helper", name: "Suresh Babu", phone: "9123456780", email: "suresh.babu@example.in", status: "active", experience_years: "2", blood_group: "O+" },
    { id: "dp-1003", seller_id: "seller-02", delivery_partner_type: "Rider", name: "Mahesh Yadav", phone: "9000011111", email: "mahesh.yadav@example.in", status: "active", experience_years: "4", blood_group: "A+" },
    { id: "dp-1004", seller_id: "seller-02", delivery_partner_type: "Helper", name: "Prakash Goud", phone: "9000022222", email: "prakash.goud@example.in", status: "active", experience_years: "1", blood_group: "AB+" },
    { id: "dp-1005", seller_id: "seller-01", delivery_partner_type: "Driver", name: "Anil Varma", phone: "9988776655", email: "anil.varma@example.in", status: "inactive", experience_years: "3", blood_group: "O-" },
    { id: "dp-1006", seller_id: "seller-03", delivery_partner_type: "Driver", name: "Kiran Rao", phone: "9012345678", email: null, status: "active", experience_years: "5", blood_group: "B-" },
  ];

  const VEHICLES = {
    ace: { name: "Tata Ace Gold", type: "Mini Truck", reg: "TS 08 UA 4521" },
    dost: { name: "Ashok Leyland Dost+", type: "LCV", reg: "TS 07 HK 9087" },
    bolero: { name: "Mahindra Bolero Pik-Up", type: "Pickup Truck", reg: "TS 09 FD 3310" },
    ape: { name: "Piaggio Ape Xtra", type: "Three Wheeler", reg: "TS 13 TB 7765" },
  };

  // ---------- builder ----------
  function build() {
    const now = new Date();
    const at = (dayOffset, h, m) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const datePart = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    let orderSeq = 101;
    let itemSeq = 1;
    let hopSeq = 1;
    let upcSeq = 17;

    const trips = [];
    const hops = [];
    const hopItems = {};

    function line(pid, qty, orderNumber, linkedOrderId) {
      const p = P[pid];
      const cs = p.caseSize;
      return {
        linkedOrderItemId: `OI-${pad(itemSeq++, 5)}`,
        itemId: p.id,
        name: p.name,
        mrp: String(p.mrp),
        cases: String(Math.floor(qty / cs)),
        pcs: String(qty % cs),
        saleValue: (qty * p.price).toFixed(2),
        orderedQty: String(qty),
        sellerName: "",
        imageUrl: packArt(...p.art),
        upc: `8907${pad(upcSeq++, 9)}`,
        orderNumber,
        linkedOrderId,
      };
    }

    function order(lines, sellerName, dayOffset, status) {
      const orderNumber = `QW${datePart}${pad(orderSeq++, 4)}`;
      const linkedOrderId = `LO-${orderNumber.slice(2)}`;
      const products = lines.map(([pid, qty]) => {
        const l = line(pid, qty, orderNumber, linkedOrderId);
        l.sellerName = sellerName;
        return l;
      });
      const amount = products.reduce((s, x) => s + Number(x.saleValue), 0);
      const weight = lines.reduce((s, [pid, qty]) => s + P[pid].kg * qty, 0);
      return {
        orderNumber,
        orderAmount: Math.round(amount * 100) / 100,
        orderDate: at(dayOffset, 10 + (orderSeq % 7), (orderSeq * 7) % 60),
        status,
        weight: Math.round(weight * 100) / 100,
        deliveryProducts: products,
        returnProducts: [],
      };
    }

    function returnCopy(prod, qty) {
      const p = P[prod.itemId];
      return Object.assign(clone(prod), {
        cases: String(Math.floor(qty / p.caseSize)),
        pcs: String(qty % p.caseSize),
        saleValue: (qty * p.price).toFixed(2),
        orderedQty: String(qty),
      });
    }

    function otp() {
      return String(1000 + Math.floor(Math.random() * 9000));
    }

    function addTrip(def) {
      const tripId = `trip-${def.code.toLowerCase()}`;
      const seller = SELLERS[def.seller];
      const trip = {
        tripId,
        tripCode: def.code,
        orderId: def.orderId,
        sellerId: "seller-01",
        riderId: def.rider,
        helperId: def.helper,
        vehicleId: def.vehicle,
        status: def.status,
        startTime: def.status === "Created" ? null : at(0, def.startH || 7, 30),
        endTime: def.status === "Completed" ? at(0, (def.startH || 7) + 4, 10) : null,
        creationDate: at(0, def.createdH, def.createdM || 0),
        targetDate: ymd(now),
        eta: def.eta || 240,
        totalDistanceKm: def.km,
      };
      trips.push(trip);

      const deliveryOrders = [];
      let stop = 1;
      // pickup hop
      const pickup = {
        id: `hop-${pad(hopSeq++, 4)}`,
        tripId,
        hopType: "Pickup",
        pointMode: 1,
        pointType: 1,
        pointName: seller.name,
        pointPhone: seller.phone,
        pointAddress: seller.address,
        pointPincode: seller.pincode,
        pointLat: seller.lat,
        pointLng: seller.lng,
        status: def.pickupStatus,
        stopNumber: String(stop++),
        fulfillmentId: `FUL-${tripId.slice(5)}-P`,
        otp: otp(),
      };
      hops.push(pickup);
      hopItems[pickup.id] = [];

      for (const d of def.deliveries) {
        const r = RETAILERS[d.retailer];
        const hop = {
          id: `hop-${pad(hopSeq++, 4)}`,
          tripId,
          hopType: "Delivery",
          pointMode: 2,
          pointType: 2,
          pointName: r.name,
          pointPhone: r.phone,
          pointAddress: r.address,
          pointPincode: r.pincode,
          pointLat: r.lat,
          pointLng: r.lng,
          status: d.status,
          stopNumber: String(stop++),
          fulfillmentId: `FUL-${tripId.slice(5)}-${stop}`,
          otp: otp(),
        };
        hops.push(hop);
        const orders = (d.orders || []).map((lines) => order(lines, seller.name, -1, d.orderStatus || "Trip Assigned"));
        // pre-recorded returns coming back from the server for this hop
        (d.returns || []).forEach(([orderIdx, lineIdx, qty]) => {
          const o = orders[orderIdx];
          o.returnProducts.push(returnCopy(o.deliveryProducts[lineIdx], qty));
        });
        hopItems[hop.id] = orders;
        orders.forEach((o) => deliveryOrders.push({ hop, order: o }));
      }

      // return-to-seller hop
      const ret = {
        id: `hop-${pad(hopSeq++, 4)}`,
        tripId,
        hopType: "Return",
        pointMode: 3,
        pointType: 1,
        pointName: seller.name,
        pointPhone: seller.phone,
        pointAddress: seller.address,
        pointPincode: seller.pincode,
        pointLat: seller.lat,
        pointLng: seller.lng,
        status: def.returnStatus,
        stopNumber: String(stop++),
        fulfillmentId: `FUL-${tripId.slice(5)}-R`,
        otp: otp(),
      };
      hops.push(ret);
      hopItems[ret.id] = [];

      // pickup hop carries every delivery order
      hopItems[pickup.id] = deliveryOrders.map(({ order: o }) => {
        const c = clone(o);
        c.returnProducts = [];
        c.status = def.pickupStatus === "Completed" ? "In Transit" : "Trip Assigned";
        return c;
      });
      // return hop carries every returned line
      deliveryOrders.forEach(({ order: o }) => {
        if (o.returnProducts.length) {
          hopItems[ret.id].push({
            orderNumber: o.orderNumber,
            orderAmount: o.orderAmount,
            orderDate: o.orderDate,
            status: "Returned",
            weight: Math.round(o.returnProducts.reduce((s, x) => s + P[x.itemId].kg * Number(x.orderedQty), 0) * 100) / 100,
            deliveryProducts: [],
            returnProducts: clone(o.returnProducts),
          });
        }
      });
      if (def.returnCustomer) {
        const rc = RETAILERS[def.returnCustomer];
        ret.customerBusinessName = rc.name;
        ret.customerMobileNumber = rc.phone;
      }
      return trip;
    }

    // Ravi (Driver) + Suresh (Helper): one live trip, one not started, one finished, one cancelled
    addTrip({
      code: "TRP-HYD-0142", orderId: "LGO-260142", seller: "V1", rider: "dp-1001", helper: "dp-1002", vehicle: "ace",
      status: "InProgress", createdH: 6, createdM: 40, startH: 7, km: "38.6",
      pickupStatus: "Completed", returnStatus: "Created", returnCustomer: "R1",
      deliveries: [
        { retailer: "R1", status: "Completed", orderStatus: "Partial Delivery", orders: [[["PRD-10021", 2], ["PRD-10034", 12], ["PRD-10068", 25]]], returns: [[0, 1, 2]] },
        { retailer: "R2", status: "InProgress", orders: [[["PRD-10052", 4], ["PRD-10047", 10], ["PRD-10085", 48], ["PRD-10149", 6]], [["PRD-10091", 20], ["PRD-10102", 6]]] },
        { retailer: "R3", status: "Created", orders: [[["PRD-10118", 4], ["PRD-10073", 12], ["PRD-10137", 96]]] },
        { retailer: "R4", status: "Created", orders: [[["PRD-10123", 20], ["PRD-10152", 6]]] },
      ],
    });
    addTrip({
      code: "TRP-HYD-0157", orderId: "LGO-260157", seller: "V2", rider: "dp-1001", helper: "dp-1002", vehicle: "dost",
      status: "Created", createdH: 8, createdM: 15, km: "22.4",
      pickupStatus: "Created", returnStatus: "Created",
      deliveries: [
        { retailer: "R5", status: "Created", orders: [[["PRD-10034", 20], ["PRD-10166", 60]]] },
        { retailer: "R6", status: "Created", orders: [[["PRD-10021", 1], ["PRD-10171", 12], ["PRD-10068", 25]], [["PRD-10085", 96]]] },
        { retailer: "R7", status: "Created", orders: [] },
      ],
    });
    addTrip({
      code: "TRP-HYD-0119", orderId: "LGO-260119", seller: "V3", rider: "dp-1001", helper: "dp-1002", vehicle: "bolero",
      status: "Completed", createdH: 5, createdM: 10, startH: 5, km: "41.2",
      pickupStatus: "Completed", returnStatus: "Completed", returnCustomer: "R9",
      deliveries: [
        { retailer: "R8", status: "Completed", orderStatus: "Delivered", orders: [[["PRD-10052", 6], ["PRD-10118", 8]]] },
        { retailer: "R9", status: "Completed", orderStatus: "Partial Delivery", orders: [[["PRD-10047", 20], ["PRD-10123", 20], ["PRD-10137", 48]]], returns: [[0, 2, 12]] },
      ],
    });
    addTrip({
      code: "TRP-HYD-0128", orderId: "LGO-260128", seller: "V2", rider: "dp-1001", helper: "dp-1002", vehicle: "ape",
      status: "Cancelled", createdH: 6, createdM: 5, km: "12.9",
      pickupStatus: "Cancelled", returnStatus: "Cancelled",
      deliveries: [{ retailer: "R5", status: "Cancelled", orderStatus: "Cancelled", orders: [[["PRD-10091", 10]]] }],
    });

    // Mahesh (Rider): live trip with every hop done (ready to close) + one not started
    addTrip({
      code: "TRP-HYD-0163", orderId: "LGO-260163", seller: "V2", rider: "dp-1003", helper: "dp-1004", vehicle: "ape",
      status: "InProgress", createdH: 7, createdM: 25, startH: 8, km: "18.3",
      pickupStatus: "Completed", returnStatus: "Completed", returnCustomer: "R6",
      deliveries: [
        { retailer: "R5", status: "Completed", orderStatus: "Delivered", orders: [[["PRD-10034", 10], ["PRD-10152", 6]]] },
        { retailer: "R6", status: "Completed", orderStatus: "Partial Delivery", orders: [[["PRD-10073", 12], ["PRD-10166", 60]]], returns: [[0, 0, 3]] },
      ],
    });
    addTrip({
      code: "TRP-HYD-0171", orderId: "LGO-260171", seller: "V1", rider: "dp-1003", helper: "dp-1004", vehicle: "ace",
      status: "Created", createdH: 9, createdM: 5, km: "26.7",
      pickupStatus: "Created", returnStatus: "Created",
      deliveries: [
        { retailer: "R7", status: "Created", orders: [[["PRD-10021", 1], ["PRD-10102", 12]]] },
        { retailer: "R3", status: "Created", orders: [[["PRD-10118", 4]]] },
      ],
    });

    return {
      version: 3,
      date: ymd(now),
      partners: clone(PARTNERS),
      settings: {
        appMinVersion: { android: "1.0.0", iOS: "1.0.0" },
        contact: { number: "9876500000", email: "info@qwipo.com", message: "Contact us through this email ID.We will respond in 3 to 4 business days." },
        tripRangeLimit: 150,
      },
      trips,
      hops,
      hopItems,
      returnsLog: [],
    };
  }

  // ---------- persistence ----------
  let db = null;
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 3 && parsed.date === ymd(new Date())) return parsed;
      }
    } catch (e) { /* storage unavailable */ }
    return build();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ }
  }
  db = load();
  save();

  const partnerById = (id) => db.partners.find((p) => p.id === id);
  const tripById = (id) => db.trips.find((t) => t.tripId === id);
  const hopsOfTrip = (tripId) => db.hops.filter((h) => h.tripId === tripId);
  const round2 = (n) => Math.round(n * 100) / 100;

  function tripTotals(trip) {
    const hs = hopsOfTrip(trip.tripId);
    const deliveryHops = hs.filter((h) => h.pointMode === 2);
    let weight = 0;
    let products = 0;
    deliveryHops.forEach((h) => (db.hopItems[h.id] || []).forEach((o) => {
      weight += o.weight;
      products += o.deliveryProducts.length;
    }));
    return {
      hops: hs.length,
      pickupHops: hs.filter((h) => h.pointMode === 1).length,
      deliveryHops: deliveryHops.length,
      returnHops: hs.filter((h) => h.pointMode === 3).length,
      weight: round2(weight),
      products,
      isHopsCompleted: hs.every((h) => h.status === "Completed"),
    };
  }

  // ---------- API (same contract as the app's services) ----------
  const api = {
    LOGIN_OTP,
    reset() {
      db = build();
      save();
    },
    snapshot() {
      return db;
    },
    partners() {
      return clone(db.partners);
    },
    hopById(id) {
      return clone(db.hops.find((h) => h.id === id) || null);
    },

    // auth service
    async sendOTPCode(mobile) {
      await latency();
      return true;
    },
    async verifyOtp(mobile, otp) {
      await latency();
      return { isValid: otp === LOGIN_OTP };
    },

    // GET {seller}/delivery-partner/{mobile}?type=mobileNumber
    async getDeliveryPartner(mobile) {
      await latency();
      const p = db.partners.find((x) => x.phone === mobile);
      return p ? clone(p) : null;
    },

    // GET {cache}/app_info/get/delivery_partner_app
    async getAppSettings(outdated) {
      await latency();
      const s = clone(db.settings);
      if (outdated) s.appMinVersion = { android: "1.1.0", iOS: "1.1.0" };
      return s;
    },

    // POST {seller}/trips/filters
    async getTripList(payload) {
      await latency();
      const id = payload.deliveryPartnerId;
      return db.trips
        .filter((t) => t.riderId === id || t.helperId === id)
        .map((t) => {
          const tot = tripTotals(t);
          const v = VEHICLES[t.vehicleId] || {};
          const rider = partnerById(t.riderId) || {};
          const helper = partnerById(t.helperId) || {};
          return {
            orderId: t.orderId, tripId: t.tripId, sellerId: t.sellerId, riderId: t.riderId, helperId: t.helperId,
            vehicleId: t.vehicleId, tripCode: t.tripCode, status: t.status, totalDistanceKm: t.totalDistanceKm,
            dropPoints: tot.deliveryHops, startTime: t.startTime, endTime: t.endTime, creationDate: t.creationDate,
            totalWeightKg: tot.weight, totalVolumeCubicCm: 0, eta: t.eta, targetDate: t.targetDate,
            hops: tot.hops, pickupHops: tot.pickupHops, deliveryHops: tot.deliveryHops, returnHops: tot.returnHops,
            vehicleName: v.name, vehicleType: v.type, vehicleRegistrationNumber: v.reg,
            driver: rider.name, phone: rider.phone, helperName: helper.name, helperPhone: helper.phone,
          };
        });
    },

    // GET {seller}/trips/summary/{id}
    async getTripSummaryByTripId(id) {
      await latency();
      const t = tripById(id);
      if (!t) return [];
      const tot = tripTotals(t);
      return [{
        orderId: t.orderId, tripId: t.tripId, sellerId: t.sellerId, riderId: t.riderId, helperId: t.helperId,
        vehicleId: t.vehicleId, tripCode: t.tripCode, status: t.status, startTime: t.startTime, endTime: t.endTime,
        totalDistance: t.totalDistanceKm, dropPoints: tot.deliveryHops, totalWeight: tot.weight, totalVolumeCubicCm: null,
        eta: t.eta, targetDate: t.targetDate, products: tot.products, pickups: tot.pickupHops,
        deliveries: tot.deliveryHops, returns: tot.returnHops, isHopsCompleted: tot.isHopsCompleted,
      }];
    },

    // PUT {seller}/trips/status
    async updateTripStatus(payload) {
      await latency();
      const t = tripById(payload.tripId);
      if (!t) return false;
      t.status = payload.status;
      if (payload.status === "InProgress") t.startTime = new Date().toISOString();
      if (payload.status === "Completed") t.endTime = new Date().toISOString();
      save();
      return true;
    },

    // POST {seller}/hops/filters
    async getHopsByFilters(filters) {
      await latency();
      let list;
      if (filters.tripId) {
        list = hopsOfTrip(filters.tripId);
      } else if (filters.deliveryPartnerId) {
        const id = filters.deliveryPartnerId;
        const active = db.trips.filter((t) => (t.riderId === id || t.helperId === id) && t.status === "InProgress").map((t) => t.tripId);
        list = db.hops.filter((h) => active.includes(h.tripId));
      } else {
        list = [];
      }
      return clone(list);
    },

    // GET {seller}/hops/{hopId}
    async getHopsByHopId(hopId) {
      await latency();
      const h = db.hops.find((x) => x.id === hopId);
      return h ? [clone(h)] : [];
    },

    // GET {seller}/hops/summary/{hopId}
    async getHopSummary(hopId) {
      await latency();
      const h = db.hops.find((x) => x.id === hopId);
      if (!h) return null;
      const t = tripById(h.tripId);
      const items = db.hopItems[h.id] || [];
      const pickupHop = hopsOfTrip(h.tripId).find((x) => x.pointMode === 1);
      const isReturn = h.pointMode === 3;
      const productCount = items.reduce((s, o) => s + (isReturn ? o.returnProducts.length : o.deliveryProducts.length), 0);
      const weight = items.reduce((s, o) => s + o.weight, 0);
      return Object.assign(clone(h), {
        pickUps: h.pointMode === 1 ? String(items.length) : "0",
        deliveries: h.pointMode === 2 ? String(items.length) : "0",
        returns: isReturn ? String(items.length) : "0",
        products: String(productCount),
        weight: round2(weight),
        tripStatus: t ? t.status : null,
        customerBusinessName: h.customerBusinessName,
        customerMobileNumber: h.customerMobileNumber,
        isPickupHopCompleted: !!pickupHop && pickupHop.status === "Completed",
      });
    },

    // PUT {seller}/hops/status
    async updateHopStatus(payload) {
      await latency();
      const h = db.hops.find((x) => x.id === payload.hopId);
      if (!h) return false;
      h.status = payload.status;
      if (payload.status === "Completed" && h.pointMode === 2) {
        (db.hopItems[h.id] || []).forEach((o) => {
          const ordered = o.deliveryProducts.reduce((s, x) => s + Number(x.orderedQty), 0);
          const returned = o.returnProducts.reduce((s, x) => s + Number(x.orderedQty), 0);
          o.status = returned === 0 ? "Delivered" : returned >= ordered ? "Returned" : "Partial Delivery";
        });
      }
      save();
      return true;
    },

    // POST {seller}/hops/return
    async returnHopOrders(payload) {
      await latency();
      const h = db.hops.find((x) => x.id === payload.hopId);
      if (!h) return false;
      const orders = db.hopItems[h.id] || [];
      const retHop = hopsOfTrip(h.tripId).find((x) => x.pointMode === 3);
      payload.returnItems.forEach((ri) => {
        const o = orders.find((x) => x.deliveryProducts.some((p) => p.linkedOrderItemId === ri.linkedOrderItemId));
        if (!o) return;
        const prod = o.deliveryProducts.find((p) => p.linkedOrderItemId === ri.linkedOrderItemId);
        const p = P[prod.itemId];
        const addTo = (list) => {
          const ex = list.find((x) => x.linkedOrderItemId === prod.linkedOrderItemId);
          if (ex) {
            const q = Number(ex.orderedQty) + ri.quantity;
            Object.assign(ex, { orderedQty: String(q), cases: String(Math.floor(q / p.caseSize)), pcs: String(q % p.caseSize), saleValue: (q * p.price).toFixed(2) });
          } else {
            list.push(Object.assign(clone(prod), {
              orderedQty: String(ri.quantity), cases: String(Math.floor(ri.quantity / p.caseSize)),
              pcs: String(ri.quantity % p.caseSize), saleValue: (ri.quantity * p.price).toFixed(2),
            }));
          }
        };
        addTo(o.returnProducts);
        if (retHop) {
          const items = db.hopItems[retHop.id] || (db.hopItems[retHop.id] = []);
          let ro = items.find((x) => x.orderNumber === o.orderNumber);
          if (!ro) {
            ro = { orderNumber: o.orderNumber, orderAmount: o.orderAmount, orderDate: o.orderDate, status: "Returned", weight: 0, deliveryProducts: [], returnProducts: [] };
            items.push(ro);
          }
          addTo(ro.returnProducts);
          ro.weight = round2(ro.returnProducts.reduce((s, x) => s + P[x.itemId].kg * Number(x.orderedQty), 0));
          if (!retHop.customerBusinessName) {
            retHop.customerBusinessName = h.pointName;
            retHop.customerMobileNumber = h.pointPhone;
          }
        }
      });
      db.returnsLog.push({ at: new Date().toISOString(), payload });
      save();
      return { success: true };
    },

    // GET {seller}/hopItems/{hopId}
    async getHopOrdersWithItems(hopId) {
      await latency();
      const items = db.hopItems[hopId] || [];
      return clone(items).map((o) => ({
        orderNumber: o.orderNumber,
        orderAmount: Number(o.orderAmount),
        orderDate: o.orderDate,
        status: o.status,
        weight: Number(o.weight),
        deliveryProducts: o.deliveryProducts.map((p) => Object.assign(p, { itemKey: `${p.itemId}-${p.orderNumber}`, id: p.linkedOrderItemId })),
        returnProducts: o.returnProducts.map((p) => Object.assign(p, { itemKey: `${p.itemId}-${p.orderNumber}`, id: p.linkedOrderItemId })),
      }));
    },

    // POST retailer order OTP
    async sendRetailerOrderOtp(list) {
      await latency();
      return true;
    },
  };

  window.DPServer = api;
})();
