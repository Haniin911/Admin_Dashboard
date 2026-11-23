import { useState } from "react";

/* ─── COLOR PALETTE (lifted directly from the AdminDashboard) ───────────── */
const C = {
    bg:        "#f8fafc",
    bgSub:     "#f1f5f9",
    surface:   "#ffffff",
    card:      "#ffffff",
    border:    "#e4eaf3",
    borderHi:  "#bfdbfe",
    text:      "#1e293b",
    text2:     "#1a56a0",
    textSub:   "#475569",
    textMuted: "#64748b",
    blue1:     "#1547a0",
    blue2:     "#1a56a0",
    blue4:     "#378ADD",
    blue5:     "#eff6ff",
    blue6:     "#dbeafe",
    red:       "#dc2626",
    redLo:     "#fef2f2",
    redBrd:    "#ef444455",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  @keyframes fadeIn  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin    { to { transform: rotate(360deg) } }
  @keyframes floatA  { 0%,100%{transform:translate(0,0)} 50%{transform:translate(16px,-12px)} }
  @keyframes floatB  { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-14px,14px)} }
  .chefaa-login * { box-sizing: border-box; }
  .chefaa-login input::placeholder { color: rgba(100,116,139,0.5); }
  .chefaa-login input { transition: border-color .15s, box-shadow .15s, background .15s; }
  .chefaa-login input:focus { outline: none; border-color: ${C.blue2} !important; box-shadow: 0 0 0 3px ${C.blue6}; background: #fff !important; }
  .chefaa-login .login-btn { transition: filter .18s ease, transform .18s ease, box-shadow .18s ease; }
  .chefaa-login .login-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 10px 26px rgba(26,86,160,0.32); }
  .chefaa-login .toggle-pass { transition: color .15s; }
  .chefaa-login .toggle-pass:hover { color: ${C.blue2} !important; }
`;

export default function AdminLogin({ onLogin = () => {} }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleSubmit = async () => {
        setError("");
        if (!email || !password) {
            setError("Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("https://shefaa-backend.vercel.app/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identity: email,
                    password,
                }),
            });

            const data = await res.json();
            console.log("LOGIN RESPONSE:", data);

            if (!res.ok) {
                setError(data?.message || "Invalid credentials. Please try again.");
                return;
            }
            sessionStorage.setItem("accessToken", data.accessToken);
            sessionStorage.setItem("refreshToken", data.refreshToken);
            sessionStorage.setItem("adminUser", JSON.stringify(data.user));
            onLogin(data.user);
        } catch (err) {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chefaa-login" style={{
            minHeight: "700px",
            background: `linear-gradient(160deg, ${C.bg} 0%, ${C.blue5} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            position: "relative",
            overflow: "hidden",
        }}>
            <style>{STYLES}</style>

            {/* ambient background blobs, matching dashboard's blue palette */}
            <div style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue6}99 0%, transparent 70%)`, top: -140, right: -120, pointerEvents: "none", animation: "floatA 9s ease-in-out infinite" }} />
            <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${C.blue5} 0%, transparent 70%)`, bottom: -100, left: -100, pointerEvents: "none", animation: "floatB 11s ease-in-out infinite" }} />

            <div style={{ width: 380, zIndex: 1, animation: "fadeIn 0.5s ease both" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: C.blue2, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "0 10px 26px rgba(26,86,160,0.3)" }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.3px" }}>Chefaa</div>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginTop: 4, letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>Admin Console</div>
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 28px 24px", boxShadow: "0 20px 60px rgba(26,86,160,0.13)" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>Welcome back</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 22 }}>Sign in to your admin account</div>

                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Email address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSubmit()}
                            placeholder="admin@shefaa.com"
                            style={{ width: "100%", boxSizing: "border-box", background: C.bgSub, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", fontFamily: "inherit" }}
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Password</label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPass ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                                placeholder="••••••••"
                                style={{ width: "100%", boxSizing: "border-box", background: C.bgSub, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 44px 10px 12px", fontSize: 13, color: C.text, outline: "none", fontFamily: "inherit" }}
                            />
                            <div className="toggle-pass" onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: C.textMuted, fontSize: 11, fontWeight: 700 }}>
                                {showPass ? "Hide" : "Show"}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: C.redLo, border: `1px solid ${C.redBrd}`, borderRadius: 9, padding: "9px 12px", fontSize: 12, color: C.red, marginBottom: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                            {error}
                        </div>
                    )}

                    <button
                        className="login-btn"
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{ width: "100%", padding: "11px", background: loading ? `${C.blue2}80` : C.blue2, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.2px", boxShadow: loading ? "none" : "0 6px 18px rgba(26,86,160,0.28)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
                    >
                        {loading && <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />}
                        {loading ? "Signing in…" : "Sign in →"}
                    </button>

                    <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
                        Protected area · Unauthorized access is prohibited
                    </div>
                </div>
            </div>
        </div>
    );
}