# STATO PROGETTO — GESTIONALE RIGHETTI 1967

Ultimo aggiornamento: **25/09/2026 — Multi-tenant completo (DB + frontend + logo), backend live, dominio attivo**

---

## ✅ Stato attuale

**Il Gestionale è online con backend FastAPI, dominio personalizzato e SMTP Google Workspace.**

### URLs di produzione
- **Frontend**: https://gestionale.righetti.club (dominio custom)
- **Frontend alternativo**: https://gestionale-righetti.vercel.app
- **Backend**: https://gestionale-righetti-production.up.railway.app
- **Supabase**: https://yporpszebtasalwazirz.supabase.co
- **GitHub**: https://github.com/righetti-1967/gestionale-righetti

---

## 🏗️ Architettura
Frontend (Vercel) → Backend (Railway) → Supabase (PostgreSQL + Auth + Storage)

text

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (in `app/`)
- **Backend**: FastAPI + Uvicorn Python 3.12 (in `backend/`)
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (email + password)
- **Email Auth**: SMTP Google Workspace (`righetti@righetti.club`)
- **Monorepo**: `app/` + `backend/` nello stesso repo GitHub

---

## ✅ Funzionalità Rilasciate

### 1. Suite di Accesso Completa
- Login e Registrazione (email + password)
- Login con Google (da abilitare, config OAuth pronta)
- Recupero Password (`/forgot-password` + `/reset-password`)
- **Template email in italiano** (conferma signup, reset password, magic link, cambio email)

### 2. Modalità DEMO 15 Giorni
- Nuovi utenti ricevono `ruolo: demo` + `demo_scadenza`
- Badge countdown in topbar
- Schermata di blocco (lock screen) alla scadenza

### 3. Backend FastAPI su Railway
- Health check: `GET /health`
- **Endpoint Licenze** (`/api/licenze/*`):
  - `GET /utenti` — lista utenti + stato
  - `POST /proroga` — allunga demo
  - `POST /sblocca-reale` — attiva reale + reset dati
- **Endpoint DEMO seed** (`/api/licenze/popola-demo`) — in sviluppo

### 4. Agenda Migliorata
- **Ricerca globale cliente** in Agenda (per nome, cellulare, email)
- Click su appuntamento → salta a data + highlight giallo
- **Auto-selezione tab "Percorso"** se cliente ha percorsi attivi
- **Bordo rosso pulsante** su dropdown percorso vuoto
- **Solo operatori visibili** in Nuovo Appuntamento/Blocco
- Layout compatto (tutto in una riga, agenda senza scroll)

### 5. Fix UI
- Rimosso "Gestionale Studio & Salone" dall'header
- Tab "Profilo" e "Azienda" già presenti
- Sidebar con TricoAI (da nascondere a utenti DEMO)

### 6. Documenti
- **"Dicitura Legale"** → **"Note documento"**
- **"DDT Commercialista"** → **"Documento di Competenza"**
- Titoli PDF: `Documento di Competenza | DDT-XXX-YYYY` (commercialista) / `Seduta in Studio | DDT-XXX-YYYY` (cliente)

---

## 🚧 LAVORO IN CORSO — Multi-tenant

**Obiettivo**: rendere il Gestionale multi-tenant come TricoAI, così ogni utente (Righetti, DEMO, altri clienti) vede solo i propri dati.

### FASE A — Migrazione DB ✅ COMPLETATA

Aggiunto `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE` a:
- `appuntamenti`, `clienti`, `fatture`, `fornitori`
- `impostazioni`, `movimenti_magazzino`, `ordini_fornitore`
- `percorsi`, `prodotti`, `righe_ordine_fornitore`
- `scarichi_seduta`, `servizi`
- `sessioni_firma`, `sessioni_firma_ddt`, `sessioni_firma_fattura`

**Indici** aggiunti su `user_id` per performance.
**Constraint `impostazioni`**: UNIQUE composta `(user_id, chiave)`.

### FASE B — Frontend `src/lib/*.ts` ✅ COMPLETATA

Tutti i file che fanno query a Supabase sono stati aggiornati con `user_id`:

| File | Stato |
|------|-------|
| `clienti.ts` | ✅ |
| `prodotti.ts` | ✅ |
| `servizi.ts` | ✅ |
| `appuntamenti.ts` | ✅ |
| `percorsi.ts` | ✅ |
| `scarichi.ts` | ✅ |
| `fatture.ts` | ✅ |
| `fornitori.ts` | ✅ |
| `ordini.ts` | ✅ |
| `magazzino.ts` | ✅ |
| `datiAziendali.ts` | ✅ |
| `agenda-config.ts` | ✅ |
| `aspetto.ts` | ✅ |
| `fatturazione.ts` | ✅ |
| `privacy.ts` | ✅ |
| `Impostazioni.tsx` | ✅ |

**Eccezioni (pubbliche via token, no user_id)**: `getSessioneFirma`, `completaSessioneFirma`, `isSessioneCompletata`, `getSessioneFirmaDdt`, `completaSessioneFirmaDdt`, `isSessioneDdtCompletata`, `getSessioneFirmaFattura`, `completaSessioneFirmaFattura`.

### FASE B-bis — Logo multi-tenant ✅ COMPLETATA

- **Righetti** (`righetti@righetti.club`): logo fisso in `azienda/logo.png` (comportamento invariato)
- **Altri utenti**: logo personale in `azienda/{user_id}/logo.png`
- **Non loggato**: fallback `/logo.png` (Login, Registrati, Reset Password)
- **`logo.ts`**: refactor con cache globale + `initLogoPath()` / `resetLogoPath()`
- **`auth.tsx`**: chiama `initLogoPath()` su SIGNED_IN e `resetLogoPath()` su SIGNED_OUT
- **`Impostazioni.tsx`**: nessuna modifica (usa già `uploadLogo`/`rimuoviLogo`)

⚠️ **RLS sul bucket `azienda`**: da configurare in FASE C per impedire scrittura cross-utente.

### FASE C — RLS policies ⏳ DA FARE

Su Supabase, attivare Row Level Security su tutte le tabelle:
```sql
CREATE POLICY "solo i propri dati"
ON clienti FOR ALL
USING (auth.uid() = user_id);
E policy sul bucket azienda (Storage):

sql
CREATE POLICY "solo il proprio logo"
ON storage.objects FOR ALL
USING (bucket_id = 'azienda' AND (storage.foldername(name))[1] = auth.uid()::text);
FASE D — Backend demo_seed.py multi-tenant + Pannello Admin ⏳ DA FARE
D1 — backend/app/services/demo_seed.py
Popola utente DEMO con:

Logo demo → copia public/logo.png in azienda/{user_id}/logo.png

3 clienti (Mario Rossi, Laura Bianchi, Giuseppe Verdi)

4 servizi (Check-up, Seduta Base, Seduta Avanzata, Controllo)

5 prodotti

2 percorsi attivi

4 appuntamenti (2 passati, 2 futuri)

Dati aziendali (ragione sociale "Studio Demo")

Config agenda di default

Aspetto, fatturazione, privacy → default

Il seed cancella prima tutti i dati dell'utente (evita duplicati).

D2 — Endpoint POST /api/licenze/popola-demo
Chiama demo_seed.popola_demo_utente(user_id).

D3 — Frontend src/lib/api.ts (nuovo)
Funzioni:

getAdminUtenti(adminEmail)

prorogaDemoUtente(adminEmail, params)

sbloccaUtenteReale(adminEmail, params)

popolaDemoUtente(adminEmail, userId)

D4 — Tab "👑 Licenze" in Impostazioni
Solo visibile a righetti@righetti.club:

Lista utenti con stato

Azioni: +7gg, +15gg, 🧪 Popola DEMO, 🔓 Attiva Reale (Reset)

D5 — Sidebar conditional TricoAI
Nascondere "🧬 TricoAI" agli utenti DEMO (mostrare solo a reali/admin).

🎯 Roadmap (dal ROADMAP.md)
🔴 Priorità Alta
Completare Multi-tenant (FASI C-D-E)

#4 Firma accettazione + invio WhatsApp (Whatsender)

#5/6 Card WhatsApp + Email in Impostazioni

#9 Sync Gestionale → TricoAI (clienti/prodotti creati qui appaiono in TricoAI)

🟡 Priorità Media
Scontrino digitale (alternativa a Fatture + DDT)

Google OAuth (abilitare su Supabase)

🔵 Backlog
Collegamento Agenzia delle Entrate (SDI + RT)

Template email business (fatture, DDT)

🛠️ Comandi utili
Backend locale
bash
cd backend
uvicorn app.main:app --reload --port 8000
Frontend locale
bash
cd app
npm run dev
Build frontend
bash
cd app
npm run build
Deploy
bash
git add .
git commit -m "messaggio"
git push
→ Vercel + Railway fanno auto-deploy

📋 Lista Cose da Fare
🔴 Priorità 1 — Chiudere multi-tenant
✅ DB: user_id su tutte le tabelle

✅ Frontend: src/lib/*.ts multi-tenant

✅ Logo multi-tenant

⏳ RLS policies su Supabase (tabelle + bucket azienda)

⏳ Backend demo_seed.py multi-tenant (con logo demo)

⏳ Endpoint POST /api/licenze/popola-demo

⏳ Frontend src/lib/api.ts (funzioni admin)

⏳ Pannello "👑 Licenze" in Impostazioni

⏳ Sidebar conditional TricoAI (nascondi a DEMO)

🟡 Priorità 2
Card WhatsApp + Email in Impostazioni

Sync Gestionale → TricoAI

Documento aggiornato il 25/09/2026.
EOF

echo "✅ STATO riscritto"
echo ""
echo "=== Git status ==="
git status --short
echo ""
echo "=== Commit + push ==="
git add .
git commit -m "docs: STATO riscritto con FASE A/B/B-bis complete + roadmap aggiornata"
git push
echo ""
echo "=== Log ==="
git log --oneline -3