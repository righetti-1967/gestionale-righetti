import { useEffect, useState } from 'react';
import {
  type TipoAutomazione,
  type ModalitaAutomazione,
  type CanaleAutomazione,
  type ParametriPostSeduta,
  type ParametriCompleanno,
  type ParametriRiattivazione,
  type ParametriPromemoria,
  type Automazione,
  LABEL_AUTOMAZIONE,
  getAutomazioni,
  salvaAutomazione,
} from '../lib/automazioni';
import { Toast, type ToastTipo } from './Toast';
import { AutomazioniTestTab } from './AutomazioniTestTab';

export function AutomazioniTab() {
  const [automazioni, setAutomazioni] = useState<Record<TipoAutomazione, Automazione> | null>(null);
  const [salvando, setSalvando] = useState<TipoAutomazione | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        const tutte = await getAutomazioni();
        setAutomazioni(tutte);
      } catch (err: any) {
        setToast({
          message: '❌ ' + (err?.message || 'Errore caricamento'),
          tipo: 'error',
        });
      }
    }
    carica();
  }, []);

  async function aggiornaAutomazione(
    tipo: TipoAutomazione,
    patch: Partial<Automazione>
  ) {
    if (!automazioni) return;
    const corrente = automazioni[tipo];
    const nuova: Automazione = { ...corrente, ...patch };

    setAutomazioni((prev) => (prev ? { ...prev, [tipo]: nuova } : prev));

    try {
      setSalvando(tipo);
      await salvaAutomazione(
        tipo,
        nuova.attivo,
        nuova.modalita,
        nuova.parametri
      );
      setToast({ message: `✅ ${LABEL_AUTOMAZIONE[tipo].label} salvata`, tipo: 'success' });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore salvataggio'),
        tipo: 'error',
      });
      // Rollback
      setAutomazioni((prev) => (prev ? { ...prev, [tipo]: corrente } : prev));
    } finally {
      setSalvando(null);
    }
  }

  if (!automazioni) {
    return (
      <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
        Caricamento automazioni...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card intro */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-apple p-4 shadow-apple">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <h3 className="text-sm font-bold text-apple-darkgray">
              Automazioni Messaggi
            </h3>
            <p className="text-xs text-apple-gray mt-1 leading-relaxed">
              Configura i messaggi automatici post-seduta, compleanno e riattivazione.
              Il <strong>motore automatico</strong> verrà attivato prossimamente
              (per ora funziona solo in modalità <strong>manuale</strong>).
            </p>
          </div>
        </div>
      </div>

      {/* Card Promemoria Appuntamento */}
      <CardAutomazione
        tipo="promemoria_appuntamento"
        automazione={automazioni.promemoria_appuntamento}
        salvando={salvando === 'promemoria_appuntamento'}
        onUpdate={(patch) => aggiornaAutomazione('promemoria_appuntamento', patch)}
      />

      {/* Card Promemoria Check-Up */}
      <CardAutomazione
        tipo="promemoria_checkup"
        automazione={automazioni.promemoria_checkup}
        salvando={salvando === 'promemoria_checkup'}
        onUpdate={(patch) => aggiornaAutomazione('promemoria_checkup', patch)}
      />

      {/* Card Post-Seduta */}
      <CardAutomazione
        tipo="post_seduta"
        automazione={automazioni.post_seduta}
        salvando={salvando === 'post_seduta'}
        onUpdate={(patch) => aggiornaAutomazione('post_seduta', patch)}
      />

      {/* Card Compleanno */}
      <CardAutomazione
        tipo="compleanno"
        automazione={automazioni.compleanno}
        salvando={salvando === 'compleanno'}
        onUpdate={(patch) => aggiornaAutomazione('compleanno', patch)}
      />

      {/* Card Riattivazione */}
      <CardAutomazione
        tipo="riattivazione"
        automazione={automazioni.riattivazione}
        salvando={salvando === 'riattivazione'}
        onUpdate={(patch) => aggiornaAutomazione('riattivazione', patch)}
      />

      {/* Log Simulazione */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <AutomazioniTestTab />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          tipo={toast.tipo}
          onComplete={() => setToast(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// CARD SINGOLA AUTOMAZIONE
// ============================================================

function CardAutomazione({
  tipo,
  automazione,
  salvando,
  onUpdate,
}: {
  tipo: TipoAutomazione;
  automazione: Automazione;
  salvando: boolean;
  onUpdate: (patch: Partial<Automazione>) => void;
}) {
  const info = LABEL_AUTOMAZIONE[tipo];
  const parametri: any = automazione.parametri;

  function cambiaParametro(campo: string, valore: any) {
    onUpdate({
      parametri: { ...parametri, [campo]: valore },
    });
  }

  return (
    <div className={`bg-white rounded-apple shadow-apple p-5 border-l-4 ${
      automazione.attivo ? 'border-purple-500' : 'border-gray-300'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{info.icona}</span>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-apple-darkgray">
              {info.label}
            </h3>
            <p className="text-xs text-apple-gray mt-0.5">
              {info.descrizione}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {salvando && (
            <span className="text-xs text-apple-gray animate-pulse">💾</span>
          )}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={automazione.attivo}
              onChange={(e) => onUpdate({ attivo: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      {/* Body — visibile solo se attivo */}
      {automazione.attivo && (
        <div className="space-y-4 pt-3 border-t border-gray-100">
          {/* Modalità */}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Modalità
            </label>
            <div className="inline-flex bg-gray-100 rounded-apple p-1 flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onUpdate({ modalita: 'manuale' })}
                className={`px-4 py-2 rounded-apple text-xs font-semibold transition-all ${
                  automazione.modalita === 'manuale'
                    ? 'bg-white text-apple-darkgray shadow-apple'
                    : 'text-apple-gray hover:text-apple-darkgray'
                }`}
              >
                👆 Manuale
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ modalita: 'simulazione' })}
                className={`px-4 py-2 rounded-apple text-xs font-semibold transition-all ${
                  automazione.modalita === 'simulazione'
                    ? 'bg-white text-apple-darkgray shadow-apple'
                    : 'text-apple-gray hover:text-apple-darkgray'
                }`}
              >
                🧪 Simulazione
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ modalita: 'automatico' })}
                className={`px-4 py-2 rounded-apple text-xs font-semibold transition-all ${
                  automazione.modalita === 'automatico'
                    ? 'bg-white text-apple-darkgray shadow-apple'
                    : 'text-apple-gray hover:text-apple-darkgray'
                }`}
              >
                🤖 Automatico
              </button>
            </div>
            {automazione.modalita === 'manuale' && (
              <p className="text-[11px] text-gray-500 mt-2 font-medium">
                👆 Nessun invio automatico. Puoi inviare manualmente dalla modale promemoria in Agenda.
              </p>
            )}
            {automazione.modalita === 'simulazione' && (
              <p className="text-[11px] text-purple-600 mt-2 font-medium">
                🧪 Nessun invio reale. Verranno solo registrati i log di anteprima (sezione "Log simulazione" in fondo).
              </p>
            )}
            {automazione.modalita === 'automatico' && (
              <p className="text-[11px] text-amber-600 mt-2 font-medium">
                ⚠️ Invia DAVVERO ai clienti reali. Verifica prima in modalità Simulazione.
              </p>
            )}
          </div>

          {/* Parametri specifici */}
          {tipo === 'post_seduta' && (() => {
            const ps = parametri as ParametriPostSeduta;
            const q = ps.quantita || 1;
            const u = ps.unita || 'ore';
            let descrizione = '';
            if (u === 'minuti') {
              descrizione = q === 1 ? '1 minuto dopo la seduta' : `${q} minuti dopo la seduta`;
            } else if (u === 'ore') {
              descrizione = q === 1 ? '1 ora dopo la seduta' : `${q} ore dopo la seduta`;
            } else {
              descrizione = q === 1 ? '1 giorno dopo la seduta (stessa ora)' : `${q} giorni dopo la seduta (stessa ora)`;
            }

            return (
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
                  Invia dopo
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={q}
                    onChange={(e) => cambiaParametro('quantita', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                  />
                  <select
                    value={u}
                    onChange={(e) => cambiaParametro('unita', e.target.value)}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                  >
                    <option value="minuti">Minuti</option>
                    <option value="ore">Ore</option>
                    <option value="giorni">Giorni</option>
                  </select>
                </div>
                <p className="text-[11px] text-apple-gray mt-2 italic">
                  💡 {descrizione}
                </p>
                {u === 'minuti' && q < 5 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    ⚠️ Il motore automatico gira ogni 15 min: tempi sotto i 15 min richiedono backend dedicato.
                  </p>
                )}

                {u === 'giorni' && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                      Ora invio
                    </label>
                    <input
                      type="time"
                      value={ps.ora_invio || '09:00'}
                      onChange={(e) => cambiaParametro('ora_invio', e.target.value)}
                      className="w-40 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {(tipo === 'promemoria_appuntamento' || tipo === 'promemoria_checkup') && (() => {
            const pp = parametri as ParametriPromemoria;
            const oreAttuali = pp.ore_anticipo || 24;
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
                    Invia prima
                  </label>
                  <select
                    value={oreAttuali}
                    onChange={(e) => cambiaParametro('ore_anticipo', parseInt(e.target.value))}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                  >
                    <option value="12">12 ore (mezza giornata)</option>
                    <option value="24">24 ore (1 giorno)</option>
                    <option value="48">48 ore (2 giorni)</option>
                    <option value="72">72 ore (3 giorni)</option>
                    <option value="96">96 ore (4 giorni)</option>
                    <option value="120">120 ore (5 giorni)</option>
                    <option value="168">168 ore (7 giorni)</option>
                  </select>
                  <p className="text-[11px] text-apple-gray mt-2 italic">
                    💡 Promemoria inviato {oreAttuali} ore prima dell'appuntamento
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                    Ora invio
                  </label>
                  <input
                    type="time"
                    value={pp.ora_invio || '09:00'}
                    onChange={(e) => cambiaParametro('ora_invio', e.target.value)}
                    className="w-40 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                  />
                </div>

                {/* Link modifica testi */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/impostazioni?tab=testi_template&sottotab=email&template=${tipo === 'promemoria_checkup' ? 'email_promemoria_checkup' : 'email_promemoria'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-apple hover:bg-blue-100"
                  >
                    ✏️ Modifica testo Email
                  </a>
                  <a
                    href={`/impostazioni?tab=testi_template&sottotab=whatsapp&template=whatsapp_promemoria`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-apple hover:bg-green-100"
                  >
                    ✏️ Modifica testo WhatsApp
                  </a>
                </div>
              </div>
            );
          })()}

          {tipo === 'compleanno' && (() => {
            const pc = parametri as ParametriCompleanno;
            const giorniPrima = pc.giorni_prima ?? 0;
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                    Giorni prima del compleanno
                  </label>
                  <select
                    value={giorniPrima}
                    onChange={(e) => cambiaParametro('giorni_prima', parseInt(e.target.value))}
                    className="w-56 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                  >
                    <option value="0">Il giorno del compleanno</option>
                    <option value="1">1 giorno prima</option>
                    <option value="2">2 giorni prima</option>
                    <option value="3">3 giorni prima</option>
                    <option value="5">5 giorni prima</option>
                    <option value="7">7 giorni prima</option>
                  </select>
                  <p className="text-[11px] text-apple-gray mt-2 italic">
                    💡 {giorniPrima === 0
                      ? 'Inviato il giorno stesso del compleanno'
                      : `Inviato ${giorniPrima} giorn${giorniPrima === 1 ? 'o' : 'i'} prima del compleanno`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                    Ora invio
                  </label>
                  <input
                    type="time"
                    value={pc.ora_invio || '09:00'}
                    onChange={(e) => cambiaParametro('ora_invio', e.target.value)}
                    className="w-40 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                  />
                </div>
              </div>
            );
          })()}

          {tipo === 'riattivazione' && (
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                Invia dopo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="15"
                  max="365"
                  value={(parametri as ParametriRiattivazione).giorni_inattivita || 90}
                  onChange={(e) => cambiaParametro('giorni_inattivita', parseInt(e.target.value) || 90)}
                  className="w-24 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                />
                <span className="text-sm text-apple-gray">
                  giorni di inattività del cliente
                </span>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                  Ora invio
                </label>
                <input
                  type="time"
                  value={(parametri as ParametriRiattivazione).ora_invio || '09:00'}
                  onChange={(e) => cambiaParametro('ora_invio', e.target.value)}
                  className="w-40 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-purple-300/40"
                />
              </div>
            </div>
          )}

          {/* Canale */}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Canale di invio
            </label>
            <div className="inline-flex bg-gray-100 rounded-apple p-1">
              {([
                { id: 'whatsapp', label: '💬 WhatsApp' },
                { id: 'email', label: '📧 Email' },
                { id: 'entrambi', label: '🔔 Entrambi' },
              ] as const).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => cambiaParametro('canale', c.id)}
                  className={`px-4 py-2 rounded-apple text-xs font-semibold transition-all ${
                    parametri.canale === c.id
                      ? 'bg-white text-apple-darkgray shadow-apple'
                      : 'text-apple-gray hover:text-apple-darkgray'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!automazione.attivo && (
        <p className="text-xs text-apple-gray italic pt-2">
          Attiva per configurare i parametri.
        </p>
      )}
    </div>
  );
}
