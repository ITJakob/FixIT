import { useEffect, useMemo, useState } from "react";
import SchadenCard from "./SchadenCard.jsx";
import SchadenMelden from "./SchadenMelden.jsx";
import { supabase } from "../lib/supabase.js";

function buildMailto(to, subject, body) {
  return "mailto:" + (to || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}

export default function MieterDashboard({ C, styles, profile }) {
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadTenantData() {
      if (!supabase) return;
      setLoading(true);
      setMessage("");

      try {
        const unitFilter = profile.unit_id
          ? "tenant_id.eq." + profile.id + ",id.eq." + profile.unit_id
          : "tenant_id.eq." + profile.id;

        const [{ data: unitData, error: unitError }, { data: reportData, error: reportError }] = await Promise.all([
          supabase.from("units").select("*").or(unitFilter).order("created_at", { ascending: false }),
          supabase.from("damage_reports").select("*").eq("tenant_id", profile.id).order("created_at", { ascending: false }),
        ]);

        if (unitError) throw unitError;
        if (reportError) throw reportError;
        if (!mounted) return;

        setUnits(unitData || []);
        setReports(reportData || []);
      } catch (error) {
        setMessage(error.message || "Meldungen konnten nicht geladen werden.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTenantData();

    const channel = supabase
      ?.channel("tenant-reports-" + profile.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "damage_reports",
        filter: "tenant_id=eq." + profile.id,
      }, () => loadTenantData())
      .subscribe();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile.id, profile.unit_id]);

  const stats = useMemo(() => ({
    open: reports.filter((report) => report.status !== "Erledigt").length,
    done: reports.filter((report) => report.status === "Erledigt").length,
    emergency: reports.filter((report) => report.urgency === "Notfall").length,
  }), [reports]);

  const landlordEmail = useMemo(() => {
    const linkedUnit = units.find((unit) => unit.id === profile.unit_id) || units[0];
    return linkedUnit?.landlord_email || "";
  }, [profile.unit_id, units]);

  const unitLabel = useMemo(() => {
    const linkedUnit = units.find((unit) => unit.id === profile.unit_id) || units[0];
    return linkedUnit?.label || linkedUnit?.name || "meiner Wohnung";
  }, [profile.unit_id, units]);

  const contactHref = buildMailto(
    landlordEmail,
    "Rückfrage zu meiner Wohnung / Schadensmeldung",
    [
      "Hallo,",
      "",
      "ich habe eine Frage zu " + unitLabel + ".",
      "",
      "Name: " + (profile.full_name || profile.email),
      "E-Mail: " + profile.email,
      "",
      "Meine Nachricht:",
      "",
      "Viele Grüße",
    ].join("\n"),
  );

  const handleCreated = (report) => {
    setReports((current) => [report, ...current]);
    setShowForm(false);
  };

  return (
    <main style={styles.dashboardShell}>
      <div style={styles.dashboardHeader}>
        <div>
          <h1 style={styles.dashboardTitle}>Mieter-Bereich</h1>
          <div style={styles.dashboardSub}>
            Hallo {profile.full_name || profile.email} · Meldungshistorie und Status deiner Schäden
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a
            href={contactHref}
            style={{ ...styles.secondaryBtn, textDecoration: "none", opacity: landlordEmail ? 1 : 0.7 }}
            title={landlordEmail ? "Hausverwaltung per E-Mail kontaktieren" : "Noch keine Vermieter-E-Mail in der Einheit hinterlegt"}
          >
            ✉️ Hausverwaltung kontaktieren
          </a>
          <button
            style={styles.primaryBtn}
            onClick={() => setShowForm((current) => !current)}
            onMouseOver={(e) => (e.currentTarget.style.background = C.orangeHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = C.orange)}
          >
            {showForm ? "Historie anzeigen" : "📸 Neue Meldung"}
          </button>
        </div>
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.open}</div>
          <div style={styles.statLabel}>Offen / in Bearbeitung</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.emergency}</div>
          <div style={styles.statLabel}>Notfälle</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.done}</div>
          <div style={styles.statLabel}>Erledigt</div>
        </div>
      </div>

      <div style={styles.proCard}>
        <div style={styles.resultHeader}>
          <div style={styles.resultIconWrap}>✉️</div>
          <div>
            <div style={styles.resultTitle}>Direkter Kontakt zur Hausverwaltung</div>
            <div style={styles.resultSub}>
              Bei Rückfragen, Zugangsthemen oder Problemen außerhalb einer Schadensmeldung kannst du direkt eine E-Mail vorbereiten.
            </div>
          </div>
        </div>
        <a href={contactHref} style={{ ...styles.primaryBtn, textDecoration: "none" }}>
          Hausverwaltung / Vermieter anschreiben
        </a>
      </div>

      {message && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", background: C.orangeDim,
          border: "1px solid " + C.orange + "33", borderRadius: 10, fontSize: 13, color: C.text,
        }}>
          {message}
        </div>
      )}

      {showForm ? (
        <div style={styles.authCard}>
          <SchadenMelden
            C={C}
            styles={styles}
            profile={profile}
            units={units}
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <>
          <h2 style={{ ...styles.sectionTitle, textAlign: "left", marginBottom: 16 }}>Deine Meldungen</h2>
          {loading && <div style={styles.resultCard}>Meldungen werden geladen...</div>}
          {!loading && reports.length === 0 && (
            <div style={styles.proCard}>
              <div style={styles.proTitle}>Noch keine Meldung</div>
              <div style={styles.proSub}>Erstelle deine erste Schadensmeldung per Foto und KI-Diagnose.</div>
              <button style={styles.primaryBtn} onClick={() => setShowForm(true)}>📸 Schaden melden</button>
            </div>
          )}
          {!loading && reports.map((report) => (
            <SchadenCard key={report.id} C={C} styles={styles} report={report} />
          ))}
        </>
      )}
    </main>
  );
}
