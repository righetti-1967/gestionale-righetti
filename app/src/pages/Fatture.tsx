import { useEffect, useState } from 'react';
import {
  getFatture, cercaFatture, formatEuro, formatData, isPagata, type FatturaConCliente,
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
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutte');
  const [filtroMese, setFiltroMese] = useState<number | 'tutti'>('tutti');
  const [filtroAnno, setFiltroAnno] = useState<number | 'tutti'>('tutti');
  const [fatturaSelezionata, setFatturaSelezionata] = useState<FatturaConCliente | null>(null);
  const [showFormNuova, setShowFormNuova] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => { caricaFatture(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (ricerca === '') caricaFatture(); else eseguiRicerca(ricerca); }, 300);
    return () => clearTimeout(t);
  }, [ricerca]);

  async function caricaFatture() {
    try { setLoading(true); const d = await getFatture(); setFatture(d); } catch (e: any) { setErrore(e.message); } finally { setLoading(false); }
  }
  async function eseguiRicerca(q: string) {
    try { setLoading(true); const d = await cercaFatture(q); setFatture(d); } catch (e: any) { setErrore(e.message); } finally { setLoading(false); }
  }

  const fattureMostrate = fatture.filter((f) => {
    const matchRicerca = (f.cliente?.nome_cognome || "").toLowerCase().includes(ricerca.toLowerCase()) || f.numero_fattura.toLowerCase().includes(ricerca.toLowerCase());
    const matchStato = filtroStato === 'tutte' || (filtroStato === 'pagate' ? !!f.data_incasso : !f.data_incasso);
    const d = f.data_incasso ? new Date(f.data_incasso) : null;
    const matchMese = filtroMese === 'tutti' || (d && d.getMonth() === filtroMese);
    const matchAnno = filtroAnno === 'tutti' || (d && d.getFullYear() === filtroAnno);
    return matchRicerca && matchStato && matchMese && matchAnno;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div><h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Fatture</h1><p className="text-sm text-apple-gray">{fattureMostrate.length} fatture mostrate</p></div>
        <button onClick={() => setShowFormNuova(true)} className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"><span>+</span> Nuova Fattura</button>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 mb-8 items-center">
        <div className="relative flex-1 w-full text-left">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray text-lg">🔍</span>
          <input type="text" placeholder="Cerca..." value={ricerca} onChange={(e) => setRicerca(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray focus:outline-none border border-gray-100" />
        </div>
        <div className="flex items-center gap-2 w-full xl:w-auto">
          <div className="flex items-center bg-white rounded-apple shadow-apple border border-gray-100 p-1 gap-1">
            <select value={filtroMese} onChange={(e) => setFiltroMese(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))} className="pl-3 pr-8 py-2 bg-apple-lightgray/40 border-none rounded-apple text-[11px] font-bold text-apple-darkgray cursor-pointer appearance-none transition-colors">
              <option value="tutti">Tutti i mesi</option>{MESI.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={filtroAnno} onChange={(e) => setFiltroAnno(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))} className="pl-3 pr-8 py-2 bg-apple-lightgray/40 border-none rounded-apple text-[11px] font-bold text-apple-darkgray cursor-pointer appearance-none transition-colors">
              <option value="tutti">Tutti gli anni</option>{ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {(filtroMese !== 'tutti' || filtroAnno !== 'tutti' || filtroStato !== 'tutte') && (
            <button onClick={() => { setFiltroStato('tutte'); setFiltroMese('tutti'); setFiltroAnno('tutti'); }} className="px-4 py-2.5 text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors whitespace-nowrap">✕ Reset</button>
          )}
        </div>
      </div>

      {!loading && !errore && (
        <div className="bg-white rounded-apple shadow-apple overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase text-left">
            <div className="col-span-2">Numero</div><div className="col-span-3">Cliente</div><div className="col-span-2">Data incasso</div><div className="col-span-2 text-right">Importo</div><div className="col-span-3 text-center">Stato</div>
          </div>
          <div className="divide-y divide-gray-100">
            {fattureMostrate.map((f) => (
              <button key={f.id} onClick={() => setFatturaSelezionata(f)} className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center text-left">
                <div className="col-span-2 text-sm font-semibold text-apple-darkgray">{f.numero_fattura}</div>
                <div className="col-span-3 text-sm text-apple-darkgray truncate">{f.cliente?.nome_cognome || '—'}</div>
                <div className="col-span-2 text-sm text-apple-gray">{formatData(f.data_incasso)}</div>
                <div className="col-span-2 text-sm font-bold text-apple-darkgray text-right">{formatEuro(Number(f.lordo_ivato))}</div>
                <div className="col-span-3 flex justify-center">
                  <span className={"inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full " + (isPagata(f) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                    <span className={"w-2 h-2 rounded-full " + (isPagata(f) ? "bg-green-500" : "bg-orange-500")}></span>
                    {isPagata(f) ? 'Pagata' : 'Proforma'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {showFormNuova && <FormNuovaFattura onClose={() => setShowFormNuova(false)} onSuccess={() => { setShowFormNuova(false); caricaFatture(); }} />}
      {fatturaSelezionata && <DettaglioFattura fattura={fatturaSelezionata} onClose={() => setFatturaSelezionata(null)} onUpdate={() => { setFatturaSelezionata(null); caricaFatture(); }} />}
      {toast && <Toast message={toast.message} tipo={toast.tipo} onComplete={() => setToast(null)} />}
    </div>
  );
}
