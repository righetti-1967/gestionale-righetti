# STATO GESTIONALE RIGHETTI 1967
Ultimo aggiornamento: 06/10/2026

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
- `cliente.righetti.club` → App Cliente (futura)

**Regimi documenti:**
- **Regime FATTURE**: fatture + DDT
- **Regime SCONTRINI**: cassa fiscale + scontrini

---

## 📌 STACK TECNICO

- **Frontend:** Vite + React + TypeScript + Tailwind
- **PWA:** vite-plugin-pwa (autoUpdate)
- **Backend:** Python FastAPI (Railway)
- **DB:** Supabase PostgreSQL (RLS abilitato)
- **Email:** Google Workspace HTTPS Relay (Apps Script)
- **Deploy:** Vercel (auto su push main)

**Ambiente unico:** PROD (sviluppo diretto in prod, no TEST)
**Supabase PROD:** `yporpszebtasalwazirz.supabase.co`

---

## 🔴 TODO — PRIORITÀ ALTA

### 1. Persistenza multi-device (useDraft) — REPLICARE
Attualmente funziona solo su Cassa Fiscale. Da replicare su:
- ⏸️ Clienti (filtro + cliente aperto)
- ⏸️ Percorsi (filtro + percorso aperto)
- ⏸️ Fatture (form in corso + cliente selezionato)
- ⏸️ DDT (form in corso)
- ⏸️ Ordini / Magazzino / Prodotti / Servizi
- ⏸️ Impostazioni / Testi Messaggi (bozze testo per chiave)

### 2. Motore Promemoria automatico (backend)
- ⏸️ Cron job: post-seduta / compleanno / riattivazione
- ⏸️ Log in `promemoria_inviati`
- ⏸️ Configurazione anticipo + canale + testo

### 3. Integrazione API reali
- ⏸️ FPT (fatturazione elettronica)
- ⏸️ ADE (Agenzia Entrate)
- ⏸️ RCH, Epson (stampanti fiscali)

### 4. App Cliente (PWA)
- ⏸️ Dominio `cliente.righetti.club` su Vercel
- ⏸️ Login OTP via Email/WhatsApp
- ⏸️ Scheda tricologica, appuntamenti, contatti, PDF scaricabili

---

## 🟡 TODO — PRIORITÀ MEDIA

### 5. Storico Cliente — Rifiniture
- ✅ Scontrini nel tab "Fatture & Scontrini"
- ✅ Badge "⭐ EXTRA" su scontrini
- ⏸️ Numero scontrino cliccabile → apertura StampaScontrino (in test)

### 6. Agenda — Completare
- ⏸️ Vista Settimanale adattiva (fasce per giorno, come Giornaliera)
- ⏸️ Vista Mensile adattiva

### 7. Cassa Fiscale — Miglioramenti
- ⏸️ Chiusura cassa giornaliera con fondo iniziale (parziale)
- ⏸️ Export CSV scontrini per commercialista
- ⏸️ Tastiera numerica touch-friendly (parziale con inputMode)

### 8. Report Analytics Clienti
- ⏸️ Ranking clienti per spesa
- ⏸️ Export PDF A4

---

## 🟢 TODO — PRIORITÀ BASSA

### 9. Sicurezza
- ⏸️ Conferma prima di salvare cambio regime documenti
- ⏸️ Log accessi/azioni critiche
- ⏸️ Timeout sessione per inattività

### 10. Performance
- ⏸️ Indici SQL su: appuntamenti, clienti, fatture, scontrini, bozze
- ⏸️ Riduzione Disk I/O e CPU Supabase

### 11. Migrazione PDF su Storage
- ⏸️ Spostare PDF generati al volo su scontrini-pdf / fatture-pdf

---

## 📋 NOTE TECNICHE

### Tabella bozze (persistenza multi-device)
- Chiave: user_id + chiave_draft (UNIQUE)
- Payload: JSONB (stato arbitrario)
- Realtime: WebSocket Supabase
- Hook: src/lib/useDraft.ts
- Chiavi attive:
  - cassa_carrello_<clienteId> / cassa_carrello_anonimo
  - cassa_cliente_attivo

### Storage Buckets (PROD)
- azienda (pubblico) → logo azienda
- avatars (pubblico) → foto profilo
- scontrini-pdf (pubblico) → PDF scontrini
- fatture-pdf (pubblico) → PDF fatture

### Annullo Fatture/DDT
- Password gestionale: Impostazioni → Sicurezza (hash SHA-256)
- Motivo obbligatorio: min 10 caratteri
- Soft-delete: annullato_at, annullato_motivo, annullato_da
- Blocco DDT collegati: annullare prima i DDT
- Segnalazione cliente: clienti.segnalazioni_annulli

### PWA Auto-Update
- In main.tsx: check ogni 60s + on focus + on online
- Reload silenzioso su controllerchange
- Anti-loop via sessionStorage

### Email Professionale
- src/lib/emailWrapper.ts → wrapEmailHtml(corpo, azienda)
- Header: logo centrato
- Footer: ragione sociale, sede, P.IVA, contatti
- Senza emoji (compatibilità Apple Mail/Outlook)
- Variabile {data_estesa}: "Lunedì 5 Ottobre 2026"

---

## 🔧 COMANDI UTILI

- Build Gestionale: cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run build
- Dev Gestionale: cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run dev
- Build TricoAI: cd /Users/luca/Desktop/Tricolab_v2 && npm run build
- Dev TricoAI: cd /Users/luca/Desktop/Tricolab_v2 && npm run dev
- Push in PROD: git add -A && git commit -m "feat: ..." && git push origin main

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

---

## 📂 FILE CORRELATI

- TricoAI v2: /Users/luca/Desktop/Tricolab_v2/STATO.md
- Gestionale: questo file

---

## FINE FILE
