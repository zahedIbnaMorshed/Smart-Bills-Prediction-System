import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
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