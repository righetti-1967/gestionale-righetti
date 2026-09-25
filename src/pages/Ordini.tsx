import { useEffect, useMemo, useState } from 'react';
import { getOrdini, type OrdineConFornitore } from '../lib/ordini';
import { formatEuro } from '../lib/fatture';
import { Toast, type ToastTipo } from '../components/Toast';
import { DettaglioOrdine } from '../components/DettaglioOrdine';

type FiltroStato = 'tutti' | 'bozza' | 'inviato' | 'ricevuto' | 'annullato';

export function Ordini() {
  const [ordini, setOrdini] = useState<OrdineConFornitore[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutti');
  const [filtroMese, setFiltroMese] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);
  const [ordineSelezionato, setOrdineSelezionato] = useState<OrdineConFornitore | null>(null);

  useEffect(() => {
    caricaOrdini();
  }, []);

  async function caricaOrdini() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getOrdini();
      setOrdini(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento ordini');
    } finally {
      setLoading(false);
    }
  }

  // Filtri applicati
  const ordiniFiltrati = useMemo(() => {
    return ordini.filter((o) => {
      // Filtro stato
      if (filtroStato !== 'tutti' && o.stato !== filtroStato) return false;

      // Filtro mese
      if (filtroMese) {
        const d = new Date(o.data_ordine);
        const annoMese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (annoMese !== filtroMese) return false;
      }

      // Ricerca
      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        const numero = o.numero_ordine.toLowerCase();
        const fornitore = (o.fornitore?.ragione_sociale || '').toLowerCase();
        if (!numero.includes(q) && !fornitore.includes(q)) return false;
      }

      return true;
    });
  }, [ordini, filtroStato, filtroMese, ricerca]);

  // Statistiche
  const stats = useMemo(() => {
    const bozze = ordini.filter((o) => o.stato === 'bozza').length;
    const inviati = ordini.filter((o) => o.stato === 'inviato').length;
    const ricevuti = ordini.filter((o) => o.stato === 'ricevuto').length;
    const annullati = ordini.filter((o) => o.stato === 'annullato').length;
    return { bozze, inviati, ricevuti, annullati, totale: ordini.length };
  }, [ordini]);

  // Mesi disponibili
  const mesiDisponibili = useMemo(() => {
    const set = new Set<string>();
    for (const o of ordini) {
      const d = new Date(o.data_ordine);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort().reverse();
  }, [ordini]);

  function formatData(data: string | null): string {
    if (!data) return '—';
    try {
      return new Date(data).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">
          Ordini Fornitori
        </h1>
        <p className="text-sm text-apple-gray">
          {ordiniFiltrati.length}{' '}
          {ordiniFiltrati.length === 1 ? 'ordine' : 'ordini'}
        </p>
      </div>

      {/* Card statistiche cliccabili */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFiltroStato(filtroStato === 'bozza' ? 'tutti' : 'bozza')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'bozza'
              ? 'bg-gray-500 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'bozza' ? 'text-white/90' : 'text-apple-gray'}`}>
            📝 Bozze
          </p>
          <p className={`text-2xl font-bold ${filtroStato === 'bozza' ? 'text-white' : 'text-apple-darkgray'}`}>
            {stats.bozze}
          </p>
        </button>

        <button
          onClick={() => setFiltroStato(filtroStato === 'inviato' ? 'tutti' : 'inviato')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'inviato'
              ? 'bg-blue-500 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'inviato' ? 'text-white/90' : 'text-apple-gray'}`}>
            📤 Inviati
          </p>
          <p className={`text-2xl font-bold ${filtroStato === 'inviato' ? 'text-white' : 'text-apple-blue'}`}>
            {stats.inviati}
          </p>
        </button>

        <button
          onClick={() => setFiltroStato(filtroStato === 'ricevuto' ? 'tutti' : 'ricevuto')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'ricevuto'
              ? 'bg-green-600 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'ricevuto' ? 'text-white/90' : 'text-apple-gray'}`}>
            ✓ Ricevuti
          </p>
          <p className={`text-2xl font-bold ${filtroStato === 'ricevuto' ? 'text-white' : 'text-green-600'}`}>
            {stats.ricevuti}
          </p>
        </button>

        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">📊 Totale ordini</p>
          <p className="text-2xl font-bold text-apple-darkgray">{stats.totale}</p>
          {(filtroStato !== 'tutti' || filtroMese || ricerca) && (
            <p className="text-xs mt-1 text-apple-gray">
              Filtrati: {ordiniFiltrati.length}
            </p>
          )}
        </div>
      </div>

      {/* Filtri */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per numero ordine o fornitore..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
          />
        </div>
        <select
          value={filtroMese}
          onChange={(e) => setFiltroMese(e.target.value)}
          className="px-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
        >
          <option value="">Tutti i mesi</option>
          {mesiDisponibili.map((m) => {
            const [anno, mese] = m.split('-');
            const nomeMese = new Date(
              Number(anno),
              Number(mese) - 1,
              1
            ).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
            return (
              <option key={m} value={m}>
                {nomeMese}
              </option>
            );
          })}
        </select>
        {(filtroStato !== 'tutti' || filtroMese || ricerca) && (
          <button
            onClick={() => {
              setFiltroStato('tutti');
              setFiltroMese('');
              setRicerca('');
            }}
            className="px-4 py-3 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors whitespace-nowrap"
          >
            ✕ Rimuovi filtri
          </button>
        )}
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

      {!loading && !errore && ordiniFiltrati.length === 0 && (
        <div className="bg-white rounded-apple shadow-apple p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-apple-darkgray font-medium mb-1">
            Nessun ordine trovato
          </p>
          <p className="text-apple-gray text-sm">
            {ricerca || filtroMese || filtroStato !== 'tutti'
              ? 'Prova a modificare i filtri'
              : 'Crea il tuo primo ordine dal Magazzino'}
          </p>
        </div>
      )}

      {!loading && !errore && ordiniFiltrati.length > 0 && (
        <>
          {/* MOBILE: Card */}
          <div className="md:hidden space-y-3">
            {ordiniFiltrati.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrdineSelezionato(o)}
                className="w-full bg-white rounded-apple shadow-apple p-4 text-left hover:bg-blue-50/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {o.numero_ordine}
                    </p>
                    <p className="text-xs text-apple-gray truncate">
                      {o.fornitore?.ragione_sociale || '—'}
                    </p>
                  </div>
                  <span className="text-base font-bold text-apple-darkgray shrink-0">
                    {formatEuro(Number(o.totale_lordo))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-apple-gray">
                    📅 {formatData(o.data_ordine)}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      o.stato === 'bozza'
                        ? 'bg-gray-100 text-apple-darkgray'
                        : o.stato === 'inviato'
                        ? 'bg-blue-100 text-apple-blue'
                        : o.stato === 'ricevuto'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {o.stato === 'bozza' && '📝 Bozza'}
                    {o.stato === 'inviato' && '📤 Inviato'}
                    {o.stato === 'ricevuto' && '✓ Ricevuto'}
                    {o.stato === 'annullato' && '✕ Annullato'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* DESKTOP: Tabella */}
          <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
              <div className="col-span-3">Numero</div>
              <div className="col-span-3">Fornitore</div>
              <div className="col-span-2">Data</div>
              <div className="col-span-2 text-right">Totale</div>
              <div className="col-span-2 text-right">Stato</div>
            </div>

            <div className="divide-y divide-gray-100">
              {ordiniFiltrati.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOrdineSelezionato(o)}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center text-left"
                >
                  <div className="col-span-3">
                    <p className="text-sm font-semibold text-apple-darkgray">
                      {o.numero_ordine}
                    </p>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-apple-darkgray truncate">
                      {o.fornitore?.ragione_sociale || '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-apple-gray">
                      {formatData(o.data_ordine)}
                    </p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-bold text-apple-darkgray">
                      {formatEuro(Number(o.totale_lordo))}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                        o.stato === 'bozza'
                          ? 'bg-gray-100 text-apple-darkgray'
                          : o.stato === 'inviato'
                          ? 'bg-blue-100 text-apple-blue'
                          : o.stato === 'ricevuto'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {o.stato === 'bozza' && '📝 Bozza'}
                      {o.stato === 'inviato' && '📤 Inviato'}
                      {o.stato === 'ricevuto' && '✓ Ricevuto'}
                      {o.stato === 'annullato' && '✕ Annullato'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {ordineSelezionato && (
        <DettaglioOrdine
          ordine={ordineSelezionato}
          onClose={() => setOrdineSelezionato(null)}
          onUpdated={() => {
            setOrdineSelezionato(null);
            caricaOrdini();
          }}
          onToast={(msg, tipo) => setToast({ message: msg, tipo })}
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
