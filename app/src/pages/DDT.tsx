import { inviaEmail } from '../lib/api';
import { getCliente } from '../lib/clienti';
import { caricaFatturazione } from '../lib/fatturazione';
import { useEffect, useMemo, useState } from 'react';
import { getTuttiScarichi, type ScaricoConCliente } from '../lib/scarichi';
import { generaPdfDdtCliente, generaPdfDdtCommercialista } from '../lib/pdfDdt';
import { generaPdfReportDdtCommercialista } from '../lib/pdfReportDdtCommercialista';
import { segnaReportCommercialistaInviato } from '../lib/scarichi';
import { formatEuro } from '../lib/percorsi-helper';
import { Toast, type ToastTipo } from '../components/Toast';
import { FirmaDdtQR } from '../components/FirmaDdtQR';
import { DettaglioDdt } from '../components/DettaglioDdt';
import { AnteprimaPdf } from '../components/AnteprimaPdf';

const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const ANNI = [2024, 2025, 2026, 2027];

export function DDT() {
  const [scarichi, setScarichi] = useState<ScaricoConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [tab, setTab] = useState<'cliente' | 'commercialista'>('cliente');
  const [ricerca, setRicerca] = useState('');
  const [filtroMese, setFiltroMese] = useState<number | 'tutti'>('tutti');
  const [filtroAnno, setFiltroAnno] = useState<number | 'tutti'>('tutti');
  const [filtroFirma, setFiltroFirma] = useState<'tutti' | 'firmati' | 'da-firmare'>('tutti');
  const [generandoReport, setGenerandoReport] = useState(false);
  const [showAnteprimaReport, setShowAnteprimaReport] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);
  const [ddtSelezionato, setDdtSelezionato] = useState<ScaricoConCliente | null>(null);
  const [ddtDaFirmare, setDdtDaFirmare] = useState<ScaricoConCliente | null>(null);

  useEffect(() => { caricaScarichi(); }, []);
  async function caricaScarichi() {
    try { setLoading(true); setErrore(null); const data = await getTuttiScarichi(); setScarichi(data);
    } catch (err: any) { setErrore(err.message || 'Errore'); } finally { setLoading(false); }
  }

  const scarichiMostrati = useMemo(() => {
    return scarichi.filter((s) => {
      const d = new Date(s.data_seduta);
      const matchMese = filtroMese === 'tutti' || d.getMonth() === filtroMese;
      const matchAnno = filtroAnno === 'tutti' || d.getFullYear() === filtroAnno;
      const matchFirma = filtroFirma === 'tutti' || (filtroFirma === 'firmati' ? s.firmato : !s.firmato);
      const q = ricerca.toLowerCase();
      const matchRicerca = !ricerca.trim() || (s.cliente?.nome_cognome || "").toLowerCase().includes(q) || String(s.numero_ddt).includes(q);
      return matchMese && matchAnno && matchFirma && matchRicerca;
    });
  }, [scarichi, filtroMese, filtroAnno, ricerca, filtroFirma]);

  const scarichiMese = useMemo(() => {
    if (filtroMese === 'tutti' || filtroAnno === 'tutti') return [];
    return scarichi.filter(s => {
      const d = new Date(s.data_seduta);
      return d.getMonth() === filtroMese && d.getFullYear() === filtroAnno;
    });
  }, [scarichi, filtroMese, filtroAnno]);

  const formatData = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—';
  const formatNumeroDdt = (n: number, d: string) => `DDT-${String(n).padStart(3, '0')}-${new Date(d).getFullYear()}`;

  async function handleInviaDdt(scarico: ScaricoConCliente, canale: 'email' | 'whatsapp') {
    const cl = await getCliente(scarico.cliente_id);
    const nomeC = cl?.nome_cognome || scarico.cliente?.nome_cognome || 'Cliente';
    const numDdt = formatNumeroDdt(scarico.numero_ddt, scarico.data_seduta);

    if (canale === 'whatsapp') {
      const waUrl = `https://wa.me/${(cl?.cellulare || '').replace(/\D/g, '')}?text=${encodeURIComponent('Le inviamo il ' + numDdt)}`;
      window.open(waUrl, '_blank');
      return;
    }
    setToast({ message: 'Invio email in corso...', tipo: 'info' });
    try {
      const doc = await generaPdfDdtCliente(scarico, null, cl as any, false);
      await inviaEmail({ destinatario: cl?.email || '', oggetto: numDdt, corpo_html: '<p>In allegato il DDT</p>', from_name: 'Studio', allegato_base64: doc.output('datauristring').split(',')[1], allegato_nome: numDdt + '.pdf' });
      setToast({ message: '✅ Inviato!', tipo: 'success' });
    } catch (err: any) { setToast({ message: 'Errore invio', tipo: 'error' }); }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 text-left">
        <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Documenti di Trasporto</h1>
        <p className="text-sm text-apple-gray">{scarichiMostrati.length} DDT trovati</p>
      </div>

      <div className="flex gap-1 bg-white rounded-apple shadow-apple p-1 mb-6 w-fit">
        <button onClick={() => setTab('cliente')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'cliente' ? 'bg-apple-blue text-white' : 'hover:bg-gray-100'}`}>📄 DDT Cliente</button>
        <button onClick={() => { setTab('commercialista'); setFiltroFirma('tutti'); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'commercialista' ? 'bg-amber-500 text-white' : 'hover:bg-gray-100'}`}>📊 Documento di Competenza</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-apple shadow-apple p-5 text-left">
          <p className="text-xs text-apple-gray mb-1">📄 DDT emessi</p>
          <p className="text-2xl font-bold text-apple-darkgray">{scarichiMostrati.length}</p>
        </div>
        {tab === 'cliente' ? (
          <>
            <button onClick={() => setFiltroFirma('firmati')} className={`p-5 rounded-apple shadow-apple text-left transition-all ${filtroFirma === 'firmati' ? 'bg-green-600 text-white' : 'bg-white'}`}>
              <p className="text-xs mb-1 opacity-80">✍️ Firmati</p>
              <p className="text-2xl font-bold">{scarichiMostrati.filter(s => s.firmato).length}</p>
            </button>
            <button onClick={() => setFiltroFirma('da-firmare')} className={`p-5 rounded-apple shadow-apple text-left transition-all ${filtroFirma === 'da-firmare' ? 'bg-amber-500 text-white' : 'bg-white'}`}>
              <p className="text-xs mb-1 opacity-80">⏳ Da firmare</p>
              <p className="text-2xl font-bold">{scarichiMostrati.filter(s => !s.firmato).length}</p>
            </button>
          </>
        ) : (
          <div className="col-span-2 bg-white rounded-apple shadow-apple p-5 flex items-center justify-between">
            <div><p className="text-xs text-apple-gray">📤 Report mensile</p><p className="text-sm font-bold text-apple-darkgray">{scarichiMese.length} DDT nel mese</p></div>
            <button onClick={() => setShowAnteprimaReport(true)} disabled={filtroMese === 'tutti' || scarichiMese.length === 0} className="px-4 py-2 bg-apple-darkgray text-white rounded-apple text-xs font-bold disabled:opacity-50">👁️ Anteprima Report</button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-8 items-center text-left">
        <div className="relative flex-1 w-full text-left">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray text-lg">🔍</span>
          <input type="text" placeholder="Cerca..." value={ricerca} onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray focus:outline-none border border-gray-100" />
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center bg-white rounded-apple shadow-apple border border-gray-100 p-1 gap-1">
            <select value={filtroMese} onChange={(e) => setFiltroMese(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))}
              className="pl-3 pr-8 py-2 bg-apple-lightgray/40 hover:bg-apple-lightgray/60 border-none rounded-apple text-[11px] font-bold text-apple-darkgray focus:outline-none cursor-pointer appearance-none transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}>
              <option value="tutti">Tutti i mesi</option>
              {MESI.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={filtroAnno} onChange={(e) => setFiltroAnno(e.target.value === 'tutti' ? 'tutti' : Number(e.target.value))}
              className="pl-3 pr-8 py-2 bg-apple-lightgray/40 hover:bg-apple-lightgray/60 border-none rounded-apple text-[11px] font-bold text-apple-darkgray focus:outline-none cursor-pointer appearance-none transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "12px" }}>
              <option value="tutti">Tutti gli anni</option>
              {ANNI.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button onClick={() => { setFiltroMese('tutti'); setFiltroAnno('tutti'); setFiltroFirma('tutti'); }} className="px-4 py-2.5 text-[11px] font-bold text-red-500 hover:text-red-600">✕ Reset</button>
        </div>
      </div>

      {!loading && !errore && (
        <div className="bg-white rounded-apple shadow-apple overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase text-left">
            <div className="col-span-3">Numero DDT</div><div className="col-span-3">Cliente</div><div className="col-span-2">Data</div><div className="col-span-2 text-right">Importo</div><div className="col-span-2 text-center">Stato</div>
          </div>
          <div className="divide-y divide-gray-100">
            {scarichiMostrati.map((s) => (
              <button key={s.id} onClick={() => setDdtSelezionato(s)} className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center text-left">
                <div className="md:col-span-3 text-sm font-semibold text-apple-darkgray">{formatNumeroDdt(s.numero_ddt, s.data_seduta)}</div>
                <div className="md:col-span-3 text-sm text-apple-darkgray truncate">{s.cliente?.nome_cognome || '—'}</div>
                <div className="md:col-span-2 text-sm text-apple-gray">{formatData(s.data_seduta)}</div>
                <div className="md:col-span-2 text-sm font-bold text-apple-darkgray md:text-right">{formatEuro(Number(s.totale_lordo_scontato || 0))}</div>
                <div className="md:col-span-2 flex justify-center">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.firmato ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {s.firmato ? '✓ Firmato' : '⏳ Da firmare'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {ddtSelezionato && (
        <DettaglioDdt
          scarico={ddtSelezionato}
          onClose={() => setDdtSelezionato(null)}
          onFirma={() => { const s = ddtSelezionato; setDdtSelezionato(null); setDdtDaFirmare(s); }}
          onInvia={(canale) => handleInviaDdt(ddtSelezionato, canale)}
          onScaricaPdf={(tipo) => {
            if (tipo === 'cliente') generaPdfDdtCliente(ddtSelezionato, null as any, ddtSelezionato.cliente as any);
            else generaPdfDdtCommercialista(ddtSelezionato, null as any, ddtSelezionato.cliente as any);
          }}
          onEliminato={() => { setDdtSelezionato(null); caricaScarichi(); }}
        />
      )}

      {ddtDaFirmare && <FirmaDdtQR scarico={ddtDaFirmare} cliente={ddtDaFirmare.cliente as any} onClose={() => setDdtDaFirmare(null)} onSuccess={() => { setDdtDaFirmare(null); caricaScarichi(); }} />}
      {toast && <Toast message={toast.message} tipo={toast.tipo} onComplete={() => setToast(null)} />}
    </div>
  );
}
