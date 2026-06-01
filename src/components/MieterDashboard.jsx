import { useEffect, useMemo, useState } from "react";
import SchadenCard from "./SchadenCard.jsx";
import SchadenMelden from "./SchadenMelden.jsx";
import { supabase } from "../lib/supabase.js";

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
          ? `tenant_id.eq.${profile.id},id.eq.${profile.unit_id}`
          : `tenant_id.eq.${profile.id}`;

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
      ?.channel(`tenant-reports-${profile.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "damage_reports",
        filter: `tenant_id=eq.${profile.id}`,
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
        <button
          style={styles.primaryBtn}
          onClick={() => setShowForm((current) => !current)}
          onMouseOver={(e) => (e.currentTarget.style.background = C.orangeHover)}
          onMouseOut={(e) => (e.currentTarget.style.background = C.orange)}
        >
          {showForm ? "Historie anzeigen" : "📸 Neue Meldung"}
        </button>
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

      {message && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", background: C.orangeDim,
          border: `1px solid ${C.orange}33`, borderRadius: 10, fontSize: 13, color: C.text,
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
