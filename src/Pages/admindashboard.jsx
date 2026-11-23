import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, UserRound, Stethoscope, Pill, FlaskConical, ShoppingCart,
  BarChart3, Wallet, Settings, CalendarDays, Building2, CheckCircle2, Clock, Banknote,
  TrendingUp, ClipboardList, AlertTriangle, FileText, Check, X, Info, Ban, Zap,
  ShieldCheck, Headphones, Bell, Search, LogOut, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Star, FolderOpen, Timer, Mail, MapPin,
} from "lucide-react";
import { QueryClient, QueryClientProvider, useQuery, useIsFetching, keepPreviousData } from "@tanstack/react-query";

const BASE = "https://shefaa-backend.vercel.app/api/admin";

/* ─── FONTS & GLOBAL STYLES ──────────────────────────────────────────────── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes spin      { to { transform: rotate(360deg) } }
  @keyframes loadbar   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes fadeIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideIn   { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.5} }
  @keyframes countUp   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes toastIn   { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastOut  { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(20px)} }
  * { box-sizing: border-box; }
  .app-root, .app-root * { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif !important; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cfd8ea; border-radius: 3px; }
  select option { background: #fff; color: #1e2a4a; }
  input::placeholder, textarea::placeholder { color: #9aa7c2; }
  .nav-item { transition: all 0.18s ease; }
  .nav-item:hover { background: #f1f5fd !important; }
  .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(37,99,235,0.12) !important; }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
  .btn-primary { transition: all 0.18s ease; }
  .table-row:hover td { background: #f6f9ff; }
  .kpi-card { animation: fadeIn 0.5s ease both; }
  .hscroll { display: flex; gap: 14px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px 2px 10px; scrollbar-width: none; }
  .hscroll::-webkit-scrollbar { display: none; }
  .hscroll > * { flex: 0 0 auto; scroll-snap-align: start; }
  .hs-btn { transition: all .15s ease; }
  .hs-btn:hover { background: #2563eb !important; color: #fff !important; }
`;

/* ─── COLOR PALETTE (MediCare style) ─────────────────────────────────────── */
const C = {
  bg: "#f4f7fc", bgSub: "#f4f7fc", surface: "#ffffff", surfaceHi: "#ffffff",
  card: "#ffffff", cardHi: "#eef4ff",
  border: "#e8edf6", borderHi: "#c7d7fb", borderAct: "#2563eb",
  text: "#1e2a4a", text2: "#1e2a4a", textSub: "#51607f", textMuted: "#8592ad",
  blue1: "#1d4ed8", blue2: "#2563eb", blue3: "#3b82f6", blue4: "#60a5fa",
  blue5: "#eaf1ff", blue6: "#dbe7ff",
  amber: "#f59e0b", amberLo: "#fff6e5", amberBrd: "#fde3a7", gold: "#f59e0b",
  orange: "#f97316", orangeLo: "#fff0e6",
  green: "#16a34a", greenLo: "#e8f8ee", greenBrd: "#b6ebc8",
  red: "#ef4444", redLo: "#fdecec", redBrd: "#f8c4c4",
  purple: "#7c5cf0", purpleLo: "#efeafe",
};
const SHADOW = "0 2px 14px rgba(30,64,175,0.06)";

/* ─── API LAYER (TanStack Query cache) ───────────────────────────────────────
   - Data is cached per URL: going back to a tab shows it instantly (no spinner)
   - Stale data is refreshed silently in the background
   - Identical requests made at the same time are merged into one
   - Any mutation (apiPost) marks all admin data stale so screens refresh      */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,                 // data counts as fresh for 30s
      gcTime: 10 * 60_000,               // keep unused data in memory for 10 min
      refetchOnWindowFocus: true,        // refresh (only if stale) when you return to the browser tab
      retry: (count, err) => ![401, 403, 404].includes(err?.status) && count < 1,
    },
  },
});

// how long each kind of data stays "fresh" (ms)
function staleFor(path) {
  if (path.startsWith("/settings") || path.startsWith("/appointments/specializations")) return 5 * 60_000;
  if (path.startsWith("/platform-health")) return 15_000;
  if (path.startsWith("/stats") || path.startsWith("/registrations-per-month") ||
      path.startsWith("/finance/revenue") || path.startsWith("/finance/summary") ||
      path.startsWith("/recent-activity")) return 60_000;
  return 30_000; // lists: users, doctors, orders, billing...
}

async function apiGet(path) {
  const token = sessionStorage.getItem("accessToken");
  const r = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

// same return shape as before: { data, loading, error, refetch }
// loading  = true only while there is NO data yet (first load)
// fetching = true during any request, including silent background refresh
function useApi(path) {
  const q = useQuery({
    queryKey: ["admin", path],
    queryFn: () => apiGet(path),
    staleTime: staleFor(path),
    placeholderData: keepPreviousData,   // when filters/page change, keep showing the old rows meanwhile
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading,
    fetching: q.isFetching,
    error: q.error ? q.error.message : null,
    refetch: () => q.refetch({ cancelRefetch: false }),
  };
}

async function apiPost(path, method = "POST", body = null) {
  const token = sessionStorage.getItem("accessToken");
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  queryClient.invalidateQueries({ queryKey: ["admin"] }); // data changed -> mark everything stale
  return json;
}

/* ─── TOAST SYSTEM ───────────────────────────────────────────────────────── */
function Toast({ message, type = "info", onDone }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2800);
    const t2 = setTimeout(onDone, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  const colors = {
    info: { bg: C.blue5, brd: C.borderHi, icon: Info, tc: C.blue2 },
    success: { bg: C.greenLo, brd: C.greenBrd, icon: Check, tc: C.green },
    error: { bg: C.redLo, brd: C.redBrd, icon: X, tc: C.red },
    warning: { bg: C.amberLo, brd: C.amberBrd, icon: AlertTriangle, tc: C.amber },
  };
  const s = colors[type] || colors.info;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: C.surface, border: `1px solid ${s.brd}`, borderRadius: 14,
      padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 32px rgba(30,64,175,0.15)",
      animation: out ? "toastOut 0.4s ease forwards" : "toastIn 0.4s ease",
      maxWidth: 340,
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, border: `1px solid ${s.brd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: s.tc, flexShrink: 0 }}><s.icon size={15} strokeWidth={2.4} /></div>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{message}</span>
    </div>
  );
}

/* ─── PRIMITIVES ─────────────────────────────────────────────────────────── */
const fmt = (n) => (n ?? 0).toLocaleString("en-EG");
const fmtEGP = (n) => `EGP ${fmt(n)}`;

const Spinner = ({ small }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: small ? 16 : 48, gap: 8, color: C.textMuted }}>
    <div style={{ width: small ? 14 : 18, height: small ? 14 : 18, border: `2px solid ${C.blue6}`, borderTopColor: C.blue2, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    {!small && <span style={{ fontSize: 12 }}>Loading…</span>}
  </div>
);

const Err = ({ msg }) => (
  <div style={{ background: C.redLo, border: `1px solid ${C.redBrd}`, borderRadius: 12, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
    <strong>Error:</strong> {msg}
  </div>
);

const Badge = ({ color = "gray", children, dot }) => {
  const map = {
    blue: { bg: C.blue5, tc: C.blue2 },
    green: { bg: C.greenLo, tc: C.green },
    amber: { bg: C.amberLo, tc: "#d97706" },
    red: { bg: C.redLo, tc: C.red },
    purple: { bg: C.purpleLo, tc: C.purple },
    orange: { bg: C.orangeLo, tc: C.orange },
    gray: { bg: "#eef2f8", tc: C.textSub },
  };
  const { bg, tc } = map[color] || map.gray;
  return (
    <span style={{ background: bg, color: tc, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: tc, display: "inline-block" }} />}
      {children}
    </span>
  );
};

const statusBadge = (s) => {
  const g = ["Active", "Confirmed", "Delivered", "Settled", "Ready", "Healthy", "Verified"];
  const a = ["Pending", "Pending verify", "Processing", "Connecting"];
  const r = ["Suspended", "Cancelled", "Rejected", "Disconnected"];
  if (g.includes(s)) return <Badge color="green" dot>{s}</Badge>;
  if (a.includes(s)) return <Badge color="amber" dot>{s}</Badge>;
  if (r.includes(s)) return <Badge color="red" dot>{s}</Badge>;
  return <Badge dot>{s}</Badge>;
};

const Avatar = ({ name = "?", size = 30 }) => {
  const palettes = [[C.blue5, C.blue2], [C.amberLo, "#d97706"], [C.greenLo, C.green], [C.purpleLo, C.purple], [C.orangeLo, C.orange]];
  const [bg, tc] = palettes[(name.charCodeAt(0) || 0) % palettes.length];
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: tc, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials}
    </div>
  );
};

/* KPI — pastel icon tile + big number + optional delta */
const KPI = ({ label, value, sub, accent, icon, delta, delay = 0 }) => {
  const col = accent || C.blue2;
  const Icon = icon;
  const up = typeof delta === "string" ? !delta.trim().startsWith("-") : true;
  return (
    <div className="card-hover kpi-card" style={{ background: `linear-gradient(135deg, ${col}12 0%, #ffffff 60%)`, border: `1px solid ${col}1f`, borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, animationDelay: `${delay}ms`, boxShadow: SHADOW }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: col + "1a", color: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {Icon ? <Icon size={22} strokeWidth={2} /> : null}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", lineHeight: 1.1, animation: "countUp 0.5s ease both", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value ?? "—"}</div>
        {(delta || sub) && (
          <div style={{ fontSize: 11, marginTop: 5, display: "flex", gap: 6, alignItems: "center" }}>
            {delta && <span style={{ color: up ? C.green : C.red, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>{up ? <ArrowUp size={12} strokeWidth={2.6} /> : <ArrowDown size={12} strokeWidth={2.6} />}{String(delta).replace("-", "")}</span>}
            {sub && <span style={{ color: C.textMuted }}>{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const Card = ({ children, style, glow, title, extra }) => (
  <div style={{
    background: glow ? "linear-gradient(180deg, #fff7e6 0%, #ffffff 55%)" : C.card, borderRadius: 18, padding: "20px 22px", marginBottom: 14,
    border: glow ? `1px solid ${C.amberBrd}` : "1px solid transparent",
    boxShadow: glow ? "0 4px 24px rgba(245,158,11,0.10)" : SHADOW,
    position: "relative", overflow: "hidden", ...style,
  }}>
    {title && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>
        {extra && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{extra}</div>}
      </div>
    )}
    {children}
  </div>
);

const Btn = ({ variant = "primary", onClick, children, small, disabled, style: ov, className }) => {
  const base = { border: "1px solid transparent", borderRadius: 10, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 };
  const sz = small ? { padding: "6px 13px", fontSize: 11.5 } : { padding: "10px 20px", fontSize: 12.5 };
  const vars = {
    primary: { background: C.blue2, color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.28)" },
    outline: { background: "#fff", color: C.blue2, borderColor: C.borderHi },
    danger: { background: C.redLo, color: C.red, borderColor: C.redBrd },
    success: { background: C.greenLo, color: C.green, borderColor: C.greenBrd },
    ghost: { background: "#fff", color: C.textSub, borderColor: C.border },
    amber: { background: C.amberLo, color: "#d97706", borderColor: C.amberBrd },
    warm: { background: C.amberLo, color: "#d97706", borderColor: C.amberBrd },
  };
  return <button className={`btn-primary ${className || ""}`} disabled={disabled} style={{ ...base, ...sz, ...vars[variant], ...ov }} onClick={onClick}>{children}</button>;
};

const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{ width: 42, height: 24, borderRadius: 12, background: on ? C.blue2 : "#dbe2ef", position: "relative", cursor: "pointer", flexShrink: 0, transition: "all .25s" }}>
    <div style={{ position: "absolute", width: 18, height: 18, background: "#fff", borderRadius: "50%", top: 3, left: on ? 21 : 3, transition: "left .22s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 5px rgba(0,0,0,0.18)" }} />
  </div>
);

const Bar = ({ pct, color, animate = true }) => (
  <div style={{ height: 7, borderRadius: 6, background: "#eef2f8", overflow: "hidden", marginTop: 6 }}>
    <div style={{ height: "100%", borderRadius: 6, background: color || C.blue2, width: `${Math.min(100, pct || 0)}%`, transition: animate ? "width 0.8s cubic-bezier(0.4,0,0.2,1)" : "none" }} />
  </div>
);

/* ─── CHARTS ─────────────────────────────────────────────────────────────── */
const SparkLine = ({ data = [], color = C.blue2, height = 90 }) => {
  if (data.length < 2) return null;
  const w = 300, h = height, pad = 8;
  const max = Math.max(...data, 1);
  const P = data.map((v, i) => [(i / (data.length - 1)) * (w - pad * 2) + pad, h - pad - (v / max) * (h - pad * 2)]);
  let d = `M ${P[0][0]},${P[0][1]}`;
  for (let i = 1; i < P.length; i++) {
    const mx = (P[i - 1][0] + P[i][0]) / 2;
    d += ` C ${mx},${P[i - 1][1]} ${mx},${P[i][1]} ${P[i][0]},${P[i][1]}`;
  }
  const area = `${d} L ${P[P.length - 1][0]},${h} L ${P[0][0]},${h} Z`;
  const gid = "sp" + color.replace("#", "");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(t => <line key={t} x1="0" x2={w} y1={h * t} y2={h * t} stroke="#e8edf6" strokeDasharray="3 4" />)}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {P.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke={color} strokeWidth="1.8" />)}
    </svg>
  );
};

const BarChart = ({ data = [], labels = [], colors = [], height = 120 }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingBottom: 20 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 9, color: C.textMuted }}>{v > 0 ? (v >= 1000 ? `${Math.round(v / 1000)}k` : v) : ""}</div>
          <div style={{ width: "100%", maxWidth: 26, borderRadius: "7px 7px 3px 3px", minHeight: 4, background: colors[i] || C.blue2, height: `${(v / max) * 100}%`, transition: "height 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
          {labels[i] && <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 2 }}>{labels[i]}</div>}
        </div>
      ))}
    </div>
  );
};

const DonutChart = ({ segments = [], size = 100 }) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 36, cx = 50, cy = 50, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f8" strokeWidth="13" />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="13"
            strokeDasharray={`${Math.max(dash - 2, 0)} ${circ - dash + 2}`} strokeDashoffset={-offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dasharray 0.8s ease" }} />
        );
        offset += dash;
        return el;
      })}
      <text x="50" y="49" textAnchor="middle" fill={C.text} fontSize="12" fontWeight="800">{fmt(total)}</text>
      <text x="50" y="61" textAnchor="middle" fill={C.textMuted} fontSize="7.5">total</text>
    </svg>
  );
};

/* ─── DATA TABLE ─────────────────────────────────────────────────────────── */
const DataTable = ({ cols, rows, empty = "No data" }) => (
  rows.length === 0
    ? <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 13 }}>{empty}</div>
    : (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "10px 12px", background: "#f7f9fd", whiteSpace: "nowrap", width: c.w, borderRadius: i === 0 ? "10px 0 0 10px" : i === cols.length - 1 ? "0 10px 10px 0" : 0 }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="table-row">
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "12px", borderBottom: ri < rows.length - 1 ? `1px solid ${C.border}` : "none", color: C.text, fontWeight: 500, verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", transition: "background .15s" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
);

/* ─── PDF VIEWER MODAL ───────────────────────────────────────────────────── */
function PdfModal({ url, title, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, borderRadius: 20, width: "80vw", height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 40px 100px rgba(30,64,175,0.25)", animation: "fadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}><FileText size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{title}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <a href={url} target="_blank" rel="noreferrer"><Btn variant="outline" small>Open ↗</Btn></a>
            <Btn variant="ghost" small onClick={onClose}><X size={13} /> Close</Btn>
          </div>
        </div>
        <iframe src={url} style={{ flex: 1, border: "none", background: "#fff" }} title={title} />
      </div>
    </div>
  );
}

/* ─── HORIZONTAL SCROLLER (cards in one row, with arrows) ─────────────────── */
function HScroll({ children }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const check = useCallback(() => {
    const el = ref.current; if (!el) return;
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    check();
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => ro.disconnect();
  }, [check, children]);
  const go = (dir) => ref.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  const arrow = (side, show, dir, Ic) => show && (
    <button className="hs-btn" onClick={() => go(dir)} style={{
      position: "absolute", top: "50%", [side]: -6, transform: "translateY(-50%)", zIndex: 5,
      width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`, background: "#fff",
      color: C.blue2, display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", boxShadow: "0 4px 14px rgba(30,64,175,0.18)",
    }}><Ic size={17} /></button>
  );
  return (
    <div style={{ position: "relative" }}>
      {arrow("left", edge.l, -1, ChevronLeft)}
      <div className="hscroll" ref={ref} onScroll={check}>{children}</div>
      {arrow("right", edge.r, 1, ChevronRight)}
    </div>
  );
}

/* ─── VERIFICATION CARD ──────────────────────────────────────────────────── */
function VerificationCard({ entity, type, onApprove, onReject }) {
  const [pdfModal, setPdfModal] = useState(null);
  const user = entity.userId || entity;
  const name = user.name || entity.name || "Unknown";
  const pdfs = [];
  if (type === "doctor" && entity.membershipPdf) pdfs.push({ label: "Membership PDF", url: entity.membershipPdf });
  if (type !== "doctor" && entity.medicalLicencePdf) pdfs.push({ label: "Medical Licence PDF", url: entity.medicalLicencePdf });
  const TypeIcon = type === "doctor" ? Stethoscope : type === "pharmacy" ? Pill : FlaskConical;
  return (
    <>
      {pdfModal && <PdfModal url={pdfModal.url} title={pdfModal.label} onClose={() => setPdfModal(null)} />}
      <div style={{ width: 340, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: SHADOW, animation: "fadeIn 0.4s ease" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.blue5}, #ffffff)`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={name} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 5, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <Mail size={12} style={{ flexShrink: 0 }} />{user.email}
            </div>
          </div>
          <Badge color="amber" dot>Pending</Badge>
        </div>
        <div style={{ padding: "14px 18px 16px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <Badge color="blue"><TypeIcon size={11} /> {type}</Badge>
            {entity.specialization && <Badge color="purple">{entity.specialization}</Badge>}
            {entity.city && <Badge><MapPin size={11} /> {entity.city}</Badge>}
          </div>
          {pdfs.map(pdf => (
            <div key={pdf.label} onClick={() => setPdfModal(pdf)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#f7f9fd", border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer", marginBottom: 12, transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = C.blue5; e.currentTarget.style.borderColor = C.borderHi; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f7f9fd"; e.currentTarget.style.borderColor = C.border; }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: C.blue5, color: C.blue2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileText size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{pdf.label}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Click to preview</div>
              </div>
              <ChevronRight size={15} color={C.blue2} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="success" small onClick={onApprove} style={{ flex: 1 }}><Check size={13} /> Approve</Btn>
            <Btn variant="danger" small onClick={onReject} style={{ flex: 1 }}><X size={13} /> Reject</Btn>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── SEARCH MODAL ───────────────────────────────────────────────────────── */
function SearchModal({ onClose }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [results, setRes] = useState(null);
  const [loading, setL] = useState(false);
  const [error, setErr] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (q.length < 2) { setRes(null); return; }
    const t = setTimeout(async () => {
      setL(true); setErr(null);
      try {
        const token = sessionStorage.getItem("accessToken");
        const params = new URLSearchParams({ q, limit: 20 });
        if (role) params.append("roles", role);
        const r = await fetch(`${BASE}/search?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setRes(await r.json());
      } catch (e) { setErr(e.message); }
      finally { setL(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, role]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, borderRadius: 20, width: 580, maxHeight: "68vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 80px rgba(30,64,175,0.22)", animation: "fadeIn 0.25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
          <Search size={17} color={C.textMuted} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search users by name or email…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: C.text, fontWeight: 500, background: "transparent" }} />
          <select value={role} onChange={e => setRole(e.target.value)}
            style={{ fontSize: 11, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, background: C.bgSub }}>
            <option value="">All roles</option>
            {["doctor", "patient", "pharmacy", "lab", "admin"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <Btn variant="ghost" small onClick={onClose}><X size={14} /></Btn>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {q.length < 2 && <div style={{ padding: "36px 16px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>Type at least 2 characters to search…</div>}
          {loading && <Spinner />}
          {error && <Err msg={error} />}
          {results && !loading && (
            results.users.length === 0
              ? <div style={{ padding: "36px 16px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>No results for "{q}"</div>
              : <>
                <div style={{ padding: "8px 18px", fontSize: 11, color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{results.total} result{results.total !== 1 ? "s" : ""}</div>
                {results.users.map(u => (
                  <div key={u._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.blue5}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Avatar name={u.name || u.email} size={34} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.name || "—"}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{u.email}</div>
                    </div>
                    <Badge color="blue">{u.role}</Badge>
                    {statusBadge(u.isVerified ? "Active" : "Pending")}
                  </div>
                ))}
              </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCREENS
══════════════════════════════════════════════════════════════════════════════ */

/* ─── OVERVIEW ───────────────────────────────────────────────────────────── */
function OverviewScreen({ addToast }) {
  const { data: statsData, loading, error } = useApi("/stats");
  const { data: healthData, loading: hLoad } = useApi("/platform-health");
  const { data: actData, loading: aLoad } = useApi("/recent-activity?limit=8");
  const { data: regData } = useApi("/registrations-per-month");

  const stats = statsData?.stats || {};
  const health = healthData || {};
  const activity = actData?.activity || [];
  const monthly = (regData?.monthly || []).map(m => m.count);

  if (loading) return <Spinner />;
  if (error) return <Err msg={error} />;

  const healthItems = [
    { label: "API Uptime", pct: health.apiUptime?.percent ?? 0, val: health.apiUptime?.status ?? "—", color: C.green },
    { label: "Server Load", pct: health.serverLoad?.percent ?? 0, val: `${health.serverLoad?.percent ?? "—"}%`, color: (health.serverLoad?.percent || 0) > 80 ? C.red : C.amber },
    { label: "DB Health", pct: health.dbHealth?.percent ?? 0, val: health.dbHealth?.status ?? "—", color: health.dbHealth?.healthy ? C.green : C.red },
  ];

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Patients" value={fmt(stats.patients)} icon={UserRound} delay={0} />
        <KPI label="Doctors" value={fmt(stats.doctors)} accent={C.green} icon={Stethoscope} delay={60} />
        <KPI label="Appointments" value={fmt(stats.appointments)} accent={C.purple} icon={CalendarDays} delay={120} />
        <KPI label="Total Providers" value={fmt((stats.pharmacies || 0) + (stats.labs || 0) + (stats.doctors || 0))} accent={C.orange} icon={Building2} delay={180} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Card title="Registration Trend" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", marginBottom: 8 }}>
            {fmt(regData?.total)}
            <span style={{ fontSize: 12, color: C.green, marginLeft: 10, fontWeight: 600 }}>registrations {regData?.year || ""}</span>
          </div>
          <SparkLine data={monthly} color={C.blue2} height={90} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((m, i) => (
              <span key={i} style={{ fontSize: 9.5, color: i === new Date().getMonth() ? C.blue2 : C.textMuted, fontWeight: i === new Date().getMonth() ? 700 : 400 }}>{m}</span>
            ))}
          </div>
        </Card>

        <Card title="Network Breakdown" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <DonutChart size={110} segments={[
              { value: stats.patients || 0, color: C.blue2 },
              { value: stats.doctors || 0, color: C.green },
              { value: stats.pharmacies || 0, color: C.amber },
              { value: stats.labs || 0, color: C.purple },
            ]} />
            <div style={{ flex: 1 }}>
              {[["Patients", stats.patients, C.blue2], ["Doctors", stats.doctors, C.green], ["Pharmacies", stats.pharmacies, C.amber], ["Labs", stats.labs, C.purple]].map(([l, v, c]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                    <span style={{ fontSize: 12, color: C.textSub }}>{l}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Card title="Platform Health" style={{ marginBottom: 0 }}>
          {hLoad ? <Spinner small /> : healthItems.map(h => (
            <div key={h.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                <span>{h.label}</span><span style={{ color: h.color }}>{h.val}</span>
              </div>
              <Bar pct={h.pct} color={h.color} />
            </div>
          ))}
          {health.apiUptime && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}><Timer size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />{health.apiUptime.uptimeFormatted}</div>}
        </Card>

        <Card title="Quick Stats" style={{ marginBottom: 0 }}>
          {[
            ["Total Appointments", stats.appointments, C.blue2],
            ["Reviews", stats.reviews, C.amber],
            ["Active Pharmacies", stats.pharmacies, C.green],
            ["Active Labs", stats.labs, C.purple],
          ].map(([label, val, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textSub }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color }}>{fmt(val)}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Recent Activity">
        {aLoad ? <Spinner /> : activity.length ? (
          <DataTable
            cols={[{ label: "Time", w: "9%" }, { label: "Event", w: "20%" }, { label: "Entity", w: "20%" }, { label: "User", w: "16%" }, { label: "Status", w: "14%" }, { label: "Date", w: "21%" }]}
            rows={activity.map(a => {
              const entityName = typeof a.entity === "object"
                ? (a.entity?.name || a.entity?.userId?.name || "Unknown")
                : (a.entity || "—");
              const userName = typeof a.user === "object"
                ? (a.user?.name || a.user?.userId?.name || "—")
                : (a.user || "—");
              return [
                <span style={{ color: C.textMuted, fontSize: 11 }}>{a.time}</span>,
                <span style={{ color: C.text }}>{a.event}</span>,
                entityName,
                userName,
                <Badge color={a.statusType === "green" ? "green" : a.statusType === "red" ? "red" : a.statusType === "amber" ? "amber" : "blue"} dot>{a.status}</Badge>,
                <span style={{ color: C.textMuted, fontSize: 11 }}>{a.date}</span>,
              ];
            })}
          />
        ) : <div style={{ color: C.textMuted, fontSize: 12, padding: "20px 0", textAlign: "center" }}>No recent activity</div>}
      </Card>
    </div>
  );
}

/* ─── USERS ──────────────────────────────────────────────────────────────── */
function UsersScreen({ addToast }) {
  const { data, loading, error, refetch } = useApi("/users");
  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatus] = useState("All");
  const users = data || [];
  const filtered = users.filter(u =>
    (filter === "All" || u.role === filter.toLowerCase()) &&
    (statusFilter === "All" || (u.isVerified ? "Active" : "Pending") === statusFilter)
  );
  const counts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  const handleAction = async (type, id) => {
    try {
      const method = type === "delete" ? "DELETE" : "PATCH";
      const path = type === "activate" ? `/users/activate/${id}` : type === "deactivate" ? `/users/deactivate/${id}` : `/users/${id}`;
      const res = await apiPost(path, method);
      addToast(res.message || "Done", "success");
      refetch();
    } catch (e) { addToast("Error: " + e.message, "error"); }
  };

  if (loading) return <Spinner />;
  if (error) return <Err msg={error} />;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Total Users" value={fmt(users.length)} icon={Users} />
        <KPI label="Patients" value={counts.patient ?? 0} accent={C.blue2} icon={UserRound} delay={40} />
        <KPI label="Doctors" value={counts.doctor ?? 0} accent={C.green} icon={Stethoscope} delay={80} />
        <KPI label="Pharmacies" value={counts.pharmacy ?? 0} accent={C.orange} icon={Pill} delay={120} />
        <KPI label="Labs" value={counts.lab ?? 0} accent={C.purple} icon={FlaskConical} delay={160} />
      </div>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>All Users</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["All", "Patient", "Doctor", "Pharmacy", "Lab", "Admin"].map(o => (
              <button key={o} onClick={() => setFilter(o)} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${filter === o ? C.blue2 : C.border}`, background: filter === o ? C.blue2 : "#fff", color: filter === o ? "#fff" : C.textSub, fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
                {o}
              </button>
            ))}
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              style={{ fontSize: 11.5, padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, background: "#fff" }}>
              {["All", "Active", "Pending"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <DataTable
          cols={[{ label: "Name", w: "22%" }, { label: "Email", w: "28%" }, { label: "Role", w: "12%" }, { label: "Status", w: "14%" }, { label: "Actions", w: "24%" }]}
          rows={filtered.slice(0, 30).map(u => [
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={u.name || u.email} size={28} /><span>{u.name || "—"}</span></div>,
            <span style={{ color: C.textMuted, fontSize: 11 }}>{u.email}</span>,
            <Badge color="blue">{u.role}</Badge>,
            statusBadge(u.isVerified ? "Active" : "Pending"),
            <div style={{ display: "flex", gap: 6 }}>
              {u.isVerified
                ? <Btn variant="danger" small onClick={() => handleAction("deactivate", u._id)}>Suspend</Btn>
                : <Btn variant="success" small onClick={() => handleAction("activate", u._id)}>Activate</Btn>}
              <Btn variant="ghost" small onClick={() => handleAction("delete", u._id)}>Delete</Btn>
            </div>,
          ])}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          Showing {Math.min(30, filtered.length)} of {fmt(filtered.length)} users
        </div>
      </Card>
    </div>
  );
}

// ─── REJECT REASON MODAL ─────────────────────────────────────────────────────
function RejectModal({ name, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
      zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: C.card, border: `1px solid ${C.redBrd}`, borderRadius: 20,
        width: 440, padding: "24px 26px", boxShadow: "0 30px 80px rgba(220,38,38,0.15)",
        animation: "fadeIn 0.25s ease", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: C.red }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.redLo, border: `1px solid ${C.redBrd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}><X size={18} color={C.red} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Reject &amp; Delete</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{name}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, padding: "10px 12px", background: C.redLo, borderRadius: 10, border: `1px solid ${C.redBrd}` }}>
          <AlertTriangle size={13} color={C.red} style={{ verticalAlign: "-2px", marginRight: 6 }} />This will <strong style={{ color: C.red }}>permanently delete</strong> this account and all linked data. A rejection email will be sent first.
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textSub, display: "block", marginBottom: 6 }}>
            Rejection Reason <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Invalid licence number, incomplete documents…"
            rows={3}
            style={{
              width: "100%", resize: "vertical", padding: "10px 12px",
              border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12,
              color: C.text, background: C.bgSub,
              outline: "none", transition: "border-color .15s", lineHeight: 1.5,
            }}
            onFocus={e => e.target.style.borderColor = C.red}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</Btn>
          <Btn variant="danger" onClick={() => onConfirm(reason.trim())} style={{ flex: 1 }}><X size={13} /> Confirm Rejection</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── DOCTORS SCREEN ───────────────────────────────────────────────────────────
function DoctorsScreen({ addToast }) {
  const { data, loading, error, refetch } = useApi("/doctors");
  const { total, doctors } = data || { total: 0, doctors: [] };
  const pending = (doctors || []).filter(d => !d.userId?.isVerified);
  const active  = (doctors || []).filter(d =>  d.userId?.isVerified);

  const [rejectTarget, setRejectTarget] = useState(null);

  const handleAction = async (type, entityId, reason = "") => {
    try {
      if (type === "approve") {
        const res = await apiPost(`/doctors/${entityId}/approve`, "POST");
        addToast(res.message || "Doctor approved", "success");
      } else {
        const res = await apiPost(`/doctors/${entityId}/reject`, "DELETE", reason ? { reason } : undefined);
        addToast(res.message || "Doctor rejected", "success");
      }
      refetch();
    } catch (e) { addToast("Error: " + e.message, "error"); }
  };

  if (loading) return <Spinner />;
  if (error)   return <Err msg={error} />;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {rejectTarget && (
        <RejectModal
          name={rejectTarget.name}
          onConfirm={reason => { setRejectTarget(null); handleAction("reject", rejectTarget.entityId, reason); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Total Doctors" value={total} icon={Stethoscope} />
        <KPI label="Active"        value={active.length}  accent={C.green} icon={CheckCircle2} />
        <KPI label="Pending Review" value={pending.length} accent={C.orange} icon={Clock} />
      </div>

      {pending.length > 0 && (
        <Card glow title="Pending doctors verification" extra={<Badge color="amber">{pending.length} pending</Badge>} style={{ marginBottom: 14 }}>
          <HScroll>
            {pending.map(doctor => (
              <VerificationCard
                key={doctor._id}
                entity={doctor}
                type="doctor"
                onApprove={() => handleAction("approve", doctor._id)}
                onReject={() => setRejectTarget({ entityId: doctor._id, name: doctor.userId?.name || "this doctor" })}
              />
            ))}
          </HScroll>
        </Card>
      )}

      <Card title="All Doctors">
        <DataTable
          cols={[
            { label: "Doctor",         w: "26%" },
            { label: "Email",          w: "28%" },
            { label: "Specialization", w: "24%" },
            { label: "Status",         w: "22%" },
          ]}
          rows={(doctors || []).slice(0, 25).map(d => {
            const u = d.userId || {}, name = u.name || "Unknown";
            return [
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={name} size={28} />{name}</div>,
              <span style={{ color: C.textMuted, fontSize: 11 }}>{u.email || "—"}</span>,
              d.specialization || "—",
              statusBadge(u.isVerified ? "Active" : "Pending"),
            ];
          })}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>
          Showing {Math.min(25, doctors?.length || 0)} of {fmt(total)}
        </div>
      </Card>
    </div>
  );
}

// ─── PHARMACIES SCREEN ────────────────────────────────────────────────────────
function PharmaciesScreen({ addToast }) {
  const { data, loading, error, refetch } = useApi("/pharmacies");
  const { total, pharmacies } = data || { total: 0, pharmacies: [] };
  const pending = (pharmacies || []).filter(p => !p.userId?.isVerified);
  const active  = (pharmacies || []).filter(p =>  p.userId?.isVerified);

  const [rejectTarget, setRejectTarget] = useState(null);

  const handleAction = async (type, entityId, reason = "") => {
    try {
      if (type === "approve") {
        const res = await apiPost(`/pharmacies/${entityId}/approve`, "POST");
        addToast(res.message || "Pharmacy approved", "success");
      } else {
        const res = await apiPost(`/pharmacies/${entityId}/reject`, "DELETE", reason ? { reason } : undefined);
        addToast(res.message || "Pharmacy rejected", "success");
      }
      refetch();
    } catch (e) { addToast("Error: " + e.message, "error"); }
  };

  if (loading) return <Spinner />;
  if (error)   return <Err msg={error} />;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {rejectTarget && (
        <RejectModal
          name={rejectTarget.name}
          onConfirm={reason => { setRejectTarget(null); handleAction("reject", rejectTarget.entityId, reason); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Total Pharmacies" value={total} icon={Pill} accent={C.orange} />
        <KPI label="Active"           value={active.length}  accent={C.green} icon={CheckCircle2} />
        <KPI label="Pending Review"   value={pending.length} accent={C.purple} icon={Clock} />
      </div>

      {pending.length > 0 && (
        <Card glow title="Pending pharmacies verification" extra={<Badge color="amber">{pending.length} pending</Badge>} style={{ marginBottom: 14 }}>
          <HScroll>
            {pending.map(pharmacy => (
              <VerificationCard
                key={pharmacy._id}
                entity={pharmacy}
                type="pharmacy"
                onApprove={() => handleAction("approve", pharmacy._id)}
                onReject={() => setRejectTarget({ entityId: pharmacy._id, name: pharmacy.userId?.name || "this pharmacy" })}
              />
            ))}
          </HScroll>
        </Card>
      )}

      <Card title="All Pharmacies" extra={<Btn variant="outline" small>Export CSV</Btn>}>
        <DataTable
          cols={[
            { label: "Pharmacy", w: "26%" },
            { label: "Email",    w: "28%" },
            { label: "City",     w: "16%" },
            { label: "Status",   w: "16%" },
            { label: "Actions",  w: "14%" },
          ]}
          rows={(pharmacies || []).slice(0, 25).map(p => {
            const u = p.userId || {}, name = u.name || p.name || "Unknown", isActive = u.isVerified;
            return [
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={name} size={28} />{name}</div>,
              <span style={{ color: C.textMuted, fontSize: 11 }}>{u.email || "—"}</span>,
              <span style={{ color: C.textMuted }}>{p.city || u.city || "—"}</span>,
              statusBadge(isActive ? "Active" : "Pending"),
              isActive
                ? <Btn small variant="danger" onClick={() => setRejectTarget({ entityId: p._id, name })}>Suspend</Btn>
                : <div style={{ display: "flex", gap: 6 }}>
                    <Btn small variant="success" onClick={() => handleAction("approve", p._id)}>Approve</Btn>
                    <Btn small variant="danger"  onClick={() => setRejectTarget({ entityId: p._id, name })}>Reject</Btn>
                  </div>,
            ];
          })}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>
          Showing {Math.min(25, pharmacies?.length || 0)} of {fmt(total)}
        </div>
      </Card>
    </div>
  );
}

// ─── LABS SCREEN ──────────────────────────────────────────────────────────────
function LabsScreen({ addToast }) {
  const { data, loading, error, refetch } = useApi("/labs");
  const { total, labs } = data || { total: 0, labs: [] };
  const pending = (labs || []).filter(l => !l.userId?.isVerified);
  const active  = (labs || []).filter(l =>  l.userId?.isVerified);

  const [rejectTarget, setRejectTarget] = useState(null);

  const handleAction = async (type, entityId, reason = "") => {
    try {
      if (type === "approve") {
        const res = await apiPost(`/labs/${entityId}/approve`, "POST");
        addToast(res.message || "Lab approved", "success");
      } else {
        const res = await apiPost(`/labs/${entityId}/reject`, "DELETE", reason ? { reason } : undefined);
        addToast(res.message || "Lab rejected", "success");
      }
      refetch();
    } catch (e) { addToast("Error: " + e.message, "error"); }
  };

  if (loading) return <Spinner />;
  if (error)   return <Err msg={error} />;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {rejectTarget && (
        <RejectModal
          name={rejectTarget.name}
          onConfirm={reason => { setRejectTarget(null); handleAction("reject", rejectTarget.entityId, reason); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Total Labs"    value={total} icon={FlaskConical} accent={C.purple} />
        <KPI label="Active"        value={active.length}  accent={C.green} icon={CheckCircle2} />
        <KPI label="Pending Review" value={pending.length} accent={C.orange} icon={Clock} />
      </div>

      {pending.length > 0 && (
        <Card glow title="Pending labs verification" extra={<Badge color="amber">{pending.length} pending</Badge>} style={{ marginBottom: 14 }}>
          <HScroll>
            {pending.map(lab => (
              <VerificationCard
                key={lab._id}
                entity={lab}
                type="lab"
                onApprove={() => handleAction("approve", lab._id)}
                onReject={() => setRejectTarget({ entityId: lab._id, name: lab.userId?.name || "this lab" })}
              />
            ))}
          </HScroll>
        </Card>
      )}

      <Card title="All Labs" extra={<Btn variant="outline" small>Export CSV</Btn>}>
        <DataTable
          cols={[
            { label: "Lab",     w: "26%" },
            { label: "Email",   w: "28%" },
            { label: "City",    w: "16%" },
            { label: "Status",  w: "16%" },
            { label: "Actions", w: "14%" },
          ]}
          rows={(labs || []).slice(0, 25).map(lab => {
            const u = lab.userId || {}, name = u.name || lab.name || "Unknown", isActive = u.isVerified;
            return [
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={name} size={28} />{name}</div>,
              <span style={{ color: C.textMuted, fontSize: 11 }}>{u.email || "—"}</span>,
              <span style={{ color: C.textMuted }}>{lab.city || u.city || "—"}</span>,
              statusBadge(isActive ? "Active" : "Pending"),
              isActive
                ? <Btn small variant="danger" onClick={() => setRejectTarget({ entityId: lab._id, name })}>Suspend</Btn>
                : <div style={{ display: "flex", gap: 6 }}>
                    <Btn small variant="success" onClick={() => handleAction("approve", lab._id)}>Approve</Btn>
                    <Btn small variant="danger"  onClick={() => setRejectTarget({ entityId: lab._id, name })}>Reject</Btn>
                  </div>,
            ];
          })}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>
          Showing {Math.min(25, labs?.length || 0)} of {fmt(total)}
        </div>
      </Card>
    </div>
  );
}

/* ─── ORDERS ─────────────────────────────────────────────────────────────── */
const ORDER_STATUSES = ["New", "Preparing", "Ready", "Completed", "Cancelled"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];
const ORDERS_PER_PAGE = 15;

const ORDER_STATUS_COLOR = { New: "blue", Preparing: "amber", Ready: "purple", Completed: "green", Cancelled: "red" };
const PAYMENT_STATUS_COLOR = { Pending: "amber", Paid: "green", Failed: "red", Refunded: "gray" };

const th = {
  textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600,
  color: C.textMuted, background: "#f7f9fd", whiteSpace: "nowrap",
};
const td = {
  padding: "12px", fontSize: 13,
  borderBottom: `1px solid ${C.border}`, verticalAlign: "middle",
};
const control = {
  padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
  background: "#fff", color: "inherit", fontSize: 12.5, outline: "none",
};

const egp = (n) => `${fmt(n ?? 0)} EGP`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function OrdersScreen() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const qs = new URLSearchParams({ page, limit: ORDERS_PER_PAGE });
  if (status) qs.set("status", status);
  if (paymentStatus) qs.set("paymentStatus", paymentStatus);
  if (search) qs.set("search", search);

  const summary = useApi("/orders/summary");
  const list = useApi(`/orders?${qs.toString()}`);

  const s = summary.data || {};
  const orders = list.data?.orders || [];
  const pages = list.data?.pages || 1;

  if (summary.loading && list.loading && !list.data) return <Spinner />;
  if (summary.error) return <Err msg={summary.error} />;

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Total Orders" value={fmt(s.total)} icon={ShoppingCart} />
        <KPI label="Today" value={s.today} icon={CalendarDays} accent={s.changeDirection === "up" ? C.green : C.red} />
        <KPI label="Completed Sales" value={egp(s.totalSales)} accent={C.green} icon={Wallet} />
        <KPI label="App Commission" value={egp(s.totalCommission)} accent={C.purple} icon={TrendingUp} />
      </div>

      <Card title="All Orders">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order #, customer or pharmacy…"
            style={{ ...control, flex: "1 1 240px" }}
          />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={control}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} style={control}>
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>

        {list.error ? (
          <Err msg={list.error} />
        ) : (
          <div style={{ overflowX: "auto", opacity: list.fetching ? 0.5 : 1, transition: "opacity .2s" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ ...th, borderRadius: "10px 0 0 10px" }}>Order #</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Pharmacy</th>
                  <th style={th}>Items</th>
                  <th style={th}>Type</th>
                  <th style={th}>Total</th>
                  <th style={th}>Payment</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, borderRadius: "0 10px 10px 0" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="table-row">
                    <td style={{ ...td, fontWeight: 700 }}>{o.orderNumber}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{o.customerName}</div>
                      {o.customerPhone && <div style={{ fontSize: 11, color: C.textMuted }}>{o.customerPhone}</div>}
                    </td>
                    <td style={td}>{o.pharmacyName}</td>
                    <td style={td}>{o.itemsCount}</td>
                    <td style={td}>{o.orderType}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {egp(o.totalPrice)}
                      {o.deliveryFee > 0 && (
                        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>incl. {egp(o.deliveryFee)} delivery</div>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>{o.paymentMethod}</div>
                      <Badge color={PAYMENT_STATUS_COLOR[o.paymentStatus] || "gray"} dot>{o.paymentStatus}</Badge>
                    </td>
                    <td style={td}><Badge color={ORDER_STATUS_COLOR[o.status] || "gray"} dot>{o.status}</Badge></td>
                    <td style={{ ...td, color: C.textMuted, whiteSpace: "nowrap" }}>{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
                {!list.loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...td, textAlign: "center", color: C.textMuted, padding: 40 }}>
                      No orders match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: C.textMuted }}>
          <span>{list.data?.total ?? 0} orders · Page {page} of {pages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              style={{ ...control, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>Previous</button>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}
              style={{ ...control, cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.5 : 1 }}>Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── ANALYTICS ──────────────────────────────────────────────────────────── */
function AnalyticsScreen() {
  const { data: regData, loading: rL, error: rE } = useApi("/registrations-per-month");
  const { data: specsData, loading: sL } = useApi("/appointments/specializations");
  const { data: statsData } = useApi("/stats");
  const { data: actData } = useApi("/recent-activity?limit=6");

  const monthly = regData?.monthly || [];
  const specs = specsData?.specializations || [];
  const stats = statsData?.stats || {};
  const activity = actData?.activity || [];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const COLORS = [C.blue2, C.amber, C.green, C.purple, C.orange, C.blue4];

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Patients" value={fmt(stats.patients)} icon={UserRound} delay={0} />
        <KPI label="Doctors" value={fmt(stats.doctors)} accent={C.green} icon={Stethoscope} delay={40} />
        <KPI label="Pharmacies" value={fmt(stats.pharmacies)} accent={C.orange} icon={Pill} delay={80} />
        <KPI label="Labs" value={fmt(stats.labs)} accent={C.purple} icon={FlaskConical} delay={120} />
        <KPI label="Reviews" value={fmt(stats.reviews)} accent={C.amber} icon={Star} delay={160} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 14 }}>
        <Card title={`Monthly Registrations — ${regData?.year || new Date().getFullYear()}`} style={{ marginBottom: 0 }}>
          {rL ? <Spinner /> : rE ? <Err msg={rE} /> : (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 14 }}>
                {fmt(regData?.total)}
                <span style={{ fontSize: 12, color: C.green, marginLeft: 10, fontWeight: 600 }}>total this year</span>
              </div>
              <BarChart
                data={monthly.map(m => m.count)}
                labels={MONTHS}
                height={140}
                colors={monthly.map((_, i) => i === new Date().getMonth() ? C.blue2 : C.blue6)}
              />
            </>
          )}
        </Card>

        <Card title="Top Specializations" style={{ marginBottom: 0 }}>
          {sL ? <Spinner /> : specs.length ? (
            specs.slice(0, 6).map((s, i) => (
              <div key={s.specialization} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{s.specialization}</span>
                  <span style={{ color: C.textMuted }}>{fmt(s.count)}</span>
                </div>
                <Bar pct={s.percentage} color={COLORS[i % COLORS.length]} />
              </div>
            ))
          ) : <div style={{ color: C.textMuted, fontSize: 12, padding: "16px 0" }}>No data yet</div>}
        </Card>
      </div>

      <Card title="Recent Activity Feed">
        {activity.map((a, i) => {
          const resolveName = (val) => {
            if (!val) return "—";
            if (typeof val === "string") return val;
            return (
              val.name || val.userId?.name || val.userId?.email || val.email || val.username ||
              (val._id ? `ID: ${String(val._id).slice(-6)}` : null) || "Unknown"
            );
          };
          const entityName = resolveName(a.entity);
          const userName = resolveName(a.user);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < activity.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                background: a.statusType === "green" ? C.greenLo : a.statusType === "red" ? C.redLo : C.blue5,
                color: a.statusType === "green" ? C.green : a.statusType === "red" ? C.red : C.blue2,
              }}>
                {a.statusType === "green" ? <Check size={16} strokeWidth={2.4} /> : a.statusType === "red" ? <X size={16} strokeWidth={2.4} /> : <Info size={16} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
                  {a.event} — <span style={{ color: C.textMuted }}>{entityName}</span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{userName} · {a.date}</div>
              </div>
              <Badge color={a.statusType === "green" ? "green" : a.statusType === "red" ? "red" : a.statusType === "amber" ? "amber" : "blue"} dot>
                {a.status}
              </Badge>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ─── FINANCE & BILLING — helpers ────────────────────────────────────────── */
const FB_MONTHS_FULL  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FB_MONTHS_SHORT = ["J","F","M","A","M","J","J","A","S","O","N","D"];
const FB_TYPE_LB = {
  appointment_fee: "Appointment fee",
  lab_test_fee:    "Lab test fee",
  pharmacy_order:  "Pharmacy order",
  refund:          "Refund",
  payout:          "Payout",
};
const FB_TYPE_COLOR = { appointment_fee: "blue", lab_test_fee: "purple", pharmacy_order: "amber", refund: "red", payout: "green" };
const FB_STATUS_COLOR = { completed: "green", pending: "amber", failed: "red", refunded: "purple" };
const FB_ACCENT = { doctor: "#2563eb", pharmacy: "#f97316", lab: "#7c5cf0" };

function fbDaysSince(d) {
  return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;
}
function fbMonthYearLabel(month, year) {
  return `${FB_MONTHS_FULL[(month || 1) - 1]} ${year || ""}`.trim();
}

const FbTxType   = ({ t }) => <Badge color={FB_TYPE_COLOR[t] || "gray"}>{FB_TYPE_LB[t] || t}</Badge>;
const FbTxStatus = ({ s }) => <Badge color={FB_STATUS_COLOR[s] || "gray"} dot>{s}</Badge>;

const FbProgBar = ({ pct, color }) => (
  <div style={{ height: 6, borderRadius: 4, background: "#eef2f8", overflow: "hidden", marginTop: 6 }}>
    <div style={{ height: "100%", borderRadius: 4, background: color, width: `${Math.min(100, pct || 0)}%`, transition: "width .8s ease" }} />
  </div>
);

/* ─── Blocked / unpaid provider card ─────────────────────────────────────── */
function BlockedDueCard({ record, onMarkPaid }) {
  const name     = record.entity?.name  || "Unknown";
  const email    = record.entity?.email || "—";
  const days     = fbDaysSince(record.createdAt);
  const monthLbl = fbMonthYearLabel(record.month, record.year);
  const overdueClr = days >= 30 ? C.red : days >= 15 ? C.orange : days >= 7 ? C.amber : C.textMuted;

  return (
    <div style={{
      width: 330, background: `linear-gradient(180deg, ${C.redLo} 0%, #ffffff 48%)`,
      border: `1px solid ${C.redBrd}`, borderRadius: 18, padding: 16,
      boxShadow: SHADOW, transition: "transform .2s, box-shadow .2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 26px rgba(239,68,68,.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = SHADOW; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Avatar name={name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text }}>{name}</div>
          <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
        </div>
        <Badge color={record.entityType === "doctor" ? "blue" : record.entityType === "pharmacy" ? "orange" : "purple"}>{record.entityType}</Badge>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.redBrd}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: C.redLo, color: C.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Banknote size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Unpaid — {monthLbl}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.red, letterSpacing: "-0.4px" }}>{fmtEGP(record.dueAmount)}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 11, color: C.textMuted }}>
        <Ban size={13} color={C.red} /> Hidden from patients until settled
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12,
        padding: "4px 10px", borderRadius: 20,
        background: overdueClr + "18", color: overdueClr, fontSize: 11, fontWeight: 600,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: overdueClr, animation: "pulse 2s ease infinite" }} />
        Overdue by {days} day{days !== 1 ? "s" : ""}
      </div>

      <Btn variant="success" small onClick={onMarkPaid} style={{ width: "100%" }}><Check size={13} /> Mark as paid &amp; unblock</Btn>
    </div>
  );
}

function PaidMonthMiniCard({ label, total, count, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      cursor: "pointer", flexShrink: 0, minWidth: 96,
      background: active ? `linear-gradient(180deg, ${C.greenLo}, #fff)` : C.card,
      border: `1px solid ${active ? C.greenBrd : C.border}`,
      borderRadius: 16, padding: "10px 12px", textAlign: "center",
      transition: "all .15s", boxShadow: active ? "none" : SHADOW,
    }}>
      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: total > 0 ? C.green : C.textMuted }}>{total > 0 ? fmtEGP(total) : "—"}</div>
      <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 2 }}>{count} paid</div>
    </div>
  );
}

/* ─── FINANCE & BILLING — MAIN SCREEN ────────────────────────────────────── */
function FinanceBillingScreen({ addToast }) {
  const now = new Date();

  const { data: summary, loading: sumLoad, error: sumErr } = useApi("/finance/summary");
  const { data: revData, loading: rL }                     = useApi("/finance/revenue-per-month");

  const { data: txData, loading: txLoading, error: txErr } = useApi("/finance/transactions?page=1&limit=500");
  const allTx = txData?.transactions || [];
  const [txFilters, setTxFilters] = useState({ status: "", type: "", search: "" });
  const [txPage,    setTxPage]    = useState(1);
  const TX_PER_PAGE = 12;

  const filteredTx = allTx.filter(tx => {
    if (txFilters.status && tx.status !== txFilters.status) return false;
    if (txFilters.type   && tx.type   !== txFilters.type)   return false;
    if (txFilters.search) {
      const q = txFilters.search.toLowerCase();
      if (!(tx.payer?.name || "").toLowerCase().includes(q) &&
          !(tx.recipient?.name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const txPages = Math.max(1, Math.ceil(filteredTx.length / TX_PER_PAGE));
  const txSlice = filteredTx.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  const [billMonth, setBillMonth] = useState(now.getMonth() + 1);
  const [billYear,  setBillYear]  = useState(now.getFullYear());
  const [generating, setGenerating] = useState(false);

  const [duesView,        setDuesView]        = useState("blocked");
  const [entityFilter,    setEntityFilter]    = useState("all");
  const [paidYear,        setPaidYear]        = useState(now.getFullYear());
  const [paidMonthFilter, setPaidMonthFilter] = useState(now.getMonth() + 1);

  const billSummaryPath = `/billing/summary?month=${billMonth}&year=${billYear}`;
  const billRecordsPath = `/billing/records?month=${billMonth}&year=${billYear}`;

  const { data: billSummary, loading: bsLoad, refetch: refetchSummary } = useApi(billSummaryPath);
  const { data: recordsData, loading: brLoad, refetch: refetchRecords } = useApi(billRecordsPath);

  const blockedPath = `/billing/records?status=unpaid&scope=all${entityFilter !== "all" ? `&entityType=${entityFilter}` : ""}`;
  const paidPath    = `/billing/records?status=paid&scope=all&year=${paidYear}${entityFilter !== "all" ? `&entityType=${entityFilter}` : ""}`;

  const { data: blockedData, loading: blkLoad, error: blkErr, refetch: refetchBlocked } = useApi(blockedPath);
  const { data: paidYearData, loading: paidLoad, error: paidErr }                        = useApi(paidPath);

  const paidRecordsAll = paidYearData?.records || [];
  const paidByMonth = FB_MONTHS_FULL.map((_, i) => {
    const monthNum = i + 1;
    const recs = paidRecordsAll.filter(r => r.month === monthNum);
    return { month: monthNum, total: recs.reduce((a, r) => a + (r.dueAmount || 0), 0), count: recs.length, records: recs };
  });
  const selectedMonthRecords = (paidByMonth.find(m => m.month === paidMonthFilter) || {}).records || [];
  const yearTotalCollected   = paidRecordsAll.reduce((a, r) => a + (r.dueAmount || 0), 0);

  const handleMarkPaid = async (id) => {
    try {
      await apiPost(`/billing/records/${id}/pay`, "PATCH");
      addToast("Marked as paid", "success");
      refetchSummary(); refetchRecords(); refetchBlocked();
    } catch (e) { addToast("Error: " + e.message, "error"); }
  };

  const handleGenerate = async () => {
    const label = `${FB_MONTHS_FULL[billMonth - 1]} ${billYear}`;
    if (!window.confirm(`Generate billing for ${label}?`)) return;
    setGenerating(true);
    try {
      const res = await apiPost("/billing/generate", "POST", { month: billMonth, year: billYear });
      addToast(`${res.message} — ${res.created} created, ${res.updated} updated`, "success");
      refetchSummary(); refetchRecords(); refetchBlocked();
    } catch (e) { addToast("Error: " + e.message, "error"); }
    finally { setGenerating(false); }
  };

  const s        = summary || {};
  const monthly  = (revData?.monthly || []).map(m => m.total || 0);
  const mLabels  = (revData?.monthly || []).map(m => m.month || FB_MONTHS_FULL[(m._id?.month || 1) - 1]);
  const byType   = s.byType  || [];
  const bySummary = billSummary?.byType || [];

  if (sumLoad) return <Spinner />;
  if (sumErr)  return <Err msg={sumErr} />;

  const selStyle = { fontSize: 12, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, background: "#fff", fontWeight: 600 };
  const fStyle   = { fontSize: 12, padding: "7px 12px", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, background: "#fff" };

  return (
    <div style={{ animation: "fadeIn .4s ease" }}>

      {/* ══ SECTION 1 — PLATFORM REVENUE ══ */}
      <FbSectionLabel>Platform Revenue</FbSectionLabel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <KPI label="Total Revenue"      value={fmtEGP(s.totalRevenue)}     accent={C.blue2}   icon={Wallet} />
        <KPI label="Revenue Today"      value={fmtEGP(s.revenueToday)}     accent={C.green}   icon={TrendingUp} />
        <KPI label="Revenue This Month" value={fmtEGP(s.revenueThisMonth)} accent={C.purple}  icon={CalendarDays} />
        <KPI label="Pending Txns"       value={fmt((s.byStatus || []).find(b => b.status === "pending")?.count || 0)} accent={C.orange} icon={Clock} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <Card title="Monthly Revenue" style={{ marginBottom: 0 }}>
          {rL ? <Spinner small /> : (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 14 }}>
                {fmtEGP(revData?.yearTotal)}
                <span style={{ fontSize: 12, color: C.green, marginLeft: 10, fontWeight: 600 }}>this year</span>
              </div>
              <BarChart
                data={monthly}
                labels={mLabels.length ? mLabels : FB_MONTHS_SHORT}
                height={130}
                colors={monthly.map((_, i) => i === now.getMonth() ? C.blue2 : C.blue6)}
              />
            </>
          )}
        </Card>

        <Card title="Revenue by Type" style={{ marginBottom: 0 }}>
          {byType.length === 0
            ? <div style={{ color: C.textMuted, fontSize: 12, padding: "16px 0" }}>No transactions yet</div>
            : byType.map((b, i) => {
              const topTotal = byType[0]?.total || 1;
              const CLRS = [C.blue2, C.purple, C.orange, C.red, C.green];
              return (
                <div key={b.type} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                    <span>{FB_TYPE_LB[b.type] || b.type}</span>
                    <span style={{ color: C.textMuted }}>{fmtEGP(b.total)} <span style={{ fontSize: 10 }}>({b.count})</span></span>
                  </div>
                  <Bar pct={(b.total / topTotal) * 100} color={CLRS[i % CLRS.length]} />
                </div>
              );
            })
          }
        </Card>
      </div>

      {(s.byStatus || []).length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          {s.byStatus.map(b => {
            const col = { green: C.green, amber: C.amber, red: C.red, purple: C.purple }[FB_STATUS_COLOR[b.status]] || C.blue2;
            return (
              <div key={b.status} style={{ flex: 1, minWidth: 150, background: `linear-gradient(135deg, ${col}14 0%, #ffffff 70%)`, border: `1px solid ${col}26`, borderRadius: 18, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: SHADOW }}>
                <div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>{b.status}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>{fmt(b.count)}</div>
                </div>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: col, boxShadow: `0 0 0 5px ${col}22` }} />
              </div>
            );
          })}
        </div>
      )}

      <Card title="Transactions" extra={<span style={{ fontSize: 11, color: C.textMuted }}>{fmt(filteredTx.length)} records</span>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <select value={txFilters.status} style={fStyle}
            onChange={e => { setTxFilters(f => ({ ...f, status: e.target.value })); setTxPage(1); }}>
            <option value="">All statuses</option>
            {["pending","completed","failed","refunded"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={txFilters.type} style={fStyle}
            onChange={e => { setTxFilters(f => ({ ...f, type: e.target.value })); setTxPage(1); }}>
            <option value="">All types</option>
            {Object.entries(FB_TYPE_LB).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={txFilters.search} placeholder="Search payer / recipient…" style={{ ...fStyle, minWidth: 200 }}
            onChange={e => { setTxFilters(f => ({ ...f, search: e.target.value })); setTxPage(1); }} />
        </div>

        {txLoading ? <Spinner /> : txErr ? <Err msg={txErr} /> : (
          <>
            <DataTable
              cols={[
                { label: "Date",      w: "10%" },
                { label: "Type",      w: "13%" },
                { label: "Payer",     w: "21%" },
                { label: "Recipient", w: "21%" },
                { label: "Amount",    w: "14%" },
                { label: "Status",    w: "21%" },
              ]}
              rows={txSlice.map(tx => {
                const d = new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
                const isRef = tx.type === "refund";
                return [
                  <span style={{ fontSize: 11, color: C.textMuted }}>{d}</span>,
                  <FbTxType t={tx.type} />,
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{tx.payer?.name || "—"}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{tx.payer?.role || ""}</div>
                  </div>,
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{tx.recipient?.name || "Platform"}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{tx.recipient?.role || ""}</div>
                  </div>,
                  <span style={{ fontWeight: 700, color: isRef ? C.red : C.text }}>{isRef ? "−" : ""}{fmtEGP(tx.amount)}</span>,
                  <FbTxStatus s={tx.status} />,
                ];
              })}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>
              <span>Page {txPage} of {txPages} — {fmt(filteredTx.length)} transactions</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" small disabled={txPage <= 1}       onClick={() => setTxPage(p => p - 1)}><ChevronLeft size={13} /> Prev</Btn>
                <Btn variant="ghost" small disabled={txPage >= txPages} onClick={() => setTxPage(p => p + 1)}>Next <ChevronRight size={13} /></Btn>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ══ SECTION 2 — MONTHLY DUES ══ */}
      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <FbSectionLabel>Monthly Dues &amp; Billing</FbSectionLabel>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select value={billMonth} onChange={e => setBillMonth(Number(e.target.value))} style={selStyle}>
            {FB_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={billYear} onChange={e => setBillYear(Number(e.target.value))} style={selStyle}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ fontSize: 12, color: C.textMuted, padding: "8px 14px", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}` }}>
            Period: <strong style={{ color: C.text }}>{FB_MONTHS_FULL[billMonth - 1]} {billYear}</strong>
          </div>
        </div>
        <Btn variant="primary" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating…" : <><Zap size={13} /> Generate Billing</>}
        </Btn>
      </div>

      {bsLoad ? <Spinner small /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
          <KPI label="Total Due"   value={fmtEGP(billSummary?.totalDue)}       accent={C.blue2}   icon={ClipboardList} />
          <KPI label="Collected"   value={fmtEGP(billSummary?.totalCollected)} accent={C.green}   icon={CheckCircle2} />
          <KPI label="Outstanding" value={fmtEGP(billSummary?.totalUnpaid)}    accent={C.red}     icon={AlertTriangle} />
          <KPI label="Records"     value={fmt(recordsData?.total)}             accent={C.purple}  icon={FolderOpen} />
        </div>
      )}

      {!bsLoad && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
          {[
            ["doctor",   <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Stethoscope size={14} /> Doctors</span>,    "1.5%", FB_ACCENT.doctor],
            ["pharmacy", <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Pill size={14} /> Pharmacies</span>, "1%",   FB_ACCENT.pharmacy],
            ["lab",      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FlaskConical size={14} /> Labs</span>,       "1%",   FB_ACCENT.lab],
          ].map(([type, label, rate, color]) => {
            const stat = bySummary.find(b => b.type === type) || {};
            const pct  = stat.total ? Math.round(((stat.collected || 0) / stat.total) * 100) : 0;
            return (
              <div key={type} style={{ background: `linear-gradient(135deg, ${color}16 0%, #ffffff 65%)`, border: `1px solid ${color}26`, borderRadius: 18, padding: "16px 18px", boxShadow: SHADOW }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{label}</div>
                  <Badge color="gray">{rate}</Badge>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 8 }}>{fmtEGP(stat.total ?? 0)}</div>
                <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: C.green, display: "flex", alignItems: "center", gap: 3 }}><Check size={12} /> {fmtEGP(stat.collected ?? 0)}</div>
                  <div style={{ fontSize: 11, color: C.red, display: "flex", alignItems: "center", gap: 3 }}><X size={12} /> {fmtEGP((stat.total ?? 0) - (stat.collected ?? 0))}</div>
                </div>
                <FbProgBar pct={pct} color={color} />
                <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6 }}>{stat.paidCount ?? 0} of {stat.count ?? 0} paid</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ SECTION 3 — PROVIDER PAYMENT COMPLIANCE ══ */}
      <div style={{ height: 1, background: C.border, margin: "8px 0 20px" }} />
      <FbSectionLabel>Provider Payment Compliance</FbSectionLabel>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 14, padding: 4, boxShadow: SHADOW }}>
          <button onClick={() => setDuesView("blocked")} style={{
            padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: duesView === "blocked" ? C.redLo : "transparent",
            color:      duesView === "blocked" ? C.red    : C.textMuted,
            transition: "all .2s", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Ban size={14} /> Blocked / Unpaid
            {!blkLoad && <Badge color="red">{(blockedData?.records || []).length}</Badge>}
          </button>
          <button onClick={() => setDuesView("paid")} style={{
            padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: duesView === "paid" ? C.greenLo : "transparent",
            color:      duesView === "paid" ? C.green    : C.textMuted,
            transition: "all .2s", display: "flex", alignItems: "center", gap: 6,
          }}>
            <CheckCircle2 size={14} /> Payment History
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[["all", "All"], ["doctor", <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Stethoscope size={14} /> Doctors</span>], ["pharmacy", <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Pill size={14} /> Pharmacies</span>], ["lab", <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FlaskConical size={14} /> Labs</span>]].map(([val, lbl]) => (
            <button key={val} onClick={() => setEntityFilter(val)} style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1px solid ${entityFilter === val ? C.blue2 : C.border}`,
              background: entityFilter === val ? C.blue2 : "#fff",
              color: entityFilter === val ? "#fff" : C.textSub,
              fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all .15s",
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {duesView === "blocked" && (
        <>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} color={C.amber} />
            <span>These providers are currently <strong style={{ color: C.red }}>hidden from patients</strong> until they settle a past due fee.</span>
          </div>

          {blkErr && <Err msg={blkErr} />}

          {blkLoad ? <Spinner /> : (blockedData?.records || []).length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>
                <div style={{ marginBottom: 10 }}><CheckCircle2 size={40} color={C.green} strokeWidth={1.8} /></div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No providers are currently blocked</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Everyone is up to date with their dues</div>
              </div>
            </Card>
          ) : (
            <HScroll>
              {(blockedData?.records || []).map(record => (
                <BlockedDueCard key={record._id} record={record} onMarkPaid={() => handleMarkPaid(record._id)} />
              ))}
            </HScroll>
          )}
        </>
      )}

      {duesView === "paid" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Total collected in <strong style={{ color: C.text }}>{paidYear}</strong>:{" "}
              <strong style={{ color: C.green }}>{fmtEGP(yearTotalCollected)}</strong>
            </div>
            <select value={paidYear} onChange={e => setPaidYear(Number(e.target.value))} style={selStyle}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {paidLoad ? <Spinner small /> : (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
              {paidByMonth.map(m => (
                <PaidMonthMiniCard
                  key={m.month}
                  label={FB_MONTHS_FULL[m.month - 1]}
                  total={m.total}
                  count={m.count}
                  active={paidMonthFilter === m.month}
                  onClick={() => setPaidMonthFilter(m.month)}
                />
              ))}
            </div>
          )}

          <Card title={`Payments — ${FB_MONTHS_FULL[paidMonthFilter - 1]} ${paidYear}`} extra={
            <Badge color="green" dot>{selectedMonthRecords.length} paid</Badge>
          }>
            {paidErr && <Err msg={paidErr} />}
            <DataTable
              empty={`No payments recorded for ${FB_MONTHS_FULL[paidMonthFilter - 1]} ${paidYear}`}
              cols={[
                { label: "Provider",  w: "26%" },
                { label: "Type",      w: "16%" },
                { label: "Rate",      w: "12%" },
                { label: "Amount",    w: "18%" },
                { label: "Paid on",   w: "18%" },
                { label: "Status",    w: "10%" },
              ]}
              rows={selectedMonthRecords.map(r => [
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={r.entity?.name || "?"} size={26} />
                  <span style={{ fontWeight: 600 }}>{r.entity?.name || "Unknown"}</span>
                </div>,
                <Badge color={r.entityType === "doctor" ? "blue" : r.entityType === "pharmacy" ? "amber" : "purple"}>{r.entityType}</Badge>,
                `${((r.rate || 0) * 100).toFixed(1)}%`,
                <span style={{ fontWeight: 700, color: C.green }}>{fmtEGP(r.dueAmount)}</span>,
                <span style={{ fontSize: 11, color: C.textMuted }}>
                  {r.paidAt ? new Date(r.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </span>,
                <Badge color="green">Paid</Badge>,
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function FbSectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.textMuted,
      letterSpacing: "1px", textTransform: "uppercase",
      marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}`,
    }}>
      {children}
    </div>
  );
}

/* ─── SETTINGS ───────────────────────────────────────────────────────────── */
function SettingsScreen({ addToast }) {
  const { data: settingsData, loading, error, refetch } = useApi("/settings");
  const [toggles, setToggles] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsData) {
      const { _id, __v, createdAt, updatedAt, ...rest } = settingsData;
      setToggles(rest);
    }
  }, [settingsData]);

  const toggle = (k) => setToggles(p => ({ ...p, [k]: !p[k] }));

  const handleSave = async () => {
    setSaving(true);
    try { await apiPost("/settings", "PATCH", toggles); addToast("Settings saved successfully", "success"); refetch(); }
    catch (e) { addToast("Error saving settings: " + e.message, "error"); }
    finally { setSaving(false); }
  };

  const handleCleanup = async () => {
    if (!window.confirm("Run system cleanup? This deletes appointments older than 90 days and reviews without ratings.")) return;
    try { const res = await apiPost("/cleanup", "POST"); addToast(res.message || "Cleanup complete", "success"); }
    catch (e) { addToast("Error: " + e.message, "error"); }
  };

  if (loading) return <Spinner />;
  if (error) return <Err msg={error} />;
  if (!toggles) return <Spinner />;

  const ToggleRow = ({ k, label, sub }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      <Toggle on={!!toggles[k]} onChange={() => toggle(k)} />
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <Card title="Platform Configuration">
            <ToggleRow k="maintenance" label="Maintenance mode" sub="Take platform offline for all users" />
            <ToggleRow k="registrations" label="New registrations" sub="Allow new user sign-ups" />
            <ToggleRow k="email" label="Email notifications" sub="System emails to users" />
            <ToggleRow k="sms" label="SMS alerts" sub="Booking & reminder SMS" />
            <ToggleRow k="ai" label="AI suggestions" sub="Pharmacy & lab recommendations" />
          </Card>
          <Card title="Verification Requirements">
            <ToggleRow k="docLicense" label="Doctor license check" />
            <ToggleRow k="pharmaLicense" label="Pharmacy license check" />
            <ToggleRow k="patientId" label="Patient ID verification" />
            <ToggleRow k="twoFa" label="2FA for doctors" />
          </Card>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
          </div>
        </div>

        <div>
          <Card title="Danger Zone">
            <div style={{ padding: 16, background: C.redLo, borderRadius: 12, border: `1px solid ${C.redBrd}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 4 }}>System Cleanup</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Deletes appointments older than 90 days and reviews without ratings.</div>
              <Btn variant="danger" onClick={handleCleanup}>Run cleanup</Btn>
            </div>
          </Card>

          <Card title="API Quick Reference">
            {[["All users by role", "/users/role/doctor"], ["Pending verifications", "/users/pending"], ["System logs", "/logs"], ["Billing summary", "/billing/summary"]].map(([label, path]) => (
              <div key={path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>{label}</span>
                <code style={{ fontSize: 10, color: C.blue2, background: C.blue5, padding: "3px 8px", borderRadius: 6 }}>GET {path}</code>
              </div>
            ))}
          </Card>

          <Card title="System Info">
            {[["Platform", "Chefaa Admin v2.0"], ["Backend", "Node.js · Vercel"], ["Database", "MongoDB Atlas"], ["Billing Cycle", "Monthly (auto)"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>{k}</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── NAV CONFIG ─────────────────────────────────────────────────────────── */
const NAV = [
  { id: "overview",   label: "Overview",          Icon: LayoutDashboard },
  { id: "users",      label: "Users",             Icon: Users },
  { id: "doctors",    label: "Doctors",           Icon: Stethoscope },
  { id: "pharmacies", label: "Pharmacies",        Icon: Pill },
  { id: "labs",       label: "Labs",              Icon: FlaskConical },
  { id: "orders",     label: "Orders",            Icon: ShoppingCart },
  { id: "analytics",  label: "Analytics",         Icon: BarChart3 },
  { id: "finance",    label: "Finance & Billing", Icon: Wallet },
  { id: "settings",   label: "Settings",          Icon: Settings },
];

const SCREENS = {
  overview: OverviewScreen, users: UsersScreen, doctors: DoctorsScreen,
  pharmacies: PharmaciesScreen, labs: LabsScreen, orders: OrdersScreen,
  analytics: AnalyticsScreen, finance: FinanceBillingScreen, settings: SettingsScreen,
};

const SUBTITLES = {
  overview: "Platform at a glance", users: "All registered users", doctors: "Doctors & verifications",
  pharmacies: "Pharmacy network", labs: "Lab network", orders: "Appointments & orders",
  analytics: "Platform insights", finance: "Revenue, transactions & monthly dues", settings: "Platform configuration",
};

const SIDEBAR_GROUPS = [
  { section: "Main", items: ["overview", "analytics"] },
  { section: "Entities", items: ["users", "doctors", "pharmacies", "labs", "orders"] },
  { section: "Money", items: ["finance"] },
  { section: "System", items: ["settings"] },
];

/* ─── ROOT DASHBOARD ─────────────────────────────────────────────────────── */
/* ─── NOTIFICATIONS (bell) ────────────────────────────────────────────────────
   "Needs attention"  -> always-current counts (pending verifications, overdue payments)
   "Recent"           -> new orders log, kept in this browser with read / unread state  */
const NOTIFS_KEY = "admin_notifs";
const loadNotifs = () => { try { return JSON.parse(localStorage.getItem(NOTIFS_KEY) || "[]"); } catch { return []; } };

function timeAgo(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotificationBell({ items, attention, onGo, onRead, onReadAll, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const unread = items.filter((i) => !i.read).length;
  const badge = unread + attention.length;
  const go = (tab, id) => { if (id) onRead(id); onGo(tab); setOpen(false); };

  const sectionTitle = (txt) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", padding: "12px 18px 6px" }}>{txt}</div>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title="Notifications" style={{ position: "relative", width: 40, height: 40, borderRadius: 12, background: open ? C.blue5 : "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SHADOW }}>
        <Bell size={17} color={open ? C.blue2 : C.textSub} />
        {badge > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: C.red, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 50, right: 0, width: 380, maxHeight: 520, background: "#fff", borderRadius: 18, boxShadow: "0 18px 60px rgba(30,64,175,0.22)", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeIn 0.2s ease", zIndex: 300 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Notifications</span>
              {badge > 0 && <Badge color="red">{badge} new</Badge>}
            </div>
            {unread > 0 && (
              <button onClick={onReadAll} style={{ border: "none", background: "transparent", color: C.blue2, fontSize: 11.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Check size={13} /> Mark all as read
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {attention.length === 0 && items.length === 0 && (
              <div style={{ textAlign: "center", padding: "44px 20px", color: C.textMuted }}>
                <CheckCircle2 size={38} color={C.green} strokeWidth={1.8} />
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 10 }}>You're all caught up</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>New orders and alerts will show up here</div>
              </div>
            )}

            {attention.length > 0 && (
              <>
                {sectionTitle("Needs attention")}
                {attention.map((a) => (
                  <div key={a.key} onClick={() => go(a.tab)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", cursor: "pointer", transition: "background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.blue5)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: a.color + "1a", color: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><a.Icon size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{a.sub}</div>
                    </div>
                    <ChevronRight size={15} color={C.textMuted} />
                  </div>
                ))}
              </>
            )}

            {items.length > 0 && (
              <>
                {sectionTitle("Recent")}
                {items.map((n) => (
                  <div key={n.id} onClick={() => go("orders", n.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", cursor: "pointer", background: n.read ? "transparent" : "#f6f9ff", transition: "background .15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.blue5)} onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "#f6f9ff")}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: C.blue5, color: C.blue2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ShoppingCart size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: n.read ? 600 : 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.sub || "New order received"}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                      <span style={{ fontSize: 10.5, color: C.textMuted, whiteSpace: "nowrap" }}>{timeAgo(n.at)}</span>
                      {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.blue2 }} />}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {items.length > 0 && (
            <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
              <button onClick={onClear} style={{ border: "none", background: "transparent", color: C.textMuted, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Clear recent</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── LIVE COUNTS (smart polling) ─────────────────────────────────────────────
   Asks GET /admin/live-counts every 25s (only while the browser tab is visible).
   Returns small numbers only: new orders since you last opened Orders, pending
   verifications, blocked providers. Drives the red badges in the sidebar, the
   bell dot and the "new order" toast. When numbers change, cached data is
   marked stale so the open screen refreshes by itself.                          */
const LIVE_POLL_MS = 25_000;
const SEEN_KEY = "admin_orders_seen_at";

function readSeenAt() {
  try {
    let v = localStorage.getItem(SEEN_KEY);
    if (!v) { v = new Date().toISOString(); localStorage.setItem(SEEN_KEY, v); }
    return v;
  } catch { return new Date().toISOString(); }
}

function useLiveCounts({ active, addToast, onNewOrder }) {
  const seenRef = useRef(readSeenAt());
  const prevSig = useRef(null);
  const notified = useRef(new Set());
  const initialised = useRef(false);

  const q = useQuery({
    queryKey: ["admin-live"],
    queryFn: () => apiGet(`/live-counts?ordersSince=${encodeURIComponent(seenRef.current)}`),
    refetchInterval: (query) => (query.state.error?.status === 404 ? false : LIVE_POLL_MS),
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });
  const live = q.data;

  const markOrdersSeen = useCallback(() => {
    const now = live?.serverTime || new Date().toISOString();
    seenRef.current = now;
    try { localStorage.setItem(SEEN_KEY, now); } catch {}
    q.refetch();
  }, [live?.serverTime, q]);

  // react to new data
  useEffect(() => {
    if (!live) return;
    const sig = JSON.stringify([live.newOrders, live.pending, live.blocked]);
    if (prevSig.current !== null && prevSig.current !== sig) {
      queryClient.invalidateQueries({ queryKey: ["admin"] });   // refresh whatever is on screen
    }
    prevSig.current = sig;

    (live.latestOrders || []).forEach((o) => {
      if (notified.current.has(o._id)) return;
      notified.current.add(o._id);
      onNewOrder?.(o);
      if (initialised.current) addToast(`New order ${o.orderNumber || ""}${o.customerName ? " · " + o.customerName : ""}`.trim(), "info");
    });
    initialised.current = true;
  }, [live, addToast, onNewOrder]);

  // viewing the Orders tab = seen
  useEffect(() => {
    if (active === "orders" && (live?.newOrders || 0) > 0) markOrdersSeen();
  }, [active, live?.newOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    orders: live?.newOrders || 0,
    pending: { doctors: live?.pending?.doctors || 0, pharmacies: live?.pending?.pharmacies || 0, labs: live?.pending?.labs || 0 },
    blocked: live?.blocked || 0,
  };
}

function AdminDashboardInner({ onLogout }) {
  const fetchingCount = useIsFetching();
  const [active, setActive] = useState("overview");
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarCollapsed, setSC] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    setToasts(prev => [...prev, { id: Date.now() + Math.random(), message, type }]);
  }, []);
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // notifications log (new orders) — persisted in this browser
  const [notifs, setNotifs] = useState(loadNotifs);
  useEffect(() => { try { localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs.slice(0, 30))); } catch {} }, [notifs]);
  const onNewOrder = useCallback((o) => {
    setNotifs((prev) => prev.some((n) => n.id === o._id) ? prev : [
      { id: o._id, type: "order", title: `New order ${o.orderNumber || ""}`.trim(), sub: o.customerName || "", at: o.createdAt || new Date().toISOString(), read: false },
      ...prev,
    ].slice(0, 30));
  }, []);
  const readNotif = useCallback((id) => setNotifs((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const readAllNotifs = useCallback(() => setNotifs((p) => p.map((n) => ({ ...n, read: true }))), []);
  const clearNotifs = useCallback(() => setNotifs([]), []);

  const live = useLiveCounts({ active, addToast, onNewOrder });
  // opening the Orders tab = those order notifications are read
  useEffect(() => {
    if (active === "orders") setNotifs((p) => (p.some((n) => !n.read) ? p.map((n) => ({ ...n, read: true })) : p));
  }, [active, notifs]);
  const badgeFor = {
    orders:     { n: live.orders,           c: C.red },
    doctors:    { n: live.pending.doctors,    c: C.amber },
    pharmacies: { n: live.pending.pharmacies, c: C.amber },
    labs:       { n: live.pending.labs,       c: C.amber },
    finance:    { n: live.blocked,          c: C.red },
  };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const attention = [
    { key: "doctors",    n: live.pending.doctors,    tab: "doctors",    Icon: Stethoscope, color: C.amber, label: `${plural(live.pending.doctors, "doctor")} waiting for verification`,       sub: "Review documents and approve" },
    { key: "pharmacies", n: live.pending.pharmacies, tab: "pharmacies", Icon: Pill,        color: C.amber, label: `${plural(live.pending.pharmacies, "pharmacy")} waiting for verification`,  sub: "Review licences and approve" },
    { key: "labs",       n: live.pending.labs,       tab: "labs",       Icon: FlaskConical,color: C.amber, label: `${plural(live.pending.labs, "lab")} waiting for verification`,             sub: "Review licences and approve" },
    { key: "blocked",    n: live.blocked,            tab: "finance",    Icon: Ban,         color: C.red,   label: `${plural(live.blocked, "overdue payment")}`,                               sub: "Providers hidden from patients until settled" },
  ].filter((a) => a.n > 0);

  const current = NAV.find(n => n.id === active);
  const Screen = SCREENS[active];
  const adminUser = (() => { try { return JSON.parse(sessionStorage.getItem("adminUser") || "{}"); } catch { return {}; } })();

  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="app-root" style={{ color: C.text }}>
      <style>{GLOBAL_STYLES}</style>

      {fetchingCount > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 9998, background: `linear-gradient(90deg, transparent, ${C.blue2}, transparent)`, backgroundSize: "200% 100%", animation: "loadbar 1.2s linear infinite" }} />
      )}
      {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />)}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}

      <div style={{ display: "flex", background: C.bg, minHeight: "100vh" }}>

        {/* ── Sidebar ── */}
        <aside style={{ width: sidebarCollapsed ? 76 : 236, background: C.surface, borderRight: `1px solid ${C.border}`, flexShrink: 0, display: "flex", flexDirection: "column", transition: "width .3s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden", position: "sticky", top: 0, height: "100vh" }}>

          <div style={{ padding: sidebarCollapsed ? "22px 0" : "22px 20px 14px", display: "flex", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: C.blue2, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(37,99,235,0.3)", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </div>
              {!sidebarCollapsed && (
                <div style={{ lineHeight: 1.05 }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: C.blue2, letterSpacing: "-0.4px" }}>Chefaa</div>
                  <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase" }}>Admin Console</div>
                </div>
              )}
            </div>
          </div>

          <nav style={{ flex: 1, padding: "6px 12px", overflowY: "auto", overflowX: "hidden" }}>
            {SIDEBAR_GROUPS.map(group => (
              <div key={group.section} style={{ marginBottom: 6 }}>
                {!sidebarCollapsed && <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, padding: "10px 12px 4px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.7 }}>{group.section}</div>}
                {group.items.map(id => {
                  const n = NAV.find(x => x.id === id);
                  const on = active === id;
                  return (
                    <div key={id} className="nav-item" onClick={() => setActive(id)} title={sidebarCollapsed ? n.label : ""}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: sidebarCollapsed ? "11px 0" : "10px 14px", justifyContent: sidebarCollapsed ? "center" : "flex-start", cursor: "pointer", position: "relative", borderRadius: 11, margin: "2px 0", background: on ? C.blue2 : "transparent", boxShadow: on ? "0 6px 16px rgba(37,99,235,0.28)" : "none" }}>
                      <n.Icon size={18} strokeWidth={1.9} color={on ? "#fff" : C.textMuted} style={{ flexShrink: 0 }} />
                      {!sidebarCollapsed && <span style={{ fontSize: 13, color: on ? "#fff" : C.textSub, fontWeight: on ? 700 : 500 }}>{n.label}</span>}
                      {(() => {
                        const b = badgeFor[id];
                        if (!b || !b.n) return null;
                        if (sidebarCollapsed) return <span style={{ position: "absolute", top: 6, right: 14, width: 9, height: 9, borderRadius: "50%", background: b.c, border: "2px solid #fff" }} />;
                        return (
                          <span style={{ marginLeft: "auto", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: on ? "#fff" : b.c, color: on ? b.c : "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", animation: id === "orders" ? "pulse 2s ease infinite" : "none" }}>
                            {b.n > 99 ? "99+" : b.n}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          {!sidebarCollapsed && (
            <div style={{ padding: "0 14px 10px" }}>
              <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: C.blue5, color: C.blue2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}><Headphones size={17} /></div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Need Help?</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>Contact Support</div>
                </div>
              </div>
              <div style={{ background: `linear-gradient(160deg, ${C.blue5}, ${C.blue6})`, borderRadius: 14, padding: "14px", textAlign: "center" }}>
                <div style={{ marginBottom: 4, color: C.blue2 }}><ShieldCheck size={32} strokeWidth={1.8} /></div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.blue1 }}>Secure. Smart. Reliable.</div>
                <div style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}>Your patient data is always protected.</div>
              </div>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${C.border}` }}>
            <div onClick={() => setSC(p => !p)} style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.textMuted, fontSize: 11, justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
              <ChevronLeft size={15} style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition: "transform .3s" }} />
              {!sidebarCollapsed && <span>Collapse</span>}
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header style={{ background: C.bg, padding: "0 28px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(8px)" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{current?.label}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{SUBTITLES[active]}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div onClick={() => setShowSearch(true)} style={{ background: "#fff", borderRadius: 12, padding: "10px 16px", width: 250, fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: SHADOW }}>
                <Search size={15} />
                <span style={{ flex: 1 }}>Search anything…</span>
                <span style={{ fontSize: 10, background: C.bg, borderRadius: 6, padding: "2px 7px" }}>⌘K</span>
              </div>
              <NotificationBell items={notifs} attention={attention} onGo={setActive} onRead={readNotif} onReadAll={readAllNotifs} onClear={clearNotifs} />
              <div style={{ background: "#fff", borderRadius: 12, padding: "9px 14px", fontSize: 12, fontWeight: 600, color: C.textSub, boxShadow: SHADOW, display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={14} /> {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 6 }}>
                <Avatar name={adminUser.name || "Super Admin"} size={38} />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{adminUser.name || "Super Admin"}</div>
                  <div style={{ fontSize: 10.5, color: C.textMuted }}>Full access</div>
                </div>
                {onLogout && (
                  <div onClick={onLogout} title="Logout" style={{ cursor: "pointer", marginLeft: 4, opacity: 0.55 }}>
                    <LogOut size={16} color={C.textSub} />
                  </div>
                )}
              </div>
            </div>
          </header>

          <main style={{ flex: 1, overflowY: "auto", padding: "6px 28px 32px" }}>
            {Screen && <Screen addToast={addToast} />}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ─── EXPORT (provides the query cache to the whole dashboard) ───────────── */
export default function AdminDashboard({ onLogout }) {
  const handleLogout = onLogout
    ? () => { queryClient.clear(); try { localStorage.removeItem(NOTIFS_KEY); localStorage.removeItem(SEEN_KEY); } catch {} onLogout(); }   // never keep one admin's cached data after logout
    : undefined;
  return (
    <QueryClientProvider client={queryClient}>
      <AdminDashboardInner onLogout={handleLogout} />
    </QueryClientProvider>
  );
}