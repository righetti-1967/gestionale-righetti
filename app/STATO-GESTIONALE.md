# STATO GESTIONALE RIGHETTI 1967
Ultimo aggiornamento: 07/10/2026 (mattina)

---

## 📌 REGOLA FISSA RESPONSIVE

Ogni nuova funzionalita' deve essere testata su:
- **Desktop** (1280px+)
- **Tablet** (768px - 1024px)
- **Mobile** (375px - 430px)

Check obbligatori:
- Pulsanti `w-full sm:w-auto` (mai full-width su desktop)
- Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-X`
- Padding `p-3 sm:p-4 lg:p-6`
- Font `text-sm sm:text-base lg:text-lg`
- Modali scrollabili senza scroll orizzontale
- Tabelle scrollabili o trasformate in card su mobile

Nessuna eccezione. Se non e' responsive, non e' finita.

---

## 🎯 VISIONE GENERALE

Gestionale per Studio Tricologico Righetti (Talamona, SO). PWA installabile su iPhone/iPad/Mac.

**Domini:**
- `gestionale.righetti.club` → Gestionale (interno studio)
- `trico.righetti.club` → TricoAI v2 (assistente AI)
- `cliente.righetti.club` → **App Cliente** (ATTIVA in PROD)

**Regimi documenti:**
- **Regime FATTURE**: fatture + DDT
- **Regime SCONTRINI**: cassa fiscale + scontrini

---

## 📌 STACK TECNICO

- **Frontend:** Vite + React + TypeScript + Tailwind
- **PWA:** vite-plugin-pwa (autoUpdate)
- **Backend:** Python FastAPI (Railway) per TricoAI
- **Edge Function:** Supabase Edge Functions (Deno) per magic link App Cliente
- **DB:** Supabase PostgreSQL (RLS abilitato)
- **Email:** Google Workspace HTTPS Relay (Apps Script)
- **Deploy:** Vercel (auto su push main)

**Ambiente unico:** PROD (sviluppo diretto in prod, no TEST)
**Supabase PROD:** `yporpszebtasalwazirz.supabase.co`

---

## 🚀 SESSIONE 06-07/10/2026 — APP CLIENTE + FIX BUG AGENDA

### 📌 Riepilogo

Creata da zero l'**App Cliente PWA** (`cliente.righetti.club`), collegata al
Gestionale, con autenticazione magic link, visione documenti e installazione
PWA su iPhone. Fixato bug critico React #310 in Agenda.

### ✅ COMPLETATO — App Cliente PWA

**Nuovo progetto:** `/Users/luca/Desktop/Tricolab/CLIENTE/app`
- Vite + React + TS + Tailwind
- Deploy Vercel: `cliente.righetti.club`
- Repo GitHub: `righetti-1967/Gestionale-cliente`

**Auth:**
- Magic link Supabase (via Edge Function `generate-invite-link`)
- Redirect 1-click: email → Safari → `/auth/callback` → `/welcome` → PWA
- Sessione in **cookie** (per copia iOS 17.2+ Safari → PWA)
- Auto-binding via RPC `find_pending_invite_for_me()`
- RPC `bind_client_session()`

**Pagine:**
- `/login` — magic link email
- `/invite?token=...` — accettazione invito (con auto-invio)
- `/auth/callback` — gestione sessione + binding
- `/welcome` — istruzioni installazione PWA (iOS/Android)
- `/` — Home (profilo + prossimo appuntamento + contatti studio + quick links)
- `/privacy` — Privacy firmata (PDF da Storage o generazione al volo)
- `/documenti` — Fatture / Scontrini / DDT (raggruppati per documento)
- `/profilo` — Profilo + Logout

**PWA:**
- Nome: **Area Riservata**
- Icone: **chiave arancione** (placeholder neutro)
- **Favicon dinamica**: cambia con logo studio loggato
- Cookie storage per copia sessione Safari → PWA

**RLS + RPC App Cliente:**
- `is_client()`, `is_staff()`, `current_client_id()`
- `validate_invite`, `bind_client_session`, `find_pending_invite_for_me`
- `get_my_client_profile`, `get_my_next_appuntamento`, `get_my_studio_contatti`, `get_my_studio_logo`
- `get_my_privacy_pdf_data` (con `privacy_pdf_url`)
- `get_my_fatture`, `get_my_scontrini`, `get_my_ddt`

### ✅ COMPLETATO — Gestionale

**Tab App Cliente (Impostazioni):**
- Lista clienti + stato App (Attivo / Invitato / Non attivo / Bloccato)
- Card statistiche cliccabili per filtro
- Toggle visibilità moduli (6): Appuntamenti, Documenti, Percorsi, Scheda tricologica, Cura domiciliare, Privacy firmata
- Blocco/sblocco accesso con motivo
- **Genera link invito** (Edge Function)
- **Invia via email** (automatico via Apps Script)
- **Invia WhatsApp** (link pre-compilato con numero cliente)

**Edge Function Supabase:**
- `generate-invite-link` → genera magic link diretto Supabase per cliente
- Deploy: `supabase functions deploy generate-invite-link`
- `supabase/` + `.vscode/settings.json` aggiunti a `.gitignore`

**Upload PDF su Storage:**
- `fatture-pdf`, `scontrini-pdf`, `scarichi-pdf`, `privacy-pdf`
- Upload automatico ad ogni generazione PDF
- URL salvato in DB (`fatture.pdf_url`, `scontrini.pdf_url`, `scarichi_seduta.pdf_url`, `clienti.privacy_pdf_url`)

**Storico Sedute & Consegne (modale cliente):**
- Tab: Tutti / Prodotti / Servizi / EXTRA / Fatture & Scontrini
- **Raggruppamento per documento** con freccia ▼
- **Documenti cliccabili** per aprire PDF (fatture pagate, scontrini, DDT, scontrini figli)
- **Proforma**: visibili ma non cliccabili (etichetta "IN ATTESA")
- **Scontrini figli**: suffisso "(Figlio)"
- **Fatture proforma**: etichetta "Proforma" invece di "Fattura"

**Fix critici:**
- **React error #310 in Agenda**: `useDraft` + 2 `useEffect` + `useRef` erano dopo `return if (loading)`. Spostati prima.
- **RPC "column reference ambiguous"**: qualificare sempre `tabella.colonna` in `RETURNS TABLE`

**Bug fix TricoAI:**
- Fix `main.tsx`: aggiunti `<BrowserRouter>` + `<AuthProvider>` mancanti
- Commit `abfea82`

---

## 🔴 TODO — PRIORITÀ ALTA

### 1. App Cliente — Pagine reali
- ⏸️ `/appuntamenti` — lista futura + passata con dettagli
- ⏸️ `/percorsi` — percorsi attivi (senza residui servizi/prodotti)
- ⏸️ `/schede` — Scheda Tricologica (da TricoAI)
- ⏸️ `/cura-domiciliare` — Rituale di Cura Domiciliare (da TricoAI)
- ✅ `/privacy` — FATTO
- ✅ `/documenti` — FATTO

### 2. TricoAI → App Cliente (schede tricologiche)
- ⏸️ TricoAI ha Supabase **separato**
- ⏸️ Serve Edge Function di TricoAI che invia PDF al Supabase PROD
- ⏸️ Autenticazione via secret condiviso
- ⏸️ Mappatura cliente: usare `tricoai_id` su `clienti` PROD
- ⏸️ Schede: "Report Tricologico Righetti" + "Rituale di Cura Domiciliare"

### 3. App Cliente — Migliorie
- ⏸️ Banner "Installa app" in Home (se non installata)
- ⏸️ Icona PWA dinamica per studio (manifest dinamico)
- ⏸️ Test su iPhone: privacy, documenti, PDF

### 4. Motore Promemoria automatico (backend)
- ⏸️ Cron job: post-seduta / compleanno / riattivazione

### 5. Integrazione API reali
- ⏸️ FPT (fatturazione elettronica)
- ⏸️ ADE (Agenzia Entrate)
- ⏸️ RCH, Epson (stampanti fiscali)

### 6. Filtri prenotazioni (App Cliente)
- ⏸️ Filtri per cliente: cosa può prenotare online
- ⏸️ Configurazione in Impostazioni

---

## 🟡 TODO — PRIORITÀ MEDIA

### 7. Agenda — Completare
- ⏸️ Vista Settimanale adattiva
- ⏸️ Vista Mensile adattiva
- ✅ Fix React #310 (fatto)

### 8. Cassa Fiscale — Miglioramenti
- ⏸️ Chiusura cassa giornaliera con fondo iniziale
- ⏸️ Export CSV scontrini per commercialista
- ⏸️ Tastiera numerica touch-friendly

### 9. Report Analytics Clienti
- ⏸️ Ranking clienti per spesa
- ⏸️ Export PDF A4

### 10. Report Commercialista
- ⏸️ Includere upload PDF per commercialista

---

## 🟢 TODO — PRIORITÀ BASSA

### 11. Sicurezza
- ⏸️ Conferma prima di salvare cambio regime documenti
- ⏸️ Log accessi/azioni critiche
- ⏸️ Timeout sessione per inattività

### 12. Performance
- ⏸️ Indici SQL su: appuntamenti, clienti, fatture, scontrini, bozze
- ⏸️ Riduzione Disk I/O e CPU Supabase

### 13. App Cliente — Icona PWA per studio
- ⏸️ Manifest dinamico per sottodominio studio
- ⏸️ Icona PWA = logo studio (non placeholder)

---

## 📋 NOTE TECNICHE

### Tabella `bozze` (persistenza multi-device)
- Chiave: user_id + chiave_draft (UNIQUE)
- Payload: JSONB
- Hook: `src/lib/useDraft.ts`
- **REGOLA**: hook sempre PRIMA di qualsiasi `return` condizionale (no React #310)

### Storage Buckets (PROD)
- `azienda` (pubblico) → logo azienda
- `avatars` (pubblico) → foto profilo
- `scontrini-pdf` (pubblico) → PDF scontrini
- `fatture-pdf` (pubblico) → PDF fatture
- `scarichi-pdf` (pubblico) → PDF DDT
- `privacy-pdf` (pubblico) → PDF privacy firmata

### App Cliente — Tabella binding
- `client_users`: `auth_user_id uuid` ↔ `client_id bigint`
- `client_portal_settings`: configurazione visibilità per cliente
- `client_invites`: token invito + `action_link` (magic link Supabase)
- `clienti.tricoai_id uuid`: collegamento a TricoAI

### Edge Function Supabase
- `generate-invite-link`: genera magic link diretto (service role)
- Deploy: `supabase functions deploy generate-invite-link`
- Setup: `supabase login` + `supabase link --project-ref yporpszebtasalwazirz`

### Annullo Fatture/DDT
- Password gestionale: Impostazioni → Sicurezza (hash SHA-256)
- Motivo obbligatorio: min 10 caratteri
- Soft-delete: annullato_at, annullato_motivo, annullato_da
- Blocco DDT collegati: annullare prima i DDT

### PWA Auto-Update
- In main.tsx: check ogni 60s + on focus + on online
- Reload silenzioso su controllerchange
- Anti-loop via sessionStorage

### Email Professionale
- `src/lib/emailWrapper.ts` → `wrapEmailHtml(corpo, azienda)`
- Variabile `{data_estesa}`: "Lunedì 5 Ottobre 2026"

### App Cliente — Magic Link
- Template email Supabase: bottone "Accedi" stile Apple
- Link generato da Edge Function (no magic link standard)
- Cookie storage per copia sessione iOS 17.2+

---

## 🔧 COMANDI UTILI

- Build Gestionale: `cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run build`
- Dev Gestionale: `cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run dev`
- Build App Cliente: `cd /Users/luca/Desktop/Tricolab/CLIENTE/app && npm run build`
- Dev App Cliente: `cd /Users/luca/Desktop/Tricolab/CLIENTE/app && npm run dev`
- Build TricoAI: `cd /Users/luca/Desktop/Tricolab_v2 && npm run build`
- Push in PROD: `git add -A && git commit -m "feat: ..." && git push origin main`
- Deploy Edge Function: `cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && supabase functions deploy generate-invite-link`

---

## 🎯 PRINCIPI DI SVILUPPO

1. Nessuna feature senza responsive (desktop/tablet/mobile)
2. Test in PROD prima di dire "fatto"
3. Backup automatico prima di modifiche critiche (_backup/)
4. Commit piccoli e chiari (un fix = un commit)
5. Deploy frequenti (Vercel automatico)
6. Realtime quando serve (Agenda, Cassa)
7. Multi-device quando serve (bozze + realtime)
8. Lavoriamo direttamente in PROD
9. **Tutti gli hook React prima di qualsiasi `return` condizionale**
10. **In RPC con RETURNS TABLE, qualificare sempre `tabella.colonna`**

---

## 📂 FILE CORRELATI

- TricoAI v2: `/Users/luca/Desktop/Tricolab_v2/STATO.md`
- App Cliente: `/Users/luca/Desktop/Tricolab/CLIENTE/app/` (nuovo repo `Gestionale-cliente`)
- Gestionale: questo file

---

## FINE FILE
