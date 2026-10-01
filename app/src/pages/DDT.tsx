import { inviaEmail } from '../lib/api';
import { getCliente } from '../lib/clienti';
import { caricaFatturazione } from '../lib/fatturazione';
import { useEffect, useMemo, useState } from 'react';
import { getTuttiScarichi, type ScaricoConCliente, segnaReportCommercialistaInviato } from '../lib/scarichi';
import type { Percorso } from '../lib/percorsi';
import { generaPdfDdtCliente, generaPdfDdtCommercialista } from '../lib/pdfDdt';
import { generaPdfReportDdtCommercialista } from '../lib/pdfReportDdtCommercialista';
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

  const filtroMeseIso = useMemo(() => {
    if (filtroMese === 'tutti' || filtroAnno === 'tutti') return '';
    return `${filtroAnno}-${String(Number(filtroMese) + 1).padStart(2, '0')}`;
  }, [filtroMese, filtroAnno]);

  const formatData = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT') : '—';
  const formatNumeroDdt = (n: number, d: string) => `DDT-${String(n).padStart(3, '0')}-${new Date(d).getFullYear()}`;

  async function handleInviaDdt(scarico: ScaricoConCliente, canale: 'email' | 'whatsapp') {
    const cl = await getCliente(scarico.cliente_id);
    const nomeC = cl?.nome_cognome || scarico.cliente?.nome_cognome || 'Cliente';
    const numDdt = formatNumeroDdt(scarico.numero_ddt, scarico.data_seduta);
    if (canale === 'whatsapp') { window.open(`https://wa.me/${(cl?.cellulare || '').replace(/\D/g, '')}?text=${encodeURIComponent('Gentile ' + nomeC + ', le inviamo il ' + numDdt)}`, '_blank'); return; }
    if (!cl?.email) { setToast({ message: 'Email mancante', tipo: 'error' }); return; }
    setToast({ message: 'Invio email...', tipo: 'info' });
    try {
      const doc = await generaPdfDdtCliente(scarico, null, cl as any, false);
      await inviaEmail({ destinatario: cl.email, oggetto: numDdt, corpo_html: `<p>Gentile <strong>${nomeC}</strong>, in allegato il <strong>${numDdt}</strong>.</p>`, from_name: 'Studio Righetti', allegato_base64: doc.output('datauristring').split(',')[1], allegato_nome: numDdt + '.pdf' });
      setToast({ message: '✅ Inviato!', tipo: 'success' });
    } catch (err: any) { setToast({ message: 'Errore', tipo: 'error' }); }
  }

  async function handleInviaEmailReport() {
    if (!filtroMeseIso) return;
    const config = await caricaFatturazione();
    const email = config.emailCommercialista?.trim();
    if (!email) { setToast({ message: 'Email commercialista non configurata', tipo: 'error' }); return; }
    try {
      setGenerandoReport(true);
      const doc = await generaPdfReportDdtCommercialista(scarichiMese, filtroMeseIso, false);
      const nomeMese = MESI[Number(filtroMese)] + ' ' + filtroAnno;
      await inviaEmail({ destinatario: email, oggetto: `Report DDT ${nomeMese}`, corpo_html: `<h2>Report DDT</h2><p>Mese: ${nomeMese}</p>`, from_name: 'Studio Righetti', allegato_base64: doc.output('datauristring').split(',')[1], allegato_nome: `Report_DDT_${filtroMeseIso}.pdf` });
      await segnaReportCommercialistaInviato(scarichiMese.map(s => s.id));
      await caricaScarichi();
      setToast({ message: '✅ Inviato!', tipo: 'success' });
    } catch (err: any) { setToast({ message: 'Errore', tipo: 'error' }); } finally { setGenerandoReport(false); }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 text-left">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Documenti di Trasporto</h1>
        <p className="text-sm text-apple-gray">{scarichiMostrati.length} DDT trovati</p>
      </div>

      <div className="flex gap-1 bg-white rounded-apple shadow-apple p-1 mb-6 w-fit">
        <button onClick={() => setTab('cliente')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'cliente' ? 'bg-apple-blue text-white' : 'hover:bg-gray-100'}`}>📄 DDT Cliente</button>
        <button onClick={() => { setTab('commercialista'); setFiltroFirma('tutti'); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'commercialista' ? 'bg-amber-500 text-white' : 'hover:bg-gray-100'}`}>📊 Documento di Competenza</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-apple shadow-apple p-5 text-left"><p className="text-xs text-apple-gray mb-1">📄 DDT emessi</p><p className="text-2xl font-bold text-apple-darkgray">{scarichiMostrati.length}</p></div>
        {tab === 'cliente' ? (
          <><button onClick={() => setFiltroFirma('firmati')} className={`p-5 rounded-apple shadow-apple text-left transition-all ${filtroFirma === 'firmati' ? 'bg-green-600 text-white' : 'bg-white'}`}><p className="text-xs mb-1 opacity-80">✍️ Firmati</p><p className="text-2xl font-bold">{scarichiMostrati.filter(s => s.firmato).length}</p></button>
            <button onClick={() => setFiltroFirma('da-firmare')} className={`p-5 rounded-apple shadow-apple text-left transition-all ${filtroFirma === 'da-firmare' ? 'bg-amber-500 text-white' : 'bg-white'}`}><p className="text-xs mb-1 opacity-80">⏳ Da firmare</p><p className="text-2xl font-bold">{scarichiMostrati.filter(s => !s.firmato).length}</p></button></>
        ) : (
          <div className="col-span-2 bg-white rounded-apple shadow-apple p-5 flex items-center justify-between">
            <div><p className="text-xs text-apple-gray mb-1">📤 Report mensile</p><p className="text-sm font-bold text-apple-darkgray">{filtroMese === 'tutti' ? 'Scegli mese' : `${scarichiMese.length} DDT nel mese`}</p></div>
            <div className="flex gap-2">
              <button onClick={() => setShowAnteprimaReport(true)} disabled={filtroMese === 'tutti' || scarichiMese.length === 0} className="px-3 py-2 bg-apple-darkgray text-white rounded-apple text-[10px] font-bold">👁️ Anteprima</button>
              <button onClick={handleInviaEmailReport} disabled={generandoReport || filtroMese === 'tutti' || scarichiMese.length === 0} className="px-3 py-2 bg-green-600 text-white rounded-apple text-[10px] font-bold">✉️ Invia Email</button>
              <button onClick={async () => { setGenerandoReport(true); await generaPdfReportDdtCommercialista(scarichiMese, filtroMeseIso); setGenerandoReport(false); }} disabled={generandoReport || filtroMese === 'tutti' || scarichiMese.length === 0} className="px-3 py-2 bg-gray-100 text-apple-darkgray rounded-apple text-[10px] font-bold">💾 Scarica PDF</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-8 items-center text-left">
        <div className="relative flex-1 w-full text-left"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray text-lg">🔍</span><input type="text" placeholder="Cerca..." value={ricerca} onChange={(e) => setRicerca(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white rounded-apple shadow-apple text-sm focus:outline-none border border-gray-100" /></div>
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 no-scrollbar">
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
          {(filtroMese !== 'tutti' || filtroAnno !== 'tutti' || filtroFirma !== 'tutti') && <button onClick={() => { setFiltroMese('tutti'); setFiltroAnno('tutti'); setFiltroFirma('tutti'); }} className="px-4 py-2.5 text-[11px] font-bold text-red-500">✕ Reset</button>}
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
                <div className="md:col-span-2 flex justify-center"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.firmato ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}><span className={`w-2 h-2 rounded-full ${s.firmato ? 'bg-green-500' : 'bg-orange-500'}`}></span>{s.firmato ? 'Firmato' : 'Da firmare'}</span></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showAnteprimaReport && (
        <AnteprimaPdf titolo="Anteprima Report Commercialista" sottotitolo={`Mese: ${MESI[Number(filtroMese)]} ${filtroAnno}`} onScarica={async () => await generaPdfReportDdtCommercialista(scarichiMese, filtroMeseIso)} labelScarica="💾 Scarica PDF Report" coloreScarica="amber" onClose={() => setShowAnteprimaReport(false)}>
          <div className="text-[10px] text-apple-darkgray text-left">
            <h2 className="text-base font-bold text-center mb-4 uppercase">RIEPILOGO MENSILE DDT</h2>
            <table className="w-full border-collapse">
              <thead><tr className="bg-gray-100"><th className="border p-1 text-left">N. DDT</th><th className="border p-1 text-left">Data</th><th className="border p-1 text-left">Cliente</th><th className="border p-1 text-right">Imponibile</th></tr></thead>
              <tbody>
                {scarichiMese.map(s => (
                  <tr key={s.id}><td className="border p-1">{formatNumeroDdt(s.numero_ddt, s.data_seduta)}</td><td className="border p-1">{formatData(s.data_seduta)}</td><td className="border p-1">{s.cliente?.nome_cognome || '—'}</td><td className="border p-1 text-right">{formatEuro(s.totale_netto_iva)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnteprimaPdf>
      )}

      {ddtSelezionato && (
        <DettaglioDdt 
          scarico={ddtSelezionato} 
          onClose={() => setDdtSelezionato(null)} 
          onFirma={() => { const s = ddtSelezionato; setDdtSelezionato(null); setDdtDaFirmare(s); }}
          onInvia={(canale) => handleInviaDdt(ddtSelezionato, canale)}
          onScaricaPdf={(tipo) => {
            const s = ddtSelezionato;
            if (tipo === 'cliente') generaPdfDdtCliente(s, null as any, s.cliente as any);
            else generaPdfDdtCommercialista(s, null as any, s.cliente as any);
          }}
          onEliminato={() => { setDdtSelezionato(null); caricaScarichi(); }}
        />
      )}

      {ddtDaFirmare && <FirmaDdtQR scarico={ddtDaFirmare} cliente={ddtDaFirmare.cliente as any} onClose={() => setDdtDaFirmare(null)} onSuccess={() => { setDdtDaFirmare(null); caricaScarichi(); }} />}
      {toast && <Toast message={toast.message} tipo={toast.tipo} onComplete={() => setToast(null)} />}
    </div>
  );
}
