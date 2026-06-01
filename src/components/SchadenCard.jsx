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

function urgencyLabel(urgency) {
  if (urgency === "Notfall") return "🔴 Notfall";
  if (urgency === "Dringend") return "🟡 Dringend";
  return "🟢 Normal";
}

function formatDate(value) {
  if (!value) return "Gerade eben";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SchadenCard({
  C,
  styles,
  report,
  editable = false,
  onStatusChange,
  onNoteChange,
  contactLabel = "✉️ Handwerker kontaktieren",
  contactHref,
}) {
  const diagnosis = parseDiagnosis(report);
  const urgency = report.urgency || diagnosis.dringlichkeit || "Normal";
  const status = report.status || "Offen";
  const title = diagnosis.schadenstyp || "Schadensmeldung";
  const difficulty = diagnosis.schwierigkeit || "Mittel";
  const unitLabel = report.unit_label || report.units?.label || report.units?.name || "Wohnung";
  const tenantName = report.tenant_name || report.profiles?.full_name || report.profiles?.email || "Mieter";

  return (
    <div style={styles.resultCard}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {report.image_url && <img src={report.image_url} alt={title} style={styles.thumbnail} />}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <div style={styles.resultTitle}>{title}</div>
              <div style={styles.resultSub}>
                {unitLabel} · {tenantName} · {formatDate(report.created_at)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={styles.badgePill(urgency)}>{urgencyLabel(urgency)}</span>
              <span style={styles.diffBadge(difficulty)}>{difficulty}</span>
            </div>
          </div>

          {diagnosis.beschreibung && (
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
              {diagnosis.beschreibung}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: editable ? 14 : 0 }}>
            <span style={styles.badgePill(status)}>
              {status === "Erledigt" ? "✓" : status === "In Bearbeitung" ? "◐" : "•"} {status}
            </span>
            {diagnosis.zeitaufwand && <span style={styles.resultSub}>⏱ {diagnosis.zeitaufwand}</span>}
            {diagnosis.kosten_schaetzung && <span style={styles.resultSub}>💶 {diagnosis.kosten_schaetzung}</span>}
          </div>

          {editable && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
                <label style={{ ...styles.label, marginBottom: 0 }}>
                  Status ändern
                  <select
                    style={styles.input}
                    value={status}
                    onChange={(e) => onStatusChange(report, e.target.value)}
                  >
                    <option>Offen</option>
                    <option>In Bearbeitung</option>
                    <option>Erledigt</option>
                  </select>
                </label>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <a
                    href={contactHref || `mailto:?subject=${encodeURIComponent(`Auftrag zu ${title}`)}&body=${encodeURIComponent(`Bitte um Rückmeldung zu folgendem Schaden:\n\nEinheit: ${unitLabel}\nMieter: ${tenantName}\nSchaden: ${title}\nDringlichkeit: ${urgency}\n\nBeschreibung:\n${diagnosis.beschreibung || ""}`)}`}
                    style={{ ...styles.secondaryBtn, textDecoration: "none", textAlign: "center", width: "100%", boxSizing: "border-box" }}
                  >
                    {contactLabel}
                  </a>
                </div>
              </div>
              <label style={{ ...styles.label, marginBottom: 0 }}>
                Interne Notiz
                <textarea
                  style={styles.textarea}
                  value={report.notes || ""}
                  onChange={(e) => onNoteChange(report, e.target.value)}
                  placeholder="Notiz, Handwerkerkontakt oder Versicherungsinformation ergänzen"
                />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
