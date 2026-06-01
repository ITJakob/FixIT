# FixIT

FixIt ist eine React/Vite MVP-App für KI-gestütztes Schadensmanagement in kleinen Hausverwaltungen und bei Privatvermietern.

## Setup

```bash
npm install
npm run dev
```

Benötigte Umgebungsvariablen:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
# Optional statt direkter Anthropic-Nutzung, z.B. Supabase Edge Function:
VITE_ANALYZE_IMAGE_ENDPOINT=...
```

## Supabase

Erwartete Tabellen:

- `profiles`: `id`, `email`, `full_name`, `role`, `landlord_id`, `unit_id`, `plan`
- `units`: `id`, `landlord_id`, `landlord_email`, `label`, `invite_code`, `tenant_id`, `tenant_name`, `tenant_email`, `created_at`
- `damage_reports`: `id`, `tenant_id`, `landlord_id`, `unit_id`, `unit_label`, `tenant_name`, `tenant_email`, `image_url`, `image_path`, `diagnosis`, `urgency`, `status`, `notes`, `created_at`, `updated_at`

Storage-Bucket: `damage-photos`.

Für den produktiven Betrieb sollte die Bildanalyse über einen EU-gehosteten Proxy oder eine Supabase Edge Function laufen, damit API-Schlüssel nicht im Browser ausgeliefert werden.
