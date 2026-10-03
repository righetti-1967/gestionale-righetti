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
import { Toast, type ToastTipo } from './Toast';

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

      // Leggi template personalizzato
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
      {/* ===== REPORT CHIUSURE MENSILE ===== */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-apple p-4 sm:p-6 shadow-apple">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-apple-darkgray">
              📊 Report Chiusure Cassa Mensile
            </h3>
            <p className="text-xs text-apple-gray mt-0.5">
              Tabella giorno-per-giorno stile gestionale (per commercialista)
            </p>
          </div>
          <span className="text-2xl">📈</span>
        </div>

        {/* Selettori mese/anno */}
        <div className="grid grid-cols-2 gap-3 mb-4">
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
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleScaricaPdfChiusure}
            disabled={scaricandoPdfChiusure}
            className="px-4 py-3 bg-apple-blue text-white rounded-apple font-semibold text-sm hover:bg-blue-600 transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scaricandoPdfChiusure ? '⏳...' : '📄 PDF A4'}
          </button>
          <button
            onClick={handleScaricaCsvChiusure}
            disabled={scaricandoCsvChiusure}
            className="px-4 py-3 bg-green-600 text-white rounded-apple font-semibold text-sm hover:bg-green-700 transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scaricandoCsvChiusure ? '⏳...' : '📊 CSV Excel'}
          </button>
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
        <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
          Caricamento riepilogo...
        </div>
      ) : riepilogo ? (
        <>
          {/* Card principali */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-apple text-sm"
                >
                  <span className="font-semibold text-apple-darkgray">
                    Aliquota {r.aliquota}%
                  </span>
                  <div className="flex gap-4 text-xs">
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
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-apple text-sm"
                >
                  <span className="font-semibold text-apple-darkgray">{m.metodo}</span>
                  <div className="flex gap-4 text-xs">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <button
                onClick={handleScaricaCsv}
                disabled={scaricandoCsv || riepilogo.numeroScontrini === 0}
                className="px-4 py-3 bg-green-600 text-white rounded-apple font-semibold text-sm hover:bg-green-700 transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scaricandoCsv ? '⏳...' : '📊 Esporta CSV'}
              </button>
              <button
                onClick={handleScaricaPdf}
                disabled={scaricandoPdf || riepilogo.numeroScontrini === 0}
                className="px-4 py-3 bg-apple-blue text-white rounded-apple font-semibold text-sm hover:bg-blue-600 transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scaricandoPdf ? '⏳...' : '📄 Esporta PDF'}
              </button>
              <button
                onClick={handleInviaEmail}
                disabled={inviandoEmail || !emailCommercialista || riepilogo.numeroScontrini === 0}
                className="px-4 py-3 bg-purple-600 text-white rounded-apple font-semibold text-sm hover:bg-purple-700 transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviandoEmail ? '⏳...' : '📧 Invia Commercialista'}
              </button>
            </div>

            {/* Info commercialista */}
            <div className="bg-gray-50 rounded-apple p-3 text-xs">
              <p className="text-apple-gray">
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
      <p className={`text-lg font-bold mt-1 ${evidenzia ? 'text-xl' : ''}`}>
        {valore}
      </p>
    </div>
  );
}
