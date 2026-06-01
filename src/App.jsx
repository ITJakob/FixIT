import { useCallback, useEffect, useMemo, useState } from "react";
import Auth from "./components/Auth.jsx";
import MieterDashboard from "./components/MieterDashboard.jsx";
import VermieterDashboard from "./components/VermieterDashboard.jsx";
import { supabase } from "./lib/supabase.js";

// ─── Palette & shared styles ────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a",
  surface: "#141414",
  card: "#1a1a1a",
  border: "#2a2a2a",
  orange: "#f97316",
  orangeHover: "#ea6c0a",
  orangeDim: "rgba(249,115,22,0.12)",
  text: "#f5f5f5",
  muted: "#888",
  subtle: "#555",
};

const styles = {
  app: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    overflowX: "hidden",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 28px",
    borderBottom: `1px solid ${C.border}`,
    background: C.bg,
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(12px)",
  },
  logo: { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: C.text },
  logoSpan: { color: C.orange },
  navBtn: {
    background: C.orange, color: "#fff", border: "none", borderRadius: 8,
    padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  hero: { padding: "64px 28px 48px", maxWidth: 600, margin: "0 auto", textAlign: "center" },
  badge: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: C.orangeDim, border: `1px solid ${C.orange}33`,
    color: C.orange, borderRadius: 20, padding: "5px 14px",
    fontSize: 12, fontWeight: 600, marginBottom: 24, letterSpacing: "0.3px",
  },
  h1: {
    fontSize: "clamp(32px, 7vw, 52px)", fontWeight: 900, lineHeight: 1.1,
    letterSpacing: "-1.5px", marginBottom: 18, color: C.text,
  },
  h1Accent: { color: C.orange },
  subtext: { fontSize: 16, color: C.muted, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 36px" },
  primaryBtn: {
    background: C.orange, color: "#fff", border: "none", borderRadius: 12,
    padding: "15px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
  },
  secondaryBtn: {
    background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer",
  },
  trustRow: { display: "flex", justifyContent: "center", gap: 28, marginTop: 32, flexWrap: "wrap" },
  trustItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.subtle },
  section: { padding: "56px 28px", maxWidth: 700, margin: "0 auto" },
  sectionTitle: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 8, textAlign: "center" },
  sectionSub: { color: C.muted, textAlign: "center", marginBottom: 40, fontSize: 15 },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 },
  stepCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 20px", textAlign: "center" },
  stepIcon: {
    width: 52, height: 52, background: C.orangeDim, borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 16px", fontSize: 24,
  },
  stepNum: { fontSize: 11, fontWeight: 700, color: C.orange, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 },
  stepTitle: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  stepDesc: { fontSize: 13, color: C.muted, lineHeight: 1.5 },
  uploadArea: {
    background: C.card, border: `2px dashed ${C.border}`, borderRadius: 20,
    padding: "52px 28px", textAlign: "center", cursor: "pointer", position: "relative",
  },
  uploadAreaActive: { border: `2px dashed ${C.orange}`, background: C.orangeDim },
  uploadIcon: { fontSize: 48, marginBottom: 16 },
  uploadTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  uploadSub: { fontSize: 14, color: C.muted, marginBottom: 20 },
  fileBtn: {
    background: C.orange, color: "#fff", border: "none", borderRadius: 10,
    padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  preview: { width: "100%", maxHeight: 340, objectFit: "cover", borderRadius: 16, marginBottom: 20 },
  analyzeBtn: {
    width: "100%", background: C.orange, color: "#fff", border: "none",
    borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  spinner: {
    width: 48, height: 48, border: `3px solid ${C.border}`,
    borderTop: `3px solid ${C.orange}`, borderRadius: "50%",
    margin: "0 auto 20px", animation: "spin 0.8s linear infinite",
  },
  resultCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px", marginBottom: 16 },
  resultHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  resultIconWrap: {
    width: 44, height: 44, background: C.orangeDim, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
  },
  resultTitle: { fontSize: 17, fontWeight: 700 },
  resultSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  diffBadge: (level) => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600,
    background: level === "Einfach" ? "#16a34a22" : level === "Mittel" ? "#ca8a0422" : "#dc262622",
    color: level === "Einfach" ? "#4ade80" : level === "Mittel" ? "#fbbf24" : "#f87171",
  }),
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 },
  listItem: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, lineHeight: 1.5, color: C.text },
  listDot: { width: 6, height: 6, background: C.orange, borderRadius: "50%", marginTop: 8, flexShrink: 0 },
  proCard: {
    background: "linear-gradient(135deg, #1a1a1a 0%, #1f1208 100%)",
    border: `1px solid ${C.orange}44`, borderRadius: 20, padding: "28px", marginBottom: 16,
  },
  proTitle: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  proSub: { fontSize: 14, color: C.muted, marginBottom: 24 },
  resetBtn: {
    background: "transparent", border: `1px solid ${C.border}`, color: C.muted,
    borderRadius: 10, padding: "11px 22px", fontSize: 14, cursor: "pointer", marginTop: 12, width: "100%",
  },
  footer: { borderTop: `1px solid ${C.border}`, padding: "28px", textAlign: "center", fontSize: 13, color: C.subtle },
  authCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "28px", marginBottom: 16 },
  input: {
    width: "100%", boxSizing: "border-box", background: C.surface, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 14px",
    fontSize: 14, outline: "none", marginTop: 8,
  },
  label: { display: "block", color: C.muted, fontSize: 13, fontWeight: 600, marginBottom: 14 },
  ctaRow: { display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 },
  smallGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 },
  dashboardShell: { padding: "32px 28px 56px", maxWidth: 1080, margin: "0 auto" },
  dashboardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" },
  dashboardTitle: { fontSize: 28, fontWeight: 900, letterSpacing: "-0.8px", margin: 0 },
  dashboardSub: { fontSize: 14, color: C.muted, marginTop: 6 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 },
  statCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px" },
  statValue: { fontSize: 26, fontWeight: 900, color: C.text, marginBottom: 4 },
  statLabel: { fontSize: 13, color: C.muted },
  badgePill: (variant) => {
    const variants = {
      Notfall: { background: "#7c1d1d22", color: "#f87171", border: "#f8717133" },
      Dringend: { background: "#ca8a0422", color: "#fbbf24", border: "#fbbf2433" },
      Normal: { background: "#16a34a22", color: "#4ade80", border: "#4ade8033" },
      Offen: { background: C.orangeDim, color: C.orange, border: `${C.orange}33` },
      "In Bearbeitung": { background: C.orangeDim, color: C.orange, border: `${C.orange}33` },
      Erledigt: { background: "#16a34a22", color: "#4ade80", border: "#4ade8033" },
    };
    const chosen = variants[variant] || variants.Normal;
    return {
      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px",
      borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: chosen.background, color: chosen.color, border: `1px solid ${chosen.border}`,
    };
  },
  thumbnail: { width: 86, height: 86, objectFit: "cover", borderRadius: 14, border: `1px solid ${C.border}`, flexShrink: 0 },
  textarea: {
    width: "100%", boxSizing: "border-box", minHeight: 86, background: C.surface,
    color: C.text, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: "12px 14px", fontSize: 14, outline: "none", resize: "vertical",
  },
  modalBackdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20, zIndex: 200,
  },
};

async function loadProfile(session) {
  if (!session?.user || !supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function Navbar({ session, profile, onHome, onAuth, onLogout }) {
  return (
    <nav style={styles.nav}>
      <button
        type="button"
        onClick={onHome}
        style={{ ...styles.logo, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
      >
        Fix<span style={styles.logoSpan}>It</span>
      </button>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {session ? (
          <>
            <span style={{ ...styles.trustItem, alignSelf: "center" }}>
              {profile?.role === "landlord" ? "Vermieter" : "Mieter"}
            </span>
            <button style={styles.secondaryBtn} onClick={onLogout}>Abmelden</button>
          </>
        ) : (
          <>
            <button style={styles.secondaryBtn}>Handwerker werden</button>
            <button style={styles.navBtn} onClick={() => onAuth("tenant")}>Schaden analysieren</button>
          </>
        )}
      </div>
    </nav>
  );
}

function Hero({ onAuth }) {
  return (
    <div style={styles.hero}>
      <div style={styles.badge}><span>✦</span> KI-gestützte Schadensdiagnose für Immobilien</div>
      <h1 style={styles.h1}>
        Schaden zuhause?{" "}
        <span style={styles.h1Accent}>Lass die KI zuerst draufschauen.</span>
      </h1>
      <p style={styles.subtext}>
        Egal ob Rohr, Steckdose, Heizung oder Fliese – mach ein Foto. Unsere KI
        liefert dir in Sekunden eine erste Einschätzung, eine Materialliste und
        verbindet Mieter, Vermieter und Hausverwaltungen in einem gemeinsamen Prozess.
      </p>
      <div style={styles.ctaRow}>
        <button style={styles.primaryBtn} onClick={() => onAuth("tenant")}
          onMouseOver={(e) => (e.currentTarget.style.background = C.orangeHover)}
          onMouseOut={(e) => (e.currentTarget.style.background = C.orange)}>
          📸 Als Mieter anmelden
        </button>
        <button style={styles.secondaryBtn} onClick={() => onAuth("landlord")}>
          🏢 Als Vermieter starten
        </button>
      </div>
      <div style={styles.smallGrid}>
        <div style={styles.resultCard}>
          <div style={styles.resultTitle}>Für Mieter</div>
          <p style={{ ...styles.stepDesc, marginBottom: 0 }}>
            Schaden fotografieren, KI-Diagnose erhalten und den Bearbeitungsstatus jederzeit verfolgen.
          </p>
        </div>
        <div style={styles.resultCard}>
          <div style={styles.resultTitle}>Für Vermieter</div>
          <p style={{ ...styles.stepDesc, marginBottom: 0 }}>
            Meldungen aller Einheiten bündeln, priorisieren, dokumentieren und Handwerker schneller kontaktieren.
          </p>
        </div>
      </div>
      <div style={styles.trustRow}>
        <div style={styles.trustItem}>🇩🇪 DSGVO-konform</div>
        <div style={styles.trustItem}>⚡ Ergebnis in Sekunden</div>
        <div style={styles.trustItem}>💶 Free bis 5 Einheiten</div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: "📷", num: "01", title: "Foto hochladen", desc: "Mieter melden Schäden direkt mit dem Smartphone." },
    { icon: "🤖", num: "02", title: "KI-Diagnose erhalten", desc: "Die KI erkennt Problem, Dringlichkeit, Kostenrahmen und Materialbedarf." },
    { icon: "🔧", num: "03", title: "Prozess steuern", desc: "Vermieter ändern Status, notieren Maßnahmen und kontaktieren Handwerker per E-Mail." },
  ];
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>In 3 Schritten zur Lösung</h2>
      <p style={styles.sectionSub}>So einfach war Schadensmanagement noch nie.</p>
      <div style={styles.stepsGrid}>
        {steps.map((s) => (
          <div key={s.num} style={styles.stepCard}>
            <div style={styles.stepIcon}>{s.icon}</div>
            <div style={styles.stepNum}>Schritt {s.num}</div>
            <div style={styles.stepTitle}>{s.title}</div>
            <div style={styles.stepDesc}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pricing() {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Preise für kleine Verwaltungen</h2>
      <p style={styles.sectionSub}>Startklar für Privatvermieter und Hausverwaltungen.</p>
      <div style={styles.smallGrid}>
        <div style={styles.resultCard}>
          <div style={styles.badge}>Free</div>
          <div style={styles.proTitle}>0€</div>
          <div style={styles.proSub}>Bis 5 Einheiten · alle MVP-Funktionen inklusive</div>
          <ul style={styles.list}>
            <li style={styles.listItem}><div style={styles.listDot} />KI-Schadensanalyse</li>
            <li style={styles.listItem}><div style={styles.listDot} />Mieter-Einladungen</li>
            <li style={styles.listItem}><div style={styles.listDot} />PDF-Export für Versicherungen</li>
          </ul>
        </div>
        <div style={styles.proCard}>
          <div style={styles.badge}>Pro</div>
          <div style={styles.proTitle}>1,50€ pro Einheit/Monat</div>
          <div style={styles.proSub}>Unbegrenzte Einheiten · Upgrade-Schranke vorbereitet</div>
          <ul style={styles.list}>
            <li style={styles.listItem}><div style={styles.listDot} />Alle Free-Funktionen</li>
            <li style={styles.listItem}><div style={styles.listDot} />Unbegrenzte Wohnungen</li>
            <li style={styles.listItem}><div style={styles.listDot} />Bereit für spätere Stripe-Aktivierung</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ ...styles.section, textAlign: "center" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.spinner} />
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>KI analysiert deinen Schaden...</div>
      <div style={{ fontSize: 14, color: C.muted }}>Erkennt Schadensart · Erstellt Materialliste · Bewertet Schwierigkeit</div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authRole, setAuthRole] = useState("tenant");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const sharedUi = useMemo(() => ({ C, styles }), []);

  const routeForProfile = useCallback((nextProfile) => {
    if (nextProfile?.role === "landlord") setView("landlord");
    else if (nextProfile?.role === "tenant") setView("tenant");
    else setView("auth");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!supabase) {
        setLoadingProfile(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session);
      if (data.session) {
        try {
          const nextProfile = await loadProfile(data.session);
          if (!mounted) return;
          setProfile(nextProfile);
          routeForProfile(nextProfile);
        } catch (error) {
          console.error(error);
        }
      }
      setLoadingProfile(false);
    }

    init();

    if (!supabase) return () => { mounted = false; };
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setView("home");
        return;
      }
      try {
        const nextProfile = await loadProfile(nextSession);
        setProfile(nextProfile);
        routeForProfile(nextProfile);
      } catch (error) {
        console.error(error);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [routeForProfile]);

  const openAuth = (role) => {
    setAuthRole(role);
    setView("auth");
  };

  const handleAuthSuccess = (nextSession, nextProfile) => {
    setSession(nextSession);
    setProfile(nextProfile);
    routeForProfile(nextProfile);
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setView("home");
  };

  return (
    <div style={styles.app}>
      <Navbar
        session={session}
        profile={profile}
        onHome={() => setView(session && profile ? (profile.role === "landlord" ? "landlord" : "tenant") : "home")}
        onAuth={openAuth}
        onLogout={handleLogout}
      />
      {loadingProfile && <LoadingScreen />}
      {!loadingProfile && view === "home" && (
        <>
          <Hero onAuth={openAuth} />
          <HowItWorks />
          <Pricing />
        </>
      )}
      {!loadingProfile && view === "auth" && (
        <Auth
          initialRole={authRole}
          onSuccess={handleAuthSuccess}
          onBack={() => setView("home")}
          {...sharedUi}
        />
      )}
      {!loadingProfile && view === "tenant" && session && profile && (
        <MieterDashboard
          session={session}
          profile={profile}
          onGlobalLoading={(active) => setView(active ? "loading" : "tenant")}
          {...sharedUi}
        />
      )}
      {!loadingProfile && view === "landlord" && session && profile && (
        <VermieterDashboard
          session={session}
          profile={profile}
          {...sharedUi}
        />
      )}
      <footer style={styles.footer}>© 2025 FixIt · KI-gestützte Schadensdiagnose · DSGVO-konform · EU-Hosting</footer>
    </div>
  );
}
