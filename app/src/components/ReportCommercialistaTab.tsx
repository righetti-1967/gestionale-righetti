import { useEffect, useMemo, useState } from 'react';
import {
  calcolaRiepilogoPeriodo,
  scaricaCsvScontrini,
  generaPdfRiepilogo,
  generaPdfRiepilogoBase64,
  primiGiorniMese,
  annoCorrente,
  type RiepilogoPeriodo,
} from '../lib/reportScontrini';
import { inviaEmailConConfig } from '../lib/api';
import { caricaFatturazione } from '../lib/fatturazione';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { formatEuro } from '../lib/fatture';
import {
  generaPdfReportChiusureA4,
  scaricaCsvReportChiusure,
} from '../lib/reportChiusure';
import {
  getTestoTemplate,
  renderTemplate,
  formatEuroIt,
} from '../lib/testiTemplate';
import {
  calcolaReportCompetenza,
  type ReportCompetenza,
} from '../lib/reportCompetenza';
import {
  generaPdfCompetenza,
  scaricaCsvCompetenza,
} from '../lib/pdfCompetenza';
import { Toast, type ToastTipo } from './Toast';
import { Button } from './Button';

type PeriodoPreset = 'mese' | 'mese-scorso' | 'anno' | 'custom';

export function ReportCommercialistaTab() {
  const { dati: azienda } = useDatiAziendali();
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [preset, setPreset] = useState<PeriodoPreset>('mese');
  const [riepilogo, setRiepilogo] = useState<RiepilogoPeriodo | null>(null);
  const [caricando, setCaricando] = useState(false);
  const [scaricandoCsv, setScaricandoCsv] = useState(false);
  const [scaricandoPdf, setScaricandoPdf] = useState(false);
  const [inviandoEmail, setInviandoEmail] = useState(false);
  const [emailCommercialista, setEmailCommercialista] = useState('');
  const [nomeCommercialista, setNomeCommercialista] = useState('');
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  // Report chiusure mensile
  const oggi = new Date();
  const [meseReport, setMeseReport] = useState<number>(oggi.getMonth() + 1);
  const [annoReport, setAnnoReport] = useState<number>(oggi.getFullYear());
  const [scaricandoPdfChiusure, setScaricandoPdfChiusure] = useState(false);
  const [scaricandoCsvChiusure, setScaricandoCsvChiusure] = useState(false);

  // Report competenza
  const [annoCompetenza, setAnnoCompetenza] = useState<number>(new Date().getFullYear());
  const [reportCompetenza, setReportCompetenza] = useState<ReportCompetenza | null>(null);
  const [caricandoCompetenza, setCaricandoCompetenza] = useState(false);
  const [scaricandoPdfCompetenza, setScaricandoPdfCompetenza] = useState(false);

  // Init preset corrente (mese) + carica config commercialista
  useEffect(() => {
    const { inizio, fine } = primiGiorniMese();
    setDataInizio(inizio);
    setDataFine(fine);

    caricaFatturazione().then((c) => {
      setEmailCommercialista(c.emailCommercialista || '');
      setNomeCommercialista(c.nomeCommercialista || '');
    });
  }, []);

  // Carica report competenza quando cambia anno
  useEffect(() => {
    let annullato = false;
    async function carica() {
      try {
        setCaricandoCompetenza(true);
        const r = await calcolaReportCompetenza(annoCompetenza);
        if (!annullato) setReportCompetenza(r);
      } catch (err: any) {
        if (!annullato) {
          setToast({ message: '❌ ' + (err?.message || 'Errore'), tipo: 'error' });
        }
      } finally {
        if (!annullato) setCaricandoCompetenza(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
  }, [annoCompetenza]);

  // Applica preset quando cambia
  useEffect(() => {
    if (preset === 'mese') {
      const { inizio, fine } = primiGiorniMese();
      setDataInizio(inizio);
      setDataFine(fine);
    } else if (preset === 'mese-scorso') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const { inizio, fine } = primiGiorniMese(d);
      setDataInizio(inizio);
      setDataFine(fine);
    } else if (preset === 'anno') {
      const { inizio, fine } = annoCorrente();
      setDataInizio(inizio);
      setDataFine(fine);
    }
  }, [preset]);

  // Carica riepilogo quando cambia periodo
  useEffect(() => {
    if (!dataInizio || !dataFine) return;
    let annullato = false;

    async function carica() {
      try {
        setCaricando(true);
        const r = await calcolaRiepilogoPeriodo(dataInizio, dataFine);
        if (!annullato) setRiepilogo(r);
      } catch (err: any) {
        if (!annullato) {
          setToast({
            message: '❌ ' + (err?.message || 'Errore caricamento'),
            tipo: 'error',
          });
        }
      } finally {
        if (!annullato) setCaricando(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
  }, [dataInizio, dataFine]);

  const dataInizioIt = useMemo(() => {
    if (!dataInizio) return '';
    return new Date(dataInizio).toLocaleDateString('it-IT');
  }, [dataInizio]);

  const dataFineIt = useMemo(() => {
    if (!dataFine) return '';
    return new Date(dataFine).toLocaleDateString('it-IT');
  }, [dataFine]);

  async function handleScaricaCsv() {
    try {
      setScaricandoCsv(true);
      await scaricaCsvScontrini(dataInizio, dataFine);
      setToast({ message: '✅ CSV scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore CSV'), tipo: 'error' });
    } finally {
      setScaricandoCsv(false);
    }
  }

  async function handleScaricaPdf() {
    try {
      setScaricandoPdf(true);
      await generaPdfRiepilogo(dataInizio, dataFine, true);
      setToast({ message: '✅ PDF scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore PDF'), tipo: 'error' });
    } finally {
      setScaricandoPdf(false);
    }
  }

  async function handleInviaEmail() {
    if (!emailCommercialista || !emailCommercialista.trim()) {
      setToast({ message: '❌ Email commercialista non configurata', tipo: 'error' });
      return;
    }
    if (!riepilogo) {
      setToast({ message: '❌ Nessun riepilogo caricato', tipo: 'error' });
      return;
    }

    try {
      setInviandoEmail(true);
      const { base64, nomeFile } = await generaPdfRiepilogoBase64(dataInizio, dataFine);

      const template = await getTestoTemplate('email_report_commercialista');
      const variabili = {
        commercialista: nomeCommercialista || 'Commercialista',
        azienda: azienda.ragioneSociale || '',
        data_inizio: dataInizioIt,
        data_fine: dataFineIt,
        totale: formatEuroIt(riepilogo.totaleLordo),
        iva: formatEuroIt(riepilogo.totaleIva),
      };
      const oggettoCustom = renderTemplate(template.oggetto || 'Report Scontrini', variabili);
      const corpoHtml = renderTemplate(template.corpo, variabili);

      await inviaEmailConConfig({
        destinatario: emailCommercialista.trim(),
        oggetto: oggettoCustom,
        corpo_html: corpoHtml,
        allegato_base64: base64,
        allegato_nome: nomeFile,
      });

      setToast({
        message: `✅ Report inviato a ${emailCommercialista}`,
        tipo: 'success',
      });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore invio email'),
        tipo: 'error',
      });
    } finally {
      setInviandoEmail(false);
    }
  }

  async function handleScaricaPdfCompetenza() {
    if (!reportCompetenza) return;
    try {
      setScaricandoPdfCompetenza(true);
      await generaPdfCompetenza(reportCompetenza, true);
      setToast({ message: '✅ PDF competenza scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore PDF'), tipo: 'error' });
    } finally {
      setScaricandoPdfCompetenza(false);
    }
  }

  function handleScaricaCsvCompetenza() {
    if (!reportCompetenza) return;
    try {
      scaricaCsvCompetenza(reportCompetenza);
      setToast({ message: '✅ CSV competenza scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore CSV'), tipo: 'error' });
    }
  }

  async function handleScaricaPdfChiusure() {
    try {
      setScaricandoPdfChiusure(true);
      await generaPdfReportChiusureA4(annoReport, meseReport, true);
      setToast({ message: '✅ Report chiusure PDF scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore PDF chiusure'),
        tipo: 'error',
      });
    } finally {
      setScaricandoPdfChiusure(false);
    }
  }

  async function handleScaricaCsvChiusure() {
    try {
      setScaricandoCsvChiusure(true);
      await scaricaCsvReportChiusure(annoReport, meseReport);
      setToast({ message: '✅ Report chiusure CSV scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore CSV chiusure'),
        tipo: 'error',
      });
    } finally {
      setScaricandoCsvChiusure(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ===== REPORT COMPETENZA PERCORSI ===== */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-apple p-4 sm:p-6 shadow-apple">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-apple-darkgray">
              📊 Report Competenza Percorsi
            </h3>
            <p className="text-xs text-apple-gray mt-0.5">
              Risconto passivo 31/12 per SRL in regime di competenza
            </p>
          </div>
          <span className="text-2xl shrink-0">🧮</span>
        </div>

        {/* Selettore anno */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
            Anno di riferimento
          </label>
          <select
            value={annoCompetenza}
            onChange={(e) => setAnnoCompetenza(Number(e.target.value))}
            className="w-full sm:w-40 px-3 py-2.5 bg-white border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-purple-300/40"
          >
            {[2023, 2024, 2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {caricandoCompetenza ? (
          <div className="text-center py-6 text-sm text-apple-gray">
            Calcolo competenza...
          </div>
        ) : reportCompetenza ? (
          <div className="space-y-3">
            {/* KPI box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white rounded-apple border border-gray-200 p-3">
                <p className="text-[10px] text-apple-gray uppercase font-semibold">
                  Percorsi venduti
                </p>
                <p className="text-sm sm:text-base font-bold text-apple-darkgray mt-1">
                  {reportCompetenza.totaleVenduto.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div className="bg-white rounded-apple border border-gray-200 p-3">
                <p className="text-[10px] text-apple-gray uppercase font-semibold">
                  Consumato
                </p>
                <p className="text-sm sm:text-base font-bold text-apple-blue mt-1">
                  −{reportCompetenza.totaleUtilizzato.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div className="bg-green-50 rounded-apple border border-green-200 p-3">
                <p className="text-[10px] text-green-800 uppercase font-bold">
                  Risconto 31/12
                </p>
                <p className="text-base sm:text-lg font-bold text-green-700 mt-1">
                  {reportCompetenza.totaleResiduo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>

            {/* Info percorsi vecchi */}
            {reportCompetenza.percorsiPrecedenti.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-apple p-3 text-xs">
                <p className="text-amber-800">
                  <strong>⚠️ {reportCompetenza.percorsiPrecedenti.length} percorsi</strong> venduti in anni precedenti ma ancora aperti — residuo totale:{' '}
                  <strong>{reportCompetenza.totaleResiduoPrecedenti.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</strong>
                </p>
              </div>
            )}

            {/* Bottoni export */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <Button
                variant="purple"
                size="md"
                onClick={handleScaricaPdfCompetenza}
                disabled={scaricandoPdfCompetenza}
              >
                {scaricandoPdfCompetenza ? '⏳...' : '📄 PDF A4'}
              </Button>
              <Button
                variant="success"
                size="md"
                onClick={handleScaricaCsvCompetenza}
              >
                📊 CSV Excel
              </Button>
            </div>

            <p className="text-[11px] text-apple-gray italic">
              📋 Il report include: dettaglio per cliente, dettaglio percorsi anno corrente,
              percorsi anni precedenti ancora aperti.
            </p>
          </div>
        ) : null}
      </div>

      {/* ===== REPORT CHIUSURE MENSILE ===== */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-apple p-4 sm:p-6 shadow-apple">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-apple-darkgray">
              📊 Report Chiusure Cassa Mensile
            </h3>
            <p className="text-xs text-apple-gray mt-0.5">
              Tabella giorno-per-giorno stile gestionale (per commercialista)
            </p>
          </div>
          <span className="text-2xl shrink-0">📈</span>
        </div>

        {/* Selettori mese/anno */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
              Mese
            </label>
            <select
              value={meseReport}
              onChange={(e) => setMeseReport(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            >
              <option value={1}>Gennaio</option>
              <option value={2}>Febbraio</option>
              <option value={3}>Marzo</option>
              <option value={4}>Aprile</option>
              <option value={5}>Maggio</option>
              <option value={6}>Giugno</option>
              <option value={7}>Luglio</option>
              <option value={8}>Agosto</option>
              <option value={9}>Settembre</option>
              <option value={10}>Ottobre</option>
              <option value={11}>Novembre</option>
              <option value={12}>Dicembre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
              Anno
            </label>
            <select
              value={annoReport}
              onChange={(e) => setAnnoReport(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pulsanti export */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleScaricaPdfChiusure}
            disabled={scaricandoPdfChiusure}
          >
            {scaricandoPdfChiusure ? '⏳...' : '📄 PDF A4'}
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={handleScaricaCsvChiusure}
            disabled={scaricandoCsvChiusure}
          >
            {scaricandoCsvChiusure ? '⏳...' : '📊 CSV Excel'}
          </Button>
        </div>

        <p className="text-[11px] text-apple-gray mt-3 italic">
          📋 Il report include: servizi, prodotti, sconti, metodi pagamento,
          totali giornalieri e differenze cassa.
        </p>
      </div>

      {/* Filtri periodo */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          📅 Periodo
        </h3>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { id: 'mese', label: '📆 Mese corrente' },
            { id: 'mese-scorso', label: '📆 Mese scorso' },
            { id: 'anno', label: '📅 Anno corrente' },
            { id: 'custom', label: '⚙️ Personalizzato' },
          ] as const).map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3.5 py-2 rounded-apple text-xs font-semibold transition-all ${
                preset === p.id
                  ? 'bg-apple-blue text-white shadow-apple'
                  : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date custom */}
        {preset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Data inizio
              </label>
              <input
                type="date"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Data fine
              </label>
              <input
                type="date"
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-apple-gray">
          📅 Periodo selezionato: <strong>{dataInizioIt}</strong> → <strong>{dataFineIt}</strong>
        </p>
      </div>

      {/* Riepilogo */}
      {caricando ? (
        <div className="bg-white rounded-apple shadow-apple p-8 sm:p-12 text-center text-apple-gray text-sm">
          Caricamento riepilogo...
        </div>
      ) : riepilogo ? (
        <>
          {/* Card principali */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <CardRiepilogo
              icon="🧾"
              label="Scontrini"
              valore={String(riepilogo.numeroScontrini)}
              colore="blue"
            />
            <CardRiepilogo
              icon="💶"
              label="Lordo"
              valore={formatEuro(riepilogo.totaleLordo)}
              colore="green"
              evidenzia
            />
            <CardRiepilogo
              icon="📊"
              label="Imponibile"
              valore={formatEuro(riepilogo.totaleNetto)}
              colore="gray"
            />
            <CardRiepilogo
              icon="💰"
              label="IVA 22%"
              valore={formatEuro(riepilogo.totaleIva)}
              colore="purple"
            />
          </div>

          {/* Dettaglio IVA */}
          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              💰 Dettaglio IVA
            </h3>
            <div className="space-y-1.5">
              {riepilogo.ivaPerAliquota.map((r) => (
                <div
                  key={r.aliquota}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 py-2 px-3 bg-gray-50 rounded-apple text-sm"
                >
                  <span className="font-semibold text-apple-darkgray">
                    Aliquota {r.aliquota}%
                  </span>
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs">
                    <span className="text-apple-gray">
                      Imp.: <strong className="text-apple-darkgray">{formatEuro(r.imponibile)}</strong>
                    </span>
                    <span className="text-apple-gray">
                      IVA: <strong className="text-purple-700">{formatEuro(r.iva)}</strong>
                    </span>
                    <span className="text-apple-gray">
                      Lordo: <strong className="text-apple-darkgray">{formatEuro(r.lordo)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dettaglio metodi pagamento */}
          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              💳 Metodi di pagamento
            </h3>
            <div className="space-y-1.5">
              {riepilogo.perMetodo.map((m) => (
                <div
                  key={m.metodo}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 py-2 px-3 bg-gray-50 rounded-apple text-sm"
                >
                  <span className="font-semibold text-apple-darkgray">{m.metodo}</span>
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs">
                    <span className="text-apple-gray">
                      N: <strong className="text-apple-darkgray">{m.numeroScontrini}</strong>
                    </span>
                    <span className="font-bold text-apple-darkgray">
                      {formatEuro(m.totale)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Annullati (se ci sono) */}
          {riepilogo.numeroAnnullati > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-4">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
                ⚠️ Scontrini annullati nel periodo
              </p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-red-700">
                  N. {riepilogo.numeroAnnullati} scontrini annullati
                </span>
                <span className="font-bold text-red-700">
                  {formatEuro(riepilogo.totaleAnnullati)}
                </span>
              </div>
            </div>
          )}

          {/* Azioni Export */}
          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              📤 Esporta / Invia
            </h3>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 mb-4">
              <Button
                variant="success"
                size="md"
                onClick={handleScaricaCsv}
                disabled={scaricandoCsv || riepilogo.numeroScontrini === 0}
              >
                {scaricandoCsv ? '⏳...' : '📊 Esporta CSV'}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleScaricaPdf}
                disabled={scaricandoPdf || riepilogo.numeroScontrini === 0}
              >
                {scaricandoPdf ? '⏳...' : '📄 Esporta PDF'}
              </Button>
              <Button
                variant="purple"
                size="md"
                onClick={handleInviaEmail}
                disabled={inviandoEmail || !emailCommercialista || riepilogo.numeroScontrini === 0}
              >
                {inviandoEmail ? '⏳...' : '📧 Invia Commercialista'}
              </Button>
            </div>

            {/* Info commercialista */}
            <div className="bg-gray-50 rounded-apple p-3 text-xs">
              <p className="text-apple-gray break-words">
                <strong>Destinatario:</strong>{' '}
                {emailCommercialista
                  ? `${nomeCommercialista || 'Commercialista'} <${emailCommercialista}>`
                  : '⚠️ Non configurato'}
              </p>
              <p className="text-apple-gray mt-1">
                {emailCommercialista
                  ? 'Configura in Impostazioni → Fatturazione'
                  : 'Vai in Impostazioni → Fatturazione per configurare email commercialista'}
              </p>
            </div>
          </div>
        </>
      ) : null}

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

// ============================================================
// CARD RIEPILOGO
// ============================================================

function CardRiepilogo({
  icon,
  label,
  valore,
  colore,
  evidenzia,
}: {
  icon: string;
  label: string;
  valore: string;
  colore: 'blue' | 'green' | 'purple' | 'gray';
  evidenzia?: boolean;
}) {
  const colori = {
    blue: 'bg-blue-50 border-blue-200 text-apple-blue',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    gray: 'bg-gray-50 border-gray-200 text-apple-darkgray',
  };

  return (
    <div className={`rounded-apple border p-3 ${colori[colore]} ${evidenzia ? 'shadow-apple' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {icon} {label}
      </p>
      <p className={`text-base sm:text-lg font-bold mt-1 ${evidenzia ? 'sm:text-xl' : ''}`}>
        {valore}
      </p>
    </div>
  );
}
