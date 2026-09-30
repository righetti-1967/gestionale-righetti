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
- ✅ Risolto inquinamento import in `src/pages/Clienti.tsx` (git checkout + import pulito)
- ✅ Build `npm run build` passa senza errori (`✓ built in ~500ms`)
- ✅ Risolto errore `[object Object]` su Scarico Seduta (catch formattato con `err?.message || err?.details`)

### 2. Isolamento DEMO Completo (Security Multi-Tenant)
- ✅ Logo sidebar neutro (🏢) per utenti DEMO senza logo custom
- ✅ Titolo sidebar dinamico ("Studio" vs "Gestionale Studio")
- ✅ Pulsante TricoAI bloccato per DEMO con badge 🔒 Pro
- ✅ Logo PDF dinamico: no fallback a logo Righetti per non-Righetti
- ✅ Dicitura fattura dinamica con ragione sociale (`Protocollo ${ragioneSociale}`)
- ✅ Luogo privacy dinamico da sede operativa aziendale
- ✅ Email DDT/Fatture/Privacy senza riferimenti hardcoded "Righetti Since 1967"

### 3. Nuova Feature: Gestione Fornitori
- ✅ Tab "Fornitori" nella pagina Prodotti
- ✅ Lista fornitori (mobile card + desktop tabella) con ricerca
- ✅ Modale `FormNuovoFornitore` con tutti i campi (ragione sociale, P.IVA, CF, SDI, IBAN, contatti, sede, sconto %, giorni consegna, note)
- ✅ CRUD completo (crea, modifica, elimina)
- ✅ Isolamento multi-tenant garantito (`user_id` filter in tutte le query)

### 4. Agenda: Stati Visivi Migliorati
- ✅ **Pending** → bordo giallo (`ring-2 ring-yellow-400`)
- ✅ **Completato** → trasparente (`opacity-60`)
- ✅ **Rebooking** → trasparente + bordo rosso (`opacity-40 ring-2 ring-red-500`)
- ✅ Rebooking ora **visibile** in agenda (prima filtrato via)
- ✅ Cancellati definitivi/disdette restano nascosti

### 5. Fix DB (Supabase)
- ✅ Vincolo `UNIQUE(user_id, numero_ddt)` su tabella `scarichi_seduta` (prima era globale, causava conflitti tra utenti)
- ✅ Riassegnati operatori DEMO orfani (`luca` → `op1`, `lorenzo` → `op2`)

### 6. Motore Comunicazioni Email & Allegati PDF (già completato)
- Google Workspace HTTPS Relay su porta 443 attivo contro il blocco SMTP di Railway
- Supporto allegati PDF reali testato e funzionante
- Email commercialista configurabile in Impostazioni con pulsante "Invia Email Report"
- Rimozione termine "salone", uniformato a "Studio"

### 7. Agenda Reattiva & Drag and Drop Avanzato (già completato)
- Realtime WebSocket Supabase su appuntamenti, clienti, servizi, impostazioni
- Risoluzione sovrapposizioni con colonne affiancate stile Google Calendar
- Modalità Blocco Unico con toggle
- Persistenza pagina corrente al reload
- Header responsive mobile a due livelli per iPhone

### 8. Sincronizzazione Google Sheets (già completato)
- Auto-sync globale continuo a livello root (`App.tsx` e `Layout.tsx`) ogni 15 minuti e al risveglio
- Backend Railway `/api/sheets/sync` operativo con parser nativo

### 9. Firma Digitale Touch-Friendly (già completato)
- Condivisione rapida link firma a distanza via WhatsApp, Email, Copia Link
- Stabilizzazione canvas iOS su Privacy, DDT, Fatture

### 10. TricoAI v2 — Pulsante Gestionale
- ✅ Aggiunto pulsante "📊 Gestionale" in Sidebar TricoAI
- ✅ Bloccato per utenti DEMO con badge 🔒 Pro + alert registrazione
- ✅ Utenti reali/Righetti: link diretto a `gestionale.righetti.club`

---

## 📌 PROSSIMI PASSI IN ROADMAP

### 🔴 Priorità Alta
1. **Dati DEMO: percorsi con prezzi corretti**
   - Problema: nel DEMO, i percorsi hanno `netto_iva_scontato = 0` → il "Totale imponibile di competenza" nel DDT commercialista risulta 0,00 €
   - Azione: modificare lo script `popolaDemoUtente` (backend Railway) per generare percorsi con prezzi reali e campi calcolati
   - Impatta su: DDT commercialista, fatture demo

### 🟡 Priorità Media
2. **Cassa Fiscale e Scontrini**
   - Tab Cassa Fiscale in sidebar visibile solo se attivo il regime scontrini
   - Scontrino Madre (incasso + IVA immediata) e Scontrino Figlio a 0 euro con dicitura di legge
   - Supporto scontrino digitale cloud e stampanti fisiche RCH ed Epson 80mm su rete locale

3. **Motore Promemoria e Automazioni**
   - Invio reminder WhatsApp ed Email automatici
   - Configurazione anticipo (24h/48h/72h), canale, testo personalizzabile
   - Regola specifica per Check-Up Gratuito nuovo cliente

### 🟢 Priorità Bassa
4. **Web App Cliente (PWA)**
   - Consultazione storico, schede, fatture e scontrini
   - Accesso cliente autonomo

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
