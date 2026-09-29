# STATO GESTIONALE RIGHETTI 1967
Data ultimo aggiornamento: 29/09/2026 12:21

---

## 🚀 AGGIORNAMENTI RECENTI & COMPLETATI

### 1. Agenda & Real-Time Multi-Device
- **Sincronizzazione Realtime Istantanea (WebSocket Supabase):** Attivata su `appuntamenti`, `clienti`, `servizi`, `prodotti`, `impostazioni` e `sessioni_firma`. Qualsiasi spostamento o nuovo appuntamento su Mac si riflette su iPhone/iPad in < 1 secondo.
- **Persistenza della Navigazione (No Reset al Reload):** Risolto il reset forzato a Dashboard. La pagina corrente viene mantenuta nell'URL e in `localStorage`, preservando l'Agenda al refresh (`Cmd+R` / pull-to-refresh).
- **Layout Responsive Mobile (iPhone/iPad):** Header compatto su due livelli con data centrata, pillola unificata `[ ‹ Oggi › ]`, selettore viste compatto `[ G | S | M ]` e pulsanti rapidi.
- **Risoluzione Sovrapposizione Testi su Slot da 30 Min:** Riorganizzata la visualizzazione per garantire leggibilità perfetta di orario, cliente, servizio e note inline.
- **Sblocco Durata Personalizzata Appuntamenti:** Corretto il calcolo di `durataNum` nel form appuntamenti; la durata manuale (es. 45 min) vince sulla durata base del servizio listino senza intaccare il catalogo.

### 2. Firma Digitale Multi-Canale & Stabilità Touch
- **Condivisione Link per Firme a Distanza:** Aggiunti pulsanti rapidi in `FirmaPrivacy`, `FirmaDdtQR` e `FirmaFatturaQR`:
  - 💬 **Invia WhatsApp**: apre direttamente la chat con messaggio precompilato e link sicuro.
  - ✉️ **Invia Email**: predispone la mail con oggetto e corpo per il cliente.
  - 📋 **Copia Link**: per incollare l'URL negli appunti con feedback visivo.
- **Stabilizzazione Canvas iOS Safari:** Risolto il problema del doppio tocco; eliminato l'overlay bloccante che causava `pointercancel` in WebKit e reso stabile il ref del canvas (allineando Fattura e DDT alla Privacy).

### 3. Sincronizzazione Google Sheets
- **Tab Dedicata in Impostazioni:** Inserita la scheda `Google Sheets` a tutta larghezza con salvataggio sicuro su tabella `impostazioni` (isolata per `user_id`).
- **Auto-Sync ogni 15 Minuti:** Timer background con Smart Check all'apertura/risveglio dello schermo da sleep.
- **Backend FastAPI (Railway):** Creato endpoint `/api/sheets/sync` con modulo `csv` nativo ad alte prestazioni e mappatura su `nome_cognome`.

### 4. Nuove Sezioni Impostazioni Salone
- **Tab Comunicazioni:**
  - Configurazione Whatsender API Token e numero mittente per WhatsApp.
  - Configurazione parametri server SMTP Email (Host, Porta, SSL, Username, Password, Mittente).
  - Dati protetti e multi-tenant (compatibili con isolamento utente DEMO).
- **Tab Promemoria & Automazioni:**
  - Regola generale per appuntamenti Agenda (scelta canale WhatsApp/Email e anticipo 24h/48h/72h).
  - Regola dedicata per prima visita **"Righetti Check-Up Gratuito"** con testo personalizzato.

---

## 📌 PROSSIMI PASSI IN ROADMAP

1. **Scontrini Digitali:** Configurazione e scelta provider nelle Impostazioni (collegamento registratore telematico/servizio cloud).
2. **Automazioni Invio Promemoria:** Motore cron/worker per inviare concretamente i messaggi WhatsApp (Whatsender) ed Email secondo le regole impostate nella tab Promemoria.
3. **Web App Cliente (PWA Dedicata):**
   - Accesso cliente senza login complesso (link sicuro / token).
   - Consultazione appuntamenti futuri e passati.
   - Scheda tricologica con download report e piani di trattamento TricoAI.
   - Storico e visualizzazione di Fatture, DDT e Scontrini Digitali.