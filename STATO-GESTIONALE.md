# STATO PROGETTO — GESTIONALE RIGHETTI 1967

Ultimo aggiornamento: **25/09/2026 — Multi-tenant completo (DB + frontend + logo + RLS + pannello Licenze)**

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

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (in `app/`)
- **Backend**: FastAPI + Uvicorn Python 3.12 (in `backend/`)
- **Database**: Supabase PostgreSQL (multi-tenant con RLS)
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
- **Pannello Admin "👑 Licenze"** per gestione completa

### 3. Backend FastAPI su Railway
- Health check: `GET /health`
- **Endpoint Licenze** (`/api/licenze/*`):
  - `GET /utenti` — lista utenti + stato
  - `POST /proroga` — allunga demo
  - `POST /sblocca-reale` — attiva reale + reset dati
  - `POST /popola-demo` — popola dati demo

### 4. Agenda Migliorata
- **Ricerca globale cliente** in Agenda (per nome, cellulare, email)
- Click su appuntamento → salta a data + highlight giallo
- **Auto-selezione tab "Percorso"** se cliente ha percorsi attivi
- **Bordo rosso pulsante** su dropdown percorso vuoto
- **Solo operatori visibili** in Nuovo Appuntamento/Blocco
- Layout compatto (tutto in una riga, agenda senza scroll)

### 5. Fix UI
- Rimosso "Gestionale Studio & Salone" dall'header
- **Tab Aspetto**: rimossi Lingua, Valuta, Formati (non interessano)
- **Sidebar**: TricoAI visibile solo a Righetti e reali (nascosto a DEMO)

### 6. Documenti
- **"Dicitura Legale"** → **"Note documento"**
- **"DDT Commercialista"** → **"Documento di Competenza"**
- Titoli PDF: `Documento di Competenza | DDT-XXX-YYYY` (commercialista) / `Seduta in Studio | DDT-XXX-YYYY` (cliente)

---

## ✅ Multi-tenant COMPLETO

**Obiettivo raggiunto**: ogni utente (Righetti, DEMO, altri clienti) vede solo i propri dati.

### FASE A — Migrazione DB ✅ COMPLETATA

Aggiunto `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE` a:
- `appuntamenti`, `clienti`, `fatture`, `fornitori`
- `impostazioni`, `movimenti_magazzino`, `ordini_fornitore`
- `percorsi`, `prodotti`, `righe_ordine_fornitore`
- `scarichi_seduta`, `servizi`
- `sessioni_firma`, `sessioni_firma_ddt`, `sessioni_firma_fattura`

**Indici** su `user_id`. **Constraint `impostazioni`**: UNIQUE `(user_id, chiave)`.

### FASE B — Frontend `src/lib/*.ts` ✅ COMPLETATA

Tutti i file aggiornati con filtro `user_id`:

`clienti.ts`, `prodotti.ts`, `servizi.ts`, `appuntamenti.ts`, `percorsi.ts`, `scarichi.ts`, `fatture.ts`, `fornitori.ts`, `ordini.ts`, `magazzino.ts`, `datiAziendali.ts`, `agenda-config.ts`, `aspetto.ts`, `fatturazione.ts`, `privacy.ts`, `Impostazioni.tsx`.

**Eccezioni (pubbliche via token)**: funzioni `get/completa/isSessione*` per `sessioni_firma*`.

### FASE B-bis — Logo multi-tenant ✅ COMPLETATA

- **Righetti**: logo fisso in `azienda/logo.png`
- **Altri utenti**: logo in `azienda/{user_id}/logo.png`
- **Non loggato**: fallback `/logo.png`
- **`logo.ts`**: cache globale + `initLogoPath()` / `resetLogoPath()`
- **`auth.tsx`**: init su SIGNED_IN, reset su SIGNED_OUT

### FASE C — RLS policies ✅ COMPLETATA

**Tabelle** (15): RLS + policy "solo i propri dati" (`auth.uid() = user_id`).
**Eccezioni**: `sessioni_firma*` con lettura pubblica via token.

**Storage bucket `azienda`** (5 policy):
- `azienda leggi proprio logo` (authenticated): legge `{user_id}/logo.png` + `logo.png`
- `azienda leggi logo pubblico` (anon): legge solo `logo.png` (Login)
- `azienda scrittura propria` (INSERT authenticated)
- `azienda update propria` (UPDATE authenticated)
- `azienda delete propria` (DELETE authenticated)

### FASE D — Backend `demo_seed.py` + Pannello Admin ✅ COMPLETATA

**D1** — `backend/app/services/demo_seed.py`:
- **Logo demo** → copia in `azienda/{user_id}/logo.png`
- 3 clienti (Mario Rossi, Laura Bianchi, Giuseppe Verdi)
- 4 servizi (Check-up, Seduta Base, Seduta Avanzata, Controllo)
- 5 prodotti
- 2 percorsi attivi
- 4 appuntamenti (2 passati, 2 futuri)
- Dati aziendali "Studio Demo Tricologico"
- Il seed **cancella prima tutti i dati** dell'utente

**D2** — Endpoint `POST /api/licenze/popola-demo` ✅

**D3** — Frontend `app/src/lib/api.ts` (nuovo):
- `getAdminUtenti(adminEmail)`
- `prorogaDemoUtente(adminEmail, params)`
- `sbloccaUtenteReale(adminEmail, params)`
- `popolaDemoUtente(adminEmail, userId)`

**D4** — Tab "👑 Licenze" in Impostazioni (solo Righetti):
- Lista utenti con stato e filtri (Tutti/Demo/Reali)
- Azioni: `+7gg`, `+15gg`, `🧪 Popola DEMO`, `🔓 Attiva Reale (Reset)`

**D5** — Sidebar conditional TricoAI ✅
`🧬 TricoAI` visibile solo a Righetti e utenti reali (nascosto ai DEMO).

---

## 🎯 Roadmap — Prossimi Step

### 🔴 Priorità Alta
1. **#5/6 Card WhatsApp + Email in Impostazioni** (SMTP + Whatsender + test invio)
2. **#4 Firma accettazione + invio WhatsApp** (Whatsender)
3. **#9 Sync Gestionale → TricoAI** (clienti/prodotti creati qui appaiono in TricoAI)

### 🟡 Priorità Media
4. **Scontrino digitale** (alternativa a Fatture + DDT)
5. **Google OAuth** (abilitare su Supabase)

### 🔵 Backlog
6. **Collegamento Agenzia delle Entrate (SDI + RT)**
7. **Template email business** (fatture, DDT)

---

## 🛠️ Comandi utili

### Backend locale
```bash
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

📋 Checklist Multi-tenant
✅ DB: user_id su tutte le tabelle

✅ Frontend: src/lib/*.ts multi-tenant

✅ Logo multi-tenant (Righetti fisso, altri personali)

✅ RLS policies su Supabase (tabelle + bucket azienda)

✅ Backend demo_seed.py multi-tenant (con logo demo)

✅ Endpoint POST /api/licenze/popola-demo

✅ Frontend src/lib/api.ts (funzioni admin)

✅ Pannello "👑 Licenze" in Impostazioni

✅ Sidebar conditional TricoAI (nascosto a DEMO)

Multi-tenant: 100% completo 🎉

Documento aggiornato il 25/09/2026.
EOF

echo "✅ STATO riscritto"
echo ""
echo "=== Git status ==="
git status --short
echo ""
echo "=== Commit + push ==="
git add .
git commit -m "docs: STATO riscritto — multi-tenant 100% completo (FASI A/B/B-bis/C/D)"
git push
echo ""
echo "=== Log ==="
git log --oneline -3