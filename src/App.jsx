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

      {/* Tariff tables */}
      <section className="tariff-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        <div style={{ background: "#0d1a2e", padding: "36px 28px" }}>
          <h3 style={{ color: "var(--elec)", marginBottom: 16, fontSize: 16 }}>⚡ {lang === "bn" ? "বিদ্যুৎ ট্যারিফ (LT-A, Feb 2024)" : "Electricity Tariff (LT-A, Feb 2024)"}</h3>
          {D_ELEC_SLABS.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>{lang === "bn" ? s.bn : s.en}</span>
              <span style={{ color: "var(--elec)", fontWeight: 700 }}>৳{s.rate}/{lang === "bn" ? "ইউনিট" : "unit"}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--dim)" }}>+{lang === "bn" ? "ডিমান্ড চার্জ" : "Demand"} ৳{D_DEMAND}/kW · 5% VAT</div>
        </div>
        <div style={{ background: "#0d1a14", padding: "36px 28px" }}>
          <h3 style={{ color: "var(--gas)", marginBottom: 16, fontSize: 16 }}>🔥 {lang === "bn" ? "গ্যাস ট্যারিফ (BERC 2024)" : "Gas Tariff (BERC 2024)"}</h3>
          {[
            [lang === "bn" ? "প্রি-পেইড মিটার" : "Pre-paid Meter", `৳${D_GAS_PREP}/${lang === "bn" ? "ঘনমিটার" : "m³"}`],
            [lang === "bn" ? "একটি বার্নার" : "Single Burner", `৳${D_GAS_FIX.single.m}/${lang === "bn" ? "মাস" : "month"}`],
            [lang === "bn" ? "দুটি বার্নার" : "Double Burner", `৳${D_GAS_FIX.double.m}/${lang === "bn" ? "মাস" : "month"}`],
            [lang === "bn" ? "মিটার ভাড়া" : "Meter Rent", `৳${D_MRENT_G}/${lang === "bn" ? "মাস" : "month"}`],
            ["VAT", "5%"],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>{l}</span>
              <span style={{ color: "var(--gas)", fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "52px 20px", maxWidth: 1060, margin: "0 auto" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, textAlign: "center", marginBottom: 32, color: "var(--text)" }}>
          {lang === "bn" ? "সম্পূর্ণ সুবিধা" : "Full Features"}
        </h2>
        <div className="grid-feat">
          {features.map(f => (
            <div key={f.title} style={{ background: "var(--card)", border: `1px solid var(--border)`, borderTop: `3px solid ${f.color}`, borderRadius: "var(--r)", padding: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: f.color, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "var(--bg2)", padding: "52px 20px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>{lang === "bn" ? "আজই শুরু করুন" : "Get Started Today"}</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
          {lang === "bn" ? "বিনামূল্যে অ্যাকাউন্ট খুলুন" : "Create a free account"}
        </p>
        <button onClick={() => go("register")} style={{ background: "var(--green)", color: "#fff", border: "none", padding: "13px 30px", borderRadius: "var(--r2)", fontSize: 15, fontWeight: 800, boxShadow: "0 4px 18px rgba(22,163,74,.35)" }}>
          {lang === "bn" ? "বিনামূল্যে নিবন্ধন করুন" : "Register for Free"}
        </button>
      </section>
    </div>
  );
}

// ── AUTH WRAPPER ──────────────────────────────────────────────────────
function AuthWrap({ icon, title, sub, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 64px)", padding: 20 }}>
      <div className="anim" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 32, width: "100%", maxWidth: 480, boxShadow: "var(--shadow)" }}>
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 6 }}>{icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, textAlign: "center", marginBottom: 4 }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginBottom: 22 }}>{sub}</p>
        {children}
      </div>
    </div>
  );
}
const Abtn = ({ onClick, disabled, children, color }) => (
  <button onClick={onClick} disabled={disabled} style={{ width: "100%", background: color || "var(--green)", color: "#fff", border: "none", padding: "13px", borderRadius: "var(--r3)", fontSize: 15, fontWeight: 800, marginTop: 4 }}>
    {children}
  </button>
);
const Fi = ({ label, type = "text", value, onChange, ph }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={ph || ""} />
  </div>
);

// ── LOGIN ─────────────────────────────────────────────────────────────
function LoginPage({ login, toast$, go, t, lang }) {
  const [f, setF] = useState({ email: "", pass: "" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!f.email || !f.pass) { toast$(lang === "bn" ? "সব তথ্য পূরণ করুন।" : "Fill all fields.", "err"); return; }
    setLoading(true);
    try {
      const passwordHash = await hashPass(f.pass);
      const d = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email: f.email.toLowerCase().trim(), passwordHash }) });
      await login(d.user); toast$(`${t.loginSuccess}, ${d.user.name}! 🎉`); go("predict");
    } catch (e) {
      const msg = e.message.includes("not registered") ? (lang === "bn" ? "ইমেইল নিবন্ধিত নয়।" : "Email not registered.") : e.message.includes("Wrong") ? (lang === "bn" ? "পাসওয়ার্ড ভুল।" : "Wrong password.") : String(e.message);
      toast$(msg, "err");
    }
    setLoading(false);
  };
  return (
    <AuthWrap icon="⚡" title={t.loginTitle} sub={lang === "bn" ? "আপনার BidyutBill অ্যাকাউন্টে প্রবেশ করুন" : "Access your BidyutBill account"}>
      <Fi label={t.email} type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} ph="you@example.com" />
      <Fi label={t.password} type="password" value={f.pass} onChange={e => setF({ ...f, pass: e.target.value })} ph="••••••••" />
      <div style={{ textAlign: "right", marginBottom: 12 }}>
        <span style={{ color: "var(--green2)", cursor: "pointer", fontSize: 13, fontWeight: 600 }} onClick={() => go("forgot")}>{t.forgotPassword}</span>
      </div>
      <Abtn onClick={submit} disabled={loading}>{loading ? (lang === "bn" ? "লগইন হচ্ছে…" : "Logging in…") : t.login}</Abtn>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 14 }}>
        {lang === "bn" ? "অ্যাকাউন্ট নেই?" : "No account?"}{" "}
        <span style={{ color: "var(--green2)", cursor: "pointer", fontWeight: 700 }} onClick={() => go("register")}>{t.register}</span>
      </p>
    </AuthWrap>
  );
}

// ── REGISTER ──────────────────────────────────────────────────────────
function RegisterPage({ login, toast$, go, t, lang }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", pass: "", confirm: "", district: "" });
  const [loading, setLoading] = useState(false);
  const districts = lang === "bn"
    ? ["ঢাকা", "চট্টগ্রাম", "রাজশাহী", "খুলনা", "বরিশাল", "সিলেট", "রংপুর", "ময়মনসিংহ", "কুমিল্লা", "গাজীপুর", "নারায়ণগঞ্জ", "বগুড়া", "যশোর", "অন্যান্য"]
    : ["Dhaka", "Chittagong", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh", "Cumilla", "Gazipur", "Narayanganj", "Bogura", "Jessore", "Other"];

  const submit = async () => {
    if (!f.name || !f.email || !f.phone || !f.pass) { toast$(lang === "bn" ? "নাম, ইমেইল, ফোন ও পাসওয়ার্ড আবশ্যক।" : "Name, email, phone & password required.", "err"); return; }
    if (!/^\S+@\S+\.\S+/.test(f.email)) { toast$(lang === "bn" ? "সঠিক ইমেইল দিন।" : "Enter valid email.", "err"); return; }
    if (!/^01[3-9]\d{8}$/.test(f.phone.replace(/\s/g, ""))) { toast$(lang === "bn" ? "সঠিক বাংলাদেশী নম্বর দিন।" : "Enter valid BD number.", "err"); return; }
    if (f.pass.length < 6) { toast$(lang === "bn" ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।" : "Password min 6 chars.", "err"); return; }
    if (f.pass !== f.confirm) { toast$(lang === "bn" ? "পাসওয়ার্ড মিলছে না।" : "Passwords don't match.", "err"); return; }
    setLoading(true);
    try {
      const hash = await hashPass(f.pass);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const nu = { id: gid(), name: f.name.trim(), email: f.email.toLowerCase().trim(), phone: f.phone.trim(), district: f.district, passwordHash: hash, emailVerified: false, otp, joinDate: Date.now(), provider: "", sanctionedLoad: 2, gasProvider: "" };
      const d = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(nu) });
      await login(d.user);
      toast$(`${t.registrationSuccess} OTP: ${otp}`); go("verify");
    } catch (e) {
      const msg = e.message.includes("already") ? (lang === "bn" ? "এই ইমেইল ইতিমধ্যে নিবন্ধিত।" : "Email already registered.") : String(e.message);
      toast$(msg, "err");
    }
    setLoading(false);
  };
  return (
    <AuthWrap icon="🌟" title={t.registerTitle} sub={lang === "bn" ? "বিনামূল্যে অ্যাকাউন্ট তৈরি করুন" : "Create your free account"}>
      <div className="grid2"><Fi label={t.name} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} ph={lang === "bn" ? "আপনার নাম" : "Your name"} /><Fi label={t.phone} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} ph="01XXXXXXXXX" /></div>
      <Fi label={t.email} type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} ph="you@example.com" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>{t.district}</label>
        <select value={f.district} onChange={e => setF({ ...f, district: e.target.value })}>
          <option value="">{lang === "bn" ? "জেলা বেছে নিন" : "Select district"}</option>
          {districts.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="grid2">
        <Fi label={t.password} type="password" value={f.pass} onChange={e => setF({ ...f, pass: e.target.value })} ph={lang === "bn" ? "কমপক্ষে ৬ অক্ষর" : "Min 6 chars"} />
        <Fi label={lang === "bn" ? "পাসওয়ার্ড নিশ্চিত" : "Confirm Password"} type="password" value={f.confirm} onChange={e => setF({ ...f, confirm: e.target.value })} ph={lang === "bn" ? "পুনরায় লিখুন" : "Repeat"} />
      </div>
      <Abtn onClick={submit} disabled={loading}>{loading ? (lang === "bn" ? "তৈরি হচ্ছে…" : "Creating…") : (lang === "bn" ? "অ্যাকাউন্ট তৈরি করুন" : "Create Account")}</Abtn>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 14 }}>
        {lang === "bn" ? "ইতিমধ্যে অ্যাকাউন্ট আছে?" : "Already have an account?"}{" "}
        <span style={{ color: "var(--green2)", cursor: "pointer", fontWeight: 700 }} onClick={() => go("login")}>{t.login}</span>
      </p>
    </AuthWrap>
  );
}

// ── FORGOT / RESET / VERIFY (condensed) ──────────────────────────────
function ForgotPage({ toast$, go, t, lang }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  const send = async () => {
    if (!email) { toast$(lang === "bn" ? "ইমেইল দিন।" : "Enter email.", "err"); return; }
    setLoading(true);
    try {
      const d = await apiFetch("/reset/send", { method: "POST", body: JSON.stringify({ email: email.toLowerCase().trim() }) });
      ls.s("bd_reset_token", d.token);
      toast$(`OTP: ${d.token} (${lang === "bn" ? "১৫ মিনিট" : "15 min"})`); setSent(true);
    } catch (e) {
      toast$(e.message.includes("not registered") ? (lang === "bn" ? "ইমেইল নিবন্ধিত নয়।" : "Email not registered.") : String(e.message), "err");
    }
    setLoading(false);
  };
  return (
    <AuthWrap icon="🔑" title={t.forgotPassword} sub={lang === "bn" ? "আপনার নিবন্ধিত ইমেইলে OTP পাঠানো হবে" : "OTP will be sent to your registered email"}>
      {sent ? (
        <div style={{ background: "rgba(22,163,74,.1)", border: "1px solid var(--green)", borderRadius: "var(--r3)", padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📧</div>
          <p style={{ color: "var(--green2)", fontWeight: 600, marginBottom: 12 }}>OTP {lang === "bn" ? "পাঠানো হয়েছে" : "sent"}!</p>
          <Abtn onClick={() => go("reset")}>{lang === "bn" ? "OTP দিয়ে রিসেট করুন →" : "Reset with OTP →"}</Abtn>
        </div>
      ) : (
        <>
          <Fi label={t.email} type="email" value={email} onChange={e => setEmail(e.target.value)} ph="you@example.com" />
          <Abtn onClick={send} disabled={loading}>{loading ? (lang === "bn" ? "পাঠানো হচ্ছে…" : "Sending…") : t.sendOtp}</Abtn>
        </>
      )}
      <p style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
        <span style={{ color: "var(--green2)", cursor: "pointer" }} onClick={() => go("login")}>← {t.login}</span>
      </p>
    </AuthWrap>
  );
}
function ResetPage({ toast$, go, t, lang }) {
  const [f, setF] = useState({ otp: "", pass: "", confirm: "" }); const [loading, setLoading] = useState(false);
  const reset = async () => {
    if (!f.otp || !f.pass) { toast$(lang === "bn" ? "OTP ও পাসওয়ার্ড দিন।" : "Enter OTP & password.", "err"); return; }
    if (f.pass !== f.confirm) { toast$(lang === "bn" ? "পাসওয়ার্ড মিলছে না।" : "Passwords don't match.", "err"); return; }
    setLoading(true);
    try {
      const newPasswordHash = await hashPass(f.pass);
      await apiFetch("/reset/verify", { method: "POST", body: JSON.stringify({ token: f.otp.trim(), newPasswordHash }) });
      toast$(lang === "bn" ? "পাসওয়ার্ড পরিবর্তিত হয়েছে! 🎉" : "Password changed! 🎉"); go("login");
    } catch (e) {
      toast$(e.message.includes("Invalid") ? (lang === "bn" ? "OTP সঠিক/মেয়াদোত্তীর্ণ নয়।" : "Invalid/expired OTP.") : String(e.message), "err");
    }
    setLoading(false);
  };
  return (
    <AuthWrap icon="🔐" title={t.resetPassword} sub="OTP + new password">
      <Fi label="OTP" value={f.otp} onChange={e => setF({ ...f, otp: e.target.value })} ph={lang === "bn" ? "৬ সংখ্যার OTP" : "6-digit OTP"} />
      <Fi label={lang === "bn" ? "নতুন পাসওয়ার্ড" : "New Password"} type="password" value={f.pass} onChange={e => setF({ ...f, pass: e.target.value })} ph="••••••••" />
      <Fi label={lang === "bn" ? "পাসওয়ার্ড নিশ্চিত" : "Confirm"} type="password" value={f.confirm} onChange={e => setF({ ...f, confirm: e.target.value })} ph="••••••••" />
      <Abtn onClick={reset} disabled={loading}>{loading ? (lang === "bn" ? "পরিবর্তন হচ্ছে…" : "Changing…") : t.resetPassword}</Abtn>
    </AuthWrap>
  );
}
function VerifyPage({ user, updateUser, toast$, go, t, lang }) {
  const [code, setCode] = useState("");
  const verify = async () => {
    if (!user) { go("login"); return; }
    if (code.trim() === user.otp) {
      await updateUser({ ...user, emailVerified: true, otp: "" });
      toast$(lang === "bn" ? "ইমেইল যাচাই সফল! 🎉" : "Email verified! 🎉"); go("predict");
    }
    else toast$(lang === "bn" ? "কোড সঠিক নয়।" : "Incorrect code.", "err");
  };
  return (
    <AuthWrap icon="📧" title={t.verifyEmail} sub={lang === "bn" ? "নিবন্ধনের সময় পাঠানো ৬-সংখ্যার OTP দিন" : "Enter the 6-digit OTP sent during registration"}>
      <div style={{ background: "rgba(22,163,74,.08)", border: "1px solid var(--green)", borderRadius: "var(--r3)", padding: 12, fontSize: 13, color: "var(--green2)", marginBottom: 14 }}>
        💡 {lang === "bn" ? "ডেমো: Toast নোটিফিকেশনে OTP দেখুন" : "Demo: Check Toast notification for OTP"}
      </div>
      <Fi label="OTP" value={code} onChange={e => setCode(e.target.value)} ph={lang === "bn" ? "৬ সংখ্যার কোড" : "6-digit code"} />
      <Abtn onClick={verify}>{t.verifyEmail}</Abtn>
      <p style={{ textAlign: "center", marginTop: 12, fontSize: 13 }}>
        <span style={{ color: "var(--green2)", cursor: "pointer" }} onClick={() => go("predict")}>{lang === "bn" ? "এখন বাদ দিন →" : "Skip for now →"}</span>
      </p>
    </AuthWrap>
  );
}
// ── PROFILE ───────────────────────────────────────────────────────────
function ProfilePage({ user, updateUser, toast$, go, t, lang }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || "", district: user.district || "", provider: user.provider || "", gasProvider: user.gasProvider || "", sanctionedLoad: user.sanctionedLoad || 2 });
  const [pwF, setPwF] = useState({ old: "", newP: "", conf: "" });
  const [tab, setTab] = useState("info");

  const save = async () => {
    if (!f.name || !f.email || !f.phone) { toast$(lang === "bn" ? "নাম, ইমেইল ও ফোন আবশ্যক।" : "Name, email & phone required.", "err"); return; }
    await updateUser({ ...user, ...f }); setEdit(false);
    toast$(lang === "bn" ? "প্রোফাইল আপডেট হয়েছে!" : "Profile updated!");
  };
  const changePw = async () => {
    if (!pwF.old || !pwF.newP) { toast$(lang === "bn" ? "পুরনো ও নতুন পাসওয়ার্ড দিন।" : "Enter old & new password.", "err"); return; }
    if (pwF.newP !== pwF.conf) { toast$(lang === "bn" ? "নতুন পাসওয়ার্ড মিলছে না।" : "New passwords don't match.", "err"); return; }
    if (pwF.newP.length < 6) { toast$(lang === "bn" ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।" : "Min 6 chars.", "err"); return; }
    const oldH = await hashPass(pwF.old);
    if (oldH !== user.passwordHash) { toast$(lang === "bn" ? "পুরনো পাসওয়ার্ড ভুল।" : "Wrong old password.", "err"); return; }
    await updateUser({ ...user, passwordHash: await hashPass(pwF.newP) });
    setPwF({ old: "", newP: "", conf: "" }); toast$(lang === "bn" ? "পাসওয়ার্ড পরিবর্তিত!" : "Password changed!");
  };

  return (
    <div className="page">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>{t.profile}</h1>
      </div>
      <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, maxWidth: 900, margin: "0 auto" }}>
        {/* Avatar card */}
        <div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 20, textAlign: "center", marginBottom: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--green)", color: "#fff", fontWeight: 900, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>{user.name[0].toUpperCase()}</div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{user.name}</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{user.email}</div>
            {user.phone && <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 3 }}>📞 {user.phone}</div>}
            {user.district && <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 2 }}>📍 {user.district}</div>}
            <div style={{ marginTop: 12 }}>
              {user.emailVerified
                ? <span style={{ background: "rgba(22,163,74,.12)", color: "var(--green2)", border: "1px solid var(--green)", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>✓ {lang === "bn" ? "যাচাইকৃত" : "Verified"}</span>
                : <span style={{ background: "rgba(245,158,11,.12)", color: "var(--elec)", border: "1px solid var(--elec)", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" }} onClick={() => go("verify")}>⚠ {lang === "bn" ? "যাচাই করুন" : "Verify"}</span>
              }
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--dim)" }}>{t.joinDate}: {fmtDt(user.joinDate, lang)}</div>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 16 }}>
            <div style={{ color: "var(--green2)", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>🗄️ DB INFO</div>
            {[["Engine", "MongoDB Atlas"], ["Password", "SHA-256"], ["ID", user.id.slice(0, 8) + "…"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--dim)" }}>{k}</span><span style={{ color: "var(--muted)", fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[["info", lang === "bn" ? "তথ্য" : "Info"], ["pw", lang === "bn" ? "পাসওয়ার্ড" : "Password"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? "var(--green)" : "var(--bg3)", color: tab === k ? "#fff" : "var(--muted)", border: "none", padding: "8px 18px", borderRadius: "var(--r3)", fontSize: 13, fontWeight: 700 }}>{l}</button>
            ))}
          </div>
          {tab === "info" && (
            <>
              {edit ? (
                <>
                  <div className="grid2"><Fi label={lang === "bn" ? "নাম" : "Name"} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><Fi label={lang === "bn" ? "ফোন" : "Phone"} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>{lang === "bn" ? "বিদ্যুৎ কোম্পানি" : "Electricity Provider"}</label>
                    <select value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })}>
                      <option value="">{lang === "bn" ? "বেছে নিন" : "Select"}</option>
                      {ELEC_PROVIDERS.map(p => <option key={p.id} value={p.id}>{lang === "bn" ? p.bn : p.en} — {lang === "bn" ? p.areaBn : p.areaEn}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--dim)", textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>{lang === "bn" ? "গ্যাস কোম্পানি" : "Gas Provider"}</label>
                    <select value={f.gasProvider} onChange={e => setF({ ...f, gasProvider: e.target.value })}>
                      <option value="">{lang === "bn" ? "বেছে নিন" : "Select"}</option>
                      {GAS_PROVIDERS.map(p => <option key={p.id} value={p.id}>{lang === "bn" ? p.bn : p.en}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--dim)", marginBottom: 8 }}>{t.sanctionedLoad}: {f.sanctionedLoad} kW</label>
                    <input type="range" min={0.5} max={10} step={0.5} value={f.sanctionedLoad} onChange={e => setF({ ...f, sanctionedLoad: Number(e.target.value) })} style={{ accentColor: "var(--elec)" }} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={save} style={{ background: "var(--green)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "var(--r3)", fontWeight: 700, fontSize: 14 }}>{t.updateProfile}</button>
                    <button onClick={() => setEdit(false)} style={{ background: "var(--bg3)", color: "var(--muted)", border: "none", padding: "10px 20px", borderRadius: "var(--r3)", fontWeight: 700, fontSize: 14 }}>{lang === "bn" ? "বাতিল" : "Cancel"}</button>
                  </div>
                </>
              ) : (
                <>
                  {[
                    [lang === "bn" ? "নাম" : "Name", user.name],
                    [lang === "bn" ? "ইমেইল" : "Email", user.email],
                    [lang === "bn" ? "ফোন" : "Phone", user.phone || "-"],
                    [lang === "bn" ? "জেলা" : "District", user.district || "-"],
                    [lang === "bn" ? "বিদ্যুৎ কোম্পানি" : "Elec Provider", ELEC_PROVIDERS.find(p => p.id === user.provider)?.[lang === "bn" ? "bn" : "en"] || "-"],
                    [lang === "bn" ? "গ্যাস কোম্পানি" : "Gas Provider", GAS_PROVIDERS.find(p => p.id === user.gasProvider)?.[lang === "bn" ? "bn" : "en"] || "-"],
                    [t.sanctionedLoad, `${user.sanctionedLoad || 2} kW`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
                      <span style={{ color: "var(--dim)", fontWeight: 600 }}>{k}</span>
                      <span style={{ color: "var(--text)" }}>{v}</span>
                    </div>
                  ))}
                  <button onClick={() => setEdit(true)} style={{ marginTop: 16, background: "var(--green)", color: "#fff", border: "none", padding: "10px 22px", borderRadius: "var(--r3)", fontWeight: 700, fontSize: 14 }}>{t.updateProfile}</button>
                </>
              )}
            </>
          )}
          {tab === "pw" && (
            <>
              <Fi label={lang === "bn" ? "পুরনো পাসওয়ার্ড" : "Old Password"} type="password" value={pwF.old} onChange={e => setPwF({ ...pwF, old: e.target.value })} />
              <Fi label={lang === "bn" ? "নতুন পাসওয়ার্ড" : "New Password"} type="password" value={pwF.newP} onChange={e => setPwF({ ...pwF, newP: e.target.value })} />
              <Fi label={lang === "bn" ? "নিশ্চিত" : "Confirm"} type="password" value={pwF.conf} onChange={e => setPwF({ ...pwF, conf: e.target.value })} />
              <Abtn onClick={changePw}>{t.changePassword}</Abtn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// ── ELECTRICITY PAGE ──────────────────────────────────────────────────
function ElecPage({ user, addHistory, toast$, t, lang }) {
  const [prov, setProv] = useState(() => ELEC_PROVIDERS.find(p => p.id === (user.provider || "dpdc")) || ELEC_PROVIDERS[0]);
  const [load, setLoad] = useState(user.sanctionedLoad || 2);
  const [days, setDays] = useState(30);
  const [devs, setDevs] = useState([]);
  const [cat, setCat] = useState("all");
  const [result, setResult] = useState(null);
  const [tariff, setTariff] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [srcLabel, setSrcLabel] = useState(null);

  const fetchRate = async () => {
    setFetching(true);
    const r = await fetchLiveElec(prov.id);
    setTariff(r);
    const sl = r.source === "live-api" ? "live" : r.source === "cache" ? "cache" : "builtin";
    setSrcLabel(sl);
    const msgs = { bn: { live: "লাইভ রেট আপডেট হয়েছে! ✅", cache: "ক্যাশড রেট লোড হয়েছে।", builtin: "ডিফল্ট রেট ব্যবহার হচ্ছে।" }, en: { live: "Live rate updated! ✅", cache: "Cached rate loaded.", builtin: "Using default rate." } };
    toast$(msgs[lang][sl], sl === "live" ? "ok" : "warn");
    setFetching(false);
  };

  useEffect(() => { fetchRate(); }, [prov.id]);

  const cats = ["all", ...[...new Set(ELEC_DEVICES.map(d => lang === "bn" ? d.cbn : d.cen))]];
  const filtered = ELEC_DEVICES.filter(d => cat === "all" || (lang === "bn" ? d.cbn : d.cen) === cat);

  const add = (d) => setDevs(p => [...p, { id: gid(), bn: d.bn, en: d.en, watts: d.w, hours: 2, qty: 1, icon: d.icon, custom: d.bn === "কাস্টম ডিভাইস" || d.en === "Custom Device" }]);
  const upd = (id, f, v) => setDevs(p => p.map(x => x.id === id ? { ...x, [f]: v } : x));
  const rem = (id) => setDevs(p => p.filter(x => x.id !== id));

  const calc = async () => {
    if (!devs.length) { toast$(lang === "bn" ? "কমপক্ষে একটি ডিভাইস যোগ করুন।" : "Add at least one device.", "err"); return; }
    let totalKwh = 0;
    const breakdown = devs.map(d => { const kwh = (d.watts * d.qty * d.hours * days) / 1000; totalKwh += kwh; return { ...d, kwh: kwh.toFixed(2) }; });
    const bill = calcElec(totalKwh, load, tariff);
    const rec = { id: gid(), type: "electricity", userId: user.id, userName: user.name, provider: lang === "bn" ? prov.bn : prov.en, days, sanctionedLoad: load, totalKwh: totalKwh.toFixed(2), bill, breakdown, tariffSource: tariff?.source || "builtin", date: Date.now() };
    await addHistory(rec); setResult(rec);
    toast$(lang === "bn" ? "বিদ্যুৎ বিল হিসাব সম্পন্ন! ⚡" : "Electricity bill calculated! ⚡");
  };

  return (
    <div className="page">
      <div style={{ textAlign: "center", marginBottom: 24 }} className="anim">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,158,11,.1)", border: "1px solid var(--elec)", borderRadius: 20, padding: "6px 18px", marginBottom: 12, fontSize: 13, fontWeight: 700, color: "var(--elec)" }}>
          ⚡ {lang === "bn" ? "বিদ্যুৎ বিল পূর্বাভাস" : "Electricity Bill Calculator"}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>{t.electricity} {lang === "bn" ? "বিল হিসাব" : "Bill"}</h1>
      </div>

      {/* Provider & Settings */}
      <Card>
        <CardTitle accent="var(--elec)">⚙️ {lang === "bn" ? "সেটিংস" : "Settings"}</CardTitle>
        <div className="grid2" style={{ marginBottom: 16 }}>
          <div>
            <label style={lblStyle}>{t.provider}</label>
            <select value={prov.id} onChange={e => { setProv(ELEC_PROVIDERS.find(p => p.id === e.target.value)); setSrcLabel(null); }}>
              {ELEC_PROVIDERS.map(p => <option key={p.id} value={p.id}>{lang === "bn" ? p.bn : p.en} — {lang === "bn" ? p.areaBn : p.areaEn}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <button onClick={fetchRate} disabled={fetching} style={{ background: "none", border: "1.5px solid var(--elec)", color: "var(--elec)", padding: "10px 14px", borderRadius: "var(--r3)", fontWeight: 700, fontSize: 13 }}>
              {fetching ? <span className="pulse">{t.fetching}</span> : t.fetchRate}
            </button>
          </div>
        </div>
        {srcLabel && (
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>{t.rateSource}:</span>
            <span className={`src-${srcLabel}`}>{lang === "bn" ? (srcLabel === "live" ? "লাইভ" : srcLabel === "cache" ? "ক্যাশড" : "ডিফল্ট") : (srcLabel === "live" ? "Live" : srcLabel === "cache" ? "Cached" : "Default")}</span>
            {tariff?.fetchedAt && <span style={{ fontSize: 11, color: "var(--dim)" }}>{fmtDt(tariff.fetchedAt, lang)}</span>}
          </div>
        )}
        <div className="grid2">
          <div>
            <label style={lblStyle}>{t.sanctionedLoad}: {load} kW · {lang === "bn" ? "ডিমান্ড" : "Demand"}: ৳{load * (tariff?.demandPerKw || D_DEMAND)}</label>
            <input type="range" min={0.5} max={10} step={0.5} value={load} onChange={e => setLoad(Number(e.target.value))} style={{ accentColor: "var(--elec)", width: "100%", marginTop: 8 }} />
          </div>
          <div>
            <label style={lblStyle}>{t.billingDays}: {days} {t.days}</label>
            <input type="range" min={7} max={60} value={days} onChange={e => setDays(Number(e.target.value))} style={{ accentColor: "var(--elec)", width: "100%", marginTop: 8 }} />
          </div>
        </div>
      </Card>

      {/* Device picker */}
      <Card>
        <CardTitle accent="var(--elec)">🔌 {t.addDevice}</CardTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ background: cat === c ? "rgba(245,158,11,.15)" : "var(--bg3)", border: `1px solid ${cat === c ? "var(--elec)" : "var(--border)"}`, color: cat === c ? "var(--elec)" : "var(--muted)", borderRadius: 20, padding: "4px 13px", fontSize: 12, fontWeight: 600 }}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid-auto">
          {filtered.map(d => (
            <button key={d.bn} onClick={() => add(d)} title={lang === "bn" ? d.bn : d.en}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", background: "var(--bg3)", border: "1.5px solid var(--border)", borderRadius: "var(--r3)", fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
              <span style={{ fontSize: 22 }}>{d.icon}</span>
              <span style={{ textAlign: "center", lineHeight: 1.3, fontSize: 10 }}>{lang === "bn" ? d.bn : d.en}</span>
              <span style={{ color: "var(--elec)", fontWeight: 700, fontSize: 10 }}>{d.w}W</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Added devices */}
      {devs.length > 0 && (
        <Card>
          <CardTitle accent="var(--elec)">🏠 {t.yourDevices} ({devs.length}) · {lang === "bn" ? "মোট" : "Total"}: {devs.reduce((s, d) => s + (d.watts * d.qty * d.hours * days) / 1000, 0).toFixed(1)} kWh</CardTitle>
          {devs.map(d => (
            <div key={d.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--r3)", padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 26 }}>{d.icon}</div>
              <div style={{ flex: 1 }}>
                {d.custom ? <input style={{ marginBottom: 4, padding: "5px 8px", fontSize: 13, width: "100%" }} value={lang === "bn" ? d.bn : d.en} onChange={e => upd(d.id, lang === "bn" ? "bn" : "en", e.target.value)} placeholder={lang === "bn" ? "ডিভাইসের নাম" : "Device name"} /> : <div style={{ fontWeight: 700, fontSize: 13 }}>{lang === "bn" ? d.bn : d.en}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                  <NumIn l={lang === "bn" ? "ওয়াট" : "Watts"} v={d.watts} min={1} onChange={v => upd(d.id, "watts", v)} />
                  <NumIn l={lang === "bn" ? "ঘণ্টা/দিন" : "Hr/day"} v={d.hours} min={0} max={24} step={.5} onChange={v => upd(d.id, "hours", v)} />
                  <NumIn l={lang === "bn" ? "সংখ্যা" : "Qty"} v={d.qty} min={1} onChange={v => upd(d.id, "qty", v)} />
                </div>
              </div>
              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "var(--elec)", fontWeight: 700 }}>{((d.watts * d.qty * d.hours * days) / 1000).toFixed(1)} kWh</div>
                <button onClick={() => rem(d.id)} style={{ background: "rgba(220,38,38,.15)", color: "#f87171", border: "none", borderRadius: 6, width: 26, height: 26, fontWeight: 700, fontSize: 12 }}>✕</button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <button onClick={calc} disabled={!devs.length}
          style={{ background: "var(--elec)", color: "#000", border: "none", padding: "14px 48px", borderRadius: "var(--r2)", fontSize: 16, fontWeight: 900, boxShadow: "0 4px 20px rgba(245,158,11,.35)" }}>
          ⚡ {t.calculate}
        </button>
      </div>
      {result && <ElecReport result={result} onClose={() => setResult(null)} t={t} lang={lang} />}
    </div>
  );
}