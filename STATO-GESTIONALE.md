# STATO GESTIONALE RIGHETTI 1967
Data ultimo aggiornamento: 02/10/2026

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

## 🚀 AGGIORNAMENTI COMPLETATI IL 02/10/2026

### 1. Fix CRITICO: Invio Email Fatture/DDT/Privacy
- ✅ **Bug risolto:** tutte le email (fatture, DDT cliente, DDT commercialista, privacy) fallivano con `400 Bad Request` dal backend Railway
- ✅ **Causa:** il frontend non passava più `google_script_url` nel payload
- ✅ **Fix:** creata funzione `inviaEmailConConfig` in `api.ts` che:
  - Carica `config_email` dal DB dell'utente loggato
  - Estrae `googleScriptUrl` o `host` (SMTP)
  - Invia al backend con config completa
- ✅ **Fix nome mittente:** ora usa `Nome Mittente Visibile` dalle Impostazioni (non più hardcoded `Studio - NomeCliente`)
- ✅ Sostituito in `DettaglioFattura.tsx`, `DDT.tsx`, `Clienti.tsx`

### 2. Fix PDF Privacy: rimosso header blu
- ✅ **Bug:** il PDF Privacy scaricato aveva una banda blu in alto (mentre l'anteprima HTML era bianca)
- ✅ **Causa:** `pdfPrivacy.ts` disegnava `doc.rect(0, 0, 210, 32, 'F')` con `setFillColor(0, 122, 255)`
- ✅ **Fix:** rimosso header blu, ora sfondo bianco con logo a sinistra e dati aziendali a destra (come l'anteprima)

### 3. Fix DB: `config_email.provider` riportato a `google_relay`
- ✅ **Bug:** il campo `provider` nel DB era stato impostato a `smtp` (invece di `google_relay`) → backend rifiutava l'invio
- ✅ **Fix SQL:** `UPDATE impostazioni SET valore = valore || jsonb_build_object('provider', 'google_relay')`

### 4. Dashboard: responsive mobile iPhone
- ✅ **Grid:** da `grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8` a `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-3 sm:gap-4`
- ✅ **Padding card:** da `p-5` a `p-3 sm:p-5`
- ✅ **Emoji card:** da `text-2xl` a `text-xl sm:text-2xl`
- ✅ **Numeri card:** da `text-2xl font-bold` a `text-lg sm:text-2xl font-bold`
- ✅ **Card Fatturato Mese:** aggiunto `flex-wrap`, `overflow-hidden`, `shrink-0`, select con `max-w-[70px]` su mobile
- ✅ **Risultato:** layout pulito e leggibile su iPhone

### 5. Sync Google Sheets: da 15 min a 1 volta/giorno alle 08:00
- ✅ **Motivo:** ridurre il carico su Supabase (Disk I/O + CPU)
- ✅ **Fix in `App.tsx`:** timer da 15 min a check ogni 60 secondi, sync solo se ora >= 08:00 E non già fatto oggi
- ✅ **Fix in `Impostazioni.tsx`:** rimosso il blocco SMART SYNC duplicato
- ✅ **Fix in TricoAI (`Layout.tsx`):** stessa logica

### 6. PWA (Progressive Web App)
- ✅ **Gestionale:** installabile su iPhone/iPad/Mac (icona Righetti + nome "Gestionale")
- ✅ **TricoAI v2:** installabile su iPhone/iPad/Mac (icona "R" nera + nome "TricoAI")
- ✅ Aggiunto `apple-touch-icon`, `theme-color`, `apple-mobile-web-app-capable` in entrambi gli `index.html`
- ✅ Icone distinte per non confondere le 2 app

### 7. Agenda: Stati Visivi Migliorati
- ✅ **Pending** → bordo giallo
- ✅ **Completato** → trasparente
- ✅ **Rebooking aperto** → trasparente + bordo rosso
- ✅ **Rebooking chiuso** → grigio scuro archiviato
- ✅ **Spostamento** → trasparente + blu chiaro (`!bg-blue-100`)
- ✅ **Operatori orfani** → mostra anche operatori non in config

### 8. Spostamenti con Tracciamento
- ✅ Funzione `spostaAppuntamento` in `appuntamenti.ts`
- ✅ Modale conferma in `FormNuovoAppuntamento` (se data cambiata)
- ✅ Nota con **data italiana** (`Spostato a 30 set 2026 10:30 — nota`)
- ✅ Tab "Disdette" cliente: mostra **destinazione** + **nota utente pulita**
- ✅ Modale ricerca cliente: **colori e label distinti** per motivo
  - 🔴 Definitiva | 🟠 Rebooking | 🟡 Disdetta | 🔄 Spostato | 🔵 Attivo

### 9. Fix CRITICO: Drag&Drop Agenda
- ✅ **Bug risolto:** trascinando un appuntamento in agenda, l'orario/operatore non veniva salvato su Supabase
- ✅ **Effetto:** aprendo modale dettaglio o attivando Blocco Unico, gli orari "saltavano" indietro
- ✅ **Fix:** il drag&drop ora esegue UPDATE reale su Supabase + aggiorna lo stato locale

### 10. Firma DDT Anonima Ripristinata
- ✅ Fix bug introdotto da `feat(security): isolamento White-Label` che richiedeva auth su `getScarico`/`salvaFirmaScarico`
- ✅ Ora la firma DDT funziona da iPhone/tablet cliente (anonimo) senza login

### 11. Fix DB (Supabase)
- ✅ Vincolo `UNIQUE(user_id, numero_ddt)` su `scarichi_seduta`
- ✅ Operatori DEMO riassegnati (`luca` → `op1`, `lorenzo` → `op2`)
- ✅ Dati DEMO percorsi con prezzi corretti

### 12. Motore Comunicazioni Email & Allegati PDF (già completato)
- Google Workspace HTTPS Relay su porta 443
- Supporto allegati PDF reali
- Email commercialista configurabile
- Rimozione termine "salone"

### 13. Agenda Reattiva & Drag and Drop Avanzato (già completato)
- Realtime WebSocket Supabase
- Risoluzione sovrapposizioni a colonne
- Modalità Blocco Unico
- Persistenza pagina al reload

### 14. Sincronizzazione Google Sheets (già completato)
- Auto-sync globale ora **1 volta al giorno alle 08:00**

### 15. Firma Digitale Touch-Friendly (già completato)
- Condivisione link firma via WhatsApp, Email, Copia Link
- Stabilizzazione canvas iOS

### 16. TricoAI v2 — Pulsante Gestionale
- ✅ Aggiunto pulsante "📊 Gestionale" in Sidebar TricoAI
- ✅ Bloccato per utenti DEMO con badge 🔒 Pro
- ✅ Utenti reali/Righetti: link diretto a `gestionale.righetti.club`

---

## 📌 PROSSIMI PASSI IN ROADMAP

### 🟡 Priorità Media
1. **Motore Promemoria e Automazioni**
   - Invio reminder WhatsApp ed Email automatici
   - Configurazione anticipo (24h/48h/72h), canale, testo personalizzabile
   - Regola specifica per Check-Up Gratuito nuovo cliente

2. **Cassa Fiscale e Scontrini**
   - Tab Cassa Fiscale in sidebar visibile solo se attivo il regime scontrini
   - Scontrino Madre (incasso + IVA immediata) e Scontrino Figlio a 0 euro
   - Supporto scontrino digitale cloud e stampanti fisiche RCH ed Epson 80mm

3. **🌐 WEB APP CLIENTE (PWA)**
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
   - **Punti di forza:** isolamento totale, codice separato, riuso di PDF/Auth/DB esistenti

### 🟢 Priorità Bassa
4. **Ottimizzazione DB: Indici SQL**
   - Creare indici su `analisi`, `bozze`, `appuntamenti`, `clienti`, `scarichi_seduta`, `fatture`
   - Ridurre Disk I/O e CPU su Supabase
   - Ridurre errori Database/Realtime

5. **Migrazione storage PDF su Supabase Storage**
   - Attualmente PDF generati al volo lato client
   - Spostare su Storage per accesso storico dal cliente

---

## 📋 NOTE TECNICHE

### Stack
- **Frontend Gestionale:** Vite + React + TypeScript + Tailwind (Railway)
- **Frontend TricoAI v2:** Vite + React + TypeScript + Tailwind (Vercel)
- **Backend TricoAI/Gestionale:** Python FastAPI (Railway)
- **DB:** Supabase (PostgreSQL)
- **Email:** Google Workspace HTTPS Relay (Apps Script)

### Domini
- `gestionale.righetti.club` → Gestionale
- `trico.righetti.club` → TricoAI v2
- `cliente.righetti.club` → **Web App Cliente (futura)**

### PWA
- **Gestionale:** icona RIGHETTI, nome "Gestionale", theme #007AFF
- **TricoAI:** icona "R" nera, nome "TricoAI", theme #007AFF
- **Installazione iPhone:** Safari → Condividi → Aggiungi a Home
- **Installazione Mac:** Chrome → icona "Installa" nella barra indirizzi

### Sync Google Sheets
- **Frequenza:** 1 volta al giorno alle 08:00
- **Manuale:** pulsante "🔄 Sincronizza ora" sempre disponibile
- **LocalStorage:** `gestionale_sheets_last_sync` (timestamp ultimo sync)
- **Tabella:** `impostazioni` chiave `google_sheet_url`

### Watcher Foto Panoramica (Mac)
- **Script:** `~/tricolab_watcher.py`
- **Config:** `~/.tricolab_watcher.json`
- **LaunchAgent:** `~/Library/LaunchAgents/com.righetti.tricolab.watcher.plist`
- **Log:** `~/Library/Logs/tricolab_watcher.log`
- **Mac attivi:** MacBook Pro, iMac Studio
- **Vedi documentazione completa:** `/Users/luca/Desktop/Tricolab_v2/STATO.md`

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

---

## 🚀 AGGIORNAMENTI COMPLETATI IL 02/10/2026 (parte 2)

### 17. Fix CRITICO: Firma Anonima su Safari/iPhone
- ✅ **Bug:** le pagine firma anonime (Privacy, DDT, Fattura) fallivano su Safari con "Non autenticato"
- ✅ **Causa:** funzioni `getCliente`, `getFattura`, `salvaFirmaPrivacy`, `salvaFirmaFattura` richiedevano auth Supabase
- ✅ **Fix:** rese pubbliche (senza auth) le seguenti funzioni:
  - `getCliente(id)` (clienti.ts)
  - `salvaFirmaPrivacy(id, firma)` (clienti.ts)
  - `getFattura(id)` (fatture.ts)
  - `salvaFirmaFattura(id, firma)` (fatture.ts)
- ✅ **Sicurezza:** RLS Supabase già configurate per lettura/update pubblici per id

### 18. Fix Email cliente in DDT
- ✅ **Bug:** nella modale firma DDT mancava email/cellulare del cliente → "Email cliente non disponibile"
- ✅ **Fix:** aggiunto `cellulare, email` al select delle query `scarichi.ts`

### 19. Fix Email cliente in Fattura
- ✅ **Bug:** nella modale firma Fattura il cliente era passato come `null`
- ✅ **Fix:** passato `fattura.cliente as any` in `DettaglioFattura.tsx`
- ✅ Aggiunto `cellulare` a tutte le query `fatture.ts`

### 20. Fix Email cliente in Privacy
- ✅ **Bug:** nella modale firma Privacy mancava email/cellulare del cliente
- ✅ **Fix:** verificato che `clienteSelezionato` è passato correttamente

### 21. Invio Email Firma Diretto (no più mailto:)
- ✅ **Bug:** cliccando "Invia Email" nella modale firma si apriva Mail.app con campo destinatario vuoto
- ✅ **Fix:** `CondividiLinkFirma.tsx` ora usa `inviaEmailConConfig` → invio diretto + banner esito:
  - ⏳ Invio...
  - ✅ Email inviata a [email cliente]
  - ❌ Errore: [messaggio]
- ✅ Funziona in tutte e 3 le modali (Privacy, DDT, Fattura)

### 22. Bug Safari vs Chrome: ITP e Storage
- ✅ **Nota:** il bug della firma anonima era visibile su Safari (non su Chrome) perché Safari blocca la sessione Supabase per pagine anonime
- ✅ **Fix:** rendendo pubbliche le funzioni, la pagina firma non richiede più la sessione

### 23. Dashboard + Fatture Responsive iPhone
- ✅ **Dashboard:** grid responsive (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8`)
- ✅ **Card:** padding `p-3 sm:p-5`, font ridotti, `flex-wrap` per i select
- ✅ **Fatture:** layout card verticale su mobile (numero + stato | cliente + importo | data)
- ✅ **Risultato:** niente sovrapposizioni, tutto leggibile
