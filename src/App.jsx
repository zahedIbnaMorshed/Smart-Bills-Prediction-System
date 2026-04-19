// ════════════════════════════════════════════════════════════════════
//  FRONTEND — BidyutBill  ⚡🔥
//  Responsive · Bilingual (বাংলা / English) · Live Tariff Sync
// ════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

// ── Inline DB (self-contained for artifact deployment) ───────────────
const DB_NAME = "BidyutBillDB2";
const DB_VER = 2;
let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (_db) { res(_db); return; }
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("users")) {
        const s = db.createObjectStore("users", { keyPath: "id" });
        s.createIndex("email", "email", { unique: true });
      }
      if (!db.objectStoreNames.contains("history"))
        db.createObjectStore("history", { keyPath: "id" }).createIndex("userId", "userId");
      if (!db.objectStoreNames.contains("feedbacks"))
        db.createObjectStore("feedbacks", { keyPath: "id" }).createIndex("userId", "userId");
      if (!db.objectStoreNames.contains("reset_tokens"))
        db.createObjectStore("reset_tokens", { keyPath: "token" });
      if (!db.objectStoreNames.contains("tariff_cache"))
        db.createObjectStore("tariff_cache", { keyPath: "id" });
    };
    r.onsuccess = (e) => { _db = e.target.result; res(_db); };
    r.onerror = (e) => rej(e.target.error);
  });
}
const dbOp = (store, mode, fn) => openDB().then(db => new Promise((r, j) => {
  const req = fn(db.transaction(store, mode).objectStore(store));
  req.onsuccess = () => r(req.result);
  req.onerror = () => j(req.error);
}));
const dbGet = (s, k) => dbOp(s, "readonly", o => o.get(k));
const dbPut = (s, v) => dbOp(s, "readwrite", o => o.put(v));
const dbDel = (s, k) => dbOp(s, "readwrite", o => o.delete(k));
const dbIdx = (s, i, v) => dbOp(s, "readonly", o => o.index(i).get(v));
const dbIdxAll = (s, i, v) => dbOp(s, "readonly", o => o.index(i).getAll(v));
async function hashPass(p) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
}
const gid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const ls = { g: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, s: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };

// ── Tariff Defaults ──────────────────────────────────────────────────
const D_ELEC_SLABS = [
  { upTo: 50, rate: 4.63, bn: "লাইফলাইন (০–৫০ ইউনিট)", en: "Lifeline (0–50 units)" },
  { upTo: 75, rate: 5.72, bn: "৫১–৭৫ ইউনিট", en: "51–75 units" },
  { upTo: 200, rate: 6.00, bn: "৭৬–২০০ ইউনিট", en: "76–200 units" },
  { upTo: 300, rate: 6.34, bn: "২০১–৩০০ ইউনিট", en: "201–300 units" },
  { upTo: 400, rate: 9.94, bn: "৩০১–৪০০ ইউনিট", en: "301–400 units" },
  { upTo: Infinity, rate: 11.46, bn: "৪০১+ ইউনিট", en: "401+ units" },
];
const D_DEMAND = 42, D_SVC = 20, D_MRENT_E = 10, D_VAT = 0.05;
const D_GAS_PREP = 18, D_GAS_FIX = { single: { m: 990, m3: 55 }, double: { m: 1080, m3: 60 } }, D_MRENT_G = 100;

const ELEC_PROVIDERS = [
  { id: "desco", bn: "ডেসকো", en: "DESCO", areaBn: "ঢাকা উত্তর", areaEn: "North Dhaka" },
  { id: "dpdc", bn: "ডিপিডিসি", en: "DPDC", areaBn: "ঢাকা দক্ষিণ", areaEn: "South Dhaka" },
  { id: "bpdb", bn: "বিপিডিবি", en: "BPDB", areaBn: "জাতীয়", areaEn: "National" },
  { id: "nesco", bn: "নেসকো", en: "NESCO", areaBn: "রাজশাহী/রংপুর", areaEn: "Rajshahi/Rangpur" },
  { id: "wzpdcl", bn: "ওজেডপিডিসিএল", en: "WZPDCL", areaBn: "খুলনা/বরিশাল", areaEn: "Khulna/Barishal" },
  { id: "breb", bn: "বিআরইবি", en: "BREB/PBS", areaBn: "গ্রামীণ অঞ্চল", areaEn: "Rural Areas" },
];
const GAS_PROVIDERS = [
  { id: "titas", bn: "তিতাস গ্যাস", en: "Titas Gas", areaBn: "ঢাকা ও ময়মনসিংহ", areaEn: "Dhaka & Mymensingh" },
  { id: "karnaphuli", bn: "কর্ণফুলী গ্যাস", en: "Karnaphuli Gas", areaBn: "চট্টগ্রাম", areaEn: "Chittagong" },
  { id: "bakhrabad", bn: "বাখরাবাদ গ্যাস", en: "Bakhrabad Gas", areaBn: "কুমিল্লা/নোয়াখালী", areaEn: "Cumilla/Noakhali" },
  { id: "jalalabad", bn: "জালালাবাদ গ্যাস", en: "Jalalabad Gas", areaBn: "সিলেট", areaEn: "Sylhet" },
  { id: "pashchimanchal", bn: "পশ্চিমাঞ্চল গ্যাস", en: "Paschimanchal Gas", areaBn: "রাজশাহী/রংপুর", areaEn: "Rajshahi/Rangpur" },
  { id: "sundarban", bn: "সুন্দরবন গ্যাস", en: "Sundarban Gas", areaBn: "খুলনা/বরিশাল", areaEn: "Khulna/Barishal" },
];

const ELEC_DEVICES = [
  { bn: "এয়ার কন্ডিশনার (১ টন)", en: "AC (1 Ton)", w: 1200, icon: "❄️", cbn: "শীতলীকরণ", cen: "Cooling" },
  { bn: "এয়ার কন্ডিশনার (১.৫ টন)", en: "AC (1.5 Ton)", w: 1800, icon: "❄️", cbn: "শীতলীকরণ", cen: "Cooling" },
  { bn: "সিলিং ফ্যান", en: "Ceiling Fan", w: 75, icon: "🌀", cbn: "শীতলীকরণ", cen: "Cooling" },
  { bn: "টেবিল ফ্যান", en: "Table Fan", w: 55, icon: "🌬️", cbn: "শীতলীকরণ", cen: "Cooling" },
  { bn: "রেফ্রিজারেটর", en: "Refrigerator", w: 150, icon: "🧊", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "মাইক্রোওয়েভ", en: "Microwave", w: 1000, icon: "📡", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "রাইস কুকার", en: "Rice Cooker", w: 700, icon: "🍚", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "বৈদ্যুতিক চুলা", en: "Electric Stove", w: 1500, icon: "🔥", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "LED টিভি", en: "LED TV", w: 80, icon: "📺", cbn: "বিনোদন", cen: "Entertainment" },
  { bn: "ল্যাপটপ", en: "Laptop", w: 65, icon: "💻", cbn: "ইলেকট্রনিক্স", cen: "Electronics" },
  { bn: "ডেস্কটপ PC", en: "Desktop PC", w: 300, icon: "🖥️", cbn: "ইলেকট্রনিক্স", cen: "Electronics" },
  { bn: "মোবাইল চার্জার", en: "Mobile Charger", w: 15, icon: "📱", cbn: "ইলেকট্রনিক্স", cen: "Electronics" },
  { bn: "ওয়াশিং মেশিন", en: "Washing Machine", w: 500, icon: "🫧", cbn: "লন্ড্রি", cen: "Laundry" },
  { bn: "ইলেক্ট্রিক আয়রন", en: "Electric Iron", w: 1000, icon: "👔", cbn: "লন্ড্রি", cen: "Laundry" },
  { bn: "ওয়াটার পাম্প", en: "Water Pump", w: 750, icon: "💧", cbn: "ইউটিলিটি", cen: "Utility" },
  { bn: "ওয়াটার হিটার", en: "Water Heater", w: 2000, icon: "🚿", cbn: "ইউটিলিটি", cen: "Utility" },
  { bn: "LED বাল্ব", en: "LED Bulb", w: 9, icon: "💡", cbn: "আলো", cen: "Lighting" },
  { bn: "IPS/UPS চার্জার", en: "IPS/UPS", w: 400, icon: "🔋", cbn: "ইলেকট্রনিক্স", cen: "Electronics" },
  { bn: "কাস্টম ডিভাইস", en: "Custom Device", w: 0, icon: "🔌", cbn: "অন্যান্য", cen: "Other" },
];

const GAS_APPLIANCES = [
  { bn: "চুলা (একটি বার্নার)", en: "Single Burner Stove", m3ph: 0.35, icon: "🔥", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "চুলা (দুটি বার্নার)", en: "Double Burner Stove", m3ph: 0.70, icon: "🔥", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "তিন বার্নার চুলা", en: "Triple Burner Stove", m3ph: 1.05, icon: "🔥", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "গ্যাস ওভেন", en: "Gas Oven", m3ph: 0.45, icon: "🫕", cbn: "রান্নাঘর", cen: "Kitchen" },
  { bn: "গ্যাস গিজার (ছোট)", en: "Gas Geyser (Small)", m3ph: 1.50, icon: "🚿", cbn: "পানি গরম", cen: "Water Heating" },
  { bn: "গ্যাস গিজার (বড়)", en: "Gas Geyser (Large)", m3ph: 2.50, icon: "🛁", cbn: "পানি গরম", cen: "Water Heating" },
  { bn: "গ্যাস হিটার", en: "Gas Room Heater", m3ph: 1.20, icon: "🌡️", cbn: "তাপ", cen: "Heating" },
  { bn: "গ্যাস জেনারেটর", en: "Gas Generator", m3ph: 3.00, icon: "⚙️", cbn: "শিল্প", cen: "Industrial" },
  { bn: "কাস্টম যন্ত্র", en: "Custom Appliance", m3ph: 0, icon: "🔩", cbn: "অন্যান্য", cen: "Other" },
];

// ── Live Tariff Fetcher ──────────────────────────────────────────────
const TTL = 6 * 3600 * 1000;
async function fetchLiveElec(pid) {
  const key = `elec_${pid}`;
  const fallback = { id: key, slabs: D_ELEC_SLABS, demandPerKw: D_DEMAND, svcChg: D_SVC, meterRent: D_MRENT_E, vat: D_VAT, source: "builtin", fetchedAt: Date.now(), pid };
  try {
    const r = await Promise.race([
      fetch(`https://bdapis.com/api/v1.1/electricity/tariff?provider=${pid}`),
      new Promise((_, j) => setTimeout(() => j(new Error("timeout")), 5000)),
    ]);
    if (r.ok) {
      const d = await r.json();
      if (d?.data?.slabs?.length) {
        const live = { id: key, slabs: d.data.slabs, demandPerKw: d.data.demandPerKw ?? D_DEMAND, svcChg: d.data.serviceCharge ?? D_SVC, meterRent: d.data.meterRent ?? D_MRENT_E, vat: d.data.vatRate ?? D_VAT, source: "live-api", fetchedAt: Date.now(), pid };
        await dbPut("tariff_cache", live); return live;
      }
    }
  } catch (_) { }
  try {
    const c = await dbGet("tariff_cache", key);
    if (c && Date.now() - c.fetchedAt < TTL) return { ...c, source: "cache" };
  } catch (_) { }
  return fallback;
}

async function fetchLiveGas(pid) {
  const key = `gas_${pid}`;
  const fallback = { id: key, ratePrepaid: D_GAS_PREP, fixedSingle: D_GAS_FIX.single.m, fixedDouble: D_GAS_FIX.double.m, meterRent: D_MRENT_G, vat: D_VAT, source: "builtin", fetchedAt: Date.now(), pid };
  try {
    const r = await Promise.race([
      fetch(`https://bdapis.com/api/v1.1/gas/tariff?provider=${pid}`),
      new Promise((_, j) => setTimeout(() => j(new Error("timeout")), 5000)),
    ]);
    if (r.ok) {
      const d = await r.json();
      if (d?.data) {
        const live = { id: key, ratePrepaid: d.data.prepaidRate ?? D_GAS_PREP, fixedSingle: d.data.singleBurnerMonthly ?? D_GAS_FIX.single.m, fixedDouble: d.data.doubleBurnerMonthly ?? D_GAS_FIX.double.m, meterRent: d.data.meterRent ?? D_MRENT_G, vat: d.data.vatRate ?? D_VAT, source: "live-api", fetchedAt: Date.now(), pid };
        await dbPut("tariff_cache", live); return live;
      }
    }
  } catch (_) { }
  try {
    const c = await dbGet("tariff_cache", key);
    if (c && Date.now() - c.fetchedAt < TTL) return { ...c, source: "cache" };
  } catch (_) { }
  return fallback;
}

// ── Calc engines ─────────────────────────────────────────────────────
function calcElec(kWh, loadKw, t) {
  const slabs = t?.slabs ?? D_ELEC_SLABS, dPkW = t?.demandPerKw ?? D_DEMAND;
  const svc = t?.svcChg ?? D_SVC, mR = t?.meterRent ?? D_MRENT_E, vr = t?.vat ?? D_VAT;
  let energy = 0, rem = kWh, prev = 0; const sb = [];
  for (const sl of slabs) {
    if (rem <= 0) break;
    const sz = sl.upTo === Infinity ? rem : sl.upTo - prev, u = Math.min(rem, sz), c = u * sl.rate;
    if (u > 0) sb.push({ bn: sl.bn, en: sl.en, units: u.toFixed(2), rate: sl.rate, cost: c.toFixed(2) });
    energy += c; rem -= u; prev = sl.upTo;
  }
  const demand = loadKw * dPkW, sub = energy + svc + mR + demand, vat = sub * vr;
  return { energy, demand, svcChg: svc, meterRent: mR, vat, total: sub + vat, slabs: sb };
}
function calcGas(m3, t) {
  const rp = t?.ratePrepaid ?? D_GAS_PREP, mR = t?.meterRent ?? D_MRENT_G, vr = t?.vat ?? D_VAT;
  const e = m3 * rp, sub = e + mR, vat = sub * vr;
  return { energy: e, meterRent: mR, vat, total: sub + vat };
}

// ── i18n ─────────────────────────────────────────────────────────────
const T = {
  bn: {
    appName: "স্মার্ট বিল অনুমান ব্যবস্থা", tagline: "বিদ্যুৎ ও গ্যাস বিল সিস্টেম",
    home: "হোম", electricity: "বিদ্যুৎ", gas: "গ্যাস", history: "ইতিহাস",
    feedback: "মতামত", login: "লগইন", register: "নিবন্ধন", logout: "লগআউট",
    profile: "প্রোফাইল",
    heroTitle: "স্মার্ট বিল অনুমান ব্যবস্থা",
    heroSub: "BERC অনুমোদিত ট্যারিফে সঠিক বিল হিসাব করুন",
    loginTitle: "লগইন করুন", registerTitle: "নিবন্ধন করুন",
    email: "ইমেইল ঠিকানা", password: "পাসওয়ার্ড", name: "পূর্ণ নাম",
    phone: "মোবাইল নম্বর", district: "জেলা",
    calculate: "বিল হিসাব করুন", fetchRate: "🔄 লাইভ রেট আনুন",
    fetching: "লোড হচ্ছে…", provider: "বিতরণ কোম্পানি",
    billingDays: "বিলিং সময়কাল", days: "দিন",
    addDevice: "ডিভাইস যোগ করুন", addAppliance: "যন্ত্র যোগ করুন",
    yourDevices: "আপনার ডিভাইস", total: "মোট",
    energyCharge: "শক্তি চার্জ", demandCharge: "ডিমান্ড চার্জ",
    serviceCharge: "সার্ভিস চার্জ", meterRent: "মিটার ভাড়া",
    vat: "ভ্যাট (৫%)", totalBill: "মোট বিল",
    slabBreakdown: "স্ল্যাব বিভাজন", deviceBreakdown: "ডিভাইস বিভাজন",
    download: "📄 ডাউনলোড করুন", close: "বন্ধ করুন",
    rateSource: "রেট উৎস", liveRate: "লাইভ রেট", cachedRate: "ক্যাশড রেট", defaultRate: "ডিফল্ট রেট",
    noHistory: "কোনো ইতিহাস নেই", noFeedback: "কোনো মতামত নেই",
    submitFeedback: "মতামত পাঠান", yourFeedbacks: "আপনার মতামত",
    sanctionedLoad: "স্যাংকশন লোড", meterType: "মিটার ধরন",
    nonMetered: "মিটারবিহীন (ফ্ল্যাট রেট)", prepaid: "প্রি-পেইড মিটার",
    singleBurner: "একটি বার্নার", doubleBurner: "দুটি বার্নার",
    loginRequired: "প্রথমে লগইন করুন।",
    forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?",
    sendOtp: "OTP পাঠান", resetPassword: "পাসওয়ার্ড রিসেট করুন",
    verifyEmail: "ইমেইল যাচাই করুন",
    savingsTitle: "সাশ্রয়ের পরামর্শ",
    registrationSuccess: "নিবন্ধন সফল!",
    loginSuccess: "স্বাগতম",
    updateProfile: "প্রোফাইল আপডেট করুন",
    changePassword: "পাসওয়ার্ড পরিবর্তন",
    joinDate: "যোগদান",
    lang: "English",
  },
  en: {
    appName: "Smart Bill Predictions", tagline: "Electricity & Gas Bill System",
    home: "Home", electricity: "Electricity", gas: "Gas", history: "History",
    feedback: "Feedback", login: "Login", register: "Register", logout: "Logout",
    profile: "Profile",
    heroTitle: "Smart Bill Predictions",
    heroSub: "Calculate accurate bills with BERC-approved tariffs",
    loginTitle: "Login", registerTitle: "Register",
    email: "Email Address", password: "Password", name: "Full Name",
    phone: "Mobile Number", district: "District",
    calculate: "Calculate Bill", fetchRate: "🔄 Fetch Live Rate",
    fetching: "Loading…", provider: "Distribution Company",
    billingDays: "Billing Period", days: "days",
    addDevice: "Add Device", addAppliance: "Add Appliance",
    yourDevices: "Your Devices", total: "Total",
    energyCharge: "Energy Charge", demandCharge: "Demand Charge",
    serviceCharge: "Service Charge", meterRent: "Meter Rent",
    vat: "VAT (5%)", totalBill: "Total Bill",
    slabBreakdown: "Slab Breakdown", deviceBreakdown: "Device Breakdown",
    download: "📄 Download", close: "Close",
    rateSource: "Rate Source", liveRate: "Live Rate", cachedRate: "Cached Rate", defaultRate: "Default Rate",
    noHistory: "No history yet", noFeedback: "No feedback yet",
    submitFeedback: "Submit Feedback", yourFeedbacks: "Your Feedback",
    sanctionedLoad: "Sanctioned Load", meterType: "Meter Type",
    nonMetered: "Non-Metered (Flat Rate)", prepaid: "Pre-Paid Meter",
    singleBurner: "Single Burner", doubleBurner: "Double Burner",
    loginRequired: "Please login first.",
    forgotPassword: "Forgot Password?",
    sendOtp: "Send OTP", resetPassword: "Reset Password",
    verifyEmail: "Verify Email",
    savingsTitle: "Savings Tips",
    registrationSuccess: "Registration successful!",
    loginSuccess: "Welcome",
    updateProfile: "Update Profile",
    changePassword: "Change Password",
    joinDate: "Joined",
    lang: "বাংলা",
  },
};

const fmtDt = (d, lang) => new Date(d).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { year: "numeric", month: "short", day: "numeric" });
const fmtBDT = (n, lang) => lang === "bn" ? `৳${Number(n).toFixed(2)}` : `BDT ${Number(n).toFixed(2)}`;

// ── STYLES (responsive, CSS variables) ───────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;700;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
  :root {
    --bg:#0b0f1a; --bg2:#111827; --bg3:#1a2235; --bg4:#1e2d45;
    --elec:#f59e0b; --elec2:#fef3c7; --elec-glow:rgba(245,158,11,.15);
    --gas:#f97316;  --gas2:#fff7ed;  --gas-glow:rgba(249,115,22,.15);
    --green:#16a34a; --green2:#4ade80; --green3:#f0fdf4;
    --text:#f1f5f9; --muted:#94a3b8; --dim:#475569; --border:#1e293b;
    --card:#111827; --card2:#1a2235;
    --r:14px; --r2:10px; --r3:8px;
    --shadow:0 4px 24px rgba(0,0,0,.4);
    --font-bn:'Hind Siliguri','Noto Sans Bengali',sans-serif;
    --font-en:'Plus Jakarta Sans',sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);}
  input,select,textarea{background:var(--bg3);border:1.5px solid var(--border);color:var(--text);border-radius:var(--r3);padding:10px 13px;font-size:14px;width:100%;font-family:inherit;transition:border-color .2s;}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--green2);}
  button{cursor:pointer;font-family:inherit;transition:opacity .15s,transform .1s;}
  button:hover:not(:disabled){opacity:.88;}
  button:active:not(:disabled){transform:scale(.97);}
  button:disabled{opacity:.5;cursor:not-allowed;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:var(--bg);}
  ::-webkit-scrollbar-thumb{background:var(--green);border-radius:3px;}
  select option{background:var(--bg2);color:var(--text);}
  /* ── RESPONSIVE ── */
  .page{max-width:1000px;margin:0 auto;padding:28px 16px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .grid-auto{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:8px;}
  .grid-feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;}
  .flex{display:flex;align-items:center;}
  .wrap{flex-wrap:wrap;}
  @media(max-width:640px){
    .grid2{grid-template-columns:1fr;}
    .grid3{grid-template-columns:1fr 1fr;}
    .nav-links{display:none;}
    .nav-links.open{display:flex;flex-direction:column;position:fixed;inset:64px 0 0 0;background:var(--bg2);z-index:200;padding:20px;gap:8px;}
    .hero-h1{font-size:clamp(22px,6vw,44px)!important;}
    .page{padding:20px 12px;}
    .tariff-split{grid-template-columns:1fr!important;}
    .profile-grid{grid-template-columns:1fr!important;}
    .report-grid{grid-template-columns:1fr 1fr!important;}
    .modal-inner{padding:16px!important;margin:8px!important;}
  }
  @media(max-width:400px){
    .grid3{grid-template-columns:1fr;}
    .grid-auto{grid-template-columns:repeat(auto-fill,minmax(70px,1fr));}
  }
  /* Animations */
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .anim{animation:fadeUp .4s ease both;}
  .spin{animation:spin 1s linear infinite;}
  .pulse{animation:pulse 1.5s ease infinite;}
  /* Toast */
  .toast{position:fixed;top:72px;right:16px;padding:12px 20px;border-radius:var(--r2);font-weight:700;font-size:14px;z-index:9999;box-shadow:var(--shadow);animation:fadeUp .3s ease;}
  /* Source badge */
  .src-live{background:#dcfce7;color:#166534;border:1px solid #86efac;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
  .src-cache{background:#fef9c3;color:#854d0e;border:1px solid #fde047;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
  .src-builtin{background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
  /* Range input */
  input[type=range]{padding:0;background:none;border:none;}
  input[type=range]:focus{box-shadow:none;outline:none;border:none;}
`;

// ── ROOT APP ─────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [history, setHistory] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [lang, setLang] = useState(() => ls.g("bb_lang") || "bn");
  const [menuOpen, setMenuOpen] = useState(false);
  const t = T[lang];

  useEffect(() => {
    openDB().then(async () => {
      setDbReady(true);
      const sid = ls.g("bd_session2");
      if (sid) { const u = await dbGet("users", sid); if (u) { setUser(u); loadUD(u.id); } }
    }).catch(console.error);
  }, []);

  const loadUD = async (uid) => {
    const h = await dbIdxAll("history", "userId", uid);
    const f = await dbIdxAll("feedbacks", "userId", uid);
    setHistory(h.sort((a, b) => b.date - a.date));
    setFeedbacks(f.sort((a, b) => b.date - a.date));
  };

  const toast$ = (msg, type = "ok") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3800);
  };

  const login = async (u) => {
    setUser(u); ls.s("bd_session2", u.id); await loadUD(u.id);
  };
  const logout = () => {
    setUser(null); ls.s("bd_session2", null); setHistory([]); setFeedbacks([]);
    setPage("home"); toast$(lang === "bn" ? "লগআউট সফল।" : "Logged out.");
  };
  const addHistory = async (rec) => { await dbPut("history", rec); setHistory(p => [rec, ...p]); };
  const addFeedback = async (fb) => { await dbPut("feedbacks", fb); setFeedbacks(p => [fb, ...p]); };
  const updateUser = async (upd) => { await dbPut("users", upd); setUser(upd); ls.s("bd_session2", upd.id); };

  const go = (p) => {
    const guarded = ["predict", "gas", "history", "profile", "feedback"];
    if (guarded.includes(p) && !user) { setPage("login"); toast$(t.loginRequired, "err"); setMenuOpen(false); return; }
    setPage(p); setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleLang = () => {
    const nl = lang === "bn" ? "en" : "bn";
    setLang(nl); ls.s("bb_lang", nl);
  };

  if (!dbReady) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0b0f1a", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }} className="spin">⚡</div>
      <div style={{ color: "#4ade80", fontSize: 16, fontFamily: "'Hind Siliguri',sans-serif" }}>
        {lang === "bn" ? "ডেটাবেস লোড হচ্ছে…" : "Loading database…"}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: lang === "bn" ? "var(--font-bn)" : "var(--font-en)" }}>
      <style>{CSS}</style>
      <Nav user={user} page={page} go={go} logout={logout} t={t} lang={lang} toggleLang={toggleLang} menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {page === "home" && <HomePage go={go} t={t} lang={lang} />}
      {page === "login" && <LoginPage login={login} toast$={toast$} go={go} t={t} lang={lang} />}
      {page === "register" && <RegisterPage login={login} toast$={toast$} go={go} t={t} lang={lang} />}
      {page === "forgot" && <ForgotPage toast$={toast$} go={go} t={t} lang={lang} />}
      {page === "reset" && <ResetPage toast$={toast$} go={go} t={t} lang={lang} />}
      {page === "verify" && <VerifyPage user={user} updateUser={updateUser} toast$={toast$} go={go} t={t} lang={lang} />}
      {page === "profile" && user && <ProfilePage user={user} updateUser={updateUser} toast$={toast$} go={go} t={t} lang={lang} />}
      {page === "predict" && user && <ElecPage user={user} addHistory={addHistory} toast$={toast$} t={t} lang={lang} />}
      {page === "gas" && user && <GasPage user={user} addHistory={addHistory} toast$={toast$} t={t} lang={lang} />}
      {page === "history" && user && <HistoryPage history={history} t={t} lang={lang} />}
      {page === "feedback" && user && <FeedbackPage user={user} feedbacks={feedbacks} addFeedback={addFeedback} toast$={toast$} t={t} lang={lang} />}
    </div>
  );
}

// ── NAVBAR ───────────────────────────────────────────────────────────
function Nav({ user, page, go, logout, t, lang, toggleLang, menuOpen, setMenuOpen }) {
  const links = [
    { k: "home", l: t.home },
    { k: "predict", l: t.electricity },
    { k: "gas", l: t.gas },
    { k: "history", l: t.history },
    { k: "feedback", l: t.feedback },
  ];

  return (
    <nav style={{
      background: "var(--bg2)",
      borderBottom: "2px solid var(--green)",
      position: "sticky",
      top: 0,
      zIndex: 300,
      boxShadow: "0 2px 20px rgba(0,0,0,.4)"
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 16px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>

        {/* 🔹 Brand */}
        <div onClick={() => go("home")}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: 28 }}>⚡</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--green2)" }}>
              {t.appName}
            </div>
            <div style={{ fontSize: 10, color: "var(--dim)" }}>
              {t.tagline}
            </div>
          </div>
        </div>

        {/* 🔹 Desktop Nav */}
        <div className="nav-desktop">
          {links.map(l => (
            <button key={l.k}
              onClick={() => go(l.k)}
              style={{
                background: page === l.k ? "var(--bg4)" : "none",
                color: page === l.k ? "var(--green2)" : "var(--muted)",
                border: "none",
                padding: "7px 12px",
                borderRadius: "var(--r3)",
                fontSize: 13,
                fontWeight: 600
              }}>
              {l.l}
            </button>
          ))}
        </div>

        {/* 🔹 Right Side */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* Language */}
          <button onClick={toggleLang}
            style={{
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              padding: "6px 11px",
              borderRadius: "var(--r3)",
              fontSize: 12,
              fontWeight: 700
            }}>
            {t.lang}
          </button>

          {/* User */}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => go("profile")}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--green)",
                  color: "#fff",
                  border: "2px solid var(--green2)",
                  fontWeight: 900
                }}>
                {user.name[0].toUpperCase()}
              </button>
              <button onClick={logout}
                style={{
                  background: "var(--bg3)",
                  color: "#f87171",
                  border: "1px solid #f87171",
                  padding: "6px 11px",
                  borderRadius: "var(--r3)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}>
                {t.logout}
              </button>
            </div>
          ) : (
            <button onClick={() => go("login")}
              style={{
                background: "var(--green)",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "var(--r3)",
                fontSize: 13,
                fontWeight: 700
              }}>
              {t.login}
            </button>
          )}

          {/* 🍔 Hamburger */}
          <button className="menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* 🔻 Mobile Nav */}
      <div className={`nav-mobile ${menuOpen ? "open" : ""}`}>
        {links.map(l => (
          <button key={l.k}
            onClick={() => go(l.k)}>
            {l.l}
          </button>
        ))}

        {user && (
          <button onClick={logout} style={{ color: "#f87171" }}>
            {t.logout}
          </button>
        )}
      </div>
    </nav>
  );
}
// ── TOAST ─────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  return <div className="toast" style={{ background: type === "err" ? "#991b1b" : type === "warn" ? "#92400e" : "#166534" }}>{msg}</div>;
}

// ── HOME PAGE ─────────────────────────────────────────────────────────
function HomePage({ go, t, lang }) {
  const features = [
    {
      icon: "⚡", title: lang === "bn" ? "সঠিক বিল হিসাব" : "Accurate Bill Calc",
      desc: lang === "bn" ? "BERC অনুমোদিত LT-A স্ল্যাব অনুযায়ী বিদ্যুৎ বিল হিসাব।" : "Electricity bills calculated per BERC-approved LT-A slabs.", color: "var(--elec)"
    },
    {
      icon: "🔥", title: lang === "bn" ? "গ্যাস বিল" : "Gas Bill",
      desc: lang === "bn" ? "তিতাস থেকে সুন্দরবন পর্যন্ত সব গ্যাস কোম্পানির ট্যারিফ।" : "Tariffs from Titas to Sundarban gas companies.", color: "var(--gas)"
    },
    {
      icon: "📡", title: lang === "bn" ? "লাইভ রেট আপডেট" : "Live Rate Updates",
      desc: lang === "bn" ? "বিতরণ কোম্পানি মূল্য পরিবর্তন করলে স্বয়ংক্রিয়ভাবে আপডেট হয়।" : "Auto-updates when providers change electricity/gas prices.", color: "var(--green2)"
    },
    {
      icon: "📊", title: lang === "bn" ? "বিল ইতিহাস" : "Bill History",
      desc: lang === "bn" ? "সব হিসাব সংরক্ষিত থাকে। যেকোনো সময় দেখুন।" : "All calculations saved. View anytime.", color: "#60a5fa"
    },
    {
      icon: "📄", title: lang === "bn" ? "PDF রিপোর্ট" : "PDF Report",
      desc: lang === "bn" ? "বিস্তারিত বিল রিপোর্ট ডাউনলোড করুন।" : "Download detailed bill reports.", color: "#a78bfa"
    },
    {
      icon: "🔒", title: lang === "bn" ? "নিরাপদ অ্যাকাউন্ট" : "Secure Account",
      desc: lang === "bn" ? "SHA-256 এনক্রিপশন ও IndexedDB স্টোরেজ।" : "SHA-256 encrypted passwords with IndexedDB storage.", color: "#34d399"
    },
  ];

  return (
    <div>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg,#0b0f1a 0%,#0d1929 50%,#0b1a0f 100%)", padding: "80px 20px 64px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, right: -120, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(22,163,74,.14),transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,158,11,.1),transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(22,163,74,.12)", border: "1px solid rgba(74,222,128,.2)", padding: "6px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "var(--green2)", marginBottom: 20 }}>
            ⚡ BERC Approved · বিইআরসি অনুমোদিত
          </div>
          <h1 className="hero-h1 anim" style={{ fontSize: "clamp(26px,5vw,52px)", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>
            {t.heroTitle}
          </h1>
          <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.8, marginBottom: 32 }}>{t.heroSub}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => go("predict")} style={{ background: "var(--elec)", color: "#000", border: "none", padding: "13px 28px", borderRadius: "var(--r2)", fontSize: 15, fontWeight: 800, boxShadow: "0 4px 20px rgba(245,158,11,.35)" }}>
              ⚡ {lang === "bn" ? "বিদ্যুৎ বিল" : "Electricity Bill"}
            </button>
            <button onClick={() => go("gas")} style={{ background: "var(--gas)", color: "#fff", border: "none", padding: "13px 28px", borderRadius: "var(--r2)", fontSize: 15, fontWeight: 800, boxShadow: "0 4px 20px rgba(249,115,22,.3)" }}>
              🔥 {lang === "bn" ? "গ্যাস বিল" : "Gas Bill"}
            </button>
          </div>
        </div>
      </section>
