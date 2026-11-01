import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { Toast, type ToastTipo } from '../components/Toast';

const API_URL = 'https://gestionale-righetti-production.up.railway.app';

interface Spesa {
  id: number;
  user_id: string;
  data: string;
  descrizione: string;
  importo: number;
  imponibile: number | null;
  iva: number | null;
  categoria: string | null;
  tipo: string;
  ricorrenza: string | null;
  data_scadenza: string | null;
  pagata: boolean;
  data_pagamento: string | null;
  metodo_pagamento: string | null;
  note: string | null;
  ricorrenza_attiva: boolean;
  giorno_scadenza: number | null;
  created_at: string;
}

type Tab = 'spese' | 'scadenze';
type FiltroStato = 'tutte' | 'pagate' | 'non-pagate';



const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function formatEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function Spese() {
  const { user } = useAuth();
  const [spese, setSpese] = useState<Spesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('spese');
  const [ricerca, setRicerca] = useState('');
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutte');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('tutte');
  const [periodoTipo, setPeriodoTipo] = useState<'corrente' | 'mese' | 'anno' | 'tutto' | 'custom'>('corrente');
  const [meseSelezionato, setMeseSelezionato] = useState<number>(new Date().getMonth());
  const [annoSelezionato, setAnnoSelezionato] = useState<number>(new Date().getFullYear());
  const [dataCustomInizio, setDataCustomInizio] = useState('');
  const [dataCustomFine, setDataCustomFine] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [spesaInModifica, setSpesaInModifica] = useState<Spesa | null>(null);
  const [importando, setImportando] = useState(false);
  const [sortData, setSortData] = useState<'asc' | 'desc'>('desc');
  const [risultatoImport, setRisultatoImport] = useState<{ importati: number; saltati: number; errori: string[] } | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);
  const [categorie, setCategorie] = useState<{id: number, nome: string}[]>([]);
  const [kpi, setKpi] = useState<{
    totale_mese: number;
    scadenze_prossimi_30gg: { totale: number; numero: number };
    pagate: { numero: number; totale: number };
    non_pagate: { numero: number; totale: number };
  } | null>(null);

  useEffect(() => {
    if (user) {
      caricaSpese();
      caricaKpi();
      caricaCategorie();
    }
  }, [user]);

  async function caricaSpese() {
    if (!user) return;
    try {
      setLoading(true);
      setErrore(null);
      const res = await fetch(`${API_URL}/api/spese?user_id=${user.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSpese(data.spese || []);
    } catch (e: any) {
      setErrore(e?.message || 'Errore caricamento spese');
    } finally {
      setLoading(false);
    }
  }

  async function caricaCategorie() {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/spese/categorie?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setCategorie(data.categorie || []);
      }
    } catch {}
  }

  async function caricaKpi() {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/spese/kpi?user_id=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setKpi({
        totale_mese: data.totale_mese,
        scadenze_prossimi_30gg: data.scadenze_prossimi_30gg,
        pagate: data.pagate,
        non_pagate: data.non_pagate,
      });
    } catch {}
  }

  async function handleImportXML(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (!file.name.toLowerCase().endsWith('.zip') && !file.name.toLowerCase().endsWith('.xml')) {
      alert('Seleziona un file .zip o .xml');
      return;
    }

    setImportando(true);
    setRisultatoImport(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API_URL}/api/spese/import-xml?user_id=${user.id}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || 'Errore import');
      }
      
      const data = await res.json();
      setRisultatoImport({
        importati: data.importati ?? 0,
        saltati: data.saltati ?? 0,
        errori: data.errori ?? [],
      });
      
      await caricaSpese();
      await caricaKpi();
      
      if (data.importati > 0) {
        setToast({ message: `✅ Importate ${data.importati} fatture`, tipo: 'success' });
      } else if (data.saltati > 0) {
        setToast({ message: `ℹ️ ${data.saltati} fatture già presenti`, tipo: 'info' });
      }
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore import'), tipo: 'error' });
    } finally {
      setImportando(false);
      e.target.value = ''; // reset input
    }
  }

  async function togglePagata(spesa: Spesa) {
    const nuovoStato = !spesa.pagata;
    const nuovaData = nuovoStato ? new Date().toISOString().split('T')[0] : null;

    // 1. Aggiorna SUBITO lo state locale (UI reattiva immediata)
    setSpese((prev) =>
      prev.map((s) =>
        s.id === spesa.id
          ? { ...s, pagata: nuovoStato, data_pagamento: nuovaData }
          : s
      )
    );

    try {
      const res = await fetch(`${API_URL}/api/spese/${spesa.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagata: nuovoStato,
          data_pagamento: nuovaData,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 2. Ricarica KPI (per aggiornare i numeri in alto)
      await caricaKpi();

      setToast({
        message: nuovoStato ? '✅ Segnata come pagata' : '✅ Segnata come non pagata',
        tipo: 'success',
      });
    } catch (e: any) {
      // Se il backend fallisce, ripristina lo state locale
      setSpese((prev) =>
        prev.map((s) => (s.id === spesa.id ? { ...s, pagata: spesa.pagata, data_pagamento: spesa.data_pagamento } : s))
      );
      setToast({ message: '❌ ' + (e?.message || 'Errore'), tipo: 'error' });
    }
  }

  async function eliminaSpesa(spesa: Spesa) {
    if (!confirm(`Eliminare questa spesa?\n\n${spesa.descrizione} — ${formatEuro(spesa.importo)}`)) return;
    try {
      const res = await fetch(`${API_URL}/api/spese/${spesa.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await caricaSpese();
      await caricaKpi();
      setToast({ message: '✅ Spesa eliminata', tipo: 'success' });
    } catch (e: any) {
      setToast({ message: '❌ ' + (e?.message || 'Errore'), tipo: 'error' });
    }
  }

  const oggi = new Date().toISOString().split('T')[0];

  const speseFiltrate = spese.filter((s) => {
    if (tab === 'scadenze') {
      if (s.pagata) return false;
      if (!s.data_scadenza) return false;
    }
    const q = ricerca.toLowerCase().trim();
    if (q && !s.descrizione.toLowerCase().includes(q) && !(s.categoria || '').toLowerCase().includes(q)) return false;
    if (filtroStato === 'pagate' && !s.pagata) return false;
    if (filtroStato === 'non-pagate' && s.pagata) return false;
    if (filtroCategoria !== 'tutte' && s.categoria !== filtroCategoria) return false;

    // Filtro periodo: usa SEMPRE data_scadenza (sia tab Spese che Scadenze)
    const dataRif = s.data_scadenza;
    if (!dataRif) return false;

    if (periodoTipo === 'corrente') {
      const oggi = new Date();
      const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
      const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0, 23, 59, 59);
      const d = new Date(dataRif + 'T00:00:00');
      if (d < inizioMese || d > fineMese) return false;
    } else if (periodoTipo === 'mese') {
      const d = new Date(dataRif + 'T00:00:00');
      if (d.getMonth() !== meseSelezionato || d.getFullYear() !== annoSelezionato) return false;
    } else if (periodoTipo === 'anno') {
      const d = new Date(dataRif + 'T00:00:00');
      if (d.getFullYear() !== annoSelezionato) return false;
    } else if (periodoTipo === 'custom' && dataCustomInizio && dataCustomFine) {
      if (dataRif < dataCustomInizio || dataRif > dataCustomFine) return false;
    }
    // 'tutto' → nessun filtro

    return true;
  });

  const speseOrdinate = [...speseFiltrate].sort((a, b) => {
    // In Scadenze, ordina per data_scadenza; in Spese, per data
    const campoData = tab === 'scadenze' ? 'data_scadenza' : 'data';
    const dataA = (a[campoData as keyof Spesa] as string) || '';
    const dataB = (b[campoData as keyof Spesa] as string) || '';
    const cmp = dataA.localeCompare(dataB);
    return sortData === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Spese & Scadenze</h1>
          <p className="text-sm text-apple-gray">Gestisci uscite e scadenze dell'azienda</p>
        </div>
        <div className="flex gap-2">
          <label className={`px-4 py-2.5 rounded-apple font-medium text-sm shadow-apple cursor-pointer transition-all flex items-center gap-2 ${
            importando 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}>
            {importando ? '⏳ Importando…' : '📥 Importa XML'}
            <input
              type="file"
              accept=".zip,.xml"
              onChange={handleImportXML}
              disabled={importando}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-all"
          >
            + Nuova Spesa
          </button>
        </div>
      </div>

      {/* KPI */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-apple shadow-apple p-4">
            <p className="text-[10px] font-semibold text-apple-gray uppercase tracking-wider mb-1">Spese Mese</p>
            <p className="text-xl font-bold text-apple-darkgray">{formatEuro(kpi.totale_mese)}</p>
          </div>
          <div className="bg-white rounded-apple shadow-apple p-4">
            <p className="text-[10px] font-semibold text-apple-gray uppercase tracking-wider mb-1">Scadenze 30gg</p>
            <p className="text-xl font-bold text-amber-600">{formatEuro(kpi.scadenze_prossimi_30gg.totale)}</p>
            <p className="text-[10px] text-apple-gray mt-1">{kpi.scadenze_prossimi_30gg.numero} scadenze</p>
          </div>
          <div className="bg-white rounded-apple shadow-apple p-4">
            <p className="text-[10px] font-semibold text-apple-gray uppercase tracking-wider mb-1">Pagate</p>
            <p className="text-xl font-bold text-green-600">{formatEuro(kpi.pagate.totale)}</p>
            <p className="text-[10px] text-apple-gray mt-1">{kpi.pagate.numero} pagate</p>
          </div>
          <div className="bg-white rounded-apple shadow-apple p-4">
            <p className="text-[10px] font-semibold text-apple-gray uppercase tracking-wider mb-1">Da Pagare</p>
            <p className="text-xl font-bold text-red-600">{formatEuro(kpi.non_pagate.totale)}</p>
            <p className="text-[10px] text-apple-gray mt-1">{kpi.non_pagate.numero} non pagate</p>
          </div>
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-1 bg-gray-100 rounded-apple p-1 mb-4 w-fit">
        <button
          onClick={() => setTab('spese')}
          className={`px-4 py-2 rounded-apple text-xs font-semibold transition-all ${
            tab === 'spese' ? 'bg-white text-apple-darkgray shadow-apple' : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          📋 Spese ({spese.length})
        </button>
        <button
          onClick={() => setTab('scadenze')}
          className={`px-4 py-2 rounded-apple text-xs font-semibold transition-all ${
            tab === 'scadenze' ? 'bg-white text-apple-darkgray shadow-apple' : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          ⏰ Scadenze
        </button>
      </div>

      {/* Filtri */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per descrizione o categoria..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-apple shadow-apple text-sm focus:outline-none border border-gray-100"
          />
        </div>
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value as FiltroStato)}
          className="px-3 py-2.5 bg-white rounded-apple shadow-apple text-sm border border-gray-100"
        >
          <option value="tutte">Tutte</option>
          <option value="pagate">Pagate</option>
          <option value="non-pagate">Non pagate</option>
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="px-3 py-2.5 bg-white rounded-apple shadow-apple text-sm border border-gray-100"
        >
          <option value="tutte">Tutte le categorie</option>
          {categorie.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </select>
      </div>

      {/* Errore */}
      {errore && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4 mb-4 text-sm text-red-700">
          ❌ {errore}
        </div>
      )}

      {/* Tabella */}
      <div className="bg-white rounded-apple shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-apple-gray">Caricamento…</div>
        ) : speseOrdinate.length === 0 ? (
          <div className="p-8 text-center text-sm text-apple-gray">
            {tab === 'scadenze' ? '🎉 Nessuna scadenza in sospeso' : 'Nessuna spesa registrata'}
          </div>
        ) : (
          <>
            {/* Card view mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {speseOrdinate.map((s) => {
                const scaduta = s.data_scadenza && s.data_scadenza < oggi && !s.pagata;
                return (
                  <div
                    key={s.id}
                    className="p-4 hover:bg-apple-lightgray/40 cursor-pointer"
                    onClick={() => setSpesaInModifica(s)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-apple-darkgray truncate">{s.descrizione}</p>
                        <p className="text-xs text-apple-gray mt-0.5">
                          {formatData(s.data)}{s.categoria ? ` · ${s.categoria}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminaSpesa(s); }}
                        className="text-red-500 hover:text-red-700 text-lg shrink-0"
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="flex items-end justify-between gap-2 mt-2">
                      <div className="text-xs">
                        <p className="text-apple-gray">
                          Scadenza:{' '}
                          <span className={scaduta ? 'text-red-600 font-semibold' : 'text-apple-darkgray'}>
                            {formatData(s.data_scadenza)}
                          </span>
                          {scaduta && ' ⚠️'}
                        </p>
                        <p className="text-apple-darkgray font-semibold mt-1">
                          {formatEuro(s.importo)}
                          {s.iva != null && s.iva > 0 && (
                            <span className="text-[10px] text-apple-gray font-normal ml-1">
                              (IVA {formatEuro(s.iva)})
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePagata(s); }}
                        className={`text-[10px] px-2.5 py-1.5 rounded font-semibold transition-colors shrink-0 ${
                          s.pagata
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {s.pagata ? '✅ Pagata' : '⏳ Da pagare'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabella desktop */}
            <table className="w-full text-sm hidden md:table">
            <thead className="bg-apple-lightgray/60 border-b border-gray-200/60">
              <tr>
                <th
                  onClick={() => setSortData(sortData === 'asc' ? 'desc' : 'asc')}
                  className="text-left px-4 py-3 text-xs font-semibold text-apple-gray uppercase cursor-pointer hover:text-apple-darkgray transition-colors select-none"
                  title={sortData === 'asc' ? 'Crescente (clicca per decrescente)' : 'Decrescente (clicca per crescente)'}
                >
                  Data {sortData === 'asc' ? '↑' : '↓'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Descrizione</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Scadenza</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Imponibile</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">IVA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Lordo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Stato</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {speseOrdinate.map((s) => {
                const scaduta = s.data_scadenza && s.data_scadenza < oggi && !s.pagata;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSpesaInModifica(s)}
                    className="border-b border-gray-100 last:border-0 hover:bg-apple-lightgray/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-apple-darkgray">{formatData(s.data)}</td>
                    <td className="px-4 py-3 font-medium text-apple-darkgray">
                      {s.descrizione}
                      {s.ricorrenza_attiva && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">
                          🔄 {s.ricorrenza}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-apple-gray">{s.categoria || '—'}</td>
                    <td className={`px-4 py-3 ${scaduta ? 'text-red-600 font-semibold' : 'text-apple-gray'}`}>
                      {formatData(s.data_scadenza)}
                      {scaduta && ' ⚠️'}
                    </td>
                    <td className="px-4 py-3 text-right text-apple-gray">{s.imponibile != null ? formatEuro(s.imponibile) : '—'}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{s.iva != null && s.iva > 0 ? formatEuro(s.iva) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-apple-darkgray">{formatEuro(s.importo)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePagata(s); }}
                        className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                          s.pagata
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        {s.pagata ? '✅ Pagata' : '⏳ Da pagare'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminaSpesa(s); }}
                        className="text-red-500 hover:text-red-700 text-lg"
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>

      {/* Modale nuova spesa */}
      {showForm && (
        <FormNuovaSpesa
          userId={user?.id || ''}
          categorie={categorie}
          onCategoryCreated={caricaCategorie}
          onSaved={() => {
            setShowForm(false);
            caricaSpese();
            caricaKpi();
            setToast({ message: '✅ Spesa salvata', tipo: 'success' });
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {spesaInModifica && (
        <FormModificaSpesa
          spesa={spesaInModifica}
          categorie={categorie}
          onCategoryCreated={caricaCategorie}
          onSaved={() => {
            setSpesaInModifica(null);
            caricaSpese();
            caricaKpi();
            setToast({ message: '✅ Spesa aggiornata', tipo: 'success' });
          }}
          onCancel={() => setSpesaInModifica(null)}
        />
      )}

      {toast && <Toast message={toast.message} tipo={toast.tipo} onComplete={() => setToast(null)} />}
    </div>
  );
}

// ============================================================================
// FORM NUOVA SPESA
// ============================================================================

function FormNuovaSpesa({
  userId,
  categorie,
  onCategoryCreated,
  onSaved,
  onCancel,
}: {
  userId: string;
  categorie: {id: number, nome: string}[];
  onCategoryCreated: () => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState('');
  const [importoIvato, setImportoIvato] = useState(true);
  const [categoria, setCategoria] = useState('');
  const [showNuovaCategoria, setShowNuovaCategoria] = useState(false);
  const [nuovaCategoria, setNuovaCategoria] = useState('');
  const [tipo, setTipo] = useState<'una_tantum' | 'ricorrente'>('una_tantum');
  const [ricorrenza, setRicorrenza] = useState<'settimanale' | 'quindicinale' | 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale'>('mensile');
  const [dataScadenza, setDataScadenza] = useState('');
  const [giornoScadenza, setGiornoScadenza] = useState<number>(1);
  const [mesiAnticipo, setMesiAnticipo] = useState<number>(12);
  const [note, setNote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descrizione.trim() || !importo) {
      setErrore('Descrizione e importo sono obbligatori');
      return;
    }
    setSalvando(true);
    setErrore(null);
    try {
      const importoNum = parseFloat(importo)
      const imponibile = importoIvato ? Math.round((importoNum / 1.22) * 100) / 100 : importoNum
      const iva = importoIvato ? Math.round((importoNum - imponibile) * 100) / 100 : 0

      const payload = {
        user_id: userId,
        data,
        descrizione: descrizione.trim(),
        importo: importoNum,
        importo_ivato: importoIvato,
        imponibile,
        iva,
        categoria: categoria || null,
        tipo,
        ricorrenza: tipo === 'ricorrente' ? ricorrenza : null,
        data_scadenza: dataScadenza || null,
        pagata: false,
        note: note.trim() || null,
        ricorrenza_attiva: tipo === 'ricorrente',
        giorno_scadenza: tipo === 'ricorrente' ? giornoScadenza : null,
        mesi_anticipo: tipo === 'ricorrente' ? mesiAnticipo : null,
      };
      const res = await fetch(`${API_URL}/api/spese`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || 'Errore salvataggio');
      }
      const data2 = await res.json();
      if (data2.scadenze_generate > 0) {
        alert(`✅ Spesa salvata + ${data2.scadenze_generate} scadenze generate automaticamente`);
      }
      onSaved();
    } catch (e: any) {
      setErrore(e?.message || 'Errore');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full my-8 p-6">
        <h2 className="text-lg font-bold text-apple-darkgray mb-4">Nuova Spesa</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Descrizione *</label>
            <input type="text" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm focus:outline-none focus:bg-white focus:border-apple-blue" placeholder="Es. Affitto studio" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Data *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm focus:outline-none focus:bg-white focus:border-apple-blue" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Importo € *</label>
              <input type="number" step="0.01" value={importo} onChange={(e) => setImporto(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm focus:outline-none focus:bg-white focus:border-apple-blue" placeholder="0,00" />
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer text-[11px] text-apple-gray">
                <input type="checkbox" checked={importoIvato} onChange={(e) => setImportoIvato(e.target.checked)} className="w-3.5 h-3.5" />
                <span>Importo IVA inclusa (22%)</span>
              </label>
              {importoIvato && importo && (
                <p className="text-[10px] text-apple-gray mt-1">
                  Imponibile: €{(parseFloat(importo) / 1.22).toFixed(2)} · IVA: €{(parseFloat(importo) - parseFloat(importo) / 1.22).toFixed(2)}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Categoria</label>
            {showNuovaCategoria ? (
              <div className="flex gap-2">
                <input type="text" value={nuovaCategoria} onChange={(e) => setNuovaCategoria(e.target.value)} placeholder="Nuova categoria..." className="flex-1 px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
                <button type="button" onClick={async () => {
                  if (!nuovaCategoria.trim()) return;
                  await fetch(`${API_URL}/api/spese/categorie`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, nome: nuovaCategoria.trim() })
                  });
                  setNuovaCategoria('');
                  setShowNuovaCategoria(false);
                  onCategoryCreated();
                }} className="px-3 py-2 bg-green-600 text-white rounded-apple text-xs font-medium">Salva</button>
                <button type="button" onClick={() => setShowNuovaCategoria(false)} className="px-3 py-2 bg-gray-200 rounded-apple text-xs">Annulla</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="flex-1 px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm">
                  <option value="">— Seleziona —</option>
                  {categorie.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
                <button type="button" onClick={() => setShowNuovaCategoria(true)} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-apple text-xs font-medium">+ Nuova</button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tipo === 'ricorrente'} onChange={(e) => setTipo(e.target.checked ? 'ricorrente' : 'una_tantum')} className="w-4 h-4" />
              <span className="text-sm font-medium text-apple-darkgray">🔄 Spesa ricorrente (genera scadenze automatiche)</span>
            </label>
          </div>

          {tipo === 'ricorrente' && (
            <div className="grid grid-cols-2 gap-3 pl-6 bg-purple-50 p-3 rounded-apple">
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Ricorrenza</label>
                <select value={ricorrenza} onChange={(e) => setRicorrenza(e.target.value as any)} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm">
                  <option value="settimanale">Settimanale (ogni 7gg)</option>
                  <option value="quindicinale">Quindicinale (ogni 15gg)</option>
                  <option value="mensile">Mensile (ogni mese)</option>
                  <option value="bimestrale">Bimestrale (ogni 2 mesi)</option>
                  <option value="trimestrale">Trimestrale (ogni 3 mesi)</option>
                  <option value="semestrale">Semestrale (ogni 6 mesi)</option>
                  <option value="annuale">Annuale (ogni anno)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Giorno scadenza</label>
                <input type="number" min="1" max="31" value={giornoScadenza} onChange={(e) => setGiornoScadenza(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Prima scadenza</label>
                <input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Genera scadenze per</label>
                <select value={mesiAnticipo} onChange={(e) => setMesiAnticipo(parseInt(e.target.value))} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm">
                  <option value="6">6 mesi</option>
                  <option value="12">12 mesi (1 anno)</option>
                  <option value="24">24 mesi (2 anni)</option>
                  <option value="36">36 mesi (3 anni)</option>
                </select>
              </div>
            </div>
          )}

          {tipo === 'una_tantum' && (
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Data scadenza (opzionale)</label>
              <input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm focus:outline-none focus:bg-white focus:border-apple-blue" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm focus:outline-none focus:bg-white focus:border-apple-blue" placeholder="Note aggiuntive…" />
          </div>

          {errore && <div className="bg-red-50 text-red-700 text-xs p-2 rounded">{errore}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={salvando} className="flex-1 py-2 rounded-apple bg-gray-100 text-apple-darkgray font-medium text-sm hover:bg-gray-200 disabled:opacity-50">
              Annulla
            </button>
            <button type="submit" disabled={salvando} className="flex-1 py-2 rounded-apple bg-apple-blue text-white font-medium text-sm hover:bg-blue-600 disabled:opacity-50">
              {salvando ? '⏳ Salvo…' : '💾 Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// FORM MODIFICA SPESA
// ============================================================================

function FormModificaSpesa({
  spesa,
  categorie,
  onCategoryCreated,
  onSaved,
  onCancel,
}: {
  spesa: Spesa;
  categorie: { id: number; nome: string }[];
  onCategoryCreated: () => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState(spesa.data);
  const [descrizione, setDescrizione] = useState(spesa.descrizione);
  const [importo, setImporto] = useState(String(spesa.importo));
  const [importoIvato, setImportoIvato] = useState(true);
  const [categoria, setCategoria] = useState(spesa.categoria || '');
  const [dataScadenza, setDataScadenza] = useState(spesa.data_scadenza || '');
  const [tipo, setTipo] = useState<'una_tantum' | 'ricorrente'>((spesa.tipo as any) || 'una_tantum');
  const [ricorrenza, setRicorrenza] = useState<'settimanale' | 'quindicinale' | 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale'>((spesa.ricorrenza as any) || 'mensile');
  const [giornoScadenza, setGiornoScadenza] = useState<number>(spesa.giorno_scadenza || 1);
  const [mesiAnticipo, setMesiAnticipo] = useState<number>(12);
  const [note, setNote] = useState(spesa.note || '');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [showNuovaCategoria, setShowNuovaCategoria] = useState(false);
  const [nuovaCategoria, setNuovaCategoria] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErrore(null);
    try {
      const importoNum = parseFloat(importo);
      const imponibile = importoIvato ? Math.round((importoNum / 1.22) * 100) / 100 : importoNum;
      const iva = importoIvato ? Math.round((importoNum - imponibile) * 100) / 100 : 0;

      const payload = {
        data,
        descrizione: descrizione.trim(),
        importo: importoNum,
        importo_ivato: importoIvato,
        imponibile,
        iva,
        categoria: categoria || null,
        tipo,
        ricorrenza: tipo === 'ricorrente' ? ricorrenza : null,
        data_scadenza: dataScadenza || null,
        giorno_scadenza: tipo === 'ricorrente' ? giornoScadenza : null,
        mesi_anticipo: tipo === 'ricorrente' ? mesiAnticipo : null,
        note: note.trim() || null,
      };

      const res = await fetch(`${API_URL}/api/spese/${spesa.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || 'Errore salvataggio');
      }
      onSaved();
    } catch (e: any) {
      setErrore(e?.message || 'Errore');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full my-8 p-6">
        <h2 className="text-lg font-bold text-apple-darkgray mb-4">Modifica Spesa</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Descrizione *</label>
            <input type="text" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Data *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Importo € *</label>
              <input type="number" step="0.01" value={importo} onChange={(e) => setImporto(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer text-[11px] text-apple-gray">
                <input type="checkbox" checked={importoIvato} onChange={(e) => setImportoIvato(e.target.checked)} className="w-3.5 h-3.5" />
                <span>Importo IVA inclusa (22%)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Categoria</label>
            {showNuovaCategoria ? (
              <div className="flex gap-2">
                <input type="text" value={nuovaCategoria} onChange={(e) => setNuovaCategoria(e.target.value)} placeholder="Nuova categoria..." className="flex-1 px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
                <button type="button" onClick={async () => {
                  if (!nuovaCategoria.trim()) return;
                  await fetch(`${API_URL}/api/spese/categorie`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: spesa.user_id, nome: nuovaCategoria.trim() })
                  });
                  setNuovaCategoria('');
                  setShowNuovaCategoria(false);
                  onCategoryCreated();
                }} className="px-3 py-2 bg-green-600 text-white rounded-apple text-xs font-medium">Salva</button>
                <button type="button" onClick={() => setShowNuovaCategoria(false)} className="px-3 py-2 bg-gray-200 rounded-apple text-xs">Annulla</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="flex-1 px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm">
                  <option value="">— Seleziona —</option>
                  {categorie.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
                <button type="button" onClick={() => setShowNuovaCategoria(true)} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-apple text-xs font-medium">+ Nuova</button>
              </div>
            )}
          </div>
          {/* Tipo: una tantum / ricorrente */}
          <div className="border-t border-gray-100 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tipo === 'ricorrente'} onChange={(e) => setTipo(e.target.checked ? 'ricorrente' : 'una_tantum')} className="w-4 h-4" />
              <span className="text-sm font-medium text-apple-darkgray">🔄 Spesa ricorrente</span>
            </label>
          </div>

          {tipo === 'ricorrente' && (
            <div className="grid grid-cols-2 gap-3 pl-6 bg-purple-50 p-3 rounded-apple">
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Ricorrenza</label>
                <select value={ricorrenza} onChange={(e) => setRicorrenza(e.target.value as any)} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm">
                  <option value="settimanale">Settimanale (ogni 7gg)</option>
                  <option value="quindicinale">Quindicinale (ogni 15gg)</option>
                  <option value="mensile">Mensile (ogni mese)</option>
                  <option value="bimestrale">Bimestrale (ogni 2 mesi)</option>
                  <option value="trimestrale">Trimestrale (ogni 3 mesi)</option>
                  <option value="semestrale">Semestrale (ogni 6 mesi)</option>
                  <option value="annuale">Annuale (ogni anno)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Giorno scadenza</label>
                <input type="number" min="1" max="31" value={giornoScadenza} onChange={(e) => setGiornoScadenza(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Prima scadenza</label>
                <input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-white border border-purple-200 text-sm" />
              </div>
            </div>
          )}

          {tipo === 'una_tantum' && (
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Data scadenza (opzionale)</label>
              <input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase mb-1">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-apple bg-apple-lightgray border border-transparent text-sm" />
          </div>

          {errore && <div className="bg-red-50 text-red-700 text-xs p-2 rounded">{errore}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={salvando} className="flex-1 py-2 rounded-apple bg-gray-100 text-apple-darkgray font-medium text-sm">Annulla</button>
            <button type="submit" disabled={salvando} className="flex-1 py-2 rounded-apple bg-apple-blue text-white font-medium text-sm">{salvando ? '⏳ Salvo…' : '💾 Salva modifiche'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
