import { useEffect, useState } from 'react';
import {
  getAppuntamentiCliente,
  OPERATORI,
  COLORI_APPUNTAMENTO,
  coloreDefault,
  calcolaOraFine,
  type Appuntamento,
  type MotivoCancellazione,
} from '../lib/appuntamenti';

const MOTIVO_CONFIG: Record<
  MotivoCancellazione,
  { label: string; colore: string; pallino: string }
> = {
  rebooking: {
    label: 'Disdetta con Rebooking',
    colore: 'bg-orange-100 text-orange-800',
    pallino: 'bg-orange-500',
  },
  disdetta: {
    label: 'Disdetta',
    colore: 'bg-yellow-100 text-yellow-800',
    pallino: 'bg-yellow-500',
  },
  definitiva: {
    label: 'Cancellazione Definitiva',
    colore: 'bg-red-100 text-red-800',
    pallino: 'bg-red-500',
  },
};

const STATO_CONFIG: Record<
  string,
  { label: string; colore: string } | null
> = {
  pending: { label: '⏳ Da confermare', colore: 'bg-amber-100 text-amber-800' },
  prenotato: { label: '📌 Prenotato', colore: 'bg-gray-100 text-gray-700' },
  confermato: { label: '✓ Confermato', colore: 'bg-green-100 text-green-800' },
  completato: null,
  cancellato: null,
};

interface ListaAppuntamentiClienteProps {
  clienteId: number;
  onApriAppuntamento?: (app: Appuntamento) => void;
}

type Tab = 'futuri' | 'completati' | 'cancellati';

export function ListaAppuntamentiCliente({
  clienteId,
  onApriAppuntamento,
}: ListaAppuntamentiClienteProps) {
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('futuri');

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        setErrore(null);
        const data = await getAppuntamentiCliente(clienteId);
        setAppuntamenti(data || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [clienteId]);

  const oggi = new Date().toISOString().split('T')[0];

  const futuri = appuntamenti.filter(
    (a) => a.stato !== 'cancellato' && a.stato !== 'completato' && (a.data || '') >= oggi
  );
  const completati = appuntamenti.filter((a) => a.stato === 'completato');
  const cancellati = appuntamenti.filter((a) => a.stato === 'cancellato');

  const lista =
    tab === 'futuri' ? futuri : tab === 'completati' ? completati : cancellati;

  function formatData(data: string): string {
    if (!data) return '—';
    try {
      return new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return data;
    }
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-xs text-apple-gray">
        Caricamento appuntamenti...
      </div>
    );
  }

  if (errore) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-xs">
        ❌ {errore}
      </div>
    );
  }

  const totFuturi = futuri.length;
  const totCompletati = completati.length;
  const totCancellati = cancellati.length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
          📅 Appuntamenti
        </h3>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-gray-100 rounded-apple p-1 mb-3">
        <button
          onClick={() => setTab('futuri')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === 'futuri'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          📅 Futuri ({totFuturi})
        </button>
        <button
          onClick={() => setTab('completati')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === 'completati'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          ✓ Completati ({totCompletati})
        </button>
        <button
          onClick={() => setTab('cancellati')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            tab === 'cancellati'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          ✕ Disdette ({totCancellati})
        </button>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="bg-gray-50 rounded-apple p-4 text-center">
          <p className="text-xs text-apple-gray">
            {tab === 'futuri' && 'Nessun appuntamento futuro'}
            {tab === 'completati' && 'Nessun appuntamento completato'}
            {tab === 'cancellati' && 'Nessuna disdetta registrata'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((app) => {
            const colore = app.colore || coloreDefault(app.tipo);
            const cfg = COLORI_APPUNTAMENTO[colore] || COLORI_APPUNTAMENTO.gray;
            const oraInizio = (app.ora_inizio || '').slice(0, 5) || '09:00';
            const oraFine = calcolaOraFine(oraInizio, app.durata_minuti || 30);
            const voci = app.voci_selezionate || [];
            const isCliccabile = tab !== 'cancellati';

            // Protezione operatore dinamico
            const opLabel = (app.operatore && OPERATORI[app.operatore]?.label) || app.operatore || 'Operatore';

            // Protezione motivo cancellazione sicuro
            const motivoCfg = (app.motivo_cancellazione && MOTIVO_CONFIG[app.motivo_cancellazione]) || null;

            return (
              <button
                key={app.id}
                type="button"
                onClick={() => isCliccabile && onApriAppuntamento?.(app)}
                disabled={!isCliccabile}
                className={`w-full text-left px-3 py-2.5 rounded-apple border transition-colors ${
                  tab === 'cancellati'
                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-default'
                    : 'bg-white border-gray-200 hover:bg-blue-50/40 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-apple-darkgray capitalize">
                      {formatData(app.data)} • {oraInizio}–{oraFine}
                    </p>
                    <p className="text-xs text-apple-gray truncate mt-0.5">
                      {opLabel}
                      {app.titolo && ` • ${app.titolo}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                    >
                      {app.tipo === 'percorso' && '🎯 Percorso'}
                      {app.tipo === 'checkup_nuovo' && '🆕 Nuovo'}
                      {(app.tipo as string) === 'consulenza' && '💼 Consulenza'}
                      {(app.tipo as string) === 'trattamento' && '💆 Trattamento'}
                      {app.tipo === 'generico' && '📌 Generico'}
                    </span>
                    {app.stato && STATO_CONFIG[app.stato] && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATO_CONFIG[app.stato]!.colore}`}
                      >
                        {STATO_CONFIG[app.stato]!.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge motivo cancellazione protetto da crash */}
                {app.stato === 'cancellato' && app.motivo_cancellazione && (
                  <div className="mt-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        motivoCfg ? motivoCfg.colore : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          motivoCfg ? motivoCfg.pallino : 'bg-gray-500'
                        }`}
                      ></span>
                      {motivoCfg ? motivoCfg.label : String(app.motivo_cancellazione)}
                    </span>
                  </div>
                )}

                {/* Servizi */}
                {voci.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {voci.slice(0, 3).map((v, i) => (
                      <p
                        key={`${v.tipo}-${v.servizio_id || v.prodotto_id || i}`}
                        className="text-[10px] text-apple-gray truncate"
                      >
                        {v.tipo === 'servizio' ? '🛠️' : '📦'} {v.nome || 'Servizio'}
                        {v.durata_minuti && ` (${v.durata_minuti}m)`}
                      </p>
                    ))}
                    {voci.length > 3 && (
                      <p className="text-[10px] text-apple-gray italic">
                        +{voci.length - 3} altri
                      </p>
                    )}
                  </div>
                )}

                {/* Note */}
                {app.note && (
                  <p className="text-[10px] text-apple-gray italic mt-1.5 truncate">
                    📝 {app.note}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
