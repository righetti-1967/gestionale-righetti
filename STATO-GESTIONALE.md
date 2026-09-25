# STATO PROGETTO — GESTIONALE RIGHETTI 1967

Ultimo aggiornamento: **25/09/2026 — Multi-tenant in corso, backend live, dominio attivo**

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

### FASE B — Frontend `src/lib/*.ts` 🟡 IN CORSO

| File | Stato |
|------|-------|
| `clienti.ts` | ✅ Aggiornato |
| `prodotti.ts` | ✅ Aggiornato |
| `servizi.ts` | ✅ Aggiornato |
| `appuntamenti.ts` | ✅ Aggiornato |
| `percorsi.ts` | 🟡 In corso (patch pronta, da testare) |
| `scarichi.ts` | ⏳ Da fare |
| `fatture.ts` | ⏳ Da fare |
| `fornitori.ts` | ⏳ Da fare |
| `ordini.ts` | ⏳ Da fare |
| `magazzino.ts` | ⏳ Da fare |
| `datiAziendali.ts` | ⏳ Da fare |
| `agenda-config.ts` | ⏳ Da fare |
| `aspetto.ts` | ⏳ Da fare |
| `fatturazione.ts` | ⏳ Da fare |
| `privacy.ts` | ⏳ Da fare |

**Pattern applicato**:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Non autenticato');

// SELECT
.eq('user_id', user.id)

// INSERT
.insert({ ...dati, user_id: user.id })

// UPDATE / DELETE
.eq('user_id', user.id)
⚠️ Eccezioni: sessioni_firma* — getSessioneFirma, completaSessioneFirma, isSessioneCompletata restano pubbliche (usate da iPad non loggato via token).

FASE C — RLS policies ⏳ DA FARE
Su Supabase, attivare Row Level Security su tutte le tabelle:

sql
CREATE POLICY "solo i propri dati"
ON clienti FOR ALL
USING (auth.uid() = user_id);
FASE D — Backend demo_seed.py ⏳ DA FARE
Creare seed per popolare utente DEMO con:

3 clienti (Mario Rossi, Laura Bianchi, Giuseppe Verdi)

4 servizi

5 prodotti

2 percorsi attivi

4 appuntamenti (2 passati, 2 futuri)

1-2 fatture

2-3 DDT

Endpoint: POST /api/licenze/popola-demo

FASE E — Pannello Admin "👑 Licenze" ⏳ DA FARE
Nuova tab in Impostazioni (solo righetti@righetti.club):

Lista utenti con stato

Azioni: +7gg, +15gg, 🧪 Popola DEMO, 🔓 Attiva Reale (Reset)

FASE F — Sidebar conditional ⏳ DA FARE
Nascondere "🧬 TricoAI" agli utenti DEMO (mostrare solo a reali/admin).

🎯 Roadmap (dal ROADMAP.md)
🔴 Priorità Alta
Completare Multi-tenant (FASE B-F)

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

📋 Lista Cose da Fare Oggi
🔴 Priorità 1 — Chiudere multi-tenant
percorsi.ts (patch pronta)

scarichi.ts

fatture.ts

fornitori.ts

ordini.ts

magazzino.ts

File minori (datiAziendali, agenda-config, aspetto, fatturazione, privacy)

RLS policies su Supabase

Backend demo_seed.py multi-tenant

Pannello "👑 Licenze" in Impostazioni

Sidebar conditional TricoAI

🟡 Priorità 2
Card WhatsApp + Email in Impostazioni

Sync Gestionale → TricoAI

Documento aggiornato il 25/09/2026.