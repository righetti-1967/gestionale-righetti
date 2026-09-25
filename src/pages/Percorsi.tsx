import { useEffect, useState } from 'react';
import { getTuttiPercorsi, type Percorso, type StatoPercorso } from '../lib/percorsi';
import { getClienti, type Cliente } from '../lib/clienti';
import { getFatture } from '../lib/fatture';
import { getScarichiFattura } from '../lib/scarichi';
import {
  calcolaResiduo,
  formatEuro,
  type ResiduoPercorso,
} from '../lib/percorsi-helper';
import { DettaglioPercorso } from '../components/DettaglioPercorso';
import { FormNuovaFattura } from '../components/FormNuovaFattura';
import { Toast, type ToastTipo } from '../components/Toast';

interface PercorsoConDati {
  percorso: Percorso;
  cliente: Cliente | null;
  residuo: ResiduoPercorso;
  stato: StatoPercorso;
  fatturaIncassata: boolean;
}

type FiltroStato =
  | 'attivi'
  | 'in-scadenza'
  | 'da-incassare'
  | 'da-fatturare'
  | 'completati'
  | 'scaduti'
  | 'terminati'
  | 'bloccati'
  | 'tutti';

const STATO_CONFIG: Record<
  StatoPercorso,
  { label: string; colore: string }
> = {
  attivo: { label: '🟢 Attivo', colore: 'bg-green-100 text-green-700' },
  'in-scadenza': { label: '🟡 In scadenza', colore: 'bg-amber-100 text-amber-700' },
  'da-incassare': { label: '🟠 Da incassare', colore: 'bg-orange-100 text-orange-700' },
  'da-fatturare': { label: '🟡 Da fatturare', colore: 'bg-yellow-100 text-yellow-700' },
  completato: { label: '🔵 Completato', colore: 'bg-blue-100 text-blue-700' },
  scaduto: { label: '🔴 Scaduto', colore: 'bg-red-100 text-red-700' },
  bloccato: { label: '🔴 Bloccato', colore: 'bg-red-100 text-red-700' },
  terminato: { label: '⚫ Terminato', colore: 'bg-gray-200 text-gray-700' },
};

export function Percorsi() {
  const [percorsi, setPercorsi] = useState<PercorsoConDati[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('attivi');
  const [percorsoSelezionato, setPercorsoSelezionato] = useState<PercorsoConDati | null>(null);
  const [fatturaDaPercorso, setFatturaDaPercorso] = useState<PercorsoConDati | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    caricaPercorsi();
  }, []);

  async function caricaPercorsi() {
    try {
      setLoading(true);
      setErrore(null);

      const [tuttiPercorsi, tuttiClienti, tutteFatture] = await Promise.all([
        getTuttiPercorsi(),
        getClienti(),
        getFatture(),
      ]);

      const clientiById = new Map(tuttiClienti.map((c) => [c.id, c]));
      const fattureIncassate = new Set(
        tutteFatture.filter((f) => !!f.data_incasso).map((f) => f.id)
      );

      const oggi = new Date();
      const trentaGiorniMs = 30 * 24 * 60 * 60 * 1000;

      const risultati: PercorsoConDati[] = await Promise.all(
        tuttiPercorsi.map(async (p) => {
          let scarichi: Awaited<ReturnType<typeof getScarichiFattura>> = [];
          if (p.fattura_id) {
            try {
              scarichi = await getScarichiFattura(p.fattura_id);
            } catch {
              scarichi = [];
            }
          }

          // Conserva TUTTI i campi delle righe scaricate (senza scartare prodotto_percorso_id)
          const righeScaricate = scarichi.flatMap((s) => s.righe || []);

          const residuo = calcolaResiduo(p.righe || [], righeScaricate);
          const completato = residuo.valore_residuo_lordo <= 0;

          const dataFine = new Date(p.data_fine);
          const scaduto = dataFine < oggi;
          const inScadenza =
            !scaduto && dataFine.getTime() - oggi.getTime() <= trentaGiorniMs;

          let stato: StatoPercorso;
          if (completato) {
            stato = 'completato';
          } else if (p.terminato) {
            stato = 'terminato';
          } else if (p.bloccato) {
            stato = 'bloccato';
          } else if (!p.fattura_id) {
            stato = 'da-fatturare';
          } else if (!fattureIncassate.has(p.fattura_id)) {
            stato = 'da-incassare';
          } else if (scaduto) {
            stato = 'scaduto';
          } else if (inScadenza) {
            stato = 'in-scadenza';
          } else {
            stato = 'attivo';
          }

          const fatturaIncassata = p.fattura_id
            ? fattureIncassate.has(p.fattura_id)
            : false;

          return {
            percorso: p,
            cliente: clientiById.get(p.cliente_id) || null,
            residuo,
            stato,
            fatturaIncassata,
          };
        })
      );

      setPercorsi(risultati);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento percorsi');
    } finally {
      setLoading(false);
    }
  }

  const percorsiFiltrati = percorsi
    .filter((p) => {
      if (filtroStato === 'tutti') return true;
      if (filtroStato === 'attivi') return p.stato === 'attivo';
      if (filtroStato === 'in-scadenza') return p.stato === 'in-scadenza';
      if (filtroStato === 'da-incassare') return p.stato === 'da-incassare';
      if (filtroStato === 'da-fatturare') return p.stato === 'da-fatturare';
      if (filtroStato === 'completati') return p.stato === 'completato';
      if (filtroStato === 'scaduti') return p.stato === 'scaduto';
      if (filtroStato === 'terminati') return p.stato === 'terminato';
      if (filtroStato === 'bloccati') return p.stato === 'bloccato';
      return true;
    })
    .filter((p) => {
      if (!ricerca.trim()) return true;
      const q = ricerca.toLowerCase();
      const nomeCliente = p.cliente?.nome_cognome.toLowerCase() || '';
      const nomePercorso = p.percorso.nome.toLowerCase();
      return nomeCliente.includes(q) || nomePercorso.includes(q);
    });

  const percorsiOperativi = percorsi.filter(
    (p) =>
      p.stato === 'attivo' ||
      p.stato === 'in-scadenza' ||
      p.stato === 'da-incassare' ||
      p.stato === 'da-fatturare'
  );
  const totaleOperativi = percorsiOperativi.length;
  const residuoTotaleOperativi = percorsiOperativi.reduce(
    (sum, p) => sum + p.residuo.valore_residuo_lordo,
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Percorsi</h1>
          <p className="text-sm text-apple-gray">{totaleOperativi} percorsi in corso</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">🎯 Percorsi in corso</p>
          <p className="text-2xl font-bold text-apple-darkgray">{totaleOperativi}</p>
        </div>
        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">💶 Valore Residuo Totale</p>
          <p className="text-2xl font-bold text-green-600">
            {formatEuro(residuoTotaleOperativi)}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per cliente o nome percorso..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {(() => {
            const configFiltri: {
              id: FiltroStato;
              stato: StatoPercorso;
              label: string;
              pallino: string;
              attivoBg: string;
              attivoText: string;
            }[] = [
              { id: 'attivi', stato: 'attivo', label: 'Attivi', pallino: 'bg-green-500', attivoBg: 'bg-green-500', attivoText: 'text-white' },
              { id: 'in-scadenza', stato: 'in-scadenza', label: 'In scadenza', pallino: 'bg-amber-500', attivoBg: 'bg-amber-500', attivoText: 'text-white' },
              { id: 'da-incassare', stato: 'da-incassare', label: 'Da incassare', pallino: 'bg-orange-500', attivoBg: 'bg-orange-500', attivoText: 'text-white' },
              { id: 'da-fatturare', stato: 'da-fatturare', label: 'Da fatturare', pallino: 'bg-yellow-500', attivoBg: 'bg-yellow-500', attivoText: 'text-white' },
              { id: 'completati', stato: 'completato', label: 'Completati', pallino: 'bg-blue-500', attivoBg: 'bg-blue-500', attivoText: 'text-white' },
              { id: 'terminati', stato: 'terminato', label: 'Terminati', pallino: 'bg-gray-500', attivoBg: 'bg-gray-600', attivoText: 'text-white' },
              { id: 'scaduti', stato: 'scaduto', label: 'Scaduti', pallino: 'bg-red-500', attivoBg: 'bg-red-500', attivoText: 'text-white' },
              { id: 'bloccati', stato: 'bloccato', label: 'Bloccati', pallino: 'bg-red-700', attivoBg: 'bg-red-700', attivoText: 'text-white' },
            ];

            return configFiltri.map((f) => {
              const isAttivo = filtroStato === f.id;
              const count = percorsi.filter((p) => p.stato === f.stato).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltroStato(f.id)}
                  disabled={count === 0 && !isAttivo}
                  className={`rounded-apple p-3 text-left transition-all shadow-apple ${
                    isAttivo
                      ? `${f.attivoBg} ${f.attivoText}`
                      : count === 0
                      ? 'bg-white opacity-50 cursor-not-allowed'
                      : 'bg-white hover:shadow-apple-lg'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${isAttivo ? 'bg-white' : f.pallino}`}></span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${isAttivo ? 'text-white/90' : 'text-apple-gray'}`}>
                      {f.label}
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${isAttivo ? 'text-white' : 'text-apple-darkgray'}`}>
                    {count}
                  </p>
                </button>
              );
            });
          })()}
        </div>

        <button
          onClick={() => setFiltroStato('tutti')}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-apple text-sm font-semibold transition-all shadow-apple ${
            filtroStato === 'tutti'
              ? 'bg-apple-blue text-white'
              : 'bg-white text-apple-darkgray hover:shadow-apple-lg'
          }`}
        >
          📋 Mostra tutti ({percorsi.length})
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-apple-gray text-sm">Caricamento...</div>
        </div>
      )}

      {errore && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4 text-red-700 text-sm">
          ❌ {errore}
        </div>
      )}

      {!loading && !errore && percorsiFiltrati.length > 0 && (
        <>
          <div className="md:hidden space-y-3">
            {percorsiFiltrati.map((p) => (
              <button
                key={p.percorso.id}
                onClick={() => setPercorsoSelezionato(p)}
                className="w-full bg-white rounded-apple shadow-apple p-4 text-left hover:bg-blue-50/40 transition-colors"
              >
                <CardPercorsoMobile dati={p} />
              </button>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
              <div className="col-span-3">Cliente</div>
              <div className="col-span-3">Percorso</div>
              <div className="col-span-2">Scadenza</div>
              <div className="col-span-2 text-right">Residuo</div>
              <div className="col-span-2 text-right">Stato</div>
            </div>

            <div className="divide-y divide-gray-100">
              {percorsiFiltrati.map((p) => {
                const cfg = STATO_CONFIG[p.stato];
                return (
                  <button
                    key={p.percorso.id}
                    onClick={() => setPercorsoSelezionato(p)}
                    className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors text-left items-center"
                  >
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                        {p.cliente?.nome_cognome
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || '—'}
                      </div>
                      <p className="text-sm text-apple-darkgray truncate">
                        {p.cliente?.nome_cognome || '—'}
                      </p>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm font-semibold text-apple-darkgray truncate">
                        {p.percorso.nome}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-apple-gray">
                        {formatData(p.percorso.data_fine)}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm font-bold text-apple-darkgray">
                        {formatEuro(p.residuo.valore_residuo_lordo)}
                      </p>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.colore}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {percorsoSelezionato && (
        <DettaglioPercorso
          percorso={percorsoSelezionato.percorso}
          cliente={percorsoSelezionato.cliente}
          residuo={percorsoSelezionato.residuo}
          fatturaIncassata={percorsoSelezionato.fatturaIncassata}
          stato={percorsoSelezionato.stato}
          onClose={() => setPercorsoSelezionato(null)}
          onUpdated={() => { setPercorsoSelezionato(null); caricaPercorsi(); }}
          onFattura={() => {
            const p = percorsoSelezionato;
            setPercorsoSelezionato(null);
            setFatturaDaPercorso(p);
          }}
        />
      )}

      {fatturaDaPercorso && (
        <FormNuovaFattura
          clienteIniziale={fatturaDaPercorso.cliente}
          percorsoIniziale={fatturaDaPercorso.percorso}
          onClose={() => setFatturaDaPercorso(null)}
          onSuccess={() => {
            setFatturaDaPercorso(null);
            caricaPercorsi();
            setToast({ message: 'Fattura creata con successo', tipo: 'success' });
          }}
        />
      )}

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

function CardPercorsoMobile({ dati }: { dati: PercorsoConDati }) {
  const { percorso, cliente, residuo, stato } = dati;
  const cfg = STATO_CONFIG[stato];

  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-apple-darkgray truncate">
            {percorso.nome}
          </p>
          <p className="text-xs text-apple-gray truncate">
            {cliente?.nome_cognome || '—'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${cfg.colore}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-apple-gray mb-3">
        📅 {formatData(percorso.data_inizio)} → {formatData(percorso.data_fine)}
      </p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-apple-gray">Residuo</p>
          <p className="text-base font-bold text-apple-darkgray">
            {formatEuro(residuo.valore_residuo_lordo)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-apple-gray">Totale</p>
          <p className="text-xs text-apple-gray font-medium">
            {formatEuro(residuo.valore_totale_lordo)}
          </p>
        </div>
      </div>
    </>
  );
}

function formatData(data: string | null): string {
  if (!data) return '—';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
