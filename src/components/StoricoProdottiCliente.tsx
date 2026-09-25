import { useEffect, useState, useMemo } from 'react';
import { getScarichiCliente, type ScaricoSeduta } from '../lib/scarichi';

interface StoricoProdottiProps {
  clienteId: number;
}

type TabFiltro = 'tutti' | 'prodotti' | 'servizi';

interface VoceStorico {
  id: string;
  tipo: 'prodotto' | 'servizio';
  data: string;
  numeroDdt: number;
  anno: number;
  nome: string;
  quantita: number;
  isExtra: boolean;
}

export function StoricoProdottiCliente({ clienteId }: StoricoProdottiProps) {
  const [scarichi, setScarichi] = useState<ScaricoSeduta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFiltro>('tutti');
  const [ricerca, setRicerca] = useState('');

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        const data = await getScarichiCliente(clienteId);
        setScarichi(data);
      } catch (err) {
        console.error('Errore nel recupero storico cliente:', err);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [clienteId]);

  // Estrae sia PRODOTTI che SERVIZI da tutti i DDT del cliente
  const tutteVoci: VoceStorico[] = useMemo(() => {
    const list: VoceStorico[] = [];
    for (const s of scarichi) {
      const anno = new Date(s.data_seduta).getFullYear();
      for (const r of s.righe || []) {
        const isExtra = r.nome.includes('(EXTRA Percorso)');
        const nomePulito = r.nome.replace(' (EXTRA Percorso)', '').trim();

        list.push({
          id: `${s.id}-${r.tipo}-${r.prodotto_id || r.servizio_id}-${Math.random()}`,
          tipo: r.tipo,
          data: s.data_seduta,
          numeroDdt: s.numero_ddt,
          anno,
          nome: nomePulito,
          quantita: r.quantita,
          isExtra,
        });
      }
    }
    // Ordina per data più recente
    return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [scarichi]);

  // Conteggi
  const totaleProdotti = tutteVoci
    .filter((v) => v.tipo === 'prodotto')
    .reduce((sum, v) => sum + v.quantita, 0);

  const totaleServizi = tutteVoci
    .filter((v) => v.tipo === 'servizio')
    .reduce((sum, v) => sum + v.quantita, 0);

  // Filtra per tab e per ricerca
  const vociFiltrate = useMemo(() => {
    return tutteVoci.filter((v) => {
      if (tab === 'prodotti' && v.tipo !== 'prodotto') return false;
      if (tab === 'servizi' && v.tipo !== 'servizio') return false;

      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        return (
          v.nome.toLowerCase().includes(q) ||
          String(v.numeroDdt).includes(q) ||
          v.data.includes(q)
        );
      }
      return true;
    });
  }, [tutteVoci, tab, ricerca]);

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
    <div className="bg-white rounded-apple border border-gray-200/80 p-4 space-y-3 shadow-sm">
      {/* Header con titolo e ricerca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-apple-darkgray uppercase tracking-wide flex items-center gap-1.5">
            📋 Storico Sedute & Consegne
          </h3>
          <p className="text-[11px] text-apple-gray mt-0.5">
            Tutti i trattamenti eseguiti e i prodotti ritirati con i relativi DDT.
          </p>
        </div>

        {tutteVoci.length > 3 && (
          <input
            type="text"
            placeholder="Cerca voce o DDT..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 w-full sm:w-48"
          />
        )}
      </div>

      {/* Segmented control stile Apple per passare da Tutti / Prodotti / Servizi */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-apple w-fit">
        <button
          type="button"
          onClick={() => setTab('tutti')}
          className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
            tab === 'tutti'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          Tutti ({tutteVoci.length})
        </button>

        <button
          type="button"
          onClick={() => setTab('prodotti')}
          className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
            tab === 'prodotti'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          📦 Prodotti ({totaleProdotti})
        </button>

        <button
          type="button"
          onClick={() => setTab('servizi')}
          className={`px-3 py-1 rounded-apple text-xs font-semibold transition-all ${
            tab === 'servizi'
              ? 'bg-white text-apple-darkgray shadow-sm'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          🛠️ Servizi ({totaleServizi})
        </button>
      </div>

      {/* Lista risultati */}
      {loading ? (
        <p className="text-xs text-apple-gray py-4 text-center">Caricamento storico...</p>
      ) : tutteVoci.length === 0 ? (
        <div className="bg-gray-50 rounded-apple p-4 text-center">
          <p className="text-xs text-apple-gray">
            Nessuna seduta o prodotto ancora registrato per questo cliente.
          </p>
        </div>
      ) : vociFiltrate.length === 0 ? (
        <p className="text-xs text-apple-gray py-3 text-center">
          Nessuna voce trovata per questa categoria o ricerca.
        </p>
      ) : (
        <div className="bg-gray-50 rounded-apple overflow-hidden divide-y divide-gray-200/80 max-h-64 overflow-y-auto border border-gray-200/60">
          {vociFiltrate.map((item, idx) => {
            const numDdtFormattato = `DDT-${String(item.numeroDdt).padStart(3, '0')}-${item.anno}`;
            return (
              <div
                key={idx}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-blue-50/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm shrink-0">
                      {item.tipo === 'servizio' ? '🛠️' : '📦'}
                    </span>
                    <p className="font-semibold text-apple-darkgray truncate">
                      {item.nome}
                    </p>
                    {item.isExtra && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        EXTRA
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-apple-gray mt-0.5">
                    📅 {formatData(item.data)} •{' '}
                    <span className="font-medium text-apple-blue">{numDdtFormattato}</span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="font-bold text-xs bg-white px-2.5 py-1 rounded-apple border border-gray-200 text-apple-darkgray shadow-sm">
                    {item.tipo === 'servizio'
                      ? `${item.quantita} seduta`
                      : `× ${item.quantita}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
