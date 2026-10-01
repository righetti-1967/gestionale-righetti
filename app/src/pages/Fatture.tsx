import { useEffect, useState } from 'react';
import {
  getFatture,
  cercaFatture,
  formatEuro,
  formatData,
  isPagata,
  type FatturaConCliente,
} from '../lib/fatture';
import { DettaglioFattura } from '../components/DettaglioFattura';
import { FormNuovaFattura } from '../components/FormNuovaFattura';
import { Toast, type ToastTipo } from '../components/Toast';

type FiltroStato = 'tutte' | 'pagate' | 'non-pagate';

const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const ANNI = [2024, 2025, 2026, 2027];

export function Fatture() {
  const [fatture, setFatture] = useState<FatturaConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  
  // Stati dei Filtri
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutte');
  const [filtroMese, setFiltroMese] = useState<number | 'tutti'>('tutti');
  const [filtroAnno, setFiltroAnno] = useState<number | 'tutti'>('tutti');

  const [fatturaSelezionata, setFatturaSelezionata] = useState<FatturaConCliente | null>(null);
  const [showFormNuova, setShowFormNuova] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    caricaFatture();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ricerca === '') caricaFatture();
      else eseguiRicerca(ricerca);
    }, 300);
    return () => clearTimeout(timer);
  }, [ricerca]);

  async function caricaFatture() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getFatture();
      setFatture(data);
    } catch (err: any) {
      setErrore(err.message || 'Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  }

  async function eseguiRicerca(q: string) {
    try {
      setLoading(true);
      const data = await cercaFatture(q);
      setFatture(data);
    } catch (err: any) {
      setErrore(err.message || 'Errore nella ricerca');
    } finally {
      setLoading(false);
    }
  }

  function handleInvia(fattura: FatturaConCliente, canale: 'email' | 'whatsapp') {
    const canaleLabel = canale === 'email' ? 'Email' : 'WhatsApp';
    setToast({
      message: `📧 Invio ${canaleLabel} di ${fattura.numero_fattura} in arrivo`,
      tipo: 'info',
    });
  }

  // Logica di Filtraggio Unificata
  const fattureMostrate = fatture.filter((f) => {
    const matchRicerca = f.cliente?.nome_cognome?.toLowerCase().includes(ricerca.toLowerCase()) || 
                         f.numero_fattura.toLowerCase().includes(ricerca.toLowerCase());
    
    const matchStato = filtroStato === 'tutte' || (filtroStato === 'pagate' ? !!f.data_incasso : !f.data_incasso);
    
    const d = f.data_incasso ? new Date(f.data_incasso) : null;
    const matchMese = filtroMese === 'tutti' || (d && d.getMonth() === filtroMese);
    const matchAnno = filtroAnno === 'tutti' || (d && d.getFullYear() === filtroAnno);
    
    return matchRicerca && matchStato && matchMese && matchAnno;
  });

  // Statistiche dinamiche basate sui filtri
  const totaleIncassato = fattureMostrate
    .filter(isPagata)
    .reduce((sum, f) => sum + Number(f.lordo_ivato || 0), 0);
  const totaleDaIncassare = fattureMostrate
    .filter((f) => !isPagata(f))
    .reduce((sum, f) => sum + Number(f.lordo_ivato || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Fatture</h1>
          <p className="text-sm text-apple-gray">
            {fattureMostrate.length} {fattureMostrate.length === 1 ? 'fattura' : 'fatture'} mostrate
          </p>
        </div>
        <button
          onClick={() => setShowFormNuova(true)}
          className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <span>+</span> Nuova Fattura
        </button>
      </div>

      {/* Card statistiche */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setFiltroStato(filtroStato === 'non-pagate' ? 'tutte' : 'non-pagate')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'non-pagate' ? 'bg-orange-500 text-white' : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'non-pagate' ? 'text-white/90' : 'text-apple-gray'}`}>📄 Proforma</p>
          <p className={`text-2xl font-bold ${filtroStato === 'non-pagate' ? 'text-white' : 'text-orange-600'}`}>
            {fattureMostrate.filter((f) => !isPagata(f)).length}
          </p>
          <p className={`text-xs mt-1 ${filtroStato === 'non-pagate' ? 'text-white/80' : 'text-apple-gray'}`}>{formatEuro(totaleDaIncassare)}</p>
        </button>

        <button
          onClick={() => setFiltroStato(filtroStato === 'pagate' ? 'tutte' : 'pagate')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'pagate' ? 'bg-green-600 text-white' : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'pagate' ? 'text-white/90' : 'text-apple-gray'}`}>✓ Pagate e Registrate</p>
          <p className={`text-2xl font-bold ${filtroStato === 'pagate' ? 'text-white' : 'text-green-600'}`}>
            {fattureMostrate.filter(isPagata).length}
          </p>
          <p className={`text-xs mt-1 ${filtroStato === 'pagate' ? 'text-white/80' : 'text-apple-gray'}`}>{formatEuro(totaleIncassato)}</p>
        </button>

        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">📊 Totale Periodo</p>
          <p className="text-2xl font-bold text-apple-darkgray">{fattureMostrate.length}</p>
          <p className="text-xs mt-1 text-apple-gray">Somma: {formatEuro(totaleIncassato + totaleDaIncassare)}</p>
        </div>
      </div>

      {/* Barra di ricerca + Filtri Temporali */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per numero o cliente..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <select 
            value={filtroMese} 
            onChange={(e) => setFiltroMese(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))}
            className="px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none shadow-apple cursor-pointer"
          >
            <option value="tutti">Tutti i mesi</option>
            {MESI.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>

          <select 
            value={filtroAnno} 
            onChange={(e) => setFiltroAnno(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))}
            className="px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none shadow-apple cursor-pointer"
          >
            <option value="tutti">Tutti gli anni</option>
            {ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          {(filtroStato !== 'tutte' || filtroMese !== 'tutti' || filtroAnno !== 'tutti') && (
            <button
              onClick={() => { setFiltroStato('tutte'); setFiltroMese('tutti'); setFiltroAnno('tutti'); }}
              className="px-4 py-3 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors shadow-apple"
            >
              ✕ Reset
            </button>
          )}
        </div>
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

      {!loading && !errore && fattureMostrate.length === 0 && (
        <div className="bg-white rounded-apple shadow-apple p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-apple-darkgray font-medium mb-1">Nessuna fattura trovata</p>
          <p className="text-apple-gray text-sm">Prova a modificare i filtri o la ricerca</p>
        </div>
      )}

      {!loading && !errore && fattureMostrate.length > 0 && (
        <>
          {/* MOBILE: Card */}
          <div className="md:hidden space-y-3">
            {fattureMostrate.map((fattura) => (
              <div key={fattura.id} className="w-full bg-white rounded-apple shadow-apple p-4">
                <button onClick={() => setFatturaSelezionata(fattura)} className="w-full text-left">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-apple-darkgray">Fatt. {fattura.numero_fattura}</p>
                      <p className="text-xs text-apple-gray truncate">{fattura.cliente?.nome_cognome || '—'}</p>
                    </div>
                    <span className="text-lg font-bold text-apple-darkgray shrink-0 ml-2">{formatEuro(Number(fattura.lordo_ivato))}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-apple-gray">{formatData(fattura.data_incasso)}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isPagata(fattura) ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {isPagata(fattura) ? '✓ Pagata' : '📄 Proforma'}
                    </span>
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* DESKTOP: Tabella */}
          <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
              <div className="col-span-2">Numero</div>
              <div className="col-span-3">Cliente</div>
              <div className="col-span-2">Data incasso</div>
              <div className="col-span-2 text-right">Importo</div>
              <div className="col-span-3 text-center">Stato</div>
            </div>

            <div className="divide-y divide-gray-100">
              {fattureMostrate.map((fattura) => (
                <button
                  key={fattura.id}
                  onClick={() => setFatturaSelezionata(fattura)}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center text-left"
                >
                  <div className="col-span-2 text-sm font-semibold text-apple-darkgray">{fattura.numero_fattura}</div>
                  <div className="col-span-3 text-sm text-apple-darkgray truncate">{fattura.cliente?.nome_cognome || '—'}</div>
                  <div className="col-span-2 text-sm text-apple-gray">{formatData(fattura.data_incasso)}</div>
                  <div className="col-span-2 text-sm font-bold text-apple-darkgray text-right">{formatEuro(Number(fattura.lordo_ivato))}</div>
                  <div className="col-span-3 flex justify-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isPagata(fattura) ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      <span className={`w-2 h-2 rounded-full ${isPagata(fattura) ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                      {isPagata(fattura) ? '✓ Pagata' : '📄 Proforma'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showFormNuova && (
        <FormNuovaFattura
          onClose={() => setShowFormNuova(false)}
          onSuccess={() => {
            setShowFormNuova(false);
            caricaFatture();
            setToast({ message: 'Proforma creata con successo', tipo: 'success' });
          }}
        />
      )}

      {fatturaSelezionata && (
        <DettaglioFattura
          fattura={fatturaSelezionata}
          onClose={() => setFatturaSelezionata(null)}
          onUpdate={() => {
            setFatturaSelezionata(null);
            caricaFatture();
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
