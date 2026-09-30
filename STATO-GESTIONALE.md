# STATO GESTIONALE RIGHETTI 1967
Data ultimo aggiornamento: 30/09/2026

---

## 🛡️ ISOLAMENTO UTENTE DEMO — COMPLETATO ✅

| Componente / Sezione | Stato |
| :--- | :--- |
| Logo in Sidebar | ✅ Icona neutra 🏢 + titolo "Studio" per DEMO senza logo |
| Logo in Impostazioni → Azienda | ✅ Box neutro "Nessun logo caricato" + pulsante Carica |
| Pulsante TricoAI in Sidebar | ✅ Bloccato per DEMO con badge 🔒 Pro + alert registrazione |
| Tab Comunicazioni (Email) | ✅ Dicitura neutra "dal tuo account Gmail / Google Workspace" |
| Anteprime Documenti (Fatture/DDT) | ✅ Dicitura dinamica `Protocollo [RagioneSociale]` |
| Luogo Firma Privacy | ✅ Dinamico da sede aziendale (no Talamona hardcoded) |
| Logo nei PDF (Fatture/DDT/Privacy) | ✅ Nessun fallback a logo Righetti per utenti non-Righetti |
| Email DDT/Fatture/Privacy | ✅ Rimossi riferimenti "Righetti Since 1967" hardcoded |
| Etichetta PDF Fattura | ✅ "DICITURA" al posto di "DICITURA LEGALE" |

---

## 🚀 AGGIORNAMENTI COMPLETATI IL 30/09/2026

### 1. Build & Compilazione
- ✅ Risolto inquinamento import in `src/pages/Clienti.tsx`
- ✅ Build `npm run build` passa senza errori
- ✅ Risolto errore `[object Object]` su Scarico Seduta

### 2. Isolamento DEMO Completo (Security Multi-Tenant)
- ✅ Logo sidebar neutro (🏢) per utenti DEMO senza logo custom
- ✅ Titolo sidebar dinamico ("Studio" vs "Gestionale Studio")
- ✅ Pulsante TricoAI bloccato per DEMO con badge 🔒 Pro
- ✅ Logo PDF dinamico: no fallback a logo Righetti per non-Righetti
- ✅ Dicitura fattura dinamica con ragione sociale
- ✅ Luogo privacy dinamico da sede operativa aziendale
- ✅ Email DDT/Fatture/Privacy senza riferimenti hardcoded "Righetti Since 1967"

### 3. Nuova Feature: Gestione Fornitori
- ✅ Tab "Fornitori" nella pagina Prodotti
- ✅ Lista fornitori (mobile card + desktop tabella) con ricerca
- ✅ Modale `FormNuovoFornitore` con tutti i campi
- ✅ CRUD completo (crea, modifica, elimina)
- ✅ Isolamento multi-tenant garantito (`user_id` filter)

### 4. Agenda: Stati Visivi Migliorati
- ✅ **Pending** → bordo giallo
- ✅ **Completato** → trasparente
- ✅ **Rebooking aperto** → trasparente + bordo rosso
- ✅ **Rebooking chiuso** → grigio scuro archiviato
- ✅ **Spostamento** → trasparente + blu chiaro (`!bg-blue-100`)
- ✅ **Operatori orfani** → mostra anche operatori non in config (fix appuntamenti persi dopo rinomina)

### 5. Spostamenti con Tracciamento
- ✅ Funzione `spostaAppuntamento` in `appuntamenti.ts`
- ✅ Modale conferma in `FormNuovoAppuntamento` (se data cambiata)
- ✅ Nota con **data italiana** (`Spostato a 30 set 2026 10:30 — nota`)
- ✅ Tab "Disdette" cliente: mostra **destinazione** + **nota utente pulita**
- ✅ Modale ricerca cliente: **colori e label distinti** per motivo
  - 🔴 Definitiva | 🟠 Rebooking | 🟡 Disdetta | 🔄 Spostato | 🔵 Attivo

### 6. Fix CRITICO: Drag&Drop Agenda
- ✅ **Bug risolto:** trascinando un appuntamento in agenda, l'orario/operatore non veniva salvato su Supabase
- ✅ **Effetto:** aprendo modale dettaglio o attivando Blocco Unico, gli orari "saltavano" indietro
- ✅ **Fix:** il drag&drop ora esegue UPDATE reale su Supabase + aggiorna lo stato locale
- ✅ Fix accessorio: `handleUpdateAppuntamento` aspetta `ricarica()` + aggiorna modale dettaglio
- ✅ Fix accessorio: `clickAppuntamento` ricarica dati freschi dal DB

### 7. Firma DDT Anonima Ripristinata
- ✅ Fix bug introdotto da `feat(security): isolamento White-Label` che richiedeva auth su `getScarico`/`salvaFirmaScarico`
- ✅ Ora la firma DDT funziona da iPhone/tablet cliente (anonimo) senza login

### 8. Fix DB (Supabase)
- ✅ Vincolo `UNIQUE(user_id, numero_ddt)` su `scarichi_seduta`
- ✅ Operatori DEMO riassegnati (`luca` → `op1`, `lorenzo` → `op2`)
- ✅ Dati DEMO percorsi con prezzi corretti

### 9. Motore Comunicazioni Email & Allegati PDF (già completato)
- Google Workspace HTTPS Relay su porta 443
- Supporto allegati PDF reali
- Email commercialista configurabile
- Rimozione termine "salone"

### 10. Agenda Reattiva & Drag and Drop Avanzato (già completato)
- Realtime WebSocket Supabase
- Risoluzione sovrapposizioni a colonne
- Modalità Blocco Unico
- Persistenza pagina al reload
- Header responsive mobile

### 11. Sincronizzazione Google Sheets (già completato)
- Auto-sync globale ogni 15 minuti
- Backend Railway `/api/sheets/sync` operativo

### 12. Firma Digitale Touch-Friendly (già completato)
- Condivisione link firma via WhatsApp, Email, Copia Link
- Stabilizzazione canvas iOS

### 13. TricoAI v2 — Pulsante Gestionale
- ✅ Aggiunto pulsante "📊 Gestionale" in Sidebar TricoAI
- ✅ Bloccato per utenti DEMO con badge 🔒 Pro
- ✅ Utenti reali/Righetti: link diretto a `gestionale.righetti.club`

---

## 📌 PROSSIMI PASSI IN ROADMAP

### 🟡 Priorità Media
1. **PWA (Progressive Web App) — Gestionale + TricoAI**
   - Installazione `vite-plugin-pwa` su entrambi i progetti
   - Manifest + Service Worker + Icone
   - Vantaggio: app installabile su iPhone/iPad/Mac senza App Store
   - **Stato:** iniziato (installazione `vite-plugin-pwa` avviata), da completare

2. **Motore Promemoria e Automazioni**
   - Invio reminder WhatsApp ed Email automatici
   - Configurazione anticipo (24h/48h/72h), canale, testo personalizzabile
   - Regola specifica per Check-Up Gratuito nuovo cliente

3. **Cassa Fiscale e Scontrini**
   - Tab Cassa Fiscale in sidebar visibile solo se attivo il regime scontrini
   - Scontrino Madre (incasso + IVA immediata) e Scontrino Figlio a 0 euro
   - Supporto scontrino digitale cloud e stampanti fisiche RCH ed Epson 80mm

4. **🌐 WEB APP CLIENTE (PWA)**
   - **Obiettivo:** portale dedicato dove il cliente vede i suoi dati, senza accesso al Gestionale
   - **Architettura consigliata:** sotto-dominio separato `cliente.righetti.club` (Vercel)
   - **Stack:** Vite + React + TypeScript + Tailwind (riusa Supabase)
   - **Autenticazione:** login dedicato (OTP via Email/WhatsApp o Magic Link)
   - **Contenuti visibili (configurabili per cliente):**
     - 📅 I suoi appuntamenti (futuri + storico)
     - 📇 Contatti studio (indirizzo, telefono, email, sito)
     - 🧬 Scheda tricologica (foto, analisi, note)
     - 📄 PDF scaricabili (report tricologico, cura domiciliare, grafico)
   - **Controllo permessi:** tabella Supabase `permessi_cliente` con flag booleani per ogni sezione
   - **Pulsante/Tab nel Gestionale:** per generare link di accesso al cliente (token univoco) + gestire permessi
   - **Punti di forza:** isolamento totale, codice separato, riuso di PDF/Auth/DB esistenti
   - **Nota:** fattibile. Decisione finale su cosa mostrare è dell'admin (tu)

### 🟢 Priorità Bassa
5. **Migrazione storage PDF su Supabase Storage**
   - Attualmente i PDF sono generati al volo lato client
   - Spostare su Storage per accesso storico dal cliente

---

## 📋 NOTE TECNICHE

### Stack
- **Frontend Gestionale:** Vite + React + TypeScript + Tailwind (Railway)
- **Frontend TricoAI v2:** Vite + React + TypeScript + Tailwind (Vercel)
- **Backend TricoAI:** Python FastAPI (Railway)
- **DB:** Supabase (PostgreSQL)
- **Email:** Google Workspace HTTPS Relay (Apps Script)

### Domini
- `gestionale.righetti.club` → Gestionale
- `trico.righetti.club` → TricoAI v2
- `cliente.righetti.club` → **Web App Cliente (futura)**

### File di stato correlati
- **TricoAI v2:** `/Users/luca/Desktop/Tricolab_v2/STATO.md`
- **Gestionale:** questo file

### Comandi utili
```bash
# Build locale Gestionale
cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run build

# Build locale TricoAI v2
cd /Users/luca/Desktop/Tricolab_v2 && npm run build

# Dev server Gestionale
cd /Users/luca/Desktop/Tricolab/GESTIONALE/app && npm run dev

# Dev server TricoAI v2
cd /Users/luca/Desktop/Tricolab_v2 && npm run dev
