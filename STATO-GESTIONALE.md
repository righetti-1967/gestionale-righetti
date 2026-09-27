# STATO PROGETTO — GESTIONALE RIGHETTI 1967

Ultimo aggiornamento: **28/09/2026 01:30 — Badge DNA, Righe Cliccabili, Tab Responsive**

---

## ✅ Stato attuale

**Il Gestionale è compilato al 100% con 0 errori (TypeScript + Vite) e online con dominio personalizzato e SSL.**

### URLs Ufficiali
- **Piattaforma Live**: https://gestionale.righetti.club (dominio custom)
- **Frontend Vercel (Backup)**: https://gestionale-righetti.vercel.app
- **Backend FastAPI (Railway)**: https://gestionale-righetti-production.up.railway.app
- **Database & Auth (Supabase)**: https://yporpszebtasalwazirz.supabase.co
- **Repository GitHub**: https://github.com/righetti-1967/gestionale-righetti

---

## 💎 Funzionalità Rilasciate

### 1. Suite di Accesso & Google Login
- Login e Registrazione in stile Apple pulito.
- "Continua con Google" e "Registrati con Google" (`signInWithOAuth`).
- Pagine `/forgot-password` e `/reset-password`.
- Fix loop login: redirect immediato post-auth.

### 2. Modalità DEMO 15 Giorni
- Nuovi utenti: `ruolo: 'demo'` e `demo_scadenza` a 15 giorni.
- Badge countdown nell'header.
- Lock screen elegante a scadenza.

### 3. Isolamento Dati & Brand Neutro
- Sidebar: "Gestionale Studio" (no Righetti).
- Logo e Dati Aziendali: fallback pulito per utenti demo/terzi.

### 4. Agenda & Documenti
- Cerca Cliente rapido in Agenda (nome, cellulare, email).
- Dicitura "Note documento" (no "legale").
- DDT Commercialista → "Documento di Competenza".
- Fix crash Scheda Cliente → Appuntamenti | Disdette.

### 🆕 5. Badge DNA Cliente (28/09/2026)
- Campo `dna` (codice corto, max 20 caratteri) visibile come **badge verde** 🧬 sotto il nome cliente.
- Visibile in: **tabella Clienti (desktop)**, **card mobile** (fix iPhone verticale).
- Campo editabile nel modale cliente (sezione "🧬 DNA Cliente" con bottone "💾 Salva DNA").

### 🆕 6. Storico Fatture & Scontrini in Modale Cliente (28/09/2026)
- Nuova tab **📄 Fatture & Scontrini** nella sezione "Storico Sedute & Consegne".
- Mostra **tutte le fatture del cliente** (indipendentemente da scarico).
- Prodotti/Servizi filtrati per escludere EXTRA (tab **⭐ EXTRA** dedicata).

### 🆕 7. Riga Cliente Cliccabile (28/09/2026)
- Click su riga cliente → apre modale dettaglio.
- Bottoni azione con `stopPropagation()`.

### 🆕 8. Modali Anteprima Minimali DDT/Fattura (28/09/2026)
- Click su numero DDT o Fattura → modale anteprima minimale (👁️ Anteprima + 📥 Scarica PDF + ✖️ Chiudi).
- No azioni extra (Email, WhatsApp, Firma, Modifica, ecc.).

### 🆕 9. Barra Pending/Rebooking in Agenda (28/09/2026)
- 2 card **⏳ Pending (N)** e **🔄 Rebooking (N)** sotto le tab Giorno/Settimana/Mese.
- Click card → modale con lista clienti e azioni: 💬 WhatsApp (messaggio differenziato pending vs rebooking), 📅 Apri in Agenda, ✏️ Dettaglio.
- WhatsApp apre l'**app nativa** (schema `whatsapp://` con fallback web `wa.me`).

### 🆕 10. Fix Responsive Mobile (28/09/2026)
- **Sidebar mobile scrollabile** (tutta la sidebar scorre, `100dvh`, `overscroll-contain`, `WebkitOverflowScrolling`).
- **Avatar centrato in Sidebar collapsed** (fix `lg:gap-0 lg:group-hover:gap-3`).
- **Tab Impostazioni**: griglia 2 colonne su mobile, flex su tablet/desktop.
- **Input date non sborda più** su iPhone (CSS globale `input[type="date"]`).
- **Bottone "+ Aggiungi" Operatore**: full-width su mobile (no sbordi).
- **Badge DNA** visibile su iPhone verticale (badge sotto al nome, non troncato).
- **"Salva Note"** allineato (no sbordi su mobile).

### 🆕 11. Fix Sidebar Pulsante Attivo (28/09/2026)
- Il pulsante attivo nella Sidebar ora segue correttamente `currentPage` (prima rimaneva sempre su Dashboard per uso errato di `useLocation`).

---

## 🎯 Roadmap da Sviluppare

### 🔴 Priorità 1 — Auto-Save Multi-Device (STIMATO ~20 ORE)
Vedi sezione dettagliata in `STATO.md` di TricoAI. Il progetto è **condiviso** tra i due software.

### 🔴 Priorità 2 — Ponte Sincronizzazione Gestionale → TricoAI (STIMATO ~4 ORE)
Vedi sezione dettagliata in `STATO.md` di TricoAI.

### 🔴 Priorità 3 — Card WhatsApp & Email in Impostazioni (~4 ORE)
**Obiettivo:** configurare parametri SMTP e API WhatsApp (Whatsender) per l'invio di documenti.

**Specifiche:**
- Card in Impostazioni Gestionale.
- Campi per: SMTP host, porta, user, password, mittente email.
- Campi per: API Key Whatsender, numero mittente, template messaggi.
- **Bottone "Test invio"** per verificare le credenziali.
- Endpoint o script Google Sheet per il salvataggio dei parametri (da definire in implementazione).
- **Solo in Gestionale** (non in TricoAI).

### 🟡 Priorità 4 — Attività Recenti Cliccabili (STIMATO ~4 ORE)
Vedi sezione dettagliata in `STATO.md` di TricoAI.

### 🟡 Priorità 5 — Nuove Funzionalità Operative

**Agenda — `+ Nuovo Servizio` rapido (in verde):**
- Sostituire `+ Aggiungi altro servizio` con pulsante verde `+ Nuovo Servizio`.
- Permette creazione servizio al volo dalla modale appuntamento (Nome, Prezzo lordo, Durata minuti).

**Avatar Utente e Foto Profilo in Sidebar:**
- Upload foto su Supabase Storage (`avatars`).
- Colori Apple per avatar iniziale.
- Foto miniatura in basso a sinistra.

**Link a TricoAI nella Sidebar:**
- Voce dedicata con icona 🧬 e link diretto.

### 🟢 Priorità 6 — Fisco, Cassa & Firma

**Switch Fiscale: Fatture/DDT vs Scontrino Digitale:**
- Impostazione aziendale per scegliere modalità di emissione.

**Sessioni di Lavoro & Cassa Utente:**
- Turni e apertura/chiusura cassa operatore.

**Firma Accettazione & Invio WhatsApp:**
- Firma digitale preventivi + invio link via WhatsApp (Whatsender).

### 🟣 Priorità 7 — Internazionalizzazione (IT + EN)
Traduzione sistematica (fase successiva).

---

## 🛠️ Comandi Rapidi di Sviluppo
- Avvio locale: `npm run dev`
- Controllo e Build: `npm run build`
- Deploy rapido: `git add . && git commit -m "messaggio" && git push`

---

## 📝 Note tecniche importanti

- **TricoAI e Gestionale usano DB Supabase DIVERSI**:
  - TricoAI: `fucagtrfydacobostdoa.supabase.co`
  - Gestionale: `yporpszebtasalwazirz.supabase.co`
- Il "Ponte di sincronizzazione" è **urgente** per condividere dati.
- **Attenzione:** la tabella `clienti` di TricoAI usa `codice_cliente`, mentre il Gestionale usa `nome_cognome`. Mappatura necessaria.
- Il campo `dna` esiste solo nel DB Gestionale. In TricoAI va **aggiunto** e **popolato** tramite il Ponte.
