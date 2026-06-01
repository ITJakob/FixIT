export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export async function analyzeImage(base64, mediaType) {
  const systemPrompt = `Du bist ein erfahrener Handwerks-Experte und Schadensdiagnostiker.
Analysiere das hochgeladene Foto auf Schäden und antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, keine Backticks, kein Preamble).

JSON-Struktur:
{
  "schadenstyp": "kurze Bezeichnung des Schadens",
  "beschreibung": "2-3 Sätze was du siehst",
  "schwierigkeit": "Einfach" | "Mittel" | "Komplex",
  "diy_moeglich": true | false,
  "materialien": ["Material 1", "Material 2", "Material 3"],
  "schritte": ["Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4"],
  "zeitaufwand": "z.B. 1-2 Stunden",
  "kosten_schaetzung": "z.B. 20-50€",
  "profi_empfehlung": "nur wenn diy_moeglich false, sonst null",
  "warnung": "wichtiger Sicherheitshinweis oder null",
  "dringlichkeit": "Notfall" | "Dringend" | "Normal"
}

Dringlichkeit:
- Notfall: Wasserrohrbruch, aktiver Wasseraustritt, Stromausfall, Gasgeruch, akute Gefahr.
- Dringend: Heizung defekt, Fenster kaputt, Schloss defekt, Schaden mit zeitnaher Eskalation.
- Normal: kosmetische Schäden, kleine Reparaturen, nicht sicherheitskritische Mängel.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Analysiere diesen Schaden und gib mir die Diagnose als JSON zurück." },
        ],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error("Die KI-Analyse konnte nicht gestartet werden.");
  }

  const data = await response.json();
  const text = data.content.map((b) => b.text || "").join("");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
