# STATO GESTIONALE RIGHETTI 1967
Data ultimo aggiornamento: 29/09/2026 17:29

---

## 🚀 AGGIORNAMENTI RECENTI & COMPLETATI

### 1. Motore Comunicazioni & Invio Email Reale (Google Workspace Relay)
- **Architettura HTTPS Relay su porta 443:** Risolto il blocco di rete di Railway (`[Errno 101] Network is unreachable` sulle porte SMTP 25/465/587). Implementato un relay sicuro tramite Google Apps Script che invia le email direttamente dall'account ufficiale `righetti@righetti.club`.
- **Supporto Allegati PDF Nativi:** Esteso lo schema e il servizio backend (`/api/email/invia`) per accettare `allegato_base64` e `allegato_nome`, consentendo la consegna di documenti PDF allegati con graffetta nelle email dei clienti e del commercialista.
- **Integrazione Completa Invii Reali:** Sostituiti tutti i vecchi segnaposto (`in arrivo`) con invii effettivi via Email e WhatsApp:
  - **Informativa Privacy Clienti (`Clienti.tsx`):** Invio email formattata con allegato il PDF firmato con valore legale.
  - **Fatture & Proforma (`DettaglioFattura.tsx`, `Fatture.tsx`):** Invio email con PDF contabile allegato e apertura chat WhatsApp precompilata.
  - **Documenti di Trasporto DDT (`DDT.tsx`):** Invio email con PDF DDT della seduta allegato per il cliente.
  - **Report Commercialista (`DDT.tsx`):** Aggiunto pulsante dedicato `✉️ Invia Email Report` per spedire il riepilogo mensile con PDF allegato direttamente allo Studio Cerati (senza aprire finestre di download locale sul Mac) e pulsante separato `💾 Scarica PDF`.
- **Recapiti Commercialista in Impostazioni:** Aggiunta card dedicata nelle Impostazioni (Fatturazione) per memorizzare l'indirizzo email e il nominativo dello studio contabile.
- **Bonifica Terminologica "Salone":** Rimossa radicalmente la parola "salone" da tutte le schermate, placeholder, piè di pagina delle email e registrazioni, uniformando la dicitura istituzionale a "Studio" o "Studio Righetti Since 1967".

### 2. Firma Digitale Multi-Canale & Stabilità Canvas (iPad / iPhone)
- **Eliminazione Bug Primo Tocco iOS:** Risolto il problema per cui il primo tratto di firma su iPad/iPhone veniva cancellato all'istante lasciando il pulsante disabilitato. Uniformato il ref del canvas e i listener su tutte le pagine firma (`PaginaFirmaiPad`, `PaginaFirmaDdtIPad`, `PaginaFirmaFatturaIPad`).
- **Condivisione Link per Firma a Distanza:** Aggiunto il componente `CondividiLinkFirma` che genera link cliccabile e pulsanti rapidi per invio immediato via WhatsApp, Email o Copia Link.

### 3. Sincronizzazione Google Sheets Continua
- **Auto-Sync Globale a Livello App (`App.tsx`):** Spostato il motore di sincronizzazione da `TabGoogleSheets` al livello radice dell'applicazione. Il controllo automatico ogni 15 minuti rimane attivo mentre l'operatore lavora in Agenda, Cassa o Clienti.
- **Smart Check al Risveglio:** Rilevamento immediato del risveglio del Mac o del cambio scheda (`visibilitychange` / `focus`) per sincronizzare all'istante se sono trascorsi più di 15 minuti.
- **Backend FastAPI su Railway:** Endpoint dedicato `/api/sheets/sync` ad alte prestazioni con modulo nativo `csv`, supporto multi-tenant per `user_id` e mapping su `nome_cognome`.

### 4. Agenda Reattiva & Gestione Sedute Complesse
- **Modalità Blocco Unico Seduta (`🧩`):** Toggle reattivo nell'header (desktop e mobile) per fondere i servizi multipli dello stesso cliente in un unico blocco continuo continuo, consentendo di trascinare l'intera seduta (orario ed eventuale cambio operatore) con un solo gesto.
- **Risoluzione Sovrapposizioni (Affiancamento Multi-Colonna):** Algoritmo a corsie parallele che divide automaticamente la colonna quando due o più appuntamenti cadono nello stesso orario per lo stesso operatore.
- **Gestione Flessibile Durate:** Selettore orario individuale per ciascun servizio con pulsanti `[ - ] [ + ]` a scatti di 15 min, ricalcolo esatto della somma totale e salvataggio sequenziale di tutti gli orari voce.
- **Sincronizzazione Realtime WebSocket (Supabase):** Aggiornamento istantaneo dell'agenda tra dispositivi (MacBook, iPhone, iPad) in < 1 secondo.
- **Routing & Memoria Pagina:** Persistenza dell'URL e dello stato dell'Agenda al reload del browser.

---

## 📌 PROSSIMI PASSI IN ROADMAP

1. **Scontrini Digitali & Registratore Telematico:**
   - Scelta della modalità nelle Impostazioni: Scontrino Fiscale Cloud (senza cassa fisica) vs Stampante RT Hardware.
   - Integrazione driver di rete locale per stampanti fiscali **RCH** (protocollo PrintF / TCP) ed **Epson 80mm** (protocollo ePOS-Print / XML).
2. **Motore Invio Promemoria & Automazioni:**
   - Worker programmato per l'invio automatico dei reminder degli appuntamenti via WhatsApp (Whatsender) ed Email secondo le regole impostate nella tab Promemoria (24h/48h prima e regola specifica prima visita *Check-Up Gratuito*).
3. **Web App Cliente (PWA Dedicata):**
   - Accesso diretto cliente tramite link/token sicuro.
   - Consultazione appuntamenti e storico sedute.
   - Scheda tricologica con download report e piani di cura TricoAI.
   - Archivio e download di Fatture, DDT e Scontrini Digitali.