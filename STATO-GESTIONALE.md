
---

## 🔮 Backlog / Prossimi sviluppi

### 🔥 PRIORITÀ OGGI (in ordine)

#### 1. ⏰ Motore Cron Automazioni
**Cosa:** Implementare il motore cron per l'invio reale delle automazioni:
- Post-seduta (follow-up dopo appuntamento)
- Compleanno cliente
- Riattivazione cliente dormiente

**Stato attuale:** UI presente (tab Automazioni), manca il trigger schedulato che le esegue.

**Note:** valutare se usare Supabase Edge Functions + pg_cron, oppure backend FastAPI con scheduler (APScheduler / Celery).

---

#### 2. 🔒 RLS policy `_all` da droppare (8-10 tabelle)
**Cosa:** Rimuovere le policy permissive `_all` (che permettono `USING (true)`) su 8-10 tabelle, sostituendole con policy tenant/user-specific.

**Rischio attuale:** Le policy `_all` rendono i dati leggibili/scrivibili a chiunque abbia una sessione attiva, anche se non appartiene al tenant.

**Tabelle coinvolte (da verificare):**
- clienti
- prodotti
- analisi
- eventi
- appuntamenti
- fatture
- ddt
- scontrini
- dati_aziendali
- configurazione
- (verificare tutte)

**Azione:** drop policy `_all`, creare policy specifiche per `user_id` / `tenant_id`.

**Priorità:** ALTA (sicurezza!)

---

### 💡 BACKLOG (futuro)

#### 8. 📞 Chiamate AI Voice (Vapi.ai + Twilio)
**Cosa:** Integrare un sistema di chiamate AI automatiche per:
- Conferma appuntamenti
- Reminder telefonici
- Follow-up post-consulenza

**Provider valutati:**
- Vapi.ai (AI voice) + Twilio (telefonia)
- Cercare alternativa gratuita o low-cost per provare (~10 chiamate di test)

**Stato:** Idea, da valutare costo/beneficio.

---

### 📌 NOTE

- Stessa roadmap vale per **TricoAI** (architettura condivisa)
- Il multitenant "vero" (slug nel path `/vanity/dashboard`) resta in backlog — non urgente, il software funziona già multitenant "di fatto"

---

_Ultimo aggiornamento: 12 ottobre 2026_
FINE_FILE
echo "✅ Aggiunto!"