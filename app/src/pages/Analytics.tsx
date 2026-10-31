import { useEffect, useMemo, useState } from 'react';
import {
  calcolaReportCliente,
  calcolaReportAggregato,
  settimanaCorrente,
  meseCorrente,
  annoCorrente,
  type ReportCliente,
  type ReportAggregato,
  type ItemAggregato,
  type ClienteRanking,
} from '../lib/analytics';
import { getClienti, type Cliente } from '../lib/clienti';
import { generaPdfReportCliente, generaPdfReportAggregato } from '../lib/pdfAnalytics';
import { formatEuro } from '../lib/fatture';
import { Toast, type ToastTipo } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { ModaleInviaTemplate } from '../components/ModaleInviaTemplate';

// ============================================================
// HELPER: formattazione date in italiano
// ============================================================
function formatDataIT(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type Tab = 'singolo' | 'aggregato' | 'iva';
type PresetPeriodo = 'settimana' | 'mese' | 'anno' | 'custom';

interface AnalyticsProps {
  onNavigate?: (page: string, params?: string) => void;
}

export function Analytics({ onNavigate }: AnalyticsProps) {

  const [tab, setTab] = useState<Tab>('singolo');

  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  // Soglie KPI Clienti (configurabili, salvate in localStorage)
  const [sogliaDormienti, setSogliaDormienti] = useState<number>(() => {
    const saved = localStorage.getItem('kpi_soglia_dormienti');
    return saved ? parseInt(saved) : 90;
  });
  const [sogliaPersi, setSogliaPersi] = useState<number>(() => {
    const saved = localStorage.getItem('kpi_soglia_persi');
    return saved ? parseInt(saved) : 180;
  });
  const [sogliaFrequenzaAttesa, setSogliaFrequenzaAttesa] = useState<number>(() => {
    const saved = localStorage.getItem('kpi_soglia_frequenza');
    return saved ? parseInt(saved) : 45;
  });

  useEffect(() => {
    localStorage.setItem('kpi_soglia_dormienti', String(sogliaDormienti));
    localStorage.setItem('kpi_soglia_persi', String(sogliaPersi));
    localStorage.setItem('kpi_soglia_frequenza', String(sogliaFrequenzaAttesa));
  }, [sogliaDormienti, sogliaPersi, sogliaFrequenzaAttesa]);

  const [mostraSoglie, setMostraSoglie] = useState(false);

  // Singolo cliente
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [ricerca, setRicerca] = useState('');
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null);
  const [reportCliente, setReportCliente] = useState<ReportCliente | null>(null);
  const [caricandoCliente, setCaricandoCliente] = useState(false);

  // Aggregato
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [preset, setPreset] = useState<PresetPeriodo>('mese');
  const [reportAggregato, setReportAggregato] = useState<ReportAggregato | null>(null);
  const [caricandoAggregato, setCaricandoAggregato] = useState(false);

  // Carica clienti
  useEffect(() => {
    getClienti().then(setClienti).catch(console.error);
  }, []);

  // Init preset corrente
  useEffect(() => {
    const p = meseCorrente();
    setDataInizio(p.inizio);
    setDataFine(p.fine);
  }, []);

  // Aggiorna preset
  useEffect(() => {
    if (preset === 'settimana') {
      const p = settimanaCorrente();
      setDataInizio(p.inizio);
      setDataFine(p.fine);
    } else if (preset === 'mese') {
      const p = meseCorrente();
      setDataInizio(p.inizio);
      setDataFine(p.fine);
    } else if (preset === 'anno') {
      const p = annoCorrente();
      setDataInizio(p.inizio);
      setDataFine(p.fine);
    }
  }, [preset]);

  // Carica report singolo
  useEffect(() => {
    if (!clienteSelezionato) {
      setReportCliente(null);
      return;
    }
    let annullato = false;
    async function carica() {
      try {
        setCaricandoCliente(true);
        const r = await calcolaReportCliente(clienteSelezionato!.id);
        if (!annullato) setReportCliente(r);
      } catch (err: any) {
        if (!annullato) {
          setToast({ message: '❌ ' + (err?.message || 'Errore'), tipo: 'error' });
        }
      } finally {
        if (!annullato) setCaricandoCliente(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
  }, [clienteSelezionato]);

  // Carica report aggregato
  useEffect(() => {
    if (!dataInizio || !dataFine) return;
    let annullato = false;
    async function carica() {
      try {
        setCaricandoAggregato(true);
        const r = await calcolaReportAggregato(dataInizio, dataFine, { sogliaDormienti, sogliaPersi });
        if (!annullato) setReportAggregato(r);
      } catch (err: any) {
        if (!annullato) {
          setToast({ message: '❌ ' + (err?.message || 'Errore'), tipo: 'error' });
        }
      } finally {
        if (!annullato) setCaricandoAggregato(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
  }, [dataInizio, dataFine, sogliaDormienti, sogliaPersi]);

  const clientiFiltrati = useMemo(() => {
    if (!ricerca.trim()) return clienti.slice(0, 20);
    const q = ricerca.toLowerCase();
    return clienti
      .filter((c) => c.nome_cognome.toLowerCase().includes(q))
      .slice(0, 30);
  }, [clienti, ricerca]);

  function cambiaCliente(c: Cliente) {
    setClienteSelezionato(c);
    setRicerca('');
  }

  function resetCliente() {
    setClienteSelezionato(null);
    setReportCliente(null);
  }

  async function esportaPdfCliente() {
    if (!reportCliente) return;
    try {
      await generaPdfReportCliente(reportCliente, true);
      setToast({ message: '✅ PDF cliente scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore PDF'), tipo: 'error' });
    }
  }

  async function esportaPdfAggregato() {
    if (!reportAggregato) return;
    try {
      await generaPdfReportAggregato(reportAggregato, true);
      setToast({ message: '✅ PDF aggregato scaricato', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore PDF'), tipo: 'error' });
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">
          📊 Analytics Clienti
        </h1>
        <p className="text-sm text-apple-gray">
          Report statistiche singolo cliente e aggregato per periodo
        </p>
      </div>

      {/* Tab selector */}
      <div className="inline-flex bg-gray-100 rounded-apple p-1 mb-6">
        <button
          onClick={() => setTab('singolo')}
          className={`px-5 py-2 rounded-apple text-sm font-semibold transition-all ${
            tab === 'singolo'
              ? 'bg-white text-apple-darkgray shadow-apple'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          👤 Singolo Cliente
        </button>
        <button
          onClick={() => setTab('aggregato')}
          className={`px-5 py-2 rounded-apple text-sm font-semibold transition-all ${
            tab === 'aggregato'
              ? 'bg-white text-apple-darkgray shadow-apple'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          👥 Aggregato Periodo
        </button>
        <button
          onClick={() => setTab('iva')}
          className={`px-5 py-2 rounded-apple text-sm font-semibold transition-all ${
            tab === 'iva'
              ? 'bg-white text-apple-darkgray shadow-apple'
              : 'text-apple-gray hover:text-apple-darkgray'
          }`}
        >
          🧾 IVA a Confronto
        </button>
      </div>

      {/* === TAB SINGOLO === */}
      {tab === 'singolo' && (
        <div className="space-y-4">
          {!clienteSelezionato ? (
            <>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
                <input
                  type="text"
                  placeholder="Cerca cliente per nome..."
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                />
              </div>
              <div className="bg-white rounded-apple shadow-apple overflow-hidden divide-y divide-gray-100">
                {clientiFiltrati.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => cambiaCliente(c)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50/40 transition-colors flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {c.nome_cognome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-apple-darkgray truncate">
                        {c.nome_cognome}
                      </p>
                      {c.cellulare && (
                        <p className="text-xs text-apple-gray">{c.cellulare}</p>
                      )}
                    </div>
                    <span className="text-apple-blue text-sm">→</span>
                  </button>
                ))}
                {clientiFiltrati.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-apple-gray">
                    Nessun cliente trovato
                  </p>
                )}
              </div>
            </>
          ) : caricandoCliente ? (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
              Calcolo statistiche...
            </div>
          ) : reportCliente ? (
            <ReportSingoloView
              report={reportCliente}
              onClose={resetCliente}
              onEsportaPdf={esportaPdfCliente}
            />
          ) : null}
        </div>
      )}

      {/* === TAB AGGREGATO === */}
      {tab === 'aggregato' && (
        <div className="space-y-4">
          {/* Filtri periodo */}

          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { id: 'settimana', label: '📆 Settimana' },
                { id: 'mese', label: '📅 Mese' },
                { id: 'anno', label: '🗓️ Anno' },
                { id: 'custom', label: '⚙️ Custom' },
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
            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-apple-gray mb-1.5">Data inizio</label>
                  <input
                    type="date"
                    value={dataInizio}
                    onChange={(e) => setDataInizio(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-apple-gray mb-1.5">Data fine</label>
                  <input
                    type="date"
                    value={dataFine}
                    onChange={(e) => setDataFine(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                  />
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-apple-gray">
              Periodo: <strong>{formatDataIT(dataInizio)}</strong> → <strong>{formatDataIT(dataFine)}</strong>
            </p>
          </div>

          {caricandoAggregato ? (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
              Calcolo statistiche...
            </div>
          ) : reportAggregato ? (
            <ReportAggregatoView
              report={reportAggregato}
              onEsportaPdf={esportaPdfAggregato}
              onNavigate={onNavigate}
              sogliaDormienti={sogliaDormienti}
              sogliaPersi={sogliaPersi}
              sogliaFrequenzaAttesa={sogliaFrequenzaAttesa}
              setSogliaDormienti={setSogliaDormienti}
              setSogliaPersi={setSogliaPersi}
              setSogliaFrequenzaAttesa={setSogliaFrequenzaAttesa}
              mostraSoglie={mostraSoglie}
              setMostraSoglie={setMostraSoglie}
            />
          ) : null}
        </div>
      )}

      {/* === TAB IVA === */}
      {tab === 'iva' && <TabIvaConfronto />}

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
// REPORT SINGOLO CLIENTE
// ============================================================

function ReportSingoloView({
  report,
  onClose,
  onEsportaPdf,
}: {
  report: ReportCliente;
  onClose: () => void;
  onEsportaPdf: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Header cliente */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-apple p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-bold shrink-0">
            {report.nomeCliente.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-apple-darkgray truncate">
              {report.nomeCliente}
            </h2>
            <p className="text-xs text-apple-gray">
              {report.numeroPassaggi} passaggi
              {report.primaSeduta && ` · dal ${report.primaSeduta}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEsportaPdf}
            className="px-4 py-2 bg-apple-blue text-white rounded-apple font-semibold text-xs hover:bg-blue-600 transition-colors shadow-apple"
          >
            🖨️ Esporta PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-apple-darkgray rounded-apple font-medium text-xs hover:bg-gray-50 transition-colors border border-gray-200"
          >
            ← Cambia cliente
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Totale Spesa"
          value={formatEuro(report.spesaTotale)}
          icon="💰"
          colore="green"
          evidenzia
        />
        <KpiCard
          label="Scontrino medio"
          value={formatEuro(report.scontrinoMedio)}
          icon="📊"
          colore="blue"
        />
        <KpiCard
          label="Fiches media"
          value={formatEuro(report.fichesMedia)}
          icon="🎯"
          colore="purple"
        />
        <KpiCard
          label="Passaggi"
          value={String(report.numeroPassaggi)}
          icon="🚶"
          colore="orange"
        />
      </div>

      {/* Dettaglio spesa */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          💰 Dettaglio spesa
        </h3>
        <div className="space-y-2">
          <RigaSpesa label="Scontrini" importo={report.spesaScontrini} totale={report.spesaTotale} />
          <RigaSpesa label="Fatture" importo={report.spesaFatture} totale={report.spesaTotale} />
          <div className="border-t border-gray-200 pt-2 mt-2">
            <RigaSpesa label="TOTALE" importo={report.spesaTotale} totale={report.spesaTotale} bold />
          </div>
        </div>
      </div>

      {/* Percentuali servizi vs prodotti */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          📈 Ripartizione spesa
        </h3>
        <div className="space-y-3">
          <BarraPercentuale
            label="🛠️ Servizi"
            percentuale={report.percentualeServizi}
            colore="blue"
          />
          <BarraPercentuale
            label="📦 Prodotti"
            percentuale={report.percentualeProdotti}
            colore="green"
          />
        </div>
      </div>

      {/* Servizi acquistati */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          🛠️ Servizi acquistati ({report.serviziAcquistati.length})
        </h3>
        {report.serviziAcquistati.length === 0 ? (
          <p className="text-xs text-apple-gray italic">Nessun servizio</p>
        ) : (
          <ListaItems items={report.serviziAcquistati} />
        )}
      </div>

      {/* Prodotti acquistati */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          📦 Prodotti acquistati ({report.prodottiAcquistati.length})
        </h3>
        {report.prodottiAcquistati.length === 0 ? (
          <p className="text-xs text-apple-gray italic">Nessun prodotto</p>
        ) : (
          <ListaItems items={report.prodottiAcquistati} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// REPORT AGGREGATO
// ============================================================

function ReportAggregatoView({
  report,
  onEsportaPdf,
  onNavigate,
  sogliaDormienti,
  sogliaPersi,
  sogliaFrequenzaAttesa,
  setSogliaDormienti,
  setSogliaPersi,
  setSogliaFrequenzaAttesa,
  mostraSoglie,
  setMostraSoglie,
}: {
  report: ReportAggregato;
  onEsportaPdf: () => void;
  onNavigate?: (page: string, params?: string) => void;
  sogliaDormienti: number;
  sogliaPersi: number;
  sogliaFrequenzaAttesa: number;
  setSogliaDormienti: (v: number) => void;
  setSogliaPersi: (v: number) => void;
  setSogliaFrequenzaAttesa: (v: number) => void;
  mostraSoglie: boolean;
  setMostraSoglie: (v: boolean) => void;
}) {

  // Funzione per aprire modale clienti filtrati
  function apriModaleFiltro(tipo: 'nuovi' | 'dormienti' | 'persi' | 'frequenza', soglia?: number) {
    setModaleFiltro({ tipo, soglia });
  }

  const [modaleFiltro, setModaleFiltro] = useState<{ tipo: 'nuovi' | 'dormienti' | 'persi' | 'frequenza'; soglia?: number } | null>(null);
  const [clienteDaContattare, setClienteDaContattare] = useState<Cliente | null>(null);
  const [toastInvia, setToastInvia] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header con pulsante export */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-apple p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-apple-darkgray">
            Report Periodo
          </h2>
          <p className="text-xs text-apple-gray">
            {formatDataIT(report.dataInizio)} → {formatDataIT(report.dataFine)}
          </p>
        </div>
        <button
          onClick={onEsportaPdf}
          className="px-4 py-2 bg-apple-blue text-white rounded-apple font-semibold text-xs hover:bg-blue-600 transition-colors shadow-apple"
        >
          🖨️ Esporta PDF
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Totale Incassato"
          value={formatEuro(report.spesaTotale)}
          icon="💰"
          colore="green"
          evidenzia
        />
        <KpiCard
          label="Clienti passati"
          value={`${report.numeroClientiPassati} / ${report.numeroClientiTotali}`}
          icon="👥"
          colore="blue"
        />
        <KpiCard
          label="Scontrino medio"
          value={formatEuro(report.scontrinoMedio)}
          icon="📊"
          colore="purple"
        />
        <KpiCard
          label="Fiches media"
          value={formatEuro(report.fichesMedia)}
          icon="🎯"
          colore="orange"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCardSmall label="Passaggi totali" value={String(report.numeroPassaggi)} />
        <KpiCardSmall label="Fiches totali" value={String(report.totaleFiches)} />
        <KpiCardSmall label="Passaggi/Cliente" value={String(report.passaggiPerCliente)} />
      </div>

      {/* KPI Clienti (nuovi) */}
      <div>
        <div className="flex items-center justify-between mb-2 mt-2">
          <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
            👥 Clienti
          </h3>
          <button
            onClick={() => setMostraSoglie(!mostraSoglie)}
            className="text-[10px] text-apple-blue hover:text-blue-700 font-medium"
          >
            {mostraSoglie ? '✕ Chiudi' : '⚙️ Configura soglie'}
          </button>
        </div>

        {mostraSoglie && (
          <div className="bg-blue-50 border border-blue-200 rounded-apple p-3 mb-3 space-y-2">
            <p className="text-[11px] text-blue-900 font-medium">
              Personalizza le soglie per il tuo studio:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-blue-700 uppercase mb-1">Dormienti (gg)</label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  value={sogliaDormienti}
                  onChange={(e) => setSogliaDormienti(parseInt(e.target.value) || 90)}
                  className="w-full px-2 py-1 rounded bg-white border border-blue-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 uppercase mb-1">Persi (gg)</label>
                <input
                  type="number"
                  min="60"
                  max="730"
                  value={sogliaPersi}
                  onChange={(e) => setSogliaPersi(parseInt(e.target.value) || 180)}
                  className="w-full px-2 py-1 rounded bg-white border border-blue-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-blue-700 uppercase mb-1">Frequenza (gg)</label>
                <input
                  type="number"
                  min="7"
                  max="180"
                  value={sogliaFrequenzaAttesa}
                  onChange={(e) => setSogliaFrequenzaAttesa(parseInt(e.target.value) || 45)}
                  className="w-full px-2 py-1 rounded bg-white border border-blue-200 text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] text-blue-600 italic">
              ℹ️ Ricarica per applicare le nuove soglie al calcolo.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => apriModaleFiltro('nuovi')} className="text-left">
            <KpiCard
              label="Nuovi clienti"
              value={String(report.nuoviClienti ?? 0)}
              icon="🆕"
              colore="green"
            />
          </button>
          <button onClick={() => apriModaleFiltro('frequenza', sogliaFrequenzaAttesa)} className="text-left">
            <KpiCard
              label="Frequenza ritorno"
              value={report.frequenzaRitornoMedia != null ? `${report.frequenzaRitornoMedia}gg` : '—'}
              icon="🔄"
              colore="blue"
            />
          </button>
          <button onClick={() => apriModaleFiltro('dormienti', sogliaDormienti)} className="text-left">
            <KpiCard
              label="Dormienti (90gg+)"
              value={String(report.clientiDormienti ?? 0)}
              icon="😴"
              colore="orange"
            />
          </button>
          <button onClick={() => apriModaleFiltro('persi', sogliaPersi)} className="text-left">
            <KpiCard
              label="Persi (180gg+)"
              value={String(report.clientiPersi ?? 0)}
              icon="🚨"
              colore="orange"
            />
          </button>
        </div>
      </div>

      {/* Ripartizione */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          📈 Ripartizione spesa
        </h3>
        <div className="space-y-3">
          <BarraPercentuale label="🛠️ Servizi" percentuale={report.percentualeServizi} colore="blue" />
          <BarraPercentuale label="📦 Prodotti" percentuale={report.percentualeProdotti} colore="green" />
        </div>
      </div>

      {/* Ranking clienti */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
          🏆 Ranking clienti ({report.clientiTop.length})
        </h3>
        <RankingClienti clienti={report.clientiTop} />
      </div>

      {/* Servizi + Prodotti */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
          <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
            🛠️ Servizi più venduti
          </h3>
          <ListaItems items={report.serviziAcquistati.slice(0, 10)} />
        </div>
        <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
          <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
            📦 Prodotti più venduti
          </h3>
          <ListaItems items={report.prodottiAcquistati.slice(0, 10)} />
        </div>
      </div>

      {/* Modale clienti filtrati */}
      {modaleFiltro !== null && (
        <ModaleClientiFiltrati
          tipo={modaleFiltro.tipo}
          soglia={modaleFiltro.soglia}
          onClose={() => setModaleFiltro(null)}
          onClienteClick={(c) => setClienteDaContattare(c)}
        />
      )}

      {/* Modale invio template (WhatsApp / Email) */}
      {clienteDaContattare && modaleFiltro && (
        <ModaleInviaTemplate
          chiave={
            modaleFiltro.tipo === 'nuovi'
              ? 'whatsapp_post_seduta'  // placeholder per "nuovo cliente" (benvenuto non ancora disponibile)
              : 'whatsapp_riattivazione'
          }
          cliente={clienteDaContattare}
          onClose={() => setClienteDaContattare(null)}
          onSuccess={(msg: string) => {
            setToastInvia(msg);
            setTimeout(() => setToastInvia(null), 3000);
            setClienteDaContattare(null);
          }}
          onError={(msg: string) => {
            setToastInvia('❌ ' + msg);
            setTimeout(() => setToastInvia(null), 3000);
          }}
        />
      )}

      {toastInvia && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-apple shadow-apple-lg z-[60] text-sm">
          {toastInvia}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTI HELPER
// ============================================================

function KpiCard({
  label,
  value,
  icon,
  colore,
  evidenzia,
}: {
  label: string;
  value: string;
  icon: string;
  colore: 'green' | 'blue' | 'purple' | 'orange';
  evidenzia?: boolean;
}) {
  const colori = {
    green: 'from-green-50 to-emerald-50 border-green-200 text-green-700',
    blue: 'from-blue-50 to-indigo-50 border-blue-200 text-apple-blue',
    purple: 'from-purple-50 to-pink-50 border-purple-200 text-purple-700',
    orange: 'from-orange-50 to-amber-50 border-orange-200 text-orange-700',
  };
  return (
    <div className={`bg-gradient-to-br ${colori[colore]} border rounded-apple p-4 ${evidenzia ? 'shadow-apple' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {icon} {label}
      </p>
      <p className={`font-bold mt-1 ${evidenzia ? 'text-2xl' : 'text-lg'}`}>{value}</p>
    </div>
  );
}

function KpiCardSmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-apple p-3 text-center">
      <p className="text-[10px] text-apple-gray uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-lg font-bold text-apple-darkgray mt-0.5">{value}</p>
    </div>
  );
}

function RigaSpesa({
  label,
  importo,
  totale,
  bold,
}: {
  label: string;
  importo: number;
  totale: number;
  bold?: boolean;
}) {
  const perc = totale > 0 ? (importo / totale) * 100 : 0;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${bold ? 'font-bold text-apple-darkgray' : 'text-apple-gray'}`}>
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-apple-gray">{perc.toFixed(1)}%</span>
        <span className={`text-sm ${bold ? 'font-bold text-apple-darkgray' : 'font-medium text-apple-darkgray'} w-24 text-right`}>
          {formatEuro(importo)}
        </span>
      </div>
    </div>
  );
}

function BarraPercentuale({
  label,
  percentuale,
  colore,
}: {
  label: string;
  percentuale: number;
  colore: 'blue' | 'green';
}) {
  const bg = colore === 'blue' ? 'bg-apple-blue' : 'bg-green-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-apple-darkgray">{label}</span>
        <span className="font-bold text-apple-darkgray">{percentuale.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${bg} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, percentuale)}%` }}
        />
      </div>
    </div>
  );
}

function ListaItems({ items }: { items: ItemAggregato[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-apple-gray italic">Nessun dato</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 py-2 px-3 bg-gray-50 rounded-apple"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-apple-darkgray truncate">
              {item.nome}
            </p>
            <p className="text-[10px] text-apple-gray">
              {item.quantita} {item.quantita === 1 ? 'unità' : 'unità'} · {item.percentuale.toFixed(1)}%
            </p>
          </div>
          <span className="text-sm font-bold text-apple-darkgray shrink-0">
            {formatEuro(item.spesa)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RankingClienti({ clienti }: { clienti: ClienteRanking[] }) {
  const [ordine, setOrdine] = useState<'desc' | 'asc'>('desc');

  const ordinati = useMemo(() => {
    const copia = [...clienti];
    copia.sort((a, b) =>
      ordine === 'desc'
        ? b.spesaTotale - a.spesaTotale
        : a.spesaTotale - b.spesaTotale
    );
    return copia;
  }, [clienti, ordine]);

  if (clienti.length === 0) {
    return <p className="text-xs text-apple-gray italic">Nessun cliente nel periodo</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={() => setOrdine(ordine === 'desc' ? 'asc' : 'desc')}
          className="px-3 py-1.5 bg-gray-100 text-apple-darkgray rounded-apple text-xs font-semibold hover:bg-gray-200 transition-colors"
        >
          {ordine === 'desc' ? '⬇️ Spesa decrescente' : '⬆️ Spesa crescente'}
        </button>
      </div>
      {ordinati.map((c, i) => (
        <div
          key={c.clienteId}
          className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-apple"
        >
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-white text-apple-gray'
          }`}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-apple-darkgray truncate">
              {c.nomeCliente}
            </p>
            <p className="text-[10px] text-apple-gray">
              {c.numeroPassaggi} passaggi · {c.percentuale.toFixed(1)}% del totale
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-apple-darkgray">
              {formatEuro(c.spesaTotale)}
            </p>
            <p className="text-[10px] text-apple-gray">
              medio {formatEuro(c.scontrinoMedio)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TAB IVA A CONFRONTO
// ============================================================================

function TabIvaConfronto() {
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [periodicita, setPeriodicita] = useState<'mensile' | 'trimestrale' | 'annuale'>('mensile');
  const [dati, setDati] = useState<Array<{
    periodo: string;
    iva_debito: number;
    iva_credito: number;
    iva_ordini: number;
    saldo: number;
    da_versare: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      setLoading(true);
      setErrore(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await fetch(
          `https://gestionale-righetti-production.up.railway.app/api/spese/iva-riepilogo?user_id=${user.id}&anno=${anno}&periodicita=${periodicita}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setDati(json.periodi || []);
      } catch (e: any) {
        setErrore(e?.message || 'Errore caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [anno, periodicita]);

  const totali = dati.reduce(
    (acc, d) => ({
      iva_debito: acc.iva_debito + d.iva_debito,
      iva_credito: acc.iva_credito + d.iva_credito,
      iva_ordini: acc.iva_ordini + (d.iva_ordini || 0),
      saldo: acc.saldo + d.saldo,
    }),
    { iva_debito: 0, iva_credito: 0, iva_ordini: 0, saldo: 0 }
  );

  function formatEuro(n: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Anno</label>
            <select
              value={anno}
              onChange={(e) => setAnno(parseInt(e.target.value))}
              className="px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
            >
              {[2024, 2025, 2026, 2027].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-apple-gray uppercase mb-1">Periodicità</label>
            <select
              value={periodicita}
              onChange={(e) => setPeriodicita(e.target.value as 'mensile' | 'trimestrale' | 'annuale')}
              className="px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm"
            >
              <option value="mensile">Mensile</option>
              <option value="trimestrale">Trimestrale</option>
              <option value="annuale">Annuale</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-apple shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-apple-gray">Caricamento…</div>
        ) : errore ? (
          <div className="p-8 text-center text-sm text-red-600">❌ {errore}</div>
        ) : dati.length === 0 ? (
          <div className="p-8 text-center text-sm text-apple-gray">
            📭 Nessun dato IVA per il periodo selezionato
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-apple-lightgray/60 border-b border-gray-200/60">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Periodo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">IVA Debito</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">IVA Credito</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase" title="IVA da ordini fornitori (in attesa di fattura, non nel saldo)">IVA Ordini ℹ️</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Saldo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-apple-gray uppercase">Stato</th>
              </tr>
            </thead>
            <tbody>
              {dati.map((d) => (
                <tr key={d.periodo} className="border-b border-gray-100 last:border-0 hover:bg-apple-lightgray/40">
                  <td className="px-4 py-3 font-medium text-apple-darkgray">{d.periodo}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-semibold">{formatEuro(d.iva_debito)}</td>
                  <td className="px-4 py-3 text-right text-blue-700 font-semibold">{formatEuro(d.iva_credito)}</td>
                  <td className="px-4 py-3 text-right text-purple-600 italic">{formatEuro(d.iva_ordini || 0)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${d.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatEuro(d.saldo)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-1 rounded font-semibold ${
                      d.da_versare
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {d.da_versare ? '💸 Da versare' : '✅ A credito'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-apple-lightgray/80 border-t-2 border-gray-300 font-bold">
              <tr>
                <td className="px-4 py-3 text-apple-darkgray uppercase text-xs">Totale</td>
                <td className="px-4 py-3 text-right text-green-700">{formatEuro(totali.iva_debito)}</td>
                <td className="px-4 py-3 text-right text-blue-700">{formatEuro(totali.iva_credito)}</td>
                <td className="px-4 py-3 text-right text-purple-600 italic">{formatEuro(totali.iva_ordini)}</td>
                <td className={`px-4 py-3 text-right ${totali.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatEuro(totali.saldo)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODALE CLIENTI FILTRATI
// ============================================================================

function ModaleClientiFiltrati({
  tipo,
  soglia,
  onClose,
  onClienteClick,
}: {
  tipo: 'nuovi' | 'dormienti' | 'persi' | 'frequenza';
  soglia?: number;
  onClose: () => void;
  onClienteClick: (c: Cliente) => void;
}) {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      setLoading(true);
      setErrore(null);
      try {
        const tutti = await getClienti();
        const { supabase } = await import('../lib/supabase');

        if (tipo === 'nuovi') {
          const oggi = new Date();
          const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1).toISOString();
          const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0, 23, 59, 59).toISOString();
          const filtrati = tutti.filter((c: any) => {
            const created = c.created_at as string | null;
            return created && created >= inizioMese && created <= fineMese;
          });
          setClienti(filtrati);
          return;
        }

        // Per dormienti/persi/frequenza: carica scontrini + fatture
        const [resScontrini, resFatture] = await Promise.all([
          supabase.from('scontrini').select('cliente_id, data_emissione').eq('tipo', 'madre').not('annullato', 'is', true),
          supabase.from('fatture').select('cliente_id, data_inizio'),
        ]);

        const datePerCliente = new Map<number, string[]>();
        for (const s of (resScontrini.data || []) as any[]) {
          if (!s.cliente_id || !s.data_emissione) continue;
          const d = String(s.data_emissione).split('T')[0];
          if (!datePerCliente.has(s.cliente_id)) datePerCliente.set(s.cliente_id, []);
          datePerCliente.get(s.cliente_id)!.push(d);
        }
        for (const f of (resFatture.data || []) as any[]) {
          if (!f.cliente_id || !f.data_inizio) continue;
          const d = String(f.data_inizio).split('T')[0];
          if (!datePerCliente.has(f.cliente_id)) datePerCliente.set(f.cliente_id, []);
          datePerCliente.get(f.cliente_id)!.push(d);
        }

        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);
        const sogliaGg = soglia ?? (tipo === 'dormienti' ? 90 : tipo === 'persi' ? 180 : 45);
        const sogliaData = new Date(oggi.getTime() - sogliaGg * 24 * 60 * 60 * 1000);

        const filtrati = tutti.filter((c) => {
          const date = datePerCliente.get(c.id);
          if (!date || date.length === 0) return false;
          const dateUniche = Array.from(new Set(date)).sort();

          if (tipo === 'dormienti' || tipo === 'persi') {
            const ultima = dateUniche[dateUniche.length - 1];
            const dUltima = new Date(ultima + 'T00:00:00');
            return dUltima < sogliaData;
          }

          if (tipo === 'frequenza') {
            if (dateUniche.length < 2) return false;
            let somma = 0;
            for (let i = 1; i < dateUniche.length; i++) {
              const d1 = new Date(dateUniche[i - 1] + 'T00:00:00').getTime();
              const d2 = new Date(dateUniche[i] + 'T00:00:00').getTime();
              somma += (d2 - d1) / (1000 * 60 * 60 * 24);
            }
            const freqMedia = somma / (dateUniche.length - 1);
            return freqMedia > sogliaGg;
          }

          return false;
        });

        filtrati.sort((a, b) => a.nome_cognome.localeCompare(b.nome_cognome));
        setClienti(filtrati);
      } catch (e: any) {
        setErrore(e?.message || 'Errore caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [tipo, soglia]);

  const titolo = {
    nuovi: '🆕 Nuovi clienti (mese corrente)',
    dormienti: `😴 Dormienti (${soglia ?? 90}gg+)`,
    persi: `🚨 Persi (${soglia ?? 180}gg+)`,
    frequenza: `🔄 Frequenza ritorno > ${soglia ?? 45}gg`,
  }[tipo];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-apple-darkgray">{titolo}</h3>
            <p className="text-xs text-apple-gray">
              {loading ? 'Caricamento…' : `${clienti.length} clienti`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-apple-gray">Caricamento…</div>
          ) : errore ? (
            <div className="p-8 text-center text-sm text-red-600">❌ {errore}</div>
          ) : clienti.length === 0 ? (
            <div className="p-8 text-center text-sm text-apple-gray">
              📭 Nessun cliente in questa categoria
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {clienti.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onClienteClick(c)}
                  className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <p className="text-sm font-semibold text-apple-darkgray">{c.nome_cognome}</p>
                  <div className="flex gap-3 text-xs text-apple-gray mt-0.5">
                    {c.cellulare && <span>📞 {c.cellulare}</span>}
                    {c.email && <span className="truncate">✉️ {c.email}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// forza rebuild sab 31 ott 2026 21:13:56 CET
