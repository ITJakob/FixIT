import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export default function Auth({ C, styles, initialRole = "tenant", onSuccess, onBack }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRole(initialRole);
    setMode("register");
  }, [initialRole]);

  const roleLabel = role === "landlord" ? "Vermieter/Hausverwaltung" : "Mieter";

  async function handleLogin(e) {
    e.preventDefault();
    if (!isSupabaseConfigured) return;

    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await fetchProfile(data.user.id);
      onSuccess(data.session, profile || { id: data.user.id, email, role: data.user.user_metadata?.role || "tenant" });
    } catch (error) {
      setMessage(error.message || "Login fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!isSupabaseConfigured) return;

    setBusy(true);
    setMessage("");
    try {
      let invitedUnit = null;

      if (role === "tenant") {
        if (!inviteCode.trim()) throw new Error("Bitte Einladungscode eingeben.");
        const { data: unit, error: unitError } = await supabase
          .from("units")
          .select("*")
          .eq("invite_code", inviteCode.trim())
          .maybeSingle();

        if (unitError) throw unitError;
        if (!unit) throw new Error("Einladungscode wurde nicht gefunden.");
        invitedUnit = unit;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, full_name: fullName } },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Registrierung konnte nicht abgeschlossen werden.");

      const profile = {
        id: data.user.id,
        email,
        full_name: fullName,
        role,
        landlord_id: invitedUnit?.landlord_id || null,
        unit_id: invitedUnit?.id || null,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profile, { onConflict: "id" });
      if (profileError) throw profileError;

      if (invitedUnit) {
        const { error: unitUpdateError } = await supabase
          .from("units")
          .update({ tenant_id: data.user.id, tenant_name: fullName, tenant_email: email })
          .eq("id", invitedUnit.id);
        if (unitUpdateError) throw unitUpdateError;
      }

      if (data.session) {
        onSuccess(data.session, profile);
      } else {
        setMode("login");
        setMessage("Registrierung erfolgreich. Bitte bestätige deine E-Mail und melde dich danach an.");
      }
    } catch (error) {
      setMessage(error.message || "Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...styles.section, paddingTop: 32 }}>
      <h2 style={styles.sectionTitle}>{mode === "login" ? "Anmelden" : "Registrieren"}</h2>
      <p style={styles.sectionSub}>
        {mode === "login"
          ? "Melde dich mit E-Mail und Passwort an."
          : `Starte als ${roleLabel} im bestehenden FixIt Dark Style.`}
      </p>

      {!isSupabaseConfigured && (
        <div style={styles.proCard}>
          <div style={styles.proTitle}>Supabase konfigurieren</div>
          <div style={styles.proSub}>
            Bitte setze <strong>VITE_SUPABASE_URL</strong> und <strong>VITE_SUPABASE_ANON_KEY</strong>.
            Danach stehen Auth, EU-Datenbank und Storage bereit.
          </div>
        </div>
      )}

      <div style={styles.authCard}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            style={mode === "login" ? styles.navBtn : styles.secondaryBtn}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            style={mode === "register" ? styles.navBtn : styles.secondaryBtn}
            onClick={() => setMode("register")}
          >
            Registrierung
          </button>
        </div>

        {mode === "register" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <button
              type="button"
              style={role === "tenant" ? styles.navBtn : styles.secondaryBtn}
              onClick={() => setRole("tenant")}
            >
              Mieter
            </button>
            <button
              type="button"
              style={role === "landlord" ? styles.navBtn : styles.secondaryBtn}
              onClick={() => setRole("landlord")}
            >
              Vermieter
            </button>
          </div>
        )}

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
          {mode === "register" && (
            <label style={styles.label}>
              Name
              <input
                style={styles.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Max Mustermann"
                required
              />
            </label>
          )}
          <label style={styles.label}>
            E-Mail
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@example.com"
              required
            />
          </label>
          <label style={styles.label}>
            Passwort
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              required
              minLength={6}
            />
          </label>
          {mode === "register" && role === "tenant" && (
            <label style={styles.label}>
              Einladungscode
              <input
                style={styles.input}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="z.B. FIX-AB12CD"
                required
              />
            </label>
          )}

          {message && (
            <div style={{
              marginBottom: 16, padding: "10px 14px", background: C.orangeDim,
              border: `1px solid ${C.orange}33`, borderRadius: 10, fontSize: 13, color: C.text,
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            style={{ ...styles.analyzeBtn, opacity: busy || !isSupabaseConfigured ? 0.7 : 1 }}
          >
            {busy ? "Bitte warten..." : mode === "login" ? "Einloggen" : "Konto erstellen"}
          </button>
        </form>
      </div>

      <button style={styles.resetBtn} onClick={onBack}>← Zur Landing Page</button>
    </div>
  );
}
