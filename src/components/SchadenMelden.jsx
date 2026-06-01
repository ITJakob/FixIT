import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeImage, fileToBase64 } from "../lib/analyzeImage.js";
import { DAMAGE_BUCKET, supabase } from "../lib/supabase.js";

function buildMailto(to, subject, body) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
}

async function getLandlordEmail(landlordId) {
  if (!landlordId) return "";
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", landlordId)
    .maybeSingle();
  return data?.email || "";
}

export default function SchadenMelden({ C, styles, profile, units = [], onCreated, onCancel }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(units[0]?.id || profile?.unit_id || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef();

  useEffect(() => {
    if (!selectedUnitId && (units[0]?.id || profile?.unit_id)) {
      setSelectedUnitId(units[0]?.id || profile.unit_id);
    }
  }, [profile?.unit_id, selectedUnitId, units]);

  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) || units[0] || null;

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMessage("");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!file || !selectedUnit || !supabase) return;

    setLoading(true);
    setMessage("");
    try {
      const base64 = await fileToBase64(file);
      const diagnosis = await analyzeImage(base64, file.type);
      const storagePath = `${profile.id}/${Date.now()}-${safeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(DAMAGE_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(DAMAGE_BUCKET)
        .getPublicUrl(storagePath);

      const report = {
        tenant_id: profile.id,
        landlord_id: selectedUnit.landlord_id || profile.landlord_id,
        unit_id: selectedUnit.id,
        unit_label: selectedUnit.label || selectedUnit.name || "Wohnung",
        tenant_name: profile.full_name || profile.email,
        tenant_email: profile.email,
        image_url: publicUrl.publicUrl,
        image_path: storagePath,
        diagnosis,
        urgency: diagnosis.dringlichkeit || "Normal",
        status: "Offen",
        notes: "",
      };

      const { data: createdReport, error: insertError } = await supabase
        .from("damage_reports")
        .insert(report)
        .select("*")
        .single();
      if (insertError) throw insertError;

      if (report.urgency === "Notfall") {
        const landlordEmail = selectedUnit.landlord_email || await getLandlordEmail(report.landlord_id);
        if (landlordEmail) {
          window.location.href = buildMailto(
            landlordEmail,
            `🔴 Notfall-Schadensmeldung: ${diagnosis.schadenstyp}`,
            `Es wurde eine Notfall-Meldung für ${report.unit_label} erstellt.\n\nMieter: ${report.tenant_name}\nSchaden: ${diagnosis.schadenstyp}\nBeschreibung: ${diagnosis.beschreibung}\nDringlichkeit: ${report.urgency}`,
          );
        }
      }

      onCreated(createdReport);
      setMessage("Meldung wurde erstellt und an den Vermieter übermittelt.");
      setFile(null);
      setPreview(null);
    } catch (err) {
      setMessage(err.message || "Fehler bei der Analyse. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...styles.section, padding: 0, maxWidth: "none" }}>
      <h2 style={{ ...styles.sectionTitle, textAlign: "left" }}>Neue Meldung erstellen</h2>
      <p style={{ ...styles.sectionSub, textAlign: "left", marginBottom: 20 }}>
        Lade ein Foto hoch – die KI erkennt das Problem und erstellt automatisch eine Schadensmeldung.
      </p>

      {units.length > 1 && (
        <label style={styles.label}>
          Einheit auswählen
          <select
            style={styles.input}
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.label || unit.name || "Wohnung"}</option>
            ))}
          </select>
        </label>
      )}

      {!selectedUnit && (
        <div style={styles.proCard}>
          <div style={styles.proTitle}>Keine Einheit verknüpft</div>
          <div style={styles.proSub}>
            Bitte registriere dich mit einem Einladungscode oder bitte deinen Vermieter um eine Einladung.
          </div>
        </div>
      )}

      {!preview ? (
        <div
          style={{ ...styles.uploadArea, ...(dragging ? styles.uploadAreaActive : {}), opacity: selectedUnit ? 1 : 0.7 }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={selectedUnit ? handleDrop : undefined}
          onClick={() => selectedUnit && inputRef.current.click()}
        >
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])} />
          <div style={styles.uploadIcon}>📸</div>
          <div style={styles.uploadTitle}>Foto hierher ziehen</div>
          <div style={styles.uploadSub}>oder klicken zum Auswählen · JPG, PNG, WEBP</div>
          <button type="button" style={styles.fileBtn} disabled={!selectedUnit}>Datei auswählen</button>
        </div>
      ) : (
        <div>
          <img src={preview} alt="Schaden" style={styles.preview} />
          <button style={{ ...styles.analyzeBtn, ...(loading ? { opacity: 0.7, cursor: "not-allowed" } : {}) }}
            onClick={handleAnalyze} disabled={loading}>
            {loading ? "⏳ Analysiere und speichere..." : "🔍 Jetzt analysieren und melden"}
          </button>
          <button style={styles.resetBtn} onClick={() => { setFile(null); setPreview(null); }}>
            Anderes Foto wählen
          </button>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: 16, padding: "10px 14px", background: C.orangeDim,
          border: `1px solid ${C.orange}33`, borderRadius: 10, fontSize: 13, color: C.text,
        }}>
          {message}
        </div>
      )}

      {onCancel && <button style={styles.resetBtn} onClick={onCancel}>← Zurück zur Übersicht</button>}
    </div>
  );
}
