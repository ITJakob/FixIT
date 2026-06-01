import { useEffect, useMemo, useRef, useState } from "react";
import SchadenCard from "./SchadenCard.jsx";
import { supabase } from "../lib/supabase.js";

function generateInviteCode() {
  return "FIX-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function parseDiagnosis(report) {
  if (!report?.diagnosis) return {};
  if (typeof report.diagnosis === "string") {
    try {
      return JSON.parse(report.diagnosis);
    } catch {
      return {};
    }
  }
  return report.diagnosis;
}

function buildMailto(to, subject, body) {
  return "mailto:" + (to || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function exportReportsAsPdf(reports) {
  const rows = reports.map((report) => {
    const diagnosis = parseDiagnosis(report);
    return [
      "<tr>",
      "<td>" + escapeHtml(new Date(report.created_at).toLocaleDateString("de-DE")) + "</td>",
      "<td>" + escapeHtml(report.unit_label || "Wohnung") + "</td>",
      "<td>" + escapeHtml(report.tenant_name || "Mieter") + "</td>",
      "<td>" + escapeHtml(diagnosis.schadenstyp || "Schadensmeldung") + "</td>",
      "<td>" + escapeHtml(report.urgency || diagnosis.dringlichkeit || "Normal") + "</td>",
      "<td>" + escapeHtml(report.status || "Offen") + "</td>",
      "<td>" + escapeHtml(diagnosis.beschreibung || "") + "</td>",
      "<td>" + escapeHtml(report.notes || "") + "</td>",
      "</tr>",
    ].join("");
  }).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write([
    "<!doctype html><html><head><title>FixIt Schadensmeldungen</title>",
    "<style>",
    "body { font-family: Arial, sans-serif; color: #111; padding: 24px; }",
    "h1 { margin-bottom: 4px; } p { color: #555; }",
    "table { width: 100%; border-collapse: collapse; font-size: 12px; }",
    "th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }",
    "th { background: #f97316; color: #fff; text-align: left; }",
    "</style></head><body>",
    "<h1>FixIt Schadensmeldungen</h1>",
    "<p>Export für Versicherung und Dokumentation · " + new Date().toLocaleString("de-DE") + "</p>",
    "<table><thead><tr>",
    "<th>Datum</th><th>Einheit</th><th>Mieter</th><th>Schaden</th>",
    "<th>Dringlichkeit</th><th>Status</th><th>Beschreibung</th><th>Notiz</th>",
    "</tr></thead><tbody>" + rows + "</tbody></table>",
    "<script>window.print();</script>",
    "</body></html>",
  ].join(""));
  printWindow.document.close();
}

export default function VermieterDashboard({ C, styles, profile }) {
  const [reports, setReports] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitLabel, setUnitLabel] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [contractorTrade, setContractorTrade] = useState("");
  const [contractorEmailInput, setContractorEmailInput] = useState("");
  const [contractors, setContractors] = useState([]);
  const [contractorEmail, setContractorEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("Alle");
  const [urgencyFilter, setUrgencyFilter] = useState("Alle");
  const [unitFilter, setUnitFilter] = useState("Alle");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const noteTimers = useRef({});

  const isPro = profile.plan === "pro";
  const contractorStorageKey = "fixit-contractors-" + profile.id;

  async function loadDashboard() {
    if (!supabase) return;
    setLoading(true);
    setMessage("");

    try {
      const [{ data: unitData, error: unitError }, { data: reportData, error: reportError }] = await Promise.all([
        supabase.from("units").select("*").eq("landlord_id", profile.id).order("created_at", { ascending: false }),
        supabase.from("damage_reports").select("*").eq("landlord_id", profile.id).order("created_at", { ascending: false }),
      ]);

      if (unitError) throw unitError;
      if (reportError) throw reportError;

      setUnits(unitData || []);
      setReports(reportData || []);
    } catch (error) {
      setMessage(error.message || "Dashboard konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(contractorStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setContractors(parsed);
        setContractorEmail(parsed[0]?.email || "");
      } catch {
        setContractors([]);
      }
    }
  }, [contractorStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(contractorStorageKey, JSON.stringify(contractors));
  }, [contractorStorageKey, contractors]);

  useEffect(() => {
    loadDashboard();

    const channel = supabase
      ?.channel("landlord-reports-" + profile.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "damage_reports",
        filter: "landlord_id=eq." + profile.id,
      }, () => loadDashboard())
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      Object.values(noteTimers.current).forEach(clearTimeout);
    };
  }, [profile.id]);

  const stats = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    return {
      open: reports.filter((report) => report.status !== "Erledigt").length,
      emergencies: reports.filter((report) => report.urgency === "Notfall").length,
      doneThisWeek: reports.filter((report) => report.status === "Erledigt" && new Date(report.updated_at || report.created_at) >= weekStart).length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return reports.filter((report) => {
      const diagnosis = parseDiagnosis(report);
      const matchesStatus = statusFilter === "Alle" || (report.status || "Offen") === statusFilter;
      const matchesUrgency = urgencyFilter === "Alle" || (report.urgency || diagnosis.dringlichkeit || "Normal") === urgencyFilter;
      const matchesUnit = unitFilter === "Alle" || report.unit_id === unitFilter;
      const haystack = [
        report.unit_label,
        report.tenant_name,
        report.tenant_email,
        diagnosis.schadenstyp,
        diagnosis.beschreibung,
        report.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesUrgency && matchesUnit && (!query || haystack.includes(query));
    });
  }, [reports, searchTerm, statusFilter, unitFilter, urgencyFilter]);

  async function handleAddUnit(e) {
    e.preventDefault();
    if (!unitLabel.trim()) return;
    if (!isPro && units.length >= 5) {
      setShowUpgrade(true);
      return;
    }

    const newUnit = {
      landlord_id: profile.id,
      landlord_email: profile.email,
      label: unitLabel.trim(),
      invite_code: generateInviteCode(),
    };

    try {
      const { data, error } = await supabase
        .from("units")
        .insert(newUnit)
        .select("*")
        .single();
      if (error) throw error;
      setUnits((current) => [data, ...current]);
      setUnitLabel("");
    } catch (error) {
      setMessage(error.message || "Einheit konnte nicht erstellt werden.");
    }
  }

  function handleAddContractor(e) {
    e.preventDefault();
    if (!contractorEmailInput.trim()) return;
    const nextContractor = {
      id: Date.now().toString(),
      name: contractorName.trim() || "Handwerkerbetrieb",
      trade: contractorTrade.trim() || "Allrounder",
      email: contractorEmailInput.trim(),
    };
    setContractors((current) => [nextContractor, ...current]);
    setContractorEmail(nextContractor.email);
    setContractorName("");
    setContractorTrade("");
    setContractorEmailInput("");
  }

  async function handleStatusChange(report, status) {
    setReports((current) => current.map((item) => (
      item.id === report.id ? { ...item, status, updated_at: new Date().toISOString() } : item
    )));

    try {
      const { error } = await supabase
        .from("damage_reports")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      if (error) throw error;

      if (report.tenant_email) {
        window.location.href = buildMailto(
          report.tenant_email,
          "Statusänderung deiner FixIt-Meldung: " + status,
          [
            "Hallo " + (report.tenant_name || "") + ",",
            "",
            "der Status deiner Schadensmeldung in " + (report.unit_label || "deiner Wohnung") + " wurde geändert.",
            "",
            "Neuer Status: " + status,
            "",
            "Viele Grüße",
          ].join("\n"),
        );
      }
    } catch (error) {
      setMessage(error.message || "Status konnte nicht geändert werden.");
    }
  }

  function handleNoteChange(report, notes) {
    setReports((current) => current.map((item) => (
      item.id === report.id ? { ...item, notes } : item
    )));

    clearTimeout(noteTimers.current[report.id]);
    noteTimers.current[report.id] = setTimeout(async () => {
      const { error } = await supabase
        .from("damage_reports")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      if (error) setMessage(error.message || "Notiz konnte nicht gespeichert werden.");
    }, 600);
  }

  function renderReport(report) {
    const diagnosis = parseDiagnosis(report);
    const contactHref = buildMailto(
      contractorEmail,
      "Auftrag: " + (diagnosis.schadenstyp || "Schadensmeldung") + " (" + (report.urgency || "Normal") + ")",
      [
        "Hallo,",
        "",
        "bitte prüfen Sie folgenden Schaden:",
        "",
        "Einheit: " + (report.unit_label || "Wohnung"),
        "Mieter: " + (report.tenant_name || "Mieter"),
        "Dringlichkeit: " + (report.urgency || "Normal"),
        "Status: " + (report.status || "Offen"),
        "",
        "Beschreibung:",
        diagnosis.beschreibung || "",
        "",
        "Mieterangabe:",
        diagnosis.mieter_angaben?.beschreibung || "",
        "",
        "Notiz:",
        report.notes || "",
      ].join("\n"),
    );

    return (
      <SchadenCard
        key={report.id}
        C={C}
        styles={styles}
        report={report}
        editable
        onStatusChange={handleStatusChange}
        onNoteChange={handleNoteChange}
        contactHref={contactHref}
        contactLabel={contractorEmail ? "✉️ Handwerker kontaktieren" : "✉️ E-Mail vorbereiten"}
      />
    );
  }

  return (
    <main style={styles.dashboardShell}>
      <div style={styles.dashboardHeader}>
        <div>
          <h1 style={styles.dashboardTitle}>Vermieter-Dashboard</h1>
          <div style={styles.dashboardSub}>
            Alle Schadensmeldungen, Einheiten und Einladungen an einem Ort
          </div>
        </div>
        <button
          style={styles.primaryBtn}
          onClick={() => exportReportsAsPdf(filteredReports)}
          onMouseOver={(e) => (e.currentTarget.style.background = C.orangeHover)}
          onMouseOut={(e) => (e.currentTarget.style.background = C.orange)}
        >
          📄 Gefilterte Meldungen als PDF exportieren
        </button>
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.open}</div>
          <div style={styles.statLabel}>Offene Meldungen</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.emergencies}</div>
          <div style={styles.statLabel}>Notfälle</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.doneThisWeek}</div>
          <div style={styles.statLabel}>Erledigt diese Woche</div>
        </div>
      </div>

      {message && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", background: C.orangeDim,
          border: "1px solid " + C.orange + "33", borderRadius: 10, fontSize: 13, color: C.text,
        }}>
          {message}
        </div>
      )}

      <div style={styles.smallGrid}>
        <div style={styles.authCard}>
          <div style={styles.resultHeader}>
            <div style={styles.resultIconWrap}>🏠</div>
            <div>
              <div style={styles.resultTitle}>Einheiten verwalten</div>
              <div style={styles.resultSub}>Free bis 5 Einheiten · aktuell {units.length}</div>
            </div>
          </div>
          <form onSubmit={handleAddUnit}>
            <label style={styles.label}>
              Wohnungsbezeichnung
              <input
                style={styles.input}
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="z.B. Musterstraße 12, EG links"
              />
            </label>
            <button style={styles.analyzeBtn} type="submit">Einheit hinzufügen & Code generieren</button>
          </form>
          <ul style={{ ...styles.list, marginTop: 18 }}>
            {units.map((unit) => (
              <li key={unit.id} style={{ ...styles.listItem, justifyContent: "space-between", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={styles.listDot} />{unit.label || unit.name || "Wohnung"}</span>
                <span style={styles.badgePill("Offen")}>{unit.invite_code}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.authCard}>
          <div style={styles.resultHeader}>
            <div style={styles.resultIconWrap}>✉️</div>
            <div>
              <div style={styles.resultTitle}>Handwerker-Verzeichnis</div>
              <div style={styles.resultSub}>MVP lokal gespeichert · Auftrag per mailto</div>
            </div>
          </div>
          <form onSubmit={handleAddContractor}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <input style={styles.input} value={contractorName} onChange={(e) => setContractorName(e.target.value)} placeholder="Betrieb" />
              <input style={styles.input} value={contractorTrade} onChange={(e) => setContractorTrade(e.target.value)} placeholder="Gewerk" />
            </div>
            <label style={styles.label}>
              E-Mail
              <input
                style={styles.input}
                type="email"
                value={contractorEmailInput}
                onChange={(e) => setContractorEmailInput(e.target.value)}
                placeholder="betrieb@example.com"
              />
            </label>
            <button style={styles.analyzeBtn} type="submit">Handwerker speichern</button>
          </form>
          <label style={{ ...styles.label, marginTop: 14 }}>
            Für neue Aufträge verwenden
            <select style={styles.input} value={contractorEmail} onChange={(e) => setContractorEmail(e.target.value)}>
              <option value="">E-Mail frei lassen</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.email}>{contractor.name} · {contractor.trade}</option>
              ))}
            </select>
          </label>
          <ul style={{ ...styles.list, marginTop: 12 }}>
            {contractors.map((contractor) => (
              <li key={contractor.id} style={{ ...styles.listItem, justifyContent: "space-between", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={styles.listDot} />{contractor.name} · {contractor.trade}</span>
                <button
                  style={styles.secondaryBtn}
                  onClick={() => setContractorEmail(contractor.email)}
                  type="button"
                >
                  Auswählen
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ ...styles.authCard, marginTop: 16 }}>
        <div style={styles.resultHeader}>
          <div style={styles.resultIconWrap}>🔎</div>
          <div>
            <div style={styles.resultTitle}>Meldungen filtern</div>
            <div style={styles.resultSub}>{filteredReports.length} von {reports.length} Meldungen sichtbar</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <input style={styles.input} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Suche nach Schaden, Mieter, Einheit" />
          <select style={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option>Alle</option>
            <option>Offen</option>
            <option>In Bearbeitung</option>
            <option>Erledigt</option>
          </select>
          <select style={styles.input} value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
            <option>Alle</option>
            <option>Notfall</option>
            <option>Dringend</option>
            <option>Normal</option>
          </select>
          <select style={styles.input} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
            <option value="Alle">Alle Einheiten</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label || unit.name || "Wohnung"}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" style={viewMode === "list" ? styles.navBtn : styles.secondaryBtn} onClick={() => setViewMode("list")}>Liste</button>
          <button type="button" style={viewMode === "kanban" ? styles.navBtn : styles.secondaryBtn} onClick={() => setViewMode("kanban")}>Kanban</button>
        </div>
      </div>

      <h2 style={{ ...styles.sectionTitle, textAlign: "left", margin: "28px 0 16px" }}>Alle Schadensmeldungen</h2>
      {loading && <div style={styles.resultCard}>Meldungen werden geladen...</div>}
      {!loading && reports.length === 0 && (
        <div style={styles.proCard}>
          <div style={styles.proTitle}>Noch keine Schadensmeldung</div>
          <div style={styles.proSub}>
            Lege Einheiten an, teile Einladungscodes mit Mietern und erhalte Meldungen inklusive KI-Diagnose.
          </div>
        </div>
      )}
      {!loading && reports.length > 0 && filteredReports.length === 0 && (
        <div style={styles.resultCard}>Keine Meldung passt zu den aktuellen Filtern.</div>
      )}
      {!loading && filteredReports.length > 0 && viewMode === "list" && filteredReports.map(renderReport)}
      {!loading && filteredReports.length > 0 && viewMode === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {["Offen", "In Bearbeitung", "Erledigt"].map((column) => (
            <div key={column} style={{ ...styles.authCard, padding: 16 }}>
              <div style={{ ...styles.resultTitle, marginBottom: 12 }}>{column}</div>
              {filteredReports.filter((report) => (report.status || "Offen") === column).map(renderReport)}
              {filteredReports.filter((report) => (report.status || "Offen") === column).length === 0 && (
                <div style={{ ...styles.resultSub, padding: "12px 0" }}>Keine Meldungen</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showUpgrade && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.proCard, maxWidth: 460, marginBottom: 0 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
            <div style={styles.proTitle}>Pro für unbegrenzte Einheiten</div>
            <div style={styles.proSub}>
              Dein Free-Plan enthält bis zu 5 Einheiten. Pro kostet 1,50€ pro Einheit/Monat.
              Stripe ist noch nicht aktiviert – die Upgrade-Schranke ist vorbereitet.
            </div>
            <button style={styles.primaryBtn} onClick={() => setShowUpgrade(false)}>
              Verstanden
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
