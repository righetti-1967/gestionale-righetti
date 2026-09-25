import { useEffect, useMemo, useState } from 'react';
import {
  getTuttiScarichi,
  type ScaricoConCliente,
} from '../lib/scarichi';
import type { Percorso } from '../lib/percorsi';
import { generaPdfDdtCliente, generaPdfDdtCommercialista } from '../lib/pdfDdt';
import { generaPdfReportDdtCommercialista } from '../lib/pdfReportDdtCommercialista';
import { segnaReportCommercialistaInviato } from '../lib/scarichi';
import { formatEuro } from '../lib/percorsi-helper';
import { Toast, type ToastTipo } from '../components/Toast';
import { FirmaDdtQR } from '../components/FirmaDdtQR';
import { DettaglioDdt } from '../components/DettaglioDdt';
import {
  AnteprimaPdf,
  IntestazionePdf,
  BandaBluPdf,
  FooterPdf,
} from '../components/AnteprimaPdf';

type Tab = 'cliente' | 'commercialista';

export function DDT() {
  const [scarichi, setScarichi] = useState<ScaricoConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('cliente');
  const [ricerca, setRicerca] = useState('');
  const [filtroMese, setFiltroMese] = useState<string>('');
  const [filtroFirma, setFiltroFirma] = useState<'tutti' | 'firmati' | 'da-firmare'>('tutti');
  const [generandoReport, setGenerandoReport] = useState(false);
  const [showAnteprimaReport, setShowAnteprimaReport] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);
  const [scaricando, setScaricando] = useState<number | null>(null);
  const [ddtDaFirmare, setDdtDaFirmare] = useState<ScaricoConCliente | null>(null);
  const [ddtSelezionato, setDdtSelezionato] = useState<ScaricoConCliente | null>(null);

  useEffect(() => {
    caricaScarichi();
  }, []);

  async function caricaScarichi() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getTuttiScarichi();
      setScarichi(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento DDT');
    } finally {
      setLoading(false);
    }
  }

  const scarichiFiltrati = useMemo(() => {
    return scarichi.filter((s) => {
      if (filtroMese) {
        const dataSeduta = new Date(s.data_seduta);
        const annoMese = `${dataSeduta.getFullYear()}-${String(dataSeduta.getMonth() + 1).padStart(2, '0')}`;
        if (annoMese !== filtroMese) return false;
      }

      if (filtroFirma === 'firmati' && !s.firmato) return false;
      if (filtroFirma === 'da-firmare' && s.firmato) return false;

      if (ricerca.trim()) {
        const q = ricerca.toLowerCase();
        const nomeCliente = s.cliente?.nome_cognome.toLowerCase() || '';
        const numeroDdt = String(s.numero_ddt);
        if (!nomeCliente.includes(q) && !numeroDdt.includes(q)) return false;
      }

      return true;
    });
  }, [scarichi, filtroMese, ricerca, filtroFirma]);

  const totaleNetto = scarichiFiltrati.reduce(
    (sum, s) => sum + Number(s.totale_netto_iva || 0),
    0
  );
  const totaleLordo = scarichiFiltrati.reduce(
    (sum, s) => sum + Number(s.totale_lordo_scontato || 0),
    0
  );

  const mesiDisponibili = useMemo(() => {
    const set = new Set<string>();
    for (const s of scarichi) {
      const d = new Date(s.data_seduta);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort().reverse();
  }, [scarichi]);

  function handleInviaDdt(scarico: ScaricoConCliente, canale: 'email' | 'whatsapp') {
    const canaleLabel = canale === 'email' ? 'Email' : 'WhatsApp';
    const numDdt = `DDT-${String(scarico.numero_ddt).padStart(3, '0')}-${new Date(scarico.data_seduta).getFullYear()}`;
    setToast({
      message: `📧 Invio ${canaleLabel} ${numDdt} in arrivo`,
      tipo: 'info',
    });
  }

  async function riscaricaPdf(scarico: ScaricoConCliente) {
    try {
      setScaricando(scarico.id);
      setToast(null);

      const percorsoFittizio = {
        id: 0,
        cliente_id: scarico.cliente_id,
        fattura_id: scarico.fattura_madre_id,
        nome: '',
        data_inizio: '',
        data_fine: '',
        righe: [],
        totale_listino: 0,
        totale_finale: 0,
        sconto_percentuale: 0,
        terminato: false,
        terminato_manualmente: false,
        bloccato: false,
        motivo_blocco: null,
        note: null,
        created_at: '',
      } as unknown as Percorso;

      const clientePerPdf = scarico.cliente
        ? ({
            id: scarico.cliente.id,
            nome_cognome: scarico.cliente.nome_cognome,
            codice_fiscale: scarico.cliente.codice_fiscale,
            partita_iva: scarico.cliente.partita_iva,
            indirizzo_residenza: scarico.cliente.indirizzo_residenza,
            cap_residenza: scarico.cliente.cap_residenza,
            citta_residenza: scarico.cliente.citta_residenza,
            provincia_residenza: scarico.cliente.provincia_residenza,
          } as unknown as import('../lib/clienti').Cliente)
        : null;

      if (tab === 'cliente') {
        await generaPdfDdtCliente(scarico, percorsoFittizio, clientePerPdf);
      } else {
        await generaPdfDdtCommercialista(scarico, percorsoFittizio, clientePerPdf);
      }
      setToast({ message: 'PDF generato', tipo: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ message: msg || 'Errore nella generazione del PDF', tipo: 'error' });
    } finally {
      setScaricando(null);
    }
  }

  const scarichiMese = filtroMese
    ? scarichi.filter((s) => {
        const d = new Date(s.data_seduta);
        const annoMese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return annoMese === filtroMese;
      })
    : scarichiFiltrati;

  const tuttiInviati =
    scarichiMese.length > 0 &&
    scarichiMese.every((s) => !!s.report_commercialista_inviato_at);

  const dataUltimoInvio = tuttiInviati
    ? scarichiMese
        .map((s) => s.report_commercialista_inviato_at)
        .filter(Boolean)
        .sort()
        .reverse()[0]
    : null;

  async function handleScaricaReport() {
    if (!filtroMese) {
      setToast({ message: 'Seleziona prima un mese dal filtro', tipo: 'error' });
      return;
    }
    if (scarichiMese.length === 0) {
      setToast({ message: 'Nessun DDT in questo mese', tipo: 'error' });
      return;
    }

    try {
      setGenerandoReport(true);
      setToast(null);

      await generaPdfReportDdtCommercialista(scarichiMese, filtroMese);

      const ids = scarichiMese.map((s) => s.id);
      await segnaReportCommercialistaInviato(ids);

      await caricaScarichi();

      setToast({ message: 'Report generato e segnato come inviato', tipo: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({ message: msg || 'Errore nella generazione', tipo: 'error' });
    } finally {
      setGenerandoReport(false);
    }
  }

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


  function formatMeseIt(meseIso: string | null): string {
    if (!meseIso) return '—';
    const [anno, mese] = meseIso.split('-');
    if (!anno || !mese) return meseIso;
    const data = new Date(Number(anno), Number(mese) - 1, 1);
    return data.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }
  function formatNumeroDdt(numeroDdt: number, dataSeduta: string): string {
    const anno = new Date(dataSeduta).getFullYear();
    return `DDT-${String(numeroDdt).padStart(3, '0')}-${anno}`;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">
          Documenti di Trasporto
        </h1>
        <p className="text-sm text-apple-gray">
          {scarichiFiltrati.length} DDT {filtroMese && `(${filtroMese})`}
        </p>
      </div>

      <div className="flex gap-1 bg-white rounded-apple shadow-apple p-1 mb-4 w-fit">
        <button
          onClick={() => setTab('cliente')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'cliente'
              ? 'bg-apple-blue text-white'
              : 'text-apple-darkgray hover:bg-gray-100'
          }`}
        >
          📄 DDT Cliente
        </button>
        <button
          onClick={() => {
            setTab('commercialista');
            setFiltroFirma('tutti');
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'commercialista'
              ? 'bg-amber-500 text-white'
              : 'text-apple-darkgray hover:bg-gray-100'
          }`}
        >
          📊 Documento di Competenza
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">
            {tab === 'cliente' ? '📄 DDT emessi' : '📊 DDT emessi'}
          </p>
          <p className="text-2xl font-bold text-apple-darkgray">{scarichiFiltrati.length}</p>
        </div>
        {tab === 'commercialista' && (
          <>
            <div className="bg-white rounded-apple shadow-apple p-5">
              <p className="text-xs text-apple-gray mb-1">💰 Tot. Imponibile</p>
              <p className="text-2xl font-bold text-green-600">{formatEuro(totaleNetto)}</p>
            </div>
            <div className="bg-white rounded-apple shadow-apple p-5">
              <p className="text-xs text-apple-gray mb-1">📊 Tot. Lordo (riferimento)</p>
              <p className="text-2xl font-bold text-apple-darkgray">{formatEuro(totaleLordo)}</p>
            </div>
          </>
        )}

        {tab === 'commercialista' && (
          <div className="bg-white rounded-apple shadow-apple p-5 flex flex-col justify-center">
            <p className="text-xs text-apple-gray mb-1">📤 Report mensile</p>
            {tuttiInviati && dataUltimoInvio ? (
              <p className="text-xs font-semibold text-green-700 mb-2">
                ✓ Scaricato il {formatData(dataUltimoInvio)}
              </p>
            ) : (
              <p className="text-xs text-apple-gray mb-2">
                {filtroMese ? scarichiMese.length : '—'} DDT nel mese
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setShowAnteprimaReport(true)}
                disabled={!filtroMese || scarichiMese.length === 0}
                className="px-3 py-2 rounded-apple font-medium text-xs transition-colors bg-apple-darkgray text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                👁️ Anteprima Report
              </button>
              <button
                onClick={handleScaricaReport}
                disabled={generandoReport || !filtroMese || scarichiMese.length === 0}
                className={`px-3 py-2 rounded-apple font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  tuttiInviati
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {generandoReport ? '...' : tuttiInviati ? '📊 Reinvia Report' : '📊 Scarica Report'}
              </button>
            </div>
          </div>
        )}

        {tab === 'cliente' && (
          <>
            <button
              onClick={() => setFiltroFirma(filtroFirma === 'firmati' ? 'tutti' : 'firmati')}
              className={`rounded-apple shadow-apple p-5 text-left transition-all ${
                filtroFirma === 'firmati'
                  ? 'bg-green-600 text-white'
                  : 'bg-white hover:shadow-apple-lg'
              }`}
            >
              <p className={`text-xs mb-1 ${filtroFirma === 'firmati' ? 'text-white/90' : 'text-apple-gray'}`}>
                ✍️ Firmati
              </p>
              <p className={`text-2xl font-bold ${filtroFirma === 'firmati' ? 'text-white' : 'text-green-600'}`}>
                {scarichiFiltrati.filter((s) => s.firmato).length}
              </p>
            </button>

            <button
              onClick={() => setFiltroFirma(filtroFirma === 'da-firmare' ? 'tutti' : 'da-firmare')}
              className={`rounded-apple shadow-apple p-5 text-left transition-all ${
                filtroFirma === 'da-firmare'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white hover:shadow-apple-lg'
              }`}
            >
              <p className={`text-xs mb-1 ${filtroFirma === 'da-firmare' ? 'text-white/90' : 'text-apple-gray'}`}>
                ⏳ Da firmare
              </p>
              <p className={`text-2xl font-bold ${
                filtroFirma === 'da-firmare'
                  ? 'text-white'
                  : scarichiFiltrati.filter((s) => !s.firmato).length > 0
                  ? 'text-amber-600'
                  : 'text-apple-darkgray'
              }`}>
                {scarichiFiltrati.filter((s) => !s.firmato).length}
              </p>
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per numero DDT o cliente..."
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
            const nomeMese = new Date(Number(anno), Number(mese) - 1, 1).toLocaleDateString(
              'it-IT',
              { month: 'long', year: 'numeric' }
            );
            return (
              <option key={m} value={m}>
                {nomeMese}
              </option>
            );
          })}
        </select>
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

      {!loading && !errore && scarichiFiltrati.length > 0 && (
        <div className="bg-white rounded-apple shadow-apple overflow-hidden">
          <div className="divide-y divide-gray-100">
            {scarichiFiltrati.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-blue-50/40 transition-colors cursor-pointer"
                onClick={() => setDdtSelezionato(s)}
              >
                <div className="col-span-3">
                  <p className="text-sm font-semibold text-apple-darkgray">
                    {formatNumeroDdt(s.numero_ddt, s.data_seduta)}
                  </p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-sm text-apple-darkgray truncate">
                    {s.cliente?.nome_cognome || '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-apple-gray">
                    {formatData(s.data_seduta)}
                  </p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-bold text-apple-darkgray">
                    {formatEuro(Number(s.totale_netto_iva))}
                  </p>
                </div>
                <div className="col-span-2 flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => riscaricaPdf(s)}
                    disabled={scaricando === s.id}
                    className="px-2.5 py-1.5 rounded-apple font-semibold text-xs transition-colors bg-blue-50 text-apple-blue hover:bg-blue-100"
                    title="Scarica PDF"
                  >
                    📄
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ddtSelezionato && (
        <DettaglioDdt
          scarico={ddtSelezionato}
          onClose={() => setDdtSelezionato(null)}
          onFirma={() => {
            const s = ddtSelezionato;
            setDdtSelezionato(null);
            setDdtDaFirmare(s);
          }}
          onInvia={(canale) => handleInviaDdt(ddtSelezionato, canale)}
          onScaricaPdf={(tipo) => {
            const s = ddtSelezionato;
            setDdtSelezionato(null);
            if (tipo === 'cliente') {
              import('../lib/pdfDdt').then(({ generaPdfDdtCliente }) => {
                const percorsoFittizio = {
                  id: 0, cliente_id: s.cliente_id, fattura_id: s.fattura_madre_id,
                  nome: '', data_inizio: '', data_fine: '', righe: [],
                  totale_listino: 0, totale_finale: 0, sconto_percentuale: 0,
                  terminato: false, terminato_manualmente: false, bloccato: false,
                  motivo_blocco: null, note: null, created_at: '',
                } as unknown as import('../lib/percorsi').Percorso;
                const clientePerPdf = s.cliente as unknown as import('../lib/clienti').Cliente;
                generaPdfDdtCliente(s, percorsoFittizio, clientePerPdf);
              });
            } else {
              import('../lib/pdfDdt').then(({ generaPdfDdtCommercialista }) => {
                const percorsoFittizio = {
                  id: 0, cliente_id: s.cliente_id, fattura_id: s.fattura_madre_id,
                  nome: '', data_inizio: '', data_fine: '', righe: [],
                  totale_listino: 0, totale_finale: 0, sconto_percentuale: 0,
                  terminato: false, terminato_manualmente: false, bloccato: false,
                  motivo_blocco: null, note: null, created_at: '',
                } as unknown as import('../lib/percorsi').Percorso;
                const clientePerPdf = s.cliente as unknown as import('../lib/clienti').Cliente;
                generaPdfDdtCommercialista(s, percorsoFittizio, clientePerPdf);
              });
            }
          }}
          onEliminato={() => {
            setDdtSelezionato(null);
            caricaScarichi();
            setToast({ message: 'DDT eliminato: scorte di magazzino e residuo percorso ripristinati!', tipo: 'success' });
          }}
        />
      )}

      {ddtDaFirmare && (
        <FirmaDdtQR
          scarico={ddtDaFirmare}
          cliente={ddtDaFirmare.cliente as unknown as import('../lib/clienti').Cliente || null}
          onClose={() => setDdtDaFirmare(null)}
          onSuccess={() => {
            setDdtDaFirmare(null);
            caricaScarichi();
            setToast({ message: 'Firma acquisita con successo', tipo: 'success' });
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



      {/* Anteprima Report Commercialista */}
      {showAnteprimaReport && (
        <AnteprimaPdf
          titolo="Anteprima Report Documento di Competenza"
          sottotitolo={`Report mensile ${filtroMese || ''}`}
          onScarica={async () => {
            await handleScaricaReport();
            setShowAnteprimaReport(false);
          }}
          labelScarica={generandoReport ? 'Generazione…' : '📊 Scarica PDF Report'}
          coloreScarica="amber"
          onClose={() => setShowAnteprimaReport(false)}
        >
          <div className="text-xs text-gray-800">
            <div className="border-b-2 border-amber-500 pb-3 mb-4">
              <h2 className="text-base font-bold text-center">
                REPORT MENSILE DDT — COMMERCIALISTA
              </h2>
              <p className="text-center text-gray-600 text-[10px] mt-1">
                Mese: {formatMeseIt(filtroMese)} · {scarichiMese.length} DDT totali
              </p>
            </div>

            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">
                    N. DDT
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-left">
                    Data
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-left">
                    Cliente
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-right">
                    Imponibile
                  </th>
                </tr>
              </thead>
              <tbody>
                {scarichiMese.map((s) => {
                  const anno = new Date(s.data_seduta).getFullYear();
                  const numFormattato = `DDT-${String(s.numero_ddt).padStart(3, '0')}-${anno}`;
                  const cliente = (s as any).cliente;
                  const imponibile = s.righe
                    ?.filter((r) => !r.nome.includes('(EXTRA Percorso)'))
                    .reduce((sum, r) => sum + r.quantita * r.netto_iva_scontato, 0) || 0;
                  return (
                    <tr key={s.id}>
                      <td className="border border-gray-300 px-2 py-1">
                        {numFormattato}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {formatData(s.data_seduta)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {cliente?.nome_cognome || '—'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {imponibile.toLocaleString('it-IT', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 font-bold">
                  <td
                    colSpan={3}
                    className="border border-gray-300 px-2 py-1 text-right"
                  >
                    TOTALE IMPONIBILE
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {scarichiMese
                      .reduce((sum, s) => {
                        const imp = s.righe
                          ?.filter((r) => !r.nome.includes('(EXTRA Percorso)'))
                          .reduce(
                            (acc, r) => acc + r.quantita * r.netto_iva_scontato,
                            0
                          ) || 0;
                        return sum + imp;
                      }, 0)
                      .toLocaleString('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                  </td>
                </tr>
              </tfoot>
            </table>

            <p className="mt-4 text-[10px] italic text-gray-500 text-center">
              Anteprima riepilogativa. Il PDF definitivo contiene anche le voci
              dettagliate di ogni DDT.
            </p>
          </div>
        </AnteprimaPdf>
      )}
    </div>

  );
}
