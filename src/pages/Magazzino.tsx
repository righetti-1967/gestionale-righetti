import { useEffect, useMemo, useState } from 'react';
import {
  getMovimenti,
  calcolaStatisticheMovimenti,
  type MovimentoConProdotto,
  type TipoMovimento,
} from '../lib/magazzino';
import { Toast, type ToastTipo } from '../components/Toast';
import { FormNuovoMovimento } from '../components/FormNuovoMovimento';
import { DettaglioMovimento } from '../components/DettaglioMovimento';
import { FormNuovoOrdine } from '../components/FormNuovoOrdine';

type FiltroTipo = 'tutti' | 'carico' | 'scarico';

export function Magazzino() {
  const [movimenti, setMovimenti] = useState<MovimentoConProdotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('tutti');
  const [filtroMese, setFiltroMese] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFormOrdine, setShowFormOrdine] = useState(false);
  const [movimentoSelezionato, setMovimentoSelezionato] =
    useState<MovimentoConProdotto | null>(null);

  useEffect(() => {
    caricaMovimenti();
  }, []);

  async function caricaMovimenti() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getMovimenti();
      setMovimenti(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento movimenti');
    } finally {
      setLoading(false);
    }
  }

  function apriNuovo() {
    setShowForm(true);
  }

  // Filtri applicati
  const movimentiFiltrati = useMemo(() => {
    return movimenti.filter((m) => {
      // Filtro tipo
      if (filtroTipo !== 'tutti' && m.tipo !== filtroTipo) return false;

      // Filtro mese
      if (filtroMese) {
        const d = new Date(m.data_movimento);
        const annoMese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (annoMese !== filtroMese) return false;
      }

      // Ricerca
      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        const nomeProdotto = m.prodotto?.nome.toLowerCase() || '';
        const motivo = (m.motivo || '').toLowerCase();
        const note = (m.note || '').toLowerCase();
        if (
          !nomeProdotto.includes(q) &&
          !motivo.includes(q) &&
          !note.includes(q)
        )
          return false;
      }

      return true;
    });
  }, [movimenti, filtroTipo, filtroMese, ricerca]);

  // Statistiche (calcolate su TUTTI i movimenti)
  const stats = useMemo(
    () => calcolaStatisticheMovimenti(movimenti),
    [movimenti]
  );

  // Mesi disponibili
  const mesiDisponibili = useMemo(() => {
    const set = new Set<string>();
    for (const m of movimenti) {
      const d = new Date(m.data_movimento);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort().reverse();
  }, [movimenti]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">
            Magazzino
          </h1>
          <p className="text-sm text-apple-gray">
            {movimentiFiltrati.length}{' '}
            {movimentiFiltrati.length === 1 ? 'movimento' : 'movimenti'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowFormOrdine(true)}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-gray-800 text-white rounded-apple font-medium text-sm shadow-apple hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
          >
            <span>📦</span>
            <span>Nuovo Ordine</span>
          </button>
          <button
            onClick={apriNuovo}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span>
            <span>Nuovo Movimento</span>
          </button>
        </div>
      </div>

      {/* Card statistiche cliccabili */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setFiltroTipo(filtroTipo === 'carico' ? 'tutti' : 'carico')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroTipo === 'carico'
              ? 'bg-green-600 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroTipo === 'carico' ? 'text-white/90' : 'text-apple-gray'}`}>
            📥 Carichi
          </p>
          <p className={`text-2xl font-bold ${filtroTipo === 'carico' ? 'text-white' : 'text-green-600'}`}>
            {stats.numCarichi}
          </p>
          <p className={`text-xs mt-1 ${filtroTipo === 'carico' ? 'text-white/80' : 'text-apple-gray'}`}>
            {stats.totaleCarichi} pezzi totali
          </p>
        </button>

        <button
          onClick={() => setFiltroTipo(filtroTipo === 'scarico' ? 'tutti' : 'scarico')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroTipo === 'scarico'
              ? 'bg-red-500 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroTipo === 'scarico' ? 'text-white/90' : 'text-apple-gray'}`}>
            📤 Scarichi
          </p>
          <p className={`text-2xl font-bold ${filtroTipo === 'scarico' ? 'text-white' : 'text-red-600'}`}>
            {stats.numScarichi}
          </p>
          <p className={`text-xs mt-1 ${filtroTipo === 'scarico' ? 'text-white/80' : 'text-apple-gray'}`}>
            {stats.totaleScarichi} pezzi totali
          </p>
        </button>

        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">📊 Movimenti totali</p>
          <p className="text-2xl font-bold text-apple-darkgray">{movimenti.length}</p>
          <p className="text-xs mt-1 text-apple-gray">
            {filtroTipo !== 'tutti' || filtroMese || ricerca
              ? `Filtrati: ${movimentiFiltrati.length}`
              : 'Tutti i movimenti'}
          </p>
        </div>
      </div>

      {/* Filtri e ricerca */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per prodotto, motivo o note..."
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
        {(filtroTipo !== 'tutti' || filtroMese || ricerca) && (
          <button
            onClick={() => {
              setFiltroTipo('tutti');
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

      {!loading && !errore && movimentiFiltrati.length === 0 && (
        <div className="bg-white rounded-apple shadow-apple p-12 text-center">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-apple-darkgray font-medium mb-1">
            Nessun movimento trovato
          </p>
          <p className="text-apple-gray text-sm">
            {ricerca || filtroMese || filtroTipo !== 'tutti'
              ? 'Prova a modificare i filtri'
              : 'Registra il tuo primo movimento di magazzino'}
          </p>
        </div>
      )}

      {!loading && !errore && movimentiFiltrati.length > 0 && (
        <>
          {/* MOBILE: Card */}
          <div className="md:hidden space-y-3">
            {movimentiFiltrati.map((m) => (
              <button
                key={m.id}
                onClick={() => setMovimentoSelezionato(m)}
                className="w-full bg-white rounded-apple shadow-apple p-4 text-left hover:bg-blue-50/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {m.prodotto?.nome || '—'}
                    </p>
                    {m.motivo && (
                      <p className="text-xs text-apple-gray mt-0.5 truncate">
                        {m.motivo}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-sm font-bold shrink-0 px-2 py-1 rounded-full ${
                      m.tipo === 'carico'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {m.tipo === 'carico' ? '+' : '−'}
                    {m.quantita}
                  </span>
                </div>
                <p className="text-xs text-apple-gray">
                  📅 {formatData(m.data_movimento)}
                </p>
              </button>
            ))}
          </div>

          {/* DESKTOP: Tabella */}
          <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
              <div className="col-span-2">Data</div>
              <div className="col-span-4">Prodotto</div>
              <div className="col-span-2 text-center">Tipo</div>
              <div className="col-span-1 text-center">Qta</div>
              <div className="col-span-3">Motivo</div>
            </div>

            <div className="divide-y divide-gray-100">
              {movimentiFiltrati.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMovimentoSelezionato(m)}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-blue-50/40 transition-colors text-left"
                >
                  <div className="col-span-2">
                    <p className="text-sm text-apple-gray">
                      {formatData(m.data_movimento)}
                    </p>
                  </div>
                  <div className="col-span-4 min-w-0">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {m.prodotto?.nome || '—'}
                    </p>
                    {m.prodotto?.codice_fornitore && (
                      <p className="text-xs text-apple-gray truncate">
                        Cod. {m.prodotto.codice_fornitore}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 text-center">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        m.tipo === 'carico'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {m.tipo === 'carico' ? '📥 Carico' : '📤 Scarico'}
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <p
                      className={`text-sm font-bold ${
                        m.tipo === 'carico' ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {m.tipo === 'carico' ? '+' : '−'}
                      {m.quantita}
                    </p>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-apple-gray truncate">
                      {m.motivo || '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showForm && (
        <FormNuovoMovimento
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            caricaMovimenti();
            setToast({ message: 'Movimento registrato con successo', tipo: 'success' });
          }}
        />
      )}

      {movimentoSelezionato && (
        <DettaglioMovimento
          movimento={movimentoSelezionato}
          onClose={() => setMovimentoSelezionato(null)}
          onEliminato={() => {
            setMovimentoSelezionato(null);
            caricaMovimenti();
            setToast({ message: 'Movimento eliminato', tipo: 'success' });
          }}
        />
      )}

      {showFormOrdine && (
        <FormNuovoOrdine
          onClose={() => setShowFormOrdine(false)}
          onSuccess={() => {
            setShowFormOrdine(false);
            caricaMovimenti();
            setToast({ message: 'Ordine creato con successo', tipo: 'success' });
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
