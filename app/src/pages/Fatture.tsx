import { useEffect, useState } from 'react';
import { inviaEmailConConfig } from '../lib/api';
import { generaPdfFattura } from '../lib/pdfFattura';
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
        <div><h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Fatture</h1><p className="text-sm text-apple-gray">{fattureMostrate.length} fatture nel periodo</p></div>
        <button onClick={() => setShowFormNuova(true)} className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-all"><span>+</span> Nuova Fattura</button>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 mb-8 items-center text-left">
        <div className="relative flex-1 w-full text-left">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray text-lg">🔍</span>
          <input type="text" placeholder="Cerca..." value={ricerca} onChange={(e) => setRicerca(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white rounded-apple shadow-apple text-sm focus:outline-none border border-gray-100" />
        </div>
        <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-1 no-scrollbar">
          <div className="flex items-center bg-white rounded-apple shadow-apple border border-gray-100 p-1 gap-1">
            <select value={filtroMese} onChange={(e) => setFiltroMese(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))} className="pl-3 pr-8 py-2 bg-apple-lightgray/40 border-none rounded-apple text-[11px] font-bold text-apple-darkgray appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}>
              <option value="tutti">Tutti i mesi</option>{MESI.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={filtroAnno} onChange={(e) => setFiltroAnno(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))} className="pl-3 pr-8 py-2 bg-apple-lightgray/40 border-none rounded-apple text-[11px] font-bold text-apple-darkgray appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}>
              <option value="tutti">Tutti gli anni</option>{ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {(filtroMese !== 'tutti' || filtroAnno !== 'tutti' || filtroStato !== 'tutte') && <button onClick={() => { setFiltroStato('tutte'); setFiltroMese('tutti'); setFiltroAnno('tutti'); }} className="px-4 py-2.5 text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors whitespace-nowrap">✕ Reset</button>}
        </div>
      </div>

      {!loading && !errore && (
        <div className="bg-white rounded-apple shadow-apple overflow-hidden">
          {/* Header solo desktop */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase">
            <div className="col-span-2">Numero</div>
            <div className="col-span-3">Cliente</div>
            <div className="col-span-2 text-left">Data</div>
            <div className="col-span-2 text-right">Importo</div>
            <div className="col-span-3 text-center">Stato</div>
          </div>
          <div className="divide-y divide-gray-100">
            {fattureMostrate.map((f) => (
              <button
                key={f.id}
                onClick={() => setFatturaSelezionata(f)}
                className="w-full hover:bg-blue-50/40 transition-colors text-left"
              >
                {/* DESKTOP: grid a 12 colonne */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                  <div className="col-span-2 text-sm font-semibold text-apple-darkgray">{f.numero_fattura}</div>
                  <div className="col-span-3 text-sm text-apple-darkgray truncate">{f.cliente?.nome_cognome || '—'}</div>
                  <div className="col-span-2 text-sm text-apple-gray">{formatData(f.data_incasso)}</div>
                  <div className="col-span-2 text-sm font-bold text-apple-darkgray text-right">{formatEuro(Number(f.lordo_ivato))}</div>
                  <div className="col-span-3 flex justify-center">
                    <span className={"px-2.5 py-1 rounded-full text-xs font-semibold " + (isPagata(f) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                      {isPagata(f) ? '✓ Pagata' : '📄 Proforma'}
                    </span>
                  </div>
                </div>

                {/* MOBILE: card verticale */}
                <div className="md:hidden px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-apple-darkgray truncate">{f.numero_fattura}</span>
                    <span className={"shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold " + (isPagata(f) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                      {isPagata(f) ? '✓ Pagata' : '📄 Proforma'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-apple-darkgray truncate">{f.cliente?.nome_cognome || '—'}</span>
                    <span className="text-sm font-bold text-apple-darkgray shrink-0">{formatEuro(Number(f.lordo_ivato))}</span>
                  </div>
                  <div className="text-[11px] text-apple-gray">{formatData(f.data_incasso)}</div>
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
