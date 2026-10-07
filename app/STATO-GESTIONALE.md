# STATO GESTIONALE RIGHETTI 1967
Ultimo aggiornamento: 08/10/2026 (notte)

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
- **PWA:** vite-plugin-pwa (registerType: prompt, strategies: injectManifest, custom SW)
- **Backend:** Python FastAPI (Railway) per TricoAI
- **Edge Function:** Supabase Edge Functions (Deno) per magic link + push
- **DB:** Supabase PostgreSQL (RLS abilitato) + `pg_net` per HTTP da trigger
- **Email:** Google Workspace HTTPS Relay (Apps Script)
- **Push:** Web Push API + VAPID + Service Worker custom
- **Deploy:** Vercel (auto su push main) + vercel.json (rewrites SPA)

**Ambiente unico:** PROD (sviluppo diretto in prod, no TEST)
**Supabase PROD:** `yporpszebtasalwazirz.supabase.co`

---

## 🚀 SESSIONE 06-08/10/2026 — APP CLIENTE + NOTIFICHE PUSH

### 📌 Riepilogo

Creata da zero l'**App Cliente PWA** (`cliente.righetti.club`), collegata al
Gestionale, con autenticazione magic link, visione documenti, note studio,
appuntamenti, percorsi e **sistema completo notifiche push**.
Fixati bug critici React #310 (Agenda, Testi Messaggi).
Implementato **UpdateBanner** PWA per aggiornamenti automatici.

### ✅ COMPLETATO — App Cliente PWA

**Nuovo progetto:** `/Users/luca/Desktop/Tricolab/CLIENTE/app`
- Vite + React + TS + Tailwind + vite-plugin-pwa
- Deploy Vercel: `cliente.righetti.club`
- Repo GitHub: `righetti-1967/Gestionale-cliente`
- **`vercel.json`** con rewrites SPA (CRITICO per routing)

**Auth:**
- Magic link Supabase (via Edge Function `generate-invite-link`)
- Redirect 1-click: email → Safari → `/auth/callback` → `/welcome` → PWA
- Sessione in **cookie** (per copia iOS 17.2+ Safari → PWA)
- Auto-binding via RPC `find_pending_invite_for_me()`
- RPC `bind_client_session()`

**Pagine complete:**
- `/login` — magic link email
- `/invite?token=...` — accettazione invito (con auto-invio)
- `/auth/callback` — gestione sessione + binding
- `/welcome` — istruzioni installazione PWA (iOS/Android)
- `/` — Home (profilo + prossimo appuntamento + contatti studio + quick links + badge)
- `/privacy` — Privacy firmata (PDF da Storage o generazione al volo)
- `/documenti` — Fatture / Scontrini / DDT (raggruppati per documento)
- `/note` — Note studio (badge rosso, modale lettura, stato letta/non letta)
- `/appuntamenti` — Prossimi + Storico (ASC/DESC, stati normalizzati)
- `/percorsi` — Attivi + Conclusi (senza residui)
- `/notifiche` — Centro notifiche ricevute
- `/attiva-notifiche` — Opt-in push + gestione subscription
- `/profilo` — Profilo + Logout + link notifiche

**PWA:**
- Nome: **Area Riservata**
- Icone: **chiave arancione** (placeholder neutro)
- **Favicon dinamica**: cambia con logo studio loggato
- Cookie storage per copia sessione Safari → PWA
- **UpdateBanner** (banner "Nuova versione disponibile" → update 1-click)
- **Service Worker custom** (`src/sw.ts`) con handler `push` + `notificationclick`
- Auto-check update: 30 min + on `visibilitychange`

**RLS + RPC App Cliente:**
- `is_client()`, `is_staff()`, `current_client_id()`
- `validate_invite`, `bind_client_session`, `find_pending_invite_for_me`
- `get_my_client_profile`, `get_my_next_appuntamento`, `get_my_studio_contatti`, `get_my_studio_logo`
- `get_my_privacy_pdf_data` (con `privacy_pdf_url`)
- `get_my_fatture`, `get_my_scontrini`, `get_my_ddt`
- `get_my_appuntamenti`, `get_my_percorsi`
- `get_my_note`, `mark_nota_letta`, `mark_my_note_lette`, `get_my_note_unread_count`
- `get_my_notifiche`, `get_my_notifiche_unread_count`, `mark_notifica_letta`, `mark_all_notifiche_lette`
- `save_push_subscription`, `delete_push_subscription`

### ✅ COMPLETATO — Gestionale

**Tab App Cliente (Impostazioni):**
- Lista clienti + stato App (Attivo / Invitato / Non attivo / Bloccato)
- Card statistiche cliccabili per filtro
- Toggle visibilità moduli (7): Appuntamenti, Documenti, Percorsi, Scheda tricologica, Cura domiciliare, Privacy firmata, Note studio
- Blocco/sblocco accesso con motivo
- **Genera link invito** (Edge Function)
- **Invia via email** (automatico via Apps Script)
- **Invia WhatsApp** (link pre-compilato con numero cliente)
- **📝 Note per il cliente** (cumulate, con stato lettura ✓ Letta / Non letta + auto-refresh 20 sec)
- **🔔 Invia notifica push** (form + storico con stato lettura)

**Edge Function Supabase:**
- `generate-invite-link` → genera magic link diretto Supabase
- `send-push` → invia notifiche push Web Push Protocol
- Deploy: `supabase functions deploy <nome>`
- `supabase/` + `.vscode/settings.json` in `.gitignore`

**Upload PDF su Storage:**
- `fatture-pdf`, `scontrini-pdf`, `scarichi-pdf`, `privacy-pdf`
- Upload automatico ad ogni generazione PDF
- URL salvato in DB (`fatture.pdf_url`, `scontrini.pdf_url`, `scarichi_seduta.pdf_url`, `clienti.privacy_pdf_url`)

**Storico Sedute & Consegne (modale cliente):**
- Tab: Tutti / Prodotti / Servizi / EXTRA / Fatture & Scontrini
- **Raggruppamento per documento** con freccia ▼
- **Documenti cliccabili** in TUTTE le tab → aprono **modale anteprima**
- **Proforma**: cliccabili (aprono anteprima Proforma)
- **Scontrini figli**: suffisso "(Figlio)" + raggruppati sotto madre
- **Fatture proforma**: etichetta "Proforma" + "IN ATTESA"
- Se `pdf_url` esiste → apre da Storage; altrimenti genera al volo

### ✅ COMPLETATO — Sistema Notifiche Push (end-to-end)

**Tabelle:**
- `push_subscriptions`: id, client_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at
- `notifiche`: id, client_id, tipo, titolo, messaggio, priorita, url, dettagli, letta, letta_at, push_inviata, push_inviata_at, push_errore, created_at, dedup_key
- `push_automazioni_config`: id, user_id, chiave, valore (JSONB), updated_at

**RLS complete** su tutte e 3.

**RPC (8):**
- `save_push_subscription`, `delete_push_subscription`
- `get_my_notifiche`, `get_my_notifiche_unread_count`
- `mark_notifica_letta`, `mark_all_notifiche_lette`
- `admin_send_custom_notifica`, `admin_list_notifiche_cliente`

**Edge Function `send-push`:**
- Deno + `web-push` lib
- Autenticazione: service_role (cron/trigger) o staff autenticato
- Legge/crea notifica, recupera subscriptions, invia push, aggiorna stato
- Rimuove subscription scadute (404/410)
- VAPID: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Supabase secrets

**Frontend App Cliente:**
- `usePushNotifications` hook (chiede permesso + registra subscription)
- Pagina `/attiva-notifiche` (attiva/disattiva + stato)
- Pagina `/notifiche` (lista + badge non lette)
- Badge rosso su tab **Profilo** (BottomNav) + quick link **Notifiche** in Home
- Auto-refresh contatore ogni 60 sec + on focus

**Frontend Gestionale:**
- Sezione **🔔 Invia notifica push** nel modale cliente
- Form: titolo + messaggio + priorità (alta/media/bassa) + URL opzionale
- **Storico notifiche** con stato ✓ Letta / Non letta + orario lettura
- Auto-refresh ogni 20 sec

### ✅ COMPLETATO — Note Studio → Cliente

**Tabella `cliente_note`:**
- id, client_id, contenuto, autore_user_id, visibile_cliente, letta, letta_at, created_at, updated_at

**RPC:**
- Staff: `admin_list_note_cliente`, `admin_create_nota_cliente`, `admin_update_nota_cliente`, `admin_delete_nota_cliente`
- Cliente: `get_my_note`, `mark_nota_letta`, `mark_my_note_lette`, `get_my_note_unread_count`

**UX App Cliente:**
- Badge rosso su quick link "Note studio" in Home
- Lista con stato visivo: **arancione = da leggere** / **grigio = letta**
- Testo **nascosto in preview** (privacy) → "Tocca per leggere il messaggio"
- Tap → **modale** con testo completo
- Marcatura automatica come letta all'apertura modale

**UX Gestionale:**
- Sezione **📝 Note per il cliente** nel modale
- Badge ✓ Letta / Non letta + orario
- Auto-refresh ogni 20 sec

### 🐛 FIX CRITICI

- **React error #310 in Agenda**: `useDraft` + 2 `useEffect` + `useRef` erano dopo `return if (loading)`. Spostati prima.
- **React error #310 in Testi Messaggi** (`TestiTemplateTab.tsx`): stesso pattern, fixato.
- **RPC "column reference ambiguous"**: qualificare sempre `tabella.colonna` in `RETURNS TABLE`
- **vercel.json mancante**: routing SPA rotto su Vercel (`/attiva-notifiche` → 404). Aggiunto rewrites.
- **RLS UPDATE su `cliente_note`**: policy mancante per marcatura letta → risolto
- **RPC `get_my_note` senza `letta`**: aggiunto campo

**Bug fix TricoAI:**
- Fix `main.tsx`: aggiunti `<BrowserRouter>` + `<AuthProvider>` mancanti (commit `abfea82`)

---

## 🔴 TODO — PRIORITÀ ALTA

### 1. Notifiche Push — Automazioni automatiche (IN CORSO)
- ⏸️ **Trigger DB** su `cliente_note` (INSERT → notifica)
- ⏸️ **Trigger DB** su `appuntamenti` (INSERT/UPDATE → notifica)
- ⏸️ **Trigger DB** su `fatture` (UPDATE pdf_url → notifica)
- ⏸️ **Trigger DB** su `scontrini` (INSERT → notifica)
- ⏸️ **Trigger DB** su `scarichi_seduta` (INSERT → notifica)
- ⏸️ **Trigger DB** su `clienti` (UPDATE privacy_pdf_url → notifica)
- ⏸️ **Cron edge function** ogni 1 min → processa `notifiche` con `push_inviata = false`
- ⏸️ **Cron compleanni** (giornaliero)
- ⏸️ **Cron promemoria pre-appuntamento** (configurabile)
- ⏸️ **Cron riattivazione** (90gg senza attività)
- ⏸️ **Config automazioni** in Impostazioni → Automazioni (on/off + timing per tipo)

### 2. TricoAI → App Cliente (schede tricologiche)
- ⏸️ TricoAI ha Supabase **separato**
- ⏸️ Edge Function di TricoAI che invia PDF al Supabase PROD
- ⏸️ Autenticazione via secret condiviso
- ⏸️ Mappatura cliente: usare `tricoai_id` su `clienti` PROD
- ⏸️ Schede: "Report Tricologico Righetti" + "Rituale di Cura Domiciliare"
- ⏸️ Pagine App Cliente `/schede` + `/cura-domiciliare`

### 3. App Cliente — Migliorie
- ⏸️ Banner "Installa app" in Home (se non installata)
- ⏸️ Icona PWA dinamica per studio (manifest sottodominio)
- ⏸️ Test completo su iPhone

### 4. Filtri prenotazioni (App Cliente)
- ⏸️ Filtri per cliente: cosa può prenotare online
- ⏸️ Configurazione in Impostazioni

### 5. Integrazione API reali
- ⏸️ FPT (fatturazione elettronica)
- ⏸️ ADE (Agenzia Entrate)
- ⏸️ RCH, Epson (stampanti fiscali)

---

## 🟡 TODO — PRIORITÀ MEDIA

### 6. Agenda — Completare
- ⏸️ Vista Settimanale adattiva
- ⏸️ Vista Mensile adattiva
- ✅ Fix React #310

### 7. Cassa Fiscale
- ⏸️ Chiusura giornaliera con fondo iniziale
- ⏸️ Export CSV scontrini
- ⏸️ Tastiera numerica touch-friendly

### 8. Report Analytics
- ⏸️ Ranking clienti per spesa
- ⏸️ Export PDF A4
- ⏸️ Upload PDF commercialista

---

## 🟢 TODO — PRIORITÀ BASSA

### 9. Sicurezza
- ⏸️ Conferma cambio regime documenti
- ⏸️ Log accessi/azioni critiche
- ⏸️ Timeout sessione inattività

### 10. Performance
- ⏸️ Indici SQL su: appuntamenti, clienti, fatture, scontrini, bozze
- ⏸️ Riduzione Disk I/O e CPU Supabase

### 11. Icona PWA dinamica per studio
- ⏸️ Manifest dinamico per sottodominio
- ⏸️ Icona PWA = logo studio

---

## 📋 NOTE TECNICHE

### Tabella `bozze` (persistenza multi-device)
- Chiave: user_id + chiave_draft (UNIQUE)
- Payload: JSONB
- Hook: `src/lib/useDraft.ts`
- **REGOLA**: hook sempre PRIMA di qualsiasi `return` condizionale

### Storage Buckets (PROD)
- `azienda` (pubblico) → logo azienda
- `avatars` (pubblico) → foto profilo
- `scontrini-pdf` (pubblico) → PDF scontrini
- `fatture-pdf` (pubblico) → PDF fatture
- `scarichi-pdf` (pubblico) → PDF DDT
- `privacy-pdf` (pubblico) → PDF privacy firmata

### App Cliente — Tabelle chiave
- `client_users`: `auth_user_id uuid` ↔ `client_id bigint`
- `client_portal_settings`: 7 toggle visibilità (appointments, documents, percorsi, scheda_tricologica, cura_domiciliare, privacy_pdf, note) + is_blocked
- `client_invites`: token invito + `action_link` (magic link)
- `cliente_note`: note studio → cliente
- `clienti.tricoai_id uuid`: collegamento a TricoAI

### App Cliente — Notifiche Push
- `push_subscriptions`: subscription Web Push per device
- `notifiche`: log notifiche + stato lettura + stato push
- `push_automazioni_config`: config per studio (futuro)
- Edge Function `send-push` (Deno + web-push)
- Service Worker custom `src/sw.ts` con handler push
- VAPID keys in Supabase secrets
- ⚠️ iOS 16.4+ richiede PWA installata
- ⚠️ Prompt autorizzazione solo dopo azione utente
- ⚠️ **VAPID_PUBLIC_KEY**: attenzione a `=` finale (errore ricorrente)

### Edge Functions Supabase
- `generate-invite-link`: magic link diretto (service role)
- `send-push`: notifiche push (service role o staff)
- Deploy: `supabase functions deploy <nome>`
- Setup: `supabase login` + `supabase link --project-ref yporpszebtasalwazirz`
- Secrets: `supabase secrets set CHIAVE="valore"`

### PWA Auto-Update (UpdateBanner)
- `registerType: 'prompt'` + `strategies: 'injectManifest'`
- Service Worker custom `src/sw.ts`
- Banner "Nuova versione disponibile" → update 1-click
- Auto-check: 30 min + on `visibilitychange`
- ⚠️ iOS a volte non rileva update → reinstallo manuale

### vercel.json (SPA Routing)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] }
  ]
}

Annullo Fatture/DDT
Password gestionale: Impostazioni → Sicurezza (hash SHA-256)

Motivo obbligatorio: min 10 caratteri

Soft-delete: annullato_at, annullato_motivo, annullato_da

Blocco DDT collegati: annullare prima i DDT

Email Professionale
src/lib/emailWrapper.ts → wrapEmailHtml(corpo, azienda)

Variabile {data_estesa}: "Lunedì 5 Ottobre 2026"

App Cliente — Magic Link
Template email Supabase: bottone "Accedi" stile Apple

Link generato da Edge Function (no magic link standard)

Cookie storage per copia sessione iOS 17.2+

Appuntamenti — Stati
prenotato (default) / confermato / pending / completato / cancellato

App Cliente normalizza: pending → "In attesa di conferma" (ambra), altri → "Prenotato" (blu), completato → "Completato" (grigio), cancellato → "Annullato" (rosso)

🔧 COMANDI UTILI
Build Gestionale: cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run build

Dev Gestionale: cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run dev

Build App Cliente: cd /Users/luca/Desktop/Tricolab/CLIENTE/app && npm run build

Dev App Cliente: cd /Users/luca/Desktop/Tricolab/CLIENTE/app && npm run dev

Build TricoAI: cd /Users/luca/Desktop/Tricolab_v2 && npm run build

Push PROD: git add -A && git commit -m "..." && git push origin main

Deploy Edge Function: cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && supabase functions deploy <nome>

Secrets: cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && supabase secrets set CHIAVE="valore"

🎯 PRINCIPI DI SVILUPPO
Nessuna feature senza responsive (desktop/tablet/mobile)

Test in PROD prima di dire "fatto"

Backup automatico prima di modifiche critiche (_backup/)

Commit piccoli e chiari (un fix = un commit)

Deploy frequenti (Vercel automatico)

Realtime quando serve (Agenda, Cassa)

Multi-device quando serve (bozze + realtime)

Lavoriamo direttamente in PROD

Tutti gli hook React prima di qualsiasi return condizionale

In RPC con RETURNS TABLE, qualificare sempre tabella.colonna

Verifica sempre l'utente loggato (admin vs demo)

Test su PROD dopo ogni push

PWA: forza hard reload dopo deploy (Cmd+Shift+R) o usa UpdateBanner

📂 FILE CORRELATI
TricoAI v2: /Users/luca/Desktop/Tricolab_v2/STATO.md

App Cliente: /Users/luca/Desktop/Tricolab/CLIENTE/app/ (repo Gestionale-cliente)

Gestionale: questo file

FINE FILE
