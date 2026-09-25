# STATO PROGETTO — GESTIONALE RIGHETTI 1967

Ultimo aggiornamento: **25/09/2026 — Suite Auth, Demo 15gg, Build Verde & Roadmap Definitiva**

---

## ✅ Stato attuale

**Il Gestionale è compilato al 100% senza errori (TypeScript + Vite) e pronto per la produzione.**

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL + Auth + Google OAuth)
- **Stato Build**: 0 errori

---

## 💎 Funzionalità Rilasciate

### 1. Suite di Accesso e Autenticazione Completa
- **Login e Registrazione**: layout Apple-style pulito e moderno.
- **Login con Google**: pulsante ufficiale "Continua con Google" (`signInWithOAuth`) in `/login` e `/registrati`.
- **Recupero Password**: pagine dedicate `/forgot-password` e `/reset-password`.

### 2. Modalità DEMO 15 Giorni & Blocco di Sicurezza
- **Prova automatica**: nuovi utenti registrati con ruolo demo e scadenza a 15 giorni.
- **Conto alla rovescia**: badge dinamico nella topbar.
- **Schermata di Blocco (Lock Screen)**: blocco protetto con lucchetto alla scadenza dei 15 giorni.

---

## 🎯 Roadmap e Nuove Specifiche

### 1. Agenda — Cerca Cliente
- [ ] Aggiungere la ricerca rapida del cliente all'interno della modale/creazione appuntamento in Agenda.

### 2. Dicitura Legale Documenti
- [ ] Rimuovere la parola "legale" lasciando la dicitura neutra/corretta stabilita dallo studio.

### 3. DDT — Documento di Competenza
- [ ] Modificare la dicitura dei DDT trasformandola in "Documento di Competenza".

### 4. Firma Accettazione & Invio WhatsApp
- [ ] Modulo di firma digitale per l'accettazione e invio link documento via WhatsApp (Whatsender).

### 5 & 6. Impostazioni — Card Dedicata WhatsApp & Email
- [ ] Card in Impostazioni per configurare SMTP ed API Whatsender con test di invio.

### 7. TricoAI in Sidebar (Cross-Link)
- [ ] Voce nella Sidebar del Gestionale "TricoAI" con collegamento a `trico.righetti.club`.

### 8. Messa Online — `gestionale.righetti.club`
- [ ] Configurazione DNS su Wix e deploy definitivo su Vercel.

### 9. Sincronizzazione Unidirezionale (Gestionale → TricoAI)
- [ ] Condivisione automatica di clienti e prodotti per chi acquista la Suite Completa.

## 🎯 Obiettivo

Estendere il Gestionale con:
- **Scontrino digitale** (alternativa a Fatture + DDT, configurabile)
- **Invio automatico documenti** (Email + WhatsApp)
- **Collegamento Agenzia delle Entrate** (SDI + RT)

---

## 📋 Backlog funzionalità

### 🧾 1. Scontrino Digitale (impostazione modulabile)

**Obiettivo**: dare all'azienda la scelta tra 2 modalità di emissione documenti.

**Impostazione in**: `Impostazioni Software → Documenti → Tipo emissione`

- **Modalità A** (attuale): Fatture + DDT
- **Modalità B** (nuova): Scontrini Digitali

**Requisiti Scontrino Digitale**:
- [ ] Template PDF dedicato (formato scontrino, no dati fattura completi)
- [ ] Stesse modalità di download delle fatture/DDT
- [ ] Inviabile con le stesse modalità (email + WhatsApp)
- [ ] Numerazione progressiva separata (es. `SC-001-2026`)
- [ ] Data/ora emissione automatica
- [ ] Riepilogo voci + totale
- [ ] Metodo pagamento (contanti / carta / bonifico)
- [ ] Opzionale: codice fiscale / P.IVA cliente
- [ ] Storico scontrini consultabile
- [ ] Integrazione con ADE (vedi punto 4)

**Note tecniche**:
- Da valutare se emettere **Documento Commerciale Online (ADE)** o **scontrino via RT** (Registratore Telematico)
- Per ora partire con **PDF scaricabile** (non ancora invio telematico)
- La scelta Modalità A/B si applica a tutta l'azienda, non per singolo documento, finchè non si cambia in Impostazioni Azienda - Fatturazione?