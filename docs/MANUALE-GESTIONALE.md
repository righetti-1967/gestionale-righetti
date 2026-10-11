---
title: "Manuale Utente — Gestionale Righetti 1967"
author: "Righetti Consulting S.r.l."
date: "11 Ottobre 2026"
---

# Manuale Utente — Gestionale Righetti 1967

**Versione:** 1.0
**Data:** 11 Ottobre 2026
**Studio:** Righetti Consulting S.r.l. — Since 1967

---

## Indice

1. [Introduzione](#1-introduzione)
2. [Setup Iniziale](#2-setup-iniziale)
3. [Clienti](#3-clienti)
4. [Agenda](#4-agenda)
5. [Percorsi](#5-percorsi)
6. [Fatture e DDT](#6-fatture-e-ddt)
7. [Cassa Fiscale](#7-cassa-fiscale)
8. [Magazzino](#8-magazzino)
9. [Automazioni](#9-automazioni)
10. [Integrazioni](#10-integrazioni)
11. [Analytics e Report](#11-analytics-e-report)
12. [App Cliente](#12-app-cliente)
13. [Sicurezza](#13-sicurezza)
14. [FAQ](#14-faq)
15. [🚀 In Arrivo: Chiamate AI Voice](#15-in-arrivo-chiamate-ai-voice)

---

## 1. Introduzione

### 1.1 Cos'è il Gestionale Righetti 1967

Il **Gestionale Righetti 1967** è un'applicazione web professionale (PWA) sviluppata per lo Studio Tricologico Righetti. È pensata per gestire in modo completo tutte le attività dello studio:

- **Clienti** e anagrafiche
- **Agenda** con appuntamenti e promemoria automatici
- **Percorsi** tricologici con riscatto sedute
- **Fatture**, **DDT** e **Scontrini** con invio automatico ai sistemi fiscali (ADE, FPT, RCH/Epson)
- **Magazzino** con giacenze e movimenti
- **Automazioni** per promemoria, compleanni, riattivazione clienti
- **App Cliente** dedicata con notifiche push
- **Analytics** e report per il commercialista

Il gestionale è **multi-tenant**: ogni studio che lo utilizza ha i propri dati, completamente separati e protetti.

### 1.2 Visione Multi-Tenant

Il Gestionale è progettato per essere utilizzato da **studi tricologici diversi**, non solo da Righetti 1967:

- **Righetti 1967** (`righetti@righetti.club`) → admin principale con funzionalità complete
- **Altri studi reali** → ognuno con i propri dati separati
- **Utenti demo** → per prova gratuita di 15 giorni con dati demo pre-popolati

Ogni studio vede **solo i propri dati**: clienti, appuntamenti, fatture, scontrini, prodotti, ecc. La separazione è garantita a livello database (Row Level Security su Supabase).

### 1.3 Primo Accesso

**URL di accesso:** `https://gestionale.righetti.club`

**Credenziali:**
- **Email**: fornita dall'amministratore dello studio
- **Password**: ricevuta via email al primo accesso

**Consiglio:** installa il Gestionale come **PWA** sul tuo Mac, iPad o iPhone:
1. Apri il gestionale in **Safari** (iOS) o **Chrome** (Mac/Android)
2. Tocca **Condividi** → **Aggiungi a Home** (iOS) o **Installa app** (Chrome)
3. Ora hai un'icona sul dispositivo come una vera app

**Perché la PWA?**
- ✅ Accesso immediato senza dover aprire il browser
- ✅ Notifiche push in tempo reale
- ✅ Migliore esperienza utente (full-screen)
- ✅ Funziona anche con connessione lenta

---

## 2. Setup Iniziale

### 2.1 Dati Azienda

**Dove:** Impostazioni → Azienda

Qui configuri l'identità dello studio che apparirà su fatture, scontrini, email e documenti:

- **Logo Aziendale**: caricato su Storage Supabase (bucket `azienda`)
- **Ragione Sociale**: denominazione legale (es. "Righetti Consulting S.r.l.")
- **Nome Studio**: nome commerciale che appare al cliente (es. "Righetti Since 1967")
- **Partita IVA** e **Codice Fiscale**
- **Sede Legale**: indirizzo completo (indirizzo, CAP, città, provincia)
- **Sede Operativa**: indirizzo dove si opera fisicamente (spesso diverso dalla sede legale)
- **Telefono**, **Email**, **Sito Web**, **WhatsApp**

**⚠️ Regola importante sugli indirizzi:**
- **Fatture, scontrini e privacy**: mostrano **entrambe** le sedi (legale + operativa)
- **Tutti gli altri documenti** (DDT, email, WhatsApp, promemoria, PDF): usano **solo la sede operativa**

Se la sede operativa non è compilata, il sistema usa automaticamente quella legale.

---

### 2.2 Agenda

**Dove:** Impostazioni → Agenda

Configura la griglia dell'agenda e gli operatori dello studio:

#### Operatori
- **Aggiungi operatore**: nome, ruolo (es. "Consulente Tricologo"), colore
- **Visibilità**: scegli quali operatori mostrare in agenda
- **Orari personalizzati per operatore**: opzionale, permette di assegnare fasce orarie diverse (es. per part-time o turni)

#### Orari di apertura
- **Orari globali della sede**: apertura, chiusura, giorni lavorativi
- **Fasce multiple per giorno**: es. mattina 9-13 + pomeriggio 15-19
- **Granularità griglia**: 10, 15, 20 o 30 minuti

#### Chiusure Straordinarie
- **🏖️ Ferie e festività**: configurà periodi di chiusura (es. Natale dal 24/12 al 06/01)
- **Motivo**: opzionale (es. "Ferie Natalizie", "Ferragosto")
- **Effetto in agenda**: i giorni in chiusura hanno slot disabilitati
- **Effetto in App Cliente**: i clienti vedono le chiusure dal 1° del mese interessato

---

### 2.3 Fiscale

**Dove:** Impostazioni → Fatturazione

Scegli il **regime documenti** dello studio e configura i provider fiscali:

#### Regime Documenti
- **📄 Regime Fatture**: emetti fatture e DDT, cassa fiscale nascosta
- **🧾 Regime Scontrini**: emetti scontrini (fisici o digitali), fatture/DDT nascosti

⚠️ Cambiare regime richiede una conferma esplicita. La sidebar si adatta automaticamente.

#### Provider Fiscali

**Per fatture elettroniche:**
- **ADE Diretto (SDI)**: genera XML, invio manuale via PEC o portale ADE
- **Fatture Per Tutti (FPT)**: invio automatico allo SDI tramite API

**Per scontrini digitali (cloud):**
- **ADE Diretto**: invio corrispettivi via ADE
- **FPT**: trasmissione automatica ad ADE

**Per scontrini fisici (RT):**
- **RCH Registratore**: registratore telematico (RCH 100, RCH 500)
- **Epson 80mm**: stampante fiscale Epson (TM-T88, TM-m30)

#### Modalità Simulazione / Reale

Ogni provider ha un **toggle** in cima alla config:

- **🧪 Simulazione** (default): nessun invio reale. Tutte le operazioni vengono simulate e loggate.
- **🔴 Reale**: invio effettivo al provider. Richiede conferma esplicita digitando `CONFERMO`.

⚠️ **IMPORTANTE**: attivare "Reale" senza il driver collegato produrrà log con esito `pending_driver`. Il driver vero verrà collegato in una sessione successiva.

#### Log Integrazioni

**Dove:** Impostazioni → Fatturazione → Log Integrazioni

Qui vedi lo storico di tutte le chiamate ai provider fiscali:
- **Tipo**: stampa scontrino, fattura FPT, fattura ADE, nota credito, ecc.
- **Modalità**: simulazione / reale
- **Esito**: `simulato` / `pending_driver` / `ok` / `errore`
- **Payload**: JSON completo della chiamata (utile per debug)
- **Filtri**: tipo, modalità, esito, giorni
- **Azioni**: elimina singolo log, pulisci tutti i log

---

### 2.4 Comunicazioni

**Dove:** Impostazioni → Comunicazioni

Configura i canali di comunicazione con i clienti:

#### WhatSender (WhatsApp automatico)
- **Token**: dalla dashboard WhatSender
- **Phone**: numero dello studio
- **Effetto**: tutti i pulsanti WhatsApp del gestionale useranno WhatSender per invio automatico (con fallback automatico a `wa.me` se non configurato)

#### Google Workspace (Email)
- **Username**: email Google Workspace
- **Password**: app password Google (non la password normale)
- **From Name**: nome mittente visibile al cliente
- **Google Script URL**: webhook Apps Script per relay HTTPS
- **Effetto**: tutte le email ai clienti passano da Google Workspace

---

*(continua...)*


---

## 3. Clienti

### 3.1 Anagrafica

**Dove:** Sidebar → Clienti

Il cuore del gestionale. Ogni cliente ha una scheda completa:

- **Nome e Cognome** (obbligatorio)
- **Cellulare** (per WhatsApp e App Cliente)
- **Email** (per fatture e documenti)
- **Codice Fiscale** / **Partita IVA** (per fatture)
- **Indirizzo di residenza** e **indirizzo di spedizione**
- **Data di nascita** (per automazione compleanno)
- **Segnalazioni annulli** (log automatico di fatture/scontrini annullati)
- **Note anamnestiche**

**Ricerca rapida:** in alto c'è la barra di ricerca per nome, email o cellulare.

### 3.2 Privacy GDPR

**Dove:** Cliente → Privacy firmata

Il sistema gestisce l'informativa privacy GDPR con **versioning**:

- **Firma digitale** su iPad con dito/stylus
- **PDF completo** generato automaticamente (2 pagine: informativa + firma)
- **Versione tracciata** (v1.0, v1.1, v2.0, ecc.)
- **Alert obsoleto**: se il testo privacy cambia versione, il cliente deve rifirmare
- **Badge in Dashboard**: "⚠️ X da rifirmare"

**Pulsanti disponibili:**
- **👁️ Anteprima**: visualizza il PDF della privacy
- **📄 Ristampa PDF**: rigenera il PDF (se perso)
- **🗑️ Rimuovi firma**: cancella la firma (richiede conferma)
- **📧 Email** / **💬 WhatsApp**: invia il link firma al cliente

**Come far firmare un cliente:**
1. Apri il cliente → Privacy firmata
2. Click **"✍️ Firma per accettazione"**
3. Apri il link su iPad → cliente firma con dito
4. Conferma → PDF salvato + notifica push al cliente

### 3.3 Note Studio

**Dove:** Cliente → Note studio

Note private dello studio visibili al cliente tramite App Cliente. Ottimo per:
- Promemoria post-seduta
- Consigli personalizzati
- Aggiornamenti trattamento

Il cliente riceve **notifica push** quando aggiungi una nota.

### 3.4 Storico

**Dove:** Cliente → scorrimento pagina

Vedi tutto lo storico del cliente:
- **Appuntamenti** passati e futuri
- **Percorsi** attivi e completati
- **Fatture** emesse
- **Scontrini** emessi
- **Prodotti** riscattati
- **Schede tricologiche** (da TricoAI)

---

## 4. Agenda

### 4.1 Creare Appuntamenti

**Dove:** Sidebar → Agenda

**3 modi per creare un appuntamento:**

1. **Click sulla cella vuota**: seleziona operatore, data e ora
2. **Pulsante "+ Nuovo"**: form completo
3. **Da cliente**: dal dettaglio cliente → "+ Nuovo appuntamento"

**Campi obbligatori:**
- **Cliente** (ricerca con autocomplete)
- **Operatore** (Luca, Lorenzo, ecc.)
- **Data** e **Ora inizio**
- **Durata** (minuti)
- **Titolo** (es. "Trattamento Righetti 4-2-1")
- **Tipo**: Percorso / Nuovo / Seduta / Generico

**Campi opzionali:**
- **Servizio** (dal catalogo)
- **Percorso attivo** (se appartiene a un percorso)
- **Note interne**
- **Colore** personalizzato

### 4.2 Stati Appuntamento

| Stato | Colore | Descrizione |
|---|---|---|
| **Pending** | 🟡 Ambra | In attesa di conferma dal cliente |
| **Confermato** | 🔵 Blu | Confermato (cliente o studio) |
| **Prenotato** | 🔵 Blu | Prenotato, non ancora confermato |
| **Completato** | ⚪ Grigio | Seduta effettuata |
| **Cancellato** | 🔴 Rosso | Annullato (con motivo tracciato) |

**Cambio stato:** click sull'appuntamento → modifica stato → salva. Il cliente riceve **notifica push** automatica.

### 4.3 Promemoria Automatici

Due tipi di promemoria configurabili in **Impostazioni → Automazioni**:

- **Promemoria Appuntamento**: X ore prima (12, 24, 48, 72, ecc.)
- **Promemoria Check-Up Gratuito**: dedicato ai nuovi clienti con prima visita check-up

**Canale:** WhatsApp / Email / Entrambi

**Invio manuale:** dalla modale "Promemoria" in Agenda (selezione multipla clienti).

### 4.4 Chiusure Straordinarie

**Dove:** Impostazioni → Agenda → 🏖️ Chiusure Straordinarie

Configura ferie e festività:
- **Data inizio** e **Data fine**
- **Motivo** opzionale (es. "Ferie Natalizie")

**Effetti:**
- **Agenda**: i giorni in chiusura hanno slot disabilitati (grigi)
- **Banner**: se apri un giorno chiuso, appare banner arancione in alto
- **App Cliente**: i clienti vedono le chiusure dal 1° del mese interessato

**Badge nella card Home App Cliente:** "⚠️ X chiusure questo mese"

---

## 5. Percorsi

### 5.1 Creazione

**Dove:** Sidebar → Percorsi (o Cliente → Nuovo percorso)

Un **percorso** è un pacchetto di sedute prepagate. Campi:
- **Cliente**
- **Tipologia** (es. "Righetti 4-2-1")
- **Numero sedute** totali
- **Prezzo totale**
- **Data inizio** e **Data fine** prevista
- **Servizi** inclusi (righe)

### 5.2 Riscatto Sedute

Quando il cliente completa una seduta del percorso:
1. Dalla seduta in agenda → click **"Riscatta percorso"**
2. Seleziona il percorso attivo
3. Compila i prodotti/servizi usati
4. Conferma → genera uno **scontrino figlio** (0€, non fiscale) o **DDT**

**Il residuo** si aggiorna automaticamente.

### 5.3 Residuo

Il **residuo** è il valore del percorso non ancora riscattato:
- Calcolato come `(righe percorso) - (righe riscattate)`
- Visibile nel dettaglio cliente
- **Fatturabile**: quando il residuo è significativo, puoi emettere fattura

### 5.4 Fatturazione

**Da percorso a fattura:**
1. Apri cliente → percorsi attivi
2. Click **"Fattura percorso"**
3. Scegli se fatturare tutto o solo il residuo
4. Genera proforma o fattura

---

## 6. Fatture e DDT

### 6.1 Emissione Fattura

**Dove:** Sidebar → Fatture → + Nuova Fattura

**Procedura:**
1. Seleziona **cliente** (o apri da percorso)
2. Aggiungi **righe** (servizi, prodotti, percorsi)
3. Applica **sconti** (per riga o totale)
4. Compila **note** e **dicitura legale**
5. Salva come **Bozza** o **Emetti** (diventa proforma)

**Numerazione:** automatica, con prefisso configurabile.

### 6.2 Firma Cliente

**2 modalità:**

**A) Firma iPad diretta:**
1. Apri fattura → **"✍️ Firma per accettazione"**
2. Apri link su iPad → cliente firma
3. Firma salvata

**B) Firma QR:**
1. Genera QR code
2. Cliente scansiona con iPhone
3. Firma da mobile

### 6.3 Invio Email/WhatsApp

Dalla fattura aperta:
- **📧 Email**: PDF allegato + template personalizzabile
- **💬 WhatsApp**: WhatSender (PDF) o fallback `wa.me`
- **📄 Scarica PDF**: per stampa manuale

### 6.4 Annullo Fattura (Nota di Credito)

⚠️ **IMPORTANTE**: annullare una fattura emessa **richiede Nota di Credito** (obbligo fiscale).

**Procedura:**
1. Apri fattura → click **🚫 Annulla**
2. Se ci sono **DDT collegati attivi** → la modale mostra **lista DDT** con checkbox
3. Seleziona DDT da annullare (tutti di default)
4. Inserisci **password gestionale** + **motivo** (min 10 caratteri)
5. Click **"📦 Annulla N DDT e procedi"** → annulla DDT selezionati
6. Modale passa a **step 2**: conferma annullo fattura
7. Click **"🚫 Confermo annullo fattura"** → annulla fattura + genera **nota di credito** verso ADE/FPT

**Il log** appare in Impostazioni → Fatturazione → Log Integrazioni.

### 6.5 DDT: Emissione, Firma, Annullo

**Emissione:** da percorsi → scarico seduta → genera DDT

**Firma:** stesso flusso fatture (iPad o QR)

**Annullo:** se collegato a fattura, prima annulla fattura. Altrimenti annullo libero.

**⚠️ DDT non è fiscale** → non serve nota di credito.

---

## 7. Cassa Fiscale

### 7.1 Scontrini Fisici (RCH/Epson)

Se hai configurato provider RCH o Epson:

**Emissione:**
1. Cassa Fiscale → scontrino
2. Il sistema genera PDF in formato **termico 80mm**
3. **Modalità Simulazione** (default): mostra anteprima a video
4. **Modalità Reale**: invia comando alla stampante fiscale

**Config:** Impostazioni → Fiscale → RCH/Epson → IP + porta

### 7.2 Scontrini Digitali (Cloud)

**Emissione:**
1. Cassa Fiscale → scontrino digitale
2. Il PDF viene generato in A4
3. Inviato via Email/WhatsApp al cliente
4. Notifica push automatica

### 7.3 Scontrini Figli (Scarichi)

Quando riscatti un percorso, si genera uno **scontrino figlio** (0€, di cortesia). **Non è fiscale** ma è collegato allo scontrino madre.

### 7.4 Chiusura Giornaliera

**Dove:** Cassa Fiscale → Chiusura

Ogni sera:
1. Inserisci **fondo cassa iniziale**
2. Il sistema calcola incassi per metodo (contanti, carta, ecc.)
3. Genera **PDF chiusura** per commercialista
4. Archivia chiusura

### 7.5 Annullo Scontrino

**Procedura:**
1. Apri scontrino → **🗑️ Annulla**
2. Se è **MADRE con figli attivi** → modale mostra **lista figli** con checkbox
3. Seleziona figli da annullare → **"📦 Annulla N figli e procedi"**
4. Step 2: **"🗑️ Confermo annullo madre"**
5. Sistema invia **annullo a RT** (RCH/Epson) o **corrispettivi** (ADE/FPT)

### 7.6 Cestino Scontrini Annullati

Uno scontrino annullato resta visibile nella lista con **badge rosso ANNULLATO**.

Per **eliminarlo definitivamente**:
1. Click **🗑️ cestino** accanto allo scontrino
2. Conferma "IRREVERSIBILE"
3. Scontrino eliminato dal DB (PDF resta su Storage)

---

## 8. Magazzino

### 8.1 Prodotti e Giacenze

**Dove:** Sidebar → Magazzino → Prodotti

Ogni prodotto ha:
- **Nome**, **Codice**, **Descrizione**
- **Prezzo acquisto** e **prezzo vendita**
- **Giacenza** attuale
- **Scorta minima** (alert se sotto)
- **Fornitore** collegato

### 8.2 Movimenti

**Dove:** Magazzino → Movimenti

Ogni movimento è tracciato:
- **Carico** (acquisto fornitore)
- **Scarico** (uso in seduta)
- **Rettifica** (inventario)

### 8.3 Scarichi da Seduta

Durante una seduta, riscatti percorso → il sistema chiede quali prodotti usare → genera **scarico** automatico.

### 8.4 Ordini Fornitori

**Dove:** Sidebar → Ordini

Crea ordini con **selezione multipla prodotti**:
1. Scegli fornitore
2. Pulsante **"📦 Aggiungi N prodotti"**
3. Checkbox multipli → aggiungi tutti in un colpo
4. Salva bozza o invia

---

## 9. Automazioni

**Dove:** Impostazioni → Automazioni

5 automazioni disponibili, ognuna con **toggle** e **modalità**:

### 9.1 Promemoria Appuntamento
- **Quando**: X ore prima (configurabile: 12/24/48/72/96/120/168)
- **Ora invio**: es. 09:00
- **Canale**: WhatsApp / Email / Entrambi
- **Testo**: personalizzabile in Impostazioni → Testi Messaggi

### 9.2 Promemoria Check-Up Gratuito
- **Quando**: X ore prima della prima visita check-up
- **Rivolta a**: nuovi clienti con check-up gratuito

### 9.3 Post-Seduta
- **Quando**: X minuti/ore/giorni dopo seduta completata
- **Scopo**: indagine soddisfazione, consigli post-cura

### 9.4 Compleanno
- **Quando**: X giorni prima del compleanno (0-7)
- **Ora invio**: es. 09:00
- **Scopo**: auguri + eventuale promo

### 9.5 Riattivazione
- **Quando**: dopo N giorni di inattività (default 90)
- **Scopo**: recupero clienti dormienti

### 9.6 Notifiche Push Tempo-Reale

**Dove:** Impostazioni → Automazioni → Notifiche Push

5 trigger automatici (già attivi):
- Nuovo appuntamento
- Appuntamento confermato
- Appuntamento cancellato
- Appuntamento spostato
- Appuntamento pending

**Dry-run globale**: disattivabile quando pronto per push reali.

---

## 10. Integrazioni

### 10.1 ADE/SDI (Agenzia Entrate)
- **Provider**: ADE Diretto o FPT
- **Config**: codice SDI + PEC + regime fiscale
- **Effetto**: fatture elettroniche inviate a SDI

### 10.2 FPT (Fatture Per Tutti)
- **API Key** + **Password**
- **Ambiente**: test o produzione
- **Effetto**: invio automatico fatture + corrispettivi a SDI/ADE

### 10.3 RCH/Epson (Stampanti Fiscali)
- **IP** + **porta** (default 9100)
- **Modello** (RCH 500, Epson TM-T88)
- **Matricola RT** + **seriale**
- **Effetto**: stampa scontrini fiscali + annulli RT

### 10.4 WhatSender (WhatsApp)
- **Token** + **Phone**
- **Effetto**: invio automatico WhatsApp con PDF allegato
- **Fallback**: se non configurato → `wa.me`

### 10.5 Google Sheets
- **URL foglio Google**
- **Sync automatico**: 1 volta al giorno
- **Effetto**: clienti + appuntamenti sincronizzati con Google Sheets

---

## 11. Analytics e Report

### 11.1 Dashboard KPI

**Dove:** Sidebar → Dashboard

Card principali:
- **Incasso Oggi/Mese/Anno**
- **Proforma in attesa**
- **Clienti Totali** (con badge **"⚠️ X da rifirmare"** privacy)
- **Percorsi Attivi**
- **Pending** (appuntamenti in attesa)
- **Rebooking**
- **Sotto scorta** (prodotti)

### 11.2 Report Commercialista

**Dove:** Analytics → Report Commercialista

Genera PDF con:
- **Elenco fatture** emesse nel periodo
- **Elenco scontrini** con dettaglio IVA
- **Chiusure cassa** giornaliere
- **Report DDT**

**Upload su Storage** per consultazione.

### 11.3 Chiusure Cassa

Vedi capitolo 7.4.

---

## 12. App Cliente

### 12.1 Invito Cliente

**Dove:** Impostazioni → App Cliente → Cliente → Genera link invito

Il cliente riceve un **link univoco** (valido 7 giorni) via **Email** o **WhatsApp**.

Click → atterra su `cliente.righetti.club` → login con magic link.

### 12.2 Moduli Visibili

**Dove:** Impostazioni → App Cliente → 7 toggle

Scegli quali moduli mostrare al cliente:
- **Appuntamenti**
- **Documenti** (fatture, scontrini, DDT)
- **Percorsi**
- **Scheda Tricologica** (da TricoAI)
- **Cura Domiciliare**
- **Privacy PDF**
- **Note Studio**

### 12.3 Privacy e Documenti

**Dove:** App Cliente → Documenti / Privacy

Il cliente vede:
- **Fatture** PDF
- **Scontrini** PDF
- **Privacy firmata** PDF
- **Schede tricologiche** (da TricoAI)
- **Cura domiciliare** (da TricoAI)

### 12.4 Notifiche Push

**Dove:** App Cliente → Notifiche

Il cliente riceve push per:
- Nuovo appuntamento
- Appuntamento confermato / cancellato / spostato
- Nuovo documento
- Nuova nota studio
- Nuova scheda
- Compleanno (se configurato)

### 12.5 Aggiungi al Calendario

Dalla card appuntamento futuro (confermato o prenotato):
- Pulsante **📅 Aggiungi al calendario**
- Genera file **.ics** compatibile con iOS/Android/Outlook
- **3 promemoria** automatici: 3 giorni, 2 giorni, 1 giorno prima
- **Location**: indirizzo studio (tap → apre Maps)
- Badge verde **"✅ Aggiunto"** dopo il click

---

## 13. Sicurezza

### 13.1 Password Gestionale

**Dove:** Impostazioni → Sicurezza

La password gestionale protegge le operazioni critiche:
- Annullo fatture / DDT / scontrini
- Storico e cancellazioni

**Imposta password**: min 4 caratteri.
**Reimposta via email**: se dimenticata.
**Rimuovi password**: per test (sconsigliato in produzione).

### 13.2 Timeout Sessione

*(In sviluppo)* — Logout automatico dopo N minuti di inattività.

### 13.3 Log Accessi

*(In sviluppo)* — Tracciamento accessi e azioni critiche.

---

## 14. FAQ

**Q: Come faccio a installare il Gestionale sul Mac/iPhone?**
A: Apri in Safari/Chrome → Condividi → Aggiungi a Home. L'app appare con icona dedicata.

**Q: Devo reinstallare la PWA quando cambiate qualcosa?**
A: NO, la maggior parte delle modifiche arriva in automatico tramite update. Solo se cambia il nome o l'icona dell'app devi reinstallare.

**Q: Perché l'agenda su iPhone non si aggiorna subito?**
A: iOS Safari sospende il Realtime in background. Il sistema usa un **polling ogni 30 sec** + refresh quando torni in app. Se serve, cambia pagina manualmente.

**Q: Cosa succede se attivo modalità "Reale" senza driver collegato?**
A: Le operazioni vengono loggate con esito `pending_driver`. Il driver verrà collegato in una sessione successiva.

**Q: Posso annullare una fattura già inviata a SDI?**
A: Sì, ma il sistema genera una **Nota di Credito** verso ADE/FPT (obbligo fiscale). Il cliente riceverà entrambi i documenti.

**Q: Come sincronizzo i clienti con Google Sheets?**
A: Impostazioni → Google Sheets → incolla URL foglio → sincronizzazione automatica giornaliera.

**Q: Perché il cliente non riceve la notifica push?**
A: Verifica che:
1. L'App Cliente sia installata come PWA (iOS 16.4+)
2. Il cliente abbia autorizzato le notifiche
3. Il toggle nella config push sia attivo
4. Il dry-run globale sia disattivato

---

## 15. 🚀 In Arrivo: Chiamate AI Voice

**Concept**: chiamate automatiche con voce AI per:
- **Riattivazione** clienti dormienti
- **Compleanno** (auguri vocali)
- **Post-seduta** (indagine soddisfazione)

**Caratteristiche**:
- **Voce italiana** indistinguibile da umana
- **Nome chiamante**: da Impostazioni → Azienda → Nome Studio
- **GDPR**: l'AI si dichiara come assistente virtuale all'inizio della chiamata
- **Gestione richieste specifiche**: AI dice "la richiamo io personalmente" → notifica al gestionale
- **Costo stimato**: ~€0,05-0,15/min (circa €5-15/mese per 3 chiamate/giorno)
- **Stack**: Vapi.ai + Twilio + backend Railway
- **Fallback**: se cliente non risponde → WhatsApp/SMS dopo 24h

**Attivazione**:
- Toggle per ogni automazione (riattivazione, compleanno, post-seduta)
- Config orari e giorni
- Test con te stesso/familiari prima di andare in produzione

**Requisiti**:
- Opt-in esplicito nel privacy PDF (aggiornamento versione)
- Consenso separato per chiamate AI
- Numero dedicato per le chiamate

**Stato**: 📅 in pianificazione (da attivare dopo altre priorità)

---

**Fine Manuale — Versione 1.0**

*Per assistenza: righetti@righetti.club*
