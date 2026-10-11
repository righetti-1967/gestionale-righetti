# STATO GESTIONALE RIGHETTI 1967
Ultimo aggiornamento: 11/10/2026 (notte)

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

## 📌 REGOLA FISSA INDIRIZZI

**Fatture, scontrini e privacy** (documenti fiscali/GDPR):
- Mostrare SEMPRE entrambi: **Sede Legale + Sede Operativa**

**Tutti gli altri documenti** (DDT, ordini fornitori, email, PDF, WhatsApp, promemoria, automazioni, schede, cura, percorsi, report, analytics):
- Usare **SOLO la Sede Operativa**
- Fallback: se Sede Operativa vuota → usa Sede Legale
- MAI la Sede Legale da sola

Nessuna eccezione. Se un documento mostra l'indirizzo sbagliato, non e' finito.

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
- **Backend TricoAI:** Python FastAPI (Railway)
- **Backend Gestionale:** Supabase Edge Functions (Deno)
- **DB:** Supabase PostgreSQL (RLS abilitato) + `pg_net` + `pg_cron`
- **Email:** Google Workspace HTTPS Relay (Apps Script)
- **WhatsApp:** Whatsender API (`api.whatsender.it/api/send`) con `mediaurl` per PDF
- **Push:** Web Push API + VAPID + Service Worker custom
- **Deploy:** Vercel (auto su push main)

**Ambiente unico:** PROD (sviluppo diretto in prod, no TEST)
**Supabase PROD:** `yporpszebtasalwazirz.supabase.co`
**Supabase TricoAI:** `fucagtrfydacobostdoa.supabase.co`

---

## 🔴 TODO — PRIORITÀ ALTA

### 1. Simulazioni Integrazioni Esterne (con toggle → reale)
**Concetto**: ogni integrazione parte in **modalità simulazione a video** (nessun invio reale ai sistemi esterni). Quando testata, un **toggle** passa a comunicazione **REALE**.

- ⏸️ **Stampa Scontrini RCH / Epson** → simulazione a video + toggle modalità reale
- ⏸️ **Collegamento ADE** (Agenzia Entrate) → fatture + scontrini, simulazione + toggle
- ⏸️ **Collegamento FPT** (fatturazione elettronica PA) → simulazione + toggle

### 2. Motore Cron Automazioni (invio reale)
**Stato**: 5 automazioni funzionanti in **dry-run** (con log + anteprima). Manca il motore cron per la modalità `automatico` (invio reale).

- ⏸️ **Cron ogni X min** → chiama `automazioni-runner` per automazioni in modalità `automatico`
- ⏸️ **Cron giornaliero** → post_seduta, compleanno, riattivazione
- ⏸️ **Cron orario** → promemoria_appuntamento, promemoria_checkup
- ⏸️ **Log reali** in `automazioni_log` con `modalita='reale'`

### 3. Cron Notifiche Push Tempo-Reale (già attivo, manca solo toggle UI)
**Stato**: i 5 trigger notifiche push (nuovo/confermato/cancellato/spostato/pending) sono **già attivi** con dry-run globale ON di default. Funziona ma va **verificato con dati reali** e poi disattivato il dry-run.

- ⏸️ **Test end-to-end** con cliente vero + notifica reale
- ⏸️ **Disattivare dry-run** quando confermato

### 4. Integrazione API Reali (da simulazioni)
Riferimento al punto 1.

---

## 🟡 TODO — PRIORITÀ MEDIA

### 5. App Cliente — Migliorie
- ⏸️ **Banner "Installa app"** in Home (se non installata)
- ⏸️ **Icona PWA dinamica per studio** (manifest sottodominio)

### 6. Rifiniture UI Automazioni
- ⏸️ **Log push con `(nessun cliente)`** → recuperare `client_nome` in `process_pending_notifiche`

---

## 🟢 TODO — PRIORITÀ BASSA

### 7. Sicurezza — Aggiunte
- ⏸️ **Conferma cambio regime documenti** (modale di conferma prima di salvare)
- ⏸️ **Log accessi/azioni critiche**
- ⏸️ **Timeout sessione inattività**

### 8. Performance
- ⏸️ Indici SQL su: `appuntamenti`, `clienti`, `fatture`, `scontrini`, `bozze`, `notifiche`

---

## ✅ STORICO — COMPLETATO

### 11/10/2026 — Notte (Manuali PDF + Fix finali)

#### 📖 Manuale Gestionale (PDF multi-tenant)
- ✅ **`docs/MANUALE-GESTIONALE.md`**: 15 capitoli completi
  - Introduzione, Setup, Clienti, Agenda, Percorsi, Fatture/DDT, Cassa, Magazzino, Automazioni, Integrazioni, Analytics, App Cliente, Sicurezza, FAQ
  - Sezione "In Arrivo: Chiamate AI Voice"
- ✅ **`app/public/manuale/manuale-gestionale.pdf`**: generato con HTML → Chrome Print
- ✅ **Impostazioni → Profilo**: card "📖 Manuale Utente" con pulsante download
- ✅ **Copertina generica** con logo 📖 (nessun riferimento a Righetti)
- ✅ **Multi-tenant**: URL generici (gestionale.tuostudio.it)

#### 📖 Manuale TricoAI (PDF multi-tenant)
- ✅ **`docs/MANUALE-TRICOAI.md`**: 9 capitoli
  - Introduzione, Setup, Analisi Tricoscopica, **Prodotti + INCI**, Clienti, Cura Domiciliare, Dashboard, Multi-tenant, FAQ
  - Sezione INCI dettagliata (4.1-4.5): come trovare INCI, generazione note AI, esempi
- ✅ **`public/manuale/manuale-tricoai.pdf`**: generato in stile Apple
- ✅ **TricoAI → Impostazioni → Profilo**: card "📖 Manuale Utente" con pulsante download
- ✅ **Assistenza**: luca.trainer@icloud.com

#### 🔧 Fix finali
- ✅ **Agenda**: refresh istantaneo pending/rebooking (visibilitychange + polling 30s mobile)
- ✅ **Cassa Fiscale**: lista scontrini ricarica subito dopo annullo (badge ANNULLATO + cestino)
- ✅ **Annullo scontrini figli** (2 step come fattura+DDT)
- ✅ **Cestino scontrini annullati** (`eliminaScontrinoAnnullato`)
- ✅ **Annullo fiscale** (nota credito ADE/FPT + RT) → log in `integrazioni_log`
- ✅ **Rifinitura UI automazioni**: recupero `client_nome` in `process_pending_notifiche` (log ora mostrano nome cliente invece di "(nessun cliente)")
- ✅ **PDF scontrini vecchi**: rigenerati (formato A4 → altezza dinamica)
- ✅ **INCI TricoAI**: popolati i 11 prodotti rimanenti con INCI + note AI generate

---

### 11/10/2026 — Pomeriggio/Sera

Vedi sezione "11/10/2026 — Pomeriggio" e "Sera" nel file originale (non duplicato qui per pulizia).

---


### 11/10/2026 — Sera (Annullo fiscale + DDT collegati + Cestino scontrini)

#### 🚨 Annullo fiscale documenti (nota credito + RT)
- ✅ **Nuova lib `annulloFiscale.ts`**:
  - `annullaFiscalmente()` per fatture, scontrini fisici, scontrini digitali
  - Modalità `simulazione` → log `esito='simulato'` in `integrazioni_log`
  - Modalità `reale` → log `esito='pending_driver'` (driver non ancora collegato)
  - Blocca se provider fiscale non configurato
  - Tipi log: `nota_credito` / `annullo_scontrino_rt` / `annullo_corrispettivi`
- ✅ **`fatture.ts`**: `annullaFattura` chiama `annullaFiscalmente` dopo soft-delete
- ✅ **`scontrini.ts`**: `annullaScontrino` chiama `annullaFiscalmente` per MADRE
- ✅ **DB**: nuovi campi `annullo_fiscale_at` / `esito` / `note` su `fatture` + `scontrini`
- ✅ Test PROD: annullo fattura → log `nota_credito` + `simulato` correttamente

#### 🔗 Annullo fattura con DDT collegati (2 step)
- ✅ **`ScaricoSeduta`** estesa con campi `annullato` + `annullato_at` + motivo + da
- ✅ **`DettaglioFattura.tsx`**: pulsante 🚫 Annulla carica DDT collegati attivi
- ✅ **Modale 2 step**:
  - **Step 1** → lista DDT con checkbox (tutti selezionati) + password + motivo
  - Pulsante "📦 Annulla N DDT e procedi"
  - **Step 2** → conferma annullo fattura (password già verificata)
  - Pulsante "🚫 Confermo annullo fattura"

#### 🗑️ Cestino scontrini annullati
- ✅ **`eliminaScontrinoAnnullato(id)`** in `scontrini.ts`:
  - Solo scontrini annullati
  - Blocca madre con figli attivi
  - Elimina righe scontrino collegate
- ✅ **`CassaFiscale.tsx`**: pulsante 🗑️ visibile SOLO su scontrini annullati
- ✅ Modale conferma "IRREVERSIBILE"
- ✅ Badge `ANNULLATO` già visibile

#### 📸 INCI Prodotti TricoLab v2 (bonus pomeriggio)
- ✅ **Scoperto**: TricoLab v2 su Railway (`righetti-1967-tricolab-v2`) è il progetto attivo
- ✅ **Vecchio TricoLab** (Streamlit) archiviato
- ✅ **DB Supabase TricoAI** esteso: `prodotti.inci` + `principi_attivi` + `azioni_estratte` + `inci_aggiornato_at`
- ✅ **Backend FastAPI**: endpoint `POST /api/gemini/genera-nota-prodotto`
  - Routing Vertex (Righetti) / Groq (demo)
  - Parametro `skip_regole_densita` per prompt INCI-only
  - Fix parsing Vertex: ritorna dict per qualsiasi JSON valido
- ✅ **Frontend React**: campo INCI + pulsante "✨ Genera nota da INCI con AI"
- ✅ **Test PROD funziona**: AI genera note simili alle esistenti
- ✅ **INCI dei prodotti Righetti estratti dal PDF** (11 prodotti + 3 mancanti)
- ✅ **TODO**: popolare INCI rimanenti + foto per CEROTUM/INTEGRATORE/PROBIOTICO

---


### 11/10/2026 — Pomeriggio (Privacy GDPR + App Cliente + Dashboard)

#### 🔴 Fix critici
- ✅ **Fix trigger notifiche push** (drop funzione `crea_notifica_cliente` duplicata)
  - Erano presenti 2 versioni in conflitto (8 + 9 parametri) → errore `function is not unique`
  - **Effetto**: scontrini, DDT, fatture, privacy, schede, cura, percorsi, note → ora tutti generano notifiche
  - Trigger mancanti aggiunti: `trg_notify_scontrino_pdf` + `trg_notify_ddt_pdf`
- ✅ **Fix RLS bucket `privacy-pdf`** → INSERT/UPDATE ora consentiti ad anon
  - Prima solo `{authenticated}` → la firma privacy da link anonimo falliva silenziosamente
  - **Effetto**: PDF privacy si carica + trigger privacy scatta + notifica arriva al cliente
- ✅ **Fix navigazione "Vedi in Agenda"** dalla notifica conferma (anche se Agenda già montata)

#### 🏖️ Chiusure Straordinarie (Agenda)
- ✅ Interface `ChiusuraStraordinaria` in `agenda-config.ts`
- ✅ Helper `getChiusuraInData()` + `isDataChiusa()`
- ✅ **Impostazioni → Agenda**: nuova Card **"🏖️ Chiusure Straordinarie"**
  - Aggiungi/modifica/elimina con modale
  - Badge stato: In corso / Programmata / Passata
- ✅ **Agenda Giornaliera**: giorni chiusi → banner arancione + slot grigi/bloccati
- ✅ Click su slot chiuso → alert con motivo e date

#### 🔔 Notifica in-app conferma appuntamento (Gestionale)
- ✅ Campo DB `appuntamenti.confermato_da_cliente_at` (distingue conferma cliente vs studio)
- ✅ RPC `cliente_conferma_appuntamento` setta il timestamp
- ✅ Componente `NotificaConfermaCliente.tsx`:
  - Ascolta Realtime UPDATE su `appuntamenti`
  - Toast centro schermo con nome cliente + data/ora
  - Pulsante "Vedi in Agenda" → naviga + salta alla data
  - **Persistente** (no auto-dismiss)
- ✅ Listener custom event `navigate-to-page` + `agenda-vai-a-data` in `App.tsx` / `Agenda.tsx`

#### 📄 Privacy GDPR — Versioning
- ✅ `ConfigPrivacy` esteso con `versione` + `dataVersione`
- ✅ Helper `incrementaVersione()` + `isPrivacyObsoleta()`
- ✅ **Impostazioni → Privacy**: badge versione corrente + pulsante **"🚀 Pubblica nuova versione"**
  - Modale scelta minor/major con anteprima
- ✅ **`salvaFirmaPrivacy`** salva `privacy_versione_firmata` automaticamente
- ✅ **Clienti.tsx**: badge **"⚠️ Privacy obsoleta"** + versione firmata visibile
- ✅ **FormNuovoAppuntamento**: modale avviso se cliente ha privacy obsoleta
  - "Vai a far rifirmare privacy" / "Procedi comunque" / "Annulla"
- ✅ **Dashboard**: badge **"⚠️ X da rifirmare"** nella card "Clienti Totali"
  - Click → naviga a Clienti con filtro `privacy_obsoleta`
- ✅ **Clienti.tsx**: filtro `privacy_obsoleta` per lista filtrata

#### 🎁 Pulsante "Rimuovi firma privacy"
- ✅ In `Clienti.tsx`: pulsante accanto a "Anteprima" / "Ristampa PDF"
- ✅ Rimuove firma dal DB + PDF da Storage
- ✅ Utile se cliente ha firmato per sbaglio o vuole rifirmare

#### 📱 App Cliente
- ✅ **Card "Aperture e chiusure Studio"** nella griglia Home + pallino ambra
- ✅ **Pagina `/aperture-chiusure`**: orari + chiusure in tab mesi
- ✅ **Pulsante "Aggiungi al calendario"** su appuntamenti futuri prenotati/confermati
  - Utility `generaICS.ts` (RFC 5545)
  - 3 promemoria (72h/48h/24h)
  - Location studio → tap apre Maps
  - Titolo: `Appuntamento - Righetti Since 1967`
  - Badge verde "✅ Aggiunto" persistente (localStorage)
  - Pulizia automatica ID non più validi
- ✅ RPC `get_my_studio_contatti` estesa con `nome_studio` + `orari` + `chiusure`

---


### 11/10/2026 — Mattina (Fix notifiche push + Chiusure straordinarie + App Cliente)

#### 🔴 FIX CRITICO — Trigger notifiche push non funzionanti
**Scoperta**: esistevano **2 versioni** di `crea_notifica_cliente` in conflitto:
- **8 parametri** (senza `p_staff_user_id`) — vecchia
- **9 parametri** (con `p_staff_user_id`) — nuova

**Conseguenza**: quando il trigger chiamava senza cast esplicito → errore `function is not unique` → **tutte le notifiche fallivano silenziosamente** (scontrini, DDT, fatture, privacy).

**Fix**: droppata la versione vecchia → ora solo 1 versione → tutti i trigger funzionano.

**Trigger mancanti aggiunti**:
- ✅ `trg_notify_scontrino_pdf` su `scontrini` (UPDATE pdf_url)
- ✅ `trg_notify_ddt_pdf` su `scarichi_seduta` (UPDATE pdf_url)

**Trigger verificati funzionanti** (dopo fix):
- ✅ `appuntamenti` INSERT/UPDATE
- ✅ `fatture` UPDATE pdf_url
- ✅ `clienti` UPDATE privacy_pdf_url
- ✅ `cliente_note` INSERT
- ✅ `cura_domiciliare` INSERT
- ✅ `schede_tricologiche` INSERT
- ✅ `percorsi` INSERT
- ✅ `scontrini` UPDATE pdf_url (NUOVO)
- ✅ `scarichi_seduta` UPDATE pdf_url (NUOVO DDT)

**Effetto**: ora il cliente riceve notifica push per **tutti** i nuovi documenti (fatture, scontrini, DDT, privacy, schede, cura, percorsi, note).

#### 🏖️ Chiusure Straordinarie (Agenda)
- ✅ `agenda-config.ts`: interface `ChiusuraStraordinaria` + campo `chiusureStraordinarie`
- ✅ Helper `getChiusuraInData()` + `isDataChiusa()`
- ✅ **Impostazioni → Agenda**: nuova Card **"🏖️ Chiusure Straordinarie"**
  - Aggiungi/modifica/elimina con modale (data inizio/fine + motivo)
  - Badge stato: In corso / Programmata / Passata
- ✅ **Agenda Giornaliera**: giorni chiusi → banner arancione + slot tutti grigi/bloccati
- ✅ Click su slot chiuso → alert con motivo e date

#### 🕐 Card "Aperture e chiusure Studio" (App Cliente)
- ✅ RPC `get_my_studio_contatti` estesa con `orari` (JSONB) + `chiusure` (JSONB)
- ✅ Interface TS `StudioContatti` aggiornata
- ✅ **Home App Cliente**: nuova card con **badge alert** se chiusure nel mese corrente
- ✅ **Nuova pagina `/aperture-chiusure`**:
  - Orari di apertura (solo giorni aperti)
  - Chiusure straordinarie con **tab mesi**
  - Tab con pallino ambra se mese ha chiusure
  - Chiusure a cavallo (es. Natale) appaiono in entrambi i mesi

#### 📝 Note / TODO per il futuro
- ⚠️ **PDF privacy NON viene caricato** in Storage (campo `privacy_pdf_url` resta null anche dopo firma) → da indagare
- ⚠️ **PDF scontrini vecchi** (pre-11/10) hanno formato A4 lungo (fix applicato solo ai nuovi)

---


### 11/10/2026 — Sessione Mostro (Simulazioni + Notifiche Push + Orari Operatore)

#### Simulazioni Integrazioni Esterne (Priorità 1-2-3) ✅
- ✅ **Stampa Scontrini RCH/Epson** — simulazione + toggle reale
  - `configFiscale.ts` esteso con `modalita: 'simulazione' | 'reale'`
  - `stampanteFiscale.ts` nuova lib `inviaAStampante()`
  - `ModaleConfigFiscale.tsx` selettore 🧪/🔴 + modale conferma `CONFERMO`
  - `StampaScontrino.tsx` badge dinamico + pulsante "Simula/Invia"
- ✅ **Collegamento ADE** — fatture + scontrini (simulazione + toggle)
- ✅ **Collegamento FPT** — fatturazione elettronica (simulazione + toggle)
- ✅ **`fatturazioneElettronica.ts`** nuova lib `inviaFatturaAlProvider()`
- ✅ **`DettaglioFattura.tsx`** badge 🧪/🔴 + pulsante "📤 Invia a SDI/FPT"

#### Log Integrazioni (nuova feature) ✅
- ✅ **Tabella `integrazioni_log`** (generica per tutte le integrazioni)
- ✅ **RLS multi-tenant** (Opzione Y): Righetti vede tutto, altri solo i propri, clienti bloccati
- ✅ **Componente `IntegrazioniLogTab.tsx`** in Impostazioni → Fatturazione
- ✅ Filtri (tipo/modalità/esito/giorni) + payload espandibile + pulisci/elimina

#### Fix bug vari ✅
- ✅ **`config_fiscale.updated_at`** mancante (bug bloccante salvataggio)
- ✅ **Modale conferma cambio regime** (Fatture ↔ Scontrini)
- ✅ **5 indici SQL performance** (appuntamenti, fatture, scontrini, clienti)
- ✅ **Badge Pending Agenda** — conta TUTTI i pending futuri (RPC `get_pending_appuntamenti`)
- ✅ **Clienti Pending** — raggruppati per cliente con riga espandibile (Opzione C)
- ✅ **Tab Test Automazioni** ripristinata in fondo a Automazioni (stile Card)

#### Notifiche Push — Fix + Titoli personalizzati ✅
- ✅ **Fix trigger UPDATE**: `WHEN` ora include cambio data/ora (spostamento stesso giorno funziona)
- ✅ **Fix trigger INSERT**: gestisce stato `pending` → notifica "In attesa" (non più "Confermato")
- ✅ **5 titoli con primo nome cliente**:
  - `appuntamento_nuovo` → "Confermato Paolo"
  - `appuntamento_pending` → "In attesa Paolo"
  - `appuntamento_confermato` → "Grazie Paolo"
  - `appuntamento_spostato` → "Riprogrammato Paolo"
  - `appuntamento_cancellato` → "Annullato Paolo"

#### App Cliente ✅
- ✅ **`short_name`** → `Righetti` (era "Area Riservata") — from Righetti nelle notifiche
- ✅ **Pulsante "📱 Installa l'App"** in Welcome + istruzioni iOS/Safari
- ✅ **Pulsante "✅ Conferma appuntamento"** in Appuntamenti
  - RPC `cliente_conferma_appuntamento()` in Supabase
  - Trigger UPDATE genera automaticamente notifica "Grazie Paolo"
- ✅ **Operatore con nome** (op2 → Lorenzo) nelle RPC `get_my_appuntamenti` + `get_my_next_appuntamento`

#### WhatSender — Audit completo ✅
Tutti i pulsanti WhatsApp usano `inviaWhatsAppSmart` (WhatSender + fallback `wa.me`):
- ✅ `whatsapp.ts` esteso: supporta testi senza PDF
- ✅ `Agenda.tsx` (Pending)
- ✅ `ModalePromemoria.tsx`
- ✅ `ModaleInviaTemplate.tsx`
- ✅ `CondividiLinkFirma.tsx`
- ✅ `AppClienteTab.tsx` (invito)
- ✅ `Clienti.tsx` (privacy con PDF GDPR allegato)
- ✅ `DettaglioAppuntamento.tsx` (promemoria)

#### Ordini Magazzino ✅
- ✅ **Selezione multipla prodotti** in `FormNuovoOrdine.tsx`
- ✅ Checkbox + pulsante "+" per aggiunta rapida singola
- ✅ "Seleziona tutti visibili" + "📦 Aggiungi N prodotti"

#### Orari Personalizzati per Operatore ✅
- ✅ **`OperatoreConfig`** esteso con `orariGiorni` + `usaOrariGlobali`
- ✅ **Helper** `getOrariOperatoreGiorno()` + `isOperatoreDisponibile()`
- ✅ **UI Impostazioni → Agenda**: pulsante 🕐 Orari per operatore
- ✅ **Card espandibile** con checkbox "Usa orari globali della sede"
- ✅ **Tabella 7 giorni** con fasce multiple (multi-fascia per giorno)
- ✅ **Modale giorno operatore** (riusa pattern globale)
- ✅ **Agenda Giornaliera**: slot disabilitati fuori orario operatore + avviso drag&drop
- ✅ **Persistenza** (`adatta()` legge `orariGiorni` + `usaOrariGlobali`)

---


### 10/10/2026 — Pomeriggio (Logo neutro multi-tenant)

#### Asset neutri per utenti non-Righetti
**Concetto**: Righetti (`righetti@righetti.club`) vede sempre il suo logo ovunque. Tutti gli altri utenti (demo + reali) non devono **mai** vedere il logo Righetti: se non caricano un loro logo, vedono icone neutre brand-agnostiche.

- ✅ **Gestionale**: icone neutre **"GS" bianco su blu** (`#007AFF`) → `favicon.svg`, `icon-192.png`, `icon-512.png` in `public/`
- ✅ **TricoAI**: icone neutre **"TG" blu su bianco** (`#007AFF`) → `favicon.svg`, `icon-192.png`, `icon-512.png` in `public/`
- ✅ **App Cliente**: icone neutre **arancione + chiave** (già esistenti) → `favicon-32.png`, `apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png`
- ✅ **Rimosso** `public/logo.png` (vecchio logo Righetti statico) da Gestionale
- ✅ **Rimosso** `public/logo.png` + `public/logo-tricoai.png` da TricoAI
- ✅ **Rimosso** `public/icons.svg` da Gestionale

#### Fallback neutro nel codice
- ✅ **Gestionale `logo.ts`**: `LOGO_DEFAULT = '/favicon.svg'` (neutro) invece di `/logo.png` (Righetti)
- ✅ **`getLogoUrl()`**: utente non-Righetti senza logo → ritorna `/favicon.svg` (neutro)
- ✅ **`caricaLogoBase64()`**: fallback neutro anche per PDF di utenti non-Righetti (mai logo Righetti)
- ✅ **TricoAI**: 6 file patchati (`Sidebar.tsx`, `Login.tsx`, `Registrati.tsx`, `ResetPassword.tsx`, `EmailConfermata.tsx`, `ForgotPassword.tsx`) → `setLogoUrl(d.logo_url || '/favicon.svg')`

#### Favicon dinamica (tab browser)
- ✅ **Gestionale**: nuovo componente `DynamicFavicon.tsx` montato in `App.tsx`
  - Al login legge `getLogoUrl()` e aggiorna la favicon
  - Ascolta evento `datiAziendali-aggiornati` → aggiorna in tempo reale
- ✅ **App Cliente**: già esistente (`DynamicFavicon.tsx`) usa `getStudioLogo()` da RPC

#### Fix backend Licenze (FastAPI Railway)
- ✅ **`licenze.py`**: la tab Licenze mostrava anche i **clienti App Cliente** (es. `lostilerhs@gmail.com`) come "utenti demo"
- ✅ Aggiunta funzione `_get_clienti_app_cliente_uuid(supabase)` → legge `client_users.auth_user_id`
- ✅ Patch `lista_utenti()` → **salta** gli auth_user_id presenti in `client_users`
- ✅ Deploy su Railway → ora la tab Licenze mostra **solo staff + demo**

#### Fix backend mancante (in sospeso?)
- ⚠️ Da verificare se il fix Railway è già deployato in PROD (patch file pronta, ma serve conferma)

#### Icone PWA — limitazione residua
- ℹ️ L'icona PWA **installata** (Dock Mac, Home iPhone) è **statica** → uguale per tutti (Gestionale: "GS" blu; TricoAI: "TG"; App Cliente: arancione+chiave)
- ℹ️ Se Righetti vuole vedere il **suo** logo sull'icona PWA installata → serve Livello 3 (canvas + manifest dinamico, complesso)
- ℹ️ Attualmente: Righetti vede il suo logo **dentro** l'app (sidebar, PDF, email, favicon tab) ✅, ma sull'**icona PWA installata** vede l'icona neutra

---

### 10/10/2026 — Notte (Automazioni + WhatsApp + Fix UI)

#### Automazioni Dry-Run — Estensione a 5 automazioni
- ✅ **Nuove 3 automazioni** in Edge Function `automazioni-runner`:
  - 📸 **Post-Seduta** → dopo X min/ore/giorni da `appuntamenti.completato_at`
  - 🎂 **Compleanno** → X giorni prima di `clienti.data_nascita`
  - 💤 **Riattivazione** → clienti con ultimo appuntamento > N giorni
- ✅ **Dropdown + pulsanti dry-run** in `AutomazioniTestTab` (5 automazioni)
- ✅ **Deduplicazione**: post_seduta (per appuntamento_id), compleanno (per cliente+anno), riattivazione (per cliente+intervallo)

#### Template Fattura + DDT
- ✅ **`email_fattura` + `whatsapp_fattura`** in `testiTemplate.ts`
- ✅ **`email_ddt` + `whatsapp_ddt`** in `testiTemplate.ts`
- ✅ **Tab Testi Messaggi**: Email (12) + WhatsApp (8)

#### Invio Documenti via Whatsender (PDF allegato)
- ✅ **Edge Function `send-whatsapp`** → upload PDF su Storage + chiamata Whatsender API con `mediaurl`
- ✅ **Fattura**: pulsante 💬 WhatsApp → PDF allegato
- ✅ **DDT**: pulsante 💬 WhatsApp → PDF allegato
- ✅ **Scontrino**: pulsante 💬 WhatsApp → PDF allegato
- ✅ **Utility `inviaWhatsAppSmart`** in `src/lib/whatsapp.ts` → fallback automatico a `wa.me` con link PDF se Whatsender non configurato
- ✅ **Email**: PDF sempre allegato (invariato)

#### Variabile `{nome_studio}`
- ✅ Aggiunta in **tutti i template** (`VARIABILI_PER_CHIAVE`)
- ✅ Passata in tutti i `renderTemplate` (fattura, DDT, scontrino, promemoria, automazioni)

#### Box informativi in Impostazioni → Comunicazioni
- ✅ **WhatSender**: link a `api.whatsender.it` + istruzioni
- ✅ **Google Workspace**: link a `workspace.google.fr/business/signup` + istruzioni

#### Fix bug Agenda — Click cella precompila data/ora
- ✅ Fix A: `key` dinamica su `<FormNuovoAppuntamento>` (force remount)
- ✅ Fix B: `useEffect` sync per data/ora/operatore
- ✅ Fix C: `useDraft` non sovrascrive più data/ora quando apri da click su cella (`!dataIniziale && !oraIniziale`)

#### Fix bug Sidebar mobile
- ✅ Scroll funzionante su iPhone (`overflow-y-auto` su `<aside>`)
- ✅ Logo trasparente su Chrome (fix `translateZ(0)` + `bg-apple-lightgray` sul container)
- ✅ Logo dinamico nella sidebar (`getLogoUrl()` invece di `d.logo_url`)

#### Fix bug notifiche push spostamento appuntamento
- ✅ `spostaAppuntamento` ora traccia `rebooking_da_id = originale.id`
- ✅ Trigger INSERT: se `rebooking_da_id` valorizzato → notifica "spostato"
- ✅ Trigger UPDATE: skip "cancellato" se `motivo_cancellazione='spostamento'`

---

### 09/10/2026 — Sessione MOSTRO (TricoAI → App Cliente + Push)

#### Integrazione TricoAI → Gestionale → App Cliente
- ✅ **Edge Function `import-tricoai-pdf`** (Deno) → riceve PDF da TricoAI, salva su Storage + DB PROD
- ✅ **Secret condiviso** `TRICOAI_IMPORT_SECRET` (Supabase + Railway)
- ✅ **Patch TricoAI backend** → invio automatico PDF Report + Cura
- ✅ **Fix SICUREZZA** → match cliente via **email univoca** (mai nome)
- ✅ **Tabelle** `schede_tricologiche` + `cura_domiciliare` + RLS + RPC
- ✅ **Bucket Storage** `schede-tricologiche` + `cura-domiciliare` (pubblici)
- ✅ **RPC App Cliente** `get_my_schede()`, `get_my_cura_domiciliare()`
- ✅ **Pagine App Cliente** `/schede` + `/cura-domiciliare`
- ✅ **Timestamp univoco** nei nomi file PDF (evita sovrascrittura cache)

#### Sistema Notifiche Push AUTOMATICHE
- ✅ **8 trigger DB** → creano notifiche in `notifiche`:
  - `cliente_note` INSERT
  - `schede_tricologiche` INSERT
  - `cura_domiciliare` INSERT
  - `appuntamenti` INSERT
  - `appuntamenti` UPDATE stato (confermato/cancellato)
  - `fatture` UPDATE pdf_url
  - `clienti` UPDATE privacy_pdf_url
  - `percorsi` INSERT
- ✅ **Funzione generica** `crea_notifica_cliente()` (con `dedup_key`)
- ✅ **Cron `pg_cron`** ogni 1 min → `process_pending_notifiche()`
- ✅ **`pg_net`** chiama Edge Function `send-push`
- ✅ **Marcatura letta automatica** quando clicchi la notifica (`?notifica_id=xxx`)
- ✅ **Badge Home aggiornato** in tempo reale (evento `notifiche-lette`)
- ✅ **Service Worker** aggiornato → aggiunge `notifica_id` all'URL al click

#### Toggle Notifiche Push (impostazioni)
- ✅ **5 toggle**: nuovo, confermato, cancellato, spostato, pending
- ✅ **Dry-run globale** toggle
- ✅ **Card in cima a Impostazioni → Automazioni**
- ✅ **Config salvata in `push_automazioni_config`**

#### Automazioni Dry-Run — Fase 1 (2 automazioni)
- ✅ **Modalità 🧪 Simulazione** in `ModalitaAutomazione`
- ✅ **Edge Function `automazioni-runner`** deployata
- ✅ **2 automazioni**: Promemoria Appuntamento + Promemoria Check-Up (`servizio_id=2`)
- ✅ **Tabella `automazioni_log`** + policy RLS + RPC
- ✅ **UI `AutomazioniTestTab`**: filtri + anteprima + 🗑️ riga + 🧹 pulisci
- ✅ **Template `whatsapp_promemoria_checkup`** in Testi Messaggi

#### Cestino Notifiche Push (App Cliente)
- ✅ **Soft-delete notifiche** (`eliminata_at`, `eliminata_da`, `eliminata_motivo`)
- ✅ **RPC `admin_elimina_notifica`** + patch `admin_list_notifiche_cliente` (filtra cancellate)
- ✅ **UI 🗑️** in App Cliente → Gestisci

#### Sync clienti bidirezionale Gestionale ⇄ TricoAI
- ✅ **Fix CRITICO** sync T→G (era invertito, scriveva su TricoAI)
- ✅ **Rimosso skip** su `matched_t_ids` → anche clienti collegati vengono valutati
- ✅ **Soft-delete clienti** con motivo + propagazione sync
- ✅ **Fix form cliente** (bug AAAA BBBB → Pacilio, `useDraft` inappropriato)
- ✅ **`user_id` popolato** su TricoAI (clienti visibili nel frontend)

#### Email Promemoria
- ✅ **Bottone WhatsApp stile Apple** nell'email (bianco + bordo verde)
- ✅ **Footer email** usa sede operativa
- ✅ **Campo `Nome Studio`** + `WhatsApp` in Impostazioni → Azienda
- ✅ **`formatDataEstesa`** capitalizza + orario ("Venerdì 9 Ottobre 2026 alle ore 12:45")

#### App Cliente
- ✅ **DDT senza importo** (importo solo nel PDF, non nell'App)

#### Fix Bug Vari
- ✅ Typo `righeIntermo` → `righeInterno` in `promemoria.ts`
- ✅ `aggiornaCliente` aggiorna `updated_at` (per sync)

---

### 08/10/2026 — App Cliente PWA + Notifiche Push (base)

- ✅ **App Cliente PWA** completa (Login, Invite, Callback, Welcome, Home, Documenti, Note, Appuntamenti, Percorsi, Privacy, Profilo, Notifiche, Attiva Notifiche)
- ✅ **Auth magic link** + sessione in cookie (iOS 17.2+)
- ✅ **RLS + RPC App Cliente** (`is_client()`, `is_staff()`, `current_client_id()`, ecc.)
- ✅ **Tab App Cliente** in Impostazioni Gestionale (7 toggle visibilità moduli)
- ✅ **Note studio → cliente** (badge rosso, modale lettura)
- ✅ **Sistema notifiche push base** (tabelle + Edge Function `send-push` + VAPID)
- ✅ **Fix React error #310** (Agenda, Testi Messaggi, FormPercorso, FormOrdine)
- ✅ **UpdateBanner PWA** (banner "Nuova versione disponibile" → update 1-click)
- ✅ **Upload PDF automatico** con righe e path corretto su Storage

### 06-07/10/2026 — Pulizia + Fix

- ✅ Fix upload PDF (fatture, scontrini, DDT) — path `<client_id>/<anno>/<nome_file>.pdf`
- ✅ Fix RLS Storage `fatture-pdf` (INSERT/UPDATE)
- ✅ Fix RPC `get_my_note` (mancava campo `letta`)
- ✅ Fix tab Prodotti/Servizi/EXTRA in Storico cliente
- ✅ Fix `main.tsx` TricoAI (mancavano `<BrowserRouter>` + `<AuthProvider>`)

### Precedenti (completati prima del 06/10)

- ✅ **Agenda**: Vista Settimanale adattiva + Vista Mensile adattiva
- ✅ **Cassa Fiscale**: Chiusura giornaliera con fondo, Export CSV scontrini, Tastiera numerica touch-friendly
- ✅ **Report Analytics**: Ranking clienti per spesa, Export PDF A4, Upload PDF commercialista
- ✅ **Config Fiscale**: ModaleConfigFiscale (`configFiscale.ts`, `ModaleConfigFiscale.tsx`)
- ✅ **Sicurezza base**: Password gestionale hash SHA-256, SicurezzaTab, reset sicurezza
- ✅ **Annullo Fatture/DDT**: soft-delete con motivo min 10 caratteri, blocco DDT collegati

---

## 📋 NOTE TECNICHE

### Tabella `bozze` (persistenza multi-device)
- Chiave: `user_id` + `chiave_draft` (UNIQUE)
- Payload: JSONB
- Hook: `src/lib/useDraft.ts`
- **REGOLA**: hook sempre PRIMA di qualsiasi `return` condizionale

### Storage Buckets (PROD)
- `azienda` (pubblico) → logo azienda
- `avatars` (pubblico) → foto profilo
- `scontrini-pdf` (pubblico)
- `fatture-pdf` (pubblico)
- `scarichi-pdf` (pubblico)
- `privacy-pdf` (pubblico)
- `schede-tricologiche` (pubblico)
- `cura-domiciliare` (pubblico)

### App Cliente — Tabelle chiave
- `client_users`: `auth_user_id uuid` ↔ `client_id bigint`
- `client_portal_settings`: 7 toggle visibilità + `is_blocked`
- `client_invites`: token + `action_link`
- `cliente_note`: note studio → cliente
- `clienti.tricoai_id uuid`: collegamento TricoAI

### Notifiche Push — Schema finale
- **Tabelle**: `push_subscriptions`, `notifiche`, `push_automazioni_config`
- **Trigger attivi (8)**: vedi STORICO 09/10
- **Cron `pg_cron`**: `process-notifiche-every-minute` (`* * * * *`)
- **pg_net** chiama `send-push` con `{ notifica_id, titolo, messaggio, priorita, url }`
- **Edge Function `send-push`** → Web Push Protocol, payload include `notifica_id`
- **Service Worker** → apre URL `?notifica_id=xxx`
- **AppLayout** → legge `?notifica_id`, marca letta, dispatch evento `notifiche-lette`
- **Home** → ascolta evento + focus + auto-refresh 60s → aggiorna badge
- **Notifiche tempo-reale**: 5 toggle in `push_automazioni_config` (dry_run globale default ON)
- ⚠️ iOS 16.4+ richiede PWA installata
- ⚠️ Prompt autorizzazione solo dopo azione utente

### Automazioni Dry-Run — Schema
- **Tabella `automazioni`** (5 righe per utente):
  - `tipo`: `promemoria_appuntamento` | `promemoria_checkup` | `post_seduta` | `compleanno` | `riattivazione`
  - `attivo` (bool), `modalita` ('manuale' | 'simulazione' | 'automatico'), `parametri` (JSONB)
- **Tabella `automazioni_log`**: chiave, modalita, esito, client_*, canale, oggetto, corpo_html/testo, metadata
- **Edge Function `automazioni-runner`** (5 chiavi supportate)
- **RPC `admin_list_automazioni_log`**, `admin_elimina_automazione_log`, `admin_pulisci_automazioni_log`

### Loghi e Asset Neutri (multi-tenant)
**Obiettivo**: `righetti@righetti.club` vede sempre il suo logo. Tutti gli altri utenti (demo + reali) vedono:
- **Il loro logo** se caricato in Impostazioni → Azienda
- **Icona neutra brand-agnostica** se non hanno caricato nulla (mai Righetti)

| Progetto | Asset neutro | Dove sta | Fallback codice |
|---|---|---|---|
| **Gestionale** | "GS" bianco su blu `#007AFF` | `public/favicon.svg` + `icon-192.png` + `icon-512.png` | `logo.ts → LOGO_DEFAULT = '/favicon.svg'` |
| **TricoAI** | "TG" blu `#007AFF` su bianco | `public/favicon.svg` + `icon-192.png` + `icon-512.png` | 6 file `.tsx` → `setLogoUrl(d.logo_url \|\| '/favicon.svg')` |
| **App Cliente** | Arancione `#FF9500` + chiave 🔑 | `public/favicon-32.png` + `apple-touch-icon.png` + `pwa-192x192.png` + `pwa-512x512.png` | `DynamicFavicon.tsx → DEFAULT_ICON = '/favicon-32.png'` |

**Favicon dinamica tab browser**:
- Gestionale: `src/components/DynamicFavicon.tsx` (montato in `App.tsx`)
- TricoAI: n/a per ora
- App Cliente: `src/components/DynamicFavicon.tsx` (già esistente)

**Logica RPC/Storage del logo**:
- Gestionale/TricoAI: Supabase Storage bucket `azienda` + path `{user_id}/logo.png` (o `logo.png` per Righetti)
- App Cliente: RPC `get_my_studio_logo()` → ritorna URL pubblico del logo dello studio

**Limite residuo**:
- L'**icona PWA installata** (Dock Mac, Home iPhone) è **statica** → vedi "GS" o "TG" o "arancione+chiave" anche se loggato come Righetti. Non si può rendere dinamica senza Livello 3 (canvas + manifest blob, complesso e instabile su iOS).

### Edge Functions Supabase
- `generate-invite-link` → magic link
- `send-push` → notifiche push
- `import-tricoai-pdf` → import PDF da TricoAI
- **`send-whatsapp`** → invio WhatsApp con PDF allegato (Whatsender API)
- **`automazioni-runner`** → esecuzione automazioni (dry-run + reale)
- Deploy: `supabase functions deploy <nome>`
- Setup: `supabase login` + `supabase link --project-ref yporpszebtasalwazirz`
- Secrets: `supabase secrets set CHIAVE="valore"`

### Backend FastAPI (Railway) — Gestionale
- Path locale: `/Users/luca/Desktop/Tricolab/GESTIONALE/backend/`
- File chiave: `app/routers/licenze.py` (gestione licenze demo/reali)
- Endpoint: `GET /api/licenze/utenti`, `POST /api/licenze/proroga`, `POST /api/licenze/sblocca-reale`, `POST /api/licenze/popola-demo`
- **IMPORTANTE**: `lista_utenti()` esclude gli auth_user_id presenti in `client_users` (clienti App Cliente) → NON devono apparire nella tab Licenze
- Deploy: Railway (auto su push GitHub)

### Integrazioni Esterne (attive)
- **Whatsender**: `https://api.whatsender.it/api/send` (POST body: receiver, msgtext, token, mediaurl)
- **Google Workspace**: Webhook Relay Apps Script
- **Config salvata in**: `impostazioni.config_whatsapp` (`{ token, phone }`) e `impostazioni.config_email`

### ⚠️ Comandi Terminal
- Se venv attivo oscura PATH → usa `deactivate` prima di `supabase`
- `supabase login` → salva token in `~/.supabase/access-token`
- Su zsh: usare apici singoli per path con caratteri speciali (`'path con (parentesi)'`)

### PWA Auto-Update (UpdateBanner)
- `registerType: 'prompt'` + `strategies: 'injectManifest'`
- Service Worker custom `src/sw.ts`
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
Note sparse
Annullo Fatture/DDT: password in Sicurezza (SHA-256), motivo min 10 caratteri, soft-delete (annullato_at, annullato_motivo, annullato_da)

Blocco DDT collegati: annullare prima i DDT

Email professionale: src/lib/emailWrapper.ts → wrapEmailHtml(corpo, azienda)

Appuntamenti — Stati: prenotato, confermato, pending, completato, cancellato

Fatture cliente: proforma visibili ma non cliccabili; pagate visibili e cliccabili

Upload PDF: sempre al momento della creazione/emissione, mai condizionato al download

Righe incluse: ricaricare con select *, righe:tabella_righe(*)

🎯 PRINCIPI DI SVILUPPO
Nessuna feature senza responsive (desktop/tablet/mobile)

Test in PROD prima di dire "fatto"

Backup automatico prima di modifiche critiche (_backup/)

Commit piccoli e chiari (un fix = un commit)

Deploy frequenti (Vercel automatico)

Realtime quando serve (Agenda, Cassa)

Multi-device quando serve (bozze + realtime)

Tutti gli hook React prima di qualsiasi return condizionale

In RPC con RETURNS TABLE, qualificare sempre tabella.colonna

Verifica sempre l'utente loggato (admin vs demo)

Test su PROD dopo ogni push

PWA: hard reload dopo deploy (Cmd+Shift+R) o usa UpdateBanner

Upload PDF: sempre fuori da if (scarica) — mai condizionato al download

MATCH CLIENTE: mai solo per nome, sempre email o email+nome+cellulare

PDF Storage: nomi file con timestamp univoco (evita cache)

WhatsApp invio: sempre via inviaWhatsAppSmart (fallback automatico se Whatsender non configurato)

Logo utente: mai mostrare logo Righetti ad altri utenti. Usa sempre getLogoUrl() per Gestionale/TricoAI o getStudioLogo() per App Cliente. Fallback neutro obbligatorio.


---

## 🔮 BACKLOG — Feature Future

### 📞 Chiamate AI Voice
**Concept**: chiamata automatica con voce AI per riattivazione, compleanno, post-seduta.

- **Volume stimato**: ~3 chiamate/giorno (costo ~€5-15/mese)
- **Stack**: Vapi.ai + Twilio + backend Railway
- **Nome chiamante**: da `impostazioni.azienda.nomeStudio`
- **GDPR**: AI deve dichiararsi AI all'inizio
- **Gestione richieste specifiche**: AI dice "la richiamo io personalmente" → notifica su gestionale
- **Requisiti tecnici**:
  - Tabella `chiamate_log` (storico + GDPR)
  - Gestione opt-out ("non chiamarmi più" → blocco immediato)
  - Fallback: se cliente non risponde → WhatsApp/SMS dopo 24h
  - Numero dedicato Twilio
- **Approccio 3 fasi**:
  1. MVP: solo riattivazione, 10 test con te stesso/familiari
  2. Estensione: post-seduta + compleanno
  3. Produzione: opt-in nel privacy PDF + voci AI ufficiali

### 🔒 RLS policy `_all` da droppare (8-10 tabelle)
Vedi sezione TODO — priorità alta per multi-tenant reale.

### 🕐 Fasce orarie per operatore ✅ FATTO
(Vedi storico 11/10)

---


---

## 🚨 PRIORITÀ ASSOLUTA — Fiscale

### 1. ⏰ Motore Cron Automazioni (invio reale)
**Stato**: 5 automazioni in dry-run OK. Manca motore cron per modalità `automatico`.

### 2. 📖 Manuale PDF utente (Gestionale + TricoAI)
**Concept**: manuale scaricabile direttamente da:
- **Gestionale**: pulsante "📖 Scarica Manuale" in Impostazioni
- **TricoAI v2**: pulsante in Impostazioni

**Contenuti Gestionale** (~50-80 pagine):
Setup, Clienti, Agenda, Percorsi, Fatture/DDT, Cassa Fiscale, Magazzino, Automazioni, Notifiche push, App Cliente, Integrazioni, Analytics, Sicurezza, FAQ.

**Contenuti TricoAI** (~30-50 pagine):
Setup, Analisi Tricoscopica, Prodotti + INCI, Clienti, Cura Domiciliare, Dashboard, Multi-tenant, FAQ.

### 3. 🔒 RLS policy `_all` da droppare (8-10 tabelle)
- `appuntamenti`, `fornitori`, `movimenti_magazzino`, `ordini_fornitore`, `righe_ordine_fornitore`
- `prodotti`, `servizi`, `sessioni_firma_*`
- Priorità alta per multi-tenant reale

---

## 📋 TODO — Altre priorità

### 🟡 Media
- [ ] Foto per CEROTUM POTENTIA + INTEGRATORE ANTI-DHT + PROBIOTICO (TricoAI)
- [ ] Test utenti demo TricoAI (Groq BYOK)
- [ ] Timeout sessione inattività

### 🔮 Backlog
- [ ] 📞 Chiamate AI Voice (Vapi.ai + Twilio)


---

## 📋 TODO — Da fare a breve

### 🔴 Alta priorità
- [ ] **Annullamento fiscale** (vedi sopra) — priorità assoluta
- [ ] **Notifica in-app conferma appuntamento** nel Gestionale
  - Toast centro schermo quando cliente conferma da App
  - Click → apre Agenda sul cliente
- [ ] **Fix PDF privacy** non caricato in Storage
- [ ] **RLS policy `_all`** da droppare (8-10 tabelle)

### 🟡 Media
- [ ] Rigenerare PDF scontrini vecchi (formato A4 lungo)
- [ ] Motore Cron Automazioni (da verificare)
- [ ] Test end-to-end notifiche push con cliente reale

### 🔮 Backlog
- [ ] Chiamate AI Voice (Vapi.ai + Twilio)
- [ ] Fasce orarie per operatore ✅ FATTO
- [ ] Rigenerare PDF scontrini vecchi

---

FINE FILE