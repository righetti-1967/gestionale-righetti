# ROADMAP — GESTIONALE RIGHETTI 1967

Ultimo aggiornamento: **20 settembre 2026**

---

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
- La scelta Modalità A/B si applica a tutta l'azienda, non per singolo documento

---

### 📧 2. Collegamento Email

**Obiettivo**: invio automatico documenti via email.

**Requisiti**:
- [ ] Configurazione SMTP (o servizio terzo: SendGrid, Resend, Brevo)
- [ ] Template email configurabili (oggetto + corpo)
- [ ] Allegato automatico (fattura / DDT / scontrino)
- [ ] Placeholder dinamici: `{nome_cliente}`, `{numero_documento}`, `{data}`, `{importo}`
- [ ] Firma email aziendale
- [ ] Log invii (data, destinatario, esito, errore)
- [ ] Retry automatico su errore
- [ ] CC/BCC configurabili
- [ ] Test invio dal pannello impostazioni

**Note tecniche**:
- Preferire servizio transazionale (SendGrid/Resend) per deliverability
- Se SMTP: gestire correttamente SPF/DKIM/DMARC del dominio aziendale

---

### 📱 3. Collegamento WhatsApp (Whatsender)

**Obiettivo**: invio automatico documenti via WhatsApp Business API.

**Provider**: **Whatsender** (già identificato)

**Requisiti**:
- [ ] Account Whatsender Business configurato
- [ ] Verifica numero mittente
- [ ] Invio documento PDF (link download o allegato diretto)
- [ ] Template messaggi approvati
- [ ] Placeholder dinamici: `{nome_cliente}`, `{numero_documento}`, `{link_download}`
- [ ] Log invii (data, numero, esito, errore)
- [ ] Gestione opt-in cliente (privacy)
- [ ] Test invio dal pannello impostazioni

**Note tecniche**:
- WhatsApp Business API richiede **template approvati** da Meta
- Il numero deve essere **verificato** e **business**
- Costo per conversazione (verificare tariffe Whatsender)

---

### 🇮🇹 4. Collegamento Agenzia delle Entrate (ADE)

**Obiettivo**: invio telematico documenti + ricezione esiti.

**Due canali da gestire**:

#### 4A. Fatturazione Elettronica (SDI)
- [ ] Generazione XML **FatturaPA** (formato 1.2.x)
- [ ] Firma digitale (se richiesto)
- [ ] Invio via **SDICoop** o **PEC** o **provider intermediario**
- [ ] Ricezione esiti: RC, NS, MC, NE, DT
- [ ] Conservazione sostitutiva a norma
- [ ] XML scaricabili dallo storico

**Opzioni implementative**:
- **Diretto**: SDICoop (molto complesso, accreditamento)
- **Intermediario**: Aruba, FattureInCloud, Openapi.it, ecc. (consigliato)
- **PEC**: più semplice ma deprecato

#### 4B. Scontrino Elettronico
- [ ] **Documento Commerciale Online** (ADE) — API disponibili
- [ ] Oppure **RT** (Registratore Telematico) fisico
- [ ] Invio corrispettivi giornalieri (XML)
- [ ] Verifica esiti

**Opzioni implementative**:
- **Documento Commerciale Online**: si integra con API ADE (consigliato per digitale)
- **RT fisico**: richiede hardware dedicato + integrazione

**Note tecniche**:
- L'integrazione ADE richiede **accreditamento** e **certificati**
- Meglio affidarsi a un **intermediario accreditato** (Aruba, Openapi, FattureInCloud, ecc.)
- Tempi sviluppo: **settimane** (non giorni) per via di accreditamenti

---

## 🗓️ Fasi suggerite

### Fase 1 — Scontrino Digitale (PDF)
- [ ] Impostazione "Tipo emissione" in Impostazioni
- [ ] Template scontrino
- [ ] Generazione PDF scontrino
- [ ] Numerazione progressiva
- [ ] Storico

### Fase 2 — Email
- [ ] Configurazione SMTP/servizio
- [ ] Template email
- [ ] Invio + log

### Fase 3 — WhatsApp
- [ ] Setup Whatsender
- [ ] Template messaggi
- [ ] Invio + log

### Fase 4 — ADE
- [ ] Scelta intermediario
- [ ] Fatturazione elettronica SDI
- [ ] Scontrino elettronico (Documento Commerciale Online)
- [ ] Conservazione sostitutiva

---

## 📌 Note importanti

1. **Separazione progetti**: questo è il **GESTIONALE**, NON Tricolab v2 (che è già separato).
2. **Priorità attuale**: Tricolab v2 (backend FastAPI) — queste feature vengono dopo.
3. **Scontrino vs Fattura**: la scelta è **aziendale**, non per singolo documento.
4. **Whatsender**: provider scelto, verificare costi + limiti.
5. **ADE**: affidarsi a intermediario accreditato, no reinventare la ruota.
6. **Privacy/GDPR**: gestire consensi per invio via email/WhatsApp.

---

## 🔗 Collegamenti utili

- **Documentazione FatturaPA**: https://www.fatturapa.gov.it/
- **SDI (Sistema di Interscambio)**: https://www.fatturapa.gov.it/it/sistemainterscambio/
- **Documento Commerciale Online**: https://www.agenziaentrate.gov.it/
- **Whatsender**: https://www.whatsender.io/
- **FattureInCloud API**: https://developers.fattureincloud.it/
- **Aruba API**: https://www.aruba.it/

---

## 📝 Changelog

- **20/09/2026** — Creazione roadmap iniziale

---

### 🌐 5. WebApp Cliente (stile Apple)

**Obiettivo**: dare a ogni cliente un accesso **personale** (webapp mobile-friendly in stile Apple) per consultare la sua scheda tricologica, i protocolli e i prossimi appuntamenti.

**Connessione con Tricolab v2 (SOFTWARE ANALISI)**: la webapp cliente **legge** i dati da Supabase (tabella `analisi`, `prodotti_cliente`, `clienti`) → i dati sono gli stessi che l'operatore vede in Tricolab v2.

#### 📲 Come il cliente accede

**3 canali di distribuzione:**
- [ ] **QR Code** stampato in studio / biglietto da visita / scontrino
- [ ] **Email** automatica (link alla webapp con token personale)
- [ ] **WhatsApp** (via Whatsender → link diretto)

Ogni cliente ha un **link univoco personale** (token firmato, scadenza opzionale).

#### 🖥️ Cosa vede il cliente nella WebApp

**1. Dashboard personale**
- [ ] Saluto con nome cliente
- [ ] Card **"Prossimo appuntamento"** (data, ora, sede operativa)
- [ ] Card **"Ultima analisi"** (data, sintesi breve, densità/calibro)
- [ ] Link rapidi: "Protocolli", "Rituale di cura", "Contatti studio"

**2. I miei appuntamenti** (solo consultazione, NO disdetta)
- [ ] Lista prossimi appuntamenti (data + ora + tipologia check-up)
- [ ] Storico visite passate (date)
- [ ] ❌ **NESSUNA possibilità di disdetta** — solo visualizzazione
- [ ] Nota: "Per modifiche o disdette, contattare lo studio"

**3. Scheda Tricologica** (collegata a Tricolab v2)
- [ ] Grafico evoluzione densità/calibro/anisotropia (mini-dashboard)
- [ ] Ultimo report (PDF scaricabile)
- [ ] Foto tricoscopiche archiviate (visibili solo al cliente)

**4. Protocolli d'uso**
- [ ] Lista prodotti assegnati con:
  - Modalità d'uso
  - Frequenza
  - Data inizio / durata
  - Eventuale prossimo rinnovo (se applicabile)
- [ ] Filtro per tipologia (Topici, Detersione, Integratori, Cerotti)

**5. Rituale di Cura** (con data)
- [ ] Protocollo sequenziale (Fase 1, Fase 2, ...)
- [ ] Data di emissione
- [ ] PDF scaricabile

**6. Contatti Studio Righetti**
- [ ] **Sede operativa**: Piazza III Novembre 38, 23017 Morbegno (SO)
- [ ] **Telefono**: 0342 234040 (tap-to-call)
- [ ] **WhatsApp**: pulsante diretto con messaggio pre-compilato
- [ ] **Email**: studio@righetti.it (tap-to-mail)
- [ ] Mappa Google integrata (embed)
- [ ] Orari di apertura

**7. Impostazioni cliente** (opzionale)
- [ ] Lingua (IT/EN futuro)
- [ ] Notifiche push (futuro, PWA)
- [ ] Privacy / gestione dati

#### 🎨 Stile & UX

- **Stile Apple** coerente con Tricolab v2 (SF Pro, palette Apple)
- **Mobile-first** (PWA, installabile su iPhone/Android)
- **Dark mode** automatica
- **Animazioni fluide** (framer-motion o CSS)
- **Offline-first** (cache dei dati per accesso senza connessione)

#### 🛠️ Stack tecnico

**Opzione A — React + Vite separato** (consigliata)
- Nuovo progetto React `tricolab-app-cliente`
- Semplice SPA con routing pubblico
- Deploy su Vercel (gratis o Pro)
- Legge dati da Supabase (RLS su `cliente_id` = token del cliente)

**Opzione B — PWA dentro Tricolab v2**
- Route pubbliche `app.tricolab.it/c/{token}`
- Riusa componenti già esistenti
- Un solo deploy

**Consiglio**: Opzione A (separazione netta, più sicura, deploy indipendente).

#### 🔐 Sicurezza

- **Token firmato** (JWT con `cliente_id` dentro, scadenza 1 anno)
- **RLS Supabase** dedicato per lettura pubblica con token valido
- **Rate limiting** (anti-scraping)
- **HTTPS obbligatorio**
- Nessuna scrittura (solo lettura dei dati del cliente)

#### 💰 Costi aggiuntivi

- **Vercel** (già attivo per Tricolab v2) → 0 €
- **Token/sessione** → gestiti lato backend → 0 €
- **QR Code** → generato automaticamente → 0 €

#### 🔗 Collegamenti

- **GESTIONALE** → genera token + invia link (email, WhatsApp, QR)
- **Tricolab v2** → fornisce i dati letti dal cliente
- **Supabase** → fonte unica di verità

#### ❓ Domande aperte

- [ ] Il cliente vede **solo** i propri dati o anche quelli di altri (es. famigliari)?
- [ ] Serve upload di documenti dal cliente (es. foto fatte a casa)?
- [ ] Serve pagamento online (acconto prenotazione)?
- [ ] Serve chat studio-cliente?

#### 📅 Fase suggerita

- **Fase 5A** → WebApp base (login cliente, dashboard, appuntamenti, contatti)
- **Fase 5B** → Scheda tricologica (grafici, foto, report)
- **Fase 5C** → Protocolli + Rituale di cura (PDF)
- **Fase 5D** → PWA + Notifiche push
- **Fase 5E** → Email/WhatsApp/QR automatici


---

### 🏢 6. Multi-tenant SaaS (Software in Licenza / White-Label)

**Obiettivo**: rendere il software **vendibile** ad altre aziende (parafarmacie, studi tricologici, centri estetici) come **SaaS in abbonamento** o **licenza self-hosted**.

#### 📊 Due modelli possibili

**🅰️ SaaS classico (tu gestisci tutto)**
- Un backend condiviso (Railway)
- Un Supabase condiviso
- **Isolamento dati** via `tenant_id` su tutte le tabelle
- Ogni azienda paga **abbonamento mensile** (es. 49-99 €/mese)
- Tu gestisci server, backup, aggiornamenti
- Provisioning nuovo tenant = 1 click

**🅱️ Licenza self-hosted (il cliente gestisce)**
- Ogni azienda ha il **suo** Supabase + **suo** Railway
- Tu vendi la **licenza** (una tantum o annuale)
- Il cliente gestisce i suoi dati in autonomia
- Zero costi server per te
- Serve sistema di **attivazione licenza** (chiave univoca)

#### 🔧 Requisiti tecnici

**Multi-tenancy (per 🅰️)**
- [ ] Colonna `tenant_id` (uuid) su **tutte** le tabelle dati (`clienti`, `analisi`, `prodotti`, `prodotti_cliente`, `configurazione`, `dati_aziendali`)
- [ ] Tabella `tenants` (id, nome_azienda, piano, data_attivazione, ...)
- [ ] Tabella `users_tenants` (mapping utente ↔ tenant, ruoli)
- [ ] **RLS aggiornata**: `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`
- [ ] Backend FastAPI: filtrare query per `tenant_id` (dal JWT)
- [ ] Storage Supabase: path `tenants/{tenant_id}/clienti/...`

**Onboarding (per entrambi)**
- [ ] Pagina **Signup** pubblica (crea admin + tenant)
- [ ] **Flusso inviti**: admin invita utenti via email
- [ ] **Ruoli**: owner, admin, operatore, cliente
- [ ] **Pagina onboarding**: setup iniziale (nome studio, logo, P.IVA, ecc.)
- [ ] **Wizard primo avvio**: crea primo cliente di test + primo prodotto

**Apple / Google Login (per SaaS)**
- [ ] **Google OAuth**: registrazione Google Cloud Console + Client ID + Secret
- [ ] **Apple Sign In**: Apple Developer Program (99 $/anno) + Service ID + chiave
- [ ] Alternativa: **Magic Link via email** (più semplice, già supportato)
- [ ] **2FA** opzionale per admin

**Licenza (per 🅱️)**
- [ ] Generatore **chiave licenza** univoca (UUID firmato)
- [ ] Pagina **Attivazione** al primo avvio
- [ ] Verifica periodica licenza (ogni 30 gg → ping server licenze)
- [ ] **Sistema licenze** (tuo server) con:
  - Attivazione / disattivazione
  - Scadenza
  - Limite clienti (per piano)
  - Limite utenti (per piano)
- [ ] **Binding** licenza ↔ installazione (hash macchina/dominio)

**Fatturazione SaaS (per 🅰️)**
- [ ] **Stripe** o **Paddle** per pagamenti ricorrenti
- [ ] Piani: Base / Pro / Enterprise
- [ ] Trial gratuito 14/30 giorni
- [ ] **Dashboard super-admin** (tu): tenants attivi, MRR, churn

**Isolamento dati garantito**
- [ ] Test RLS: utente A non vede dati B
- [ ] Test API: chiamate cross-tenant bloccate
- [ ] Test storage: file A non accessibili da B
- [ ] Backup separati per tenant
- [ ] GDPR compliance (ogni tenant può esportare/cancellare dati)

#### 🎨 UI/UX differenze

- **Logo azienda** caricabile da tenant (white-label)
- **Colori tema** (opzionale)
- **Nome studio** ovunque (fatture, PDF, email)
- **Dominio custom** (es. `app.{azienda}.it`) → Vercel multi-domain
- **Email transazionali** con mittente azienda (SMTP custom)

#### 💰 Monetizzazione suggerita

| Piano | Prezzo | Clienti | Utenti | Feature |
|-------|--------|---------|--------|---------|
| Base | 49 €/mese | Fino a 100 | 2 | Analisi base |
| Pro | 99 €/mese | Fino a 500 | 5 | + Dashboard, PDF avanzati |
| Enterprise | 199 €/mese | Illimitati | Illimitati | + API, export, custom |
| Self-hosted | 2.500 € una tantum | Illimitati | Illimitati | Codice + supporto 1 anno |

#### 🚦 Fasi di sviluppo

**Fase 1 — Refactoring multi-tenant**
- [ ] Aggiungere `tenant_id` su tutte le tabelle
- [ ] Migrazione dati esistenti (crea tenant "default" per Righetti)
- [ ] RLS multi-tenant
- [ ] Backend filtra per tenant

**Fase 2 — Onboarding**
- [ ] Pagina Signup
- [ ] Wizard primo avvio
- [ ] Flusso inviti utenti
- [ ] Ruoli

**Fase 3 — Fatturazione**
- [ ] Stripe/Paddle
- [ ] Piani
- [ ] Trial

**Fase 4 — White-label**
- [ ] Logo custom
- [ ] Dominio custom
- [ ] Email custom

**Fase 5 — Licenza self-hosted (opzionale)**
- [ ] Sistema licenze
- [ ] Attivazione
- [ ] Binding

#### ⚠️ Note importanti

1. **Complessità**: Fase 1-5 = **2-3 mesi** di lavoro full-time
2. **Decisione critica**: scegliere 🅰️ SaaS o 🅱️ self-hosted **prima** di iniziare il refactoring
3. **Legale**: P.IVA, contratto SaaS, GDPR, ToS, Privacy Policy
4. **Supporto**: clienti SaaS richiedono supporto continuo (email, telefono)
5. **Marketing**: sito web, SEO, campagne → vendere il software è un lavoro a sé
6. **Alternativa**: **rivendere Tricolab v2** solo come **consulenza** (setup + formazione) + **licenza annuale** → molto più semplice

#### 🎯 Decisione da prendere (futuro)

Prima di iniziare, rispondere a:
- [ ] Voglio clienti SaaS (abbonamento) o licenze (una tantum)?
- [ ] Ho tempo per supporto continuo ai clienti?
- [ ] Voglio fare marketing (vendere a sconosciuti) o solo passaparola?
- [ ] Serve P.IVA dedicata al software?
- [ ] Accetto di gestire server/dati di altre aziende (GDPR)?

**Consiglio**: partire con **1 cliente pilota amico** (self-hosted, gratis) → imparare → poi decidere se fare SaaS.

