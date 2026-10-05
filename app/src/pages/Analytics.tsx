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

type Tab = 'singolo' | 'aggregato';
type PresetPeriodo = 'settimana' | 'mese' | 'anno' | 'custom';

export function Analytics() {
  const [tab, setTab] = useState<Tab>('singolo');
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

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
        const r = await calcolaReportAggregato(dataInizio, dataFine);
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
  }, [dataInizio, dataFine]);

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
              Periodo: <strong>{dataInizio}</strong> → <strong>{dataFine}</strong>
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
            />
          ) : null}
        </div>
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
}: {
  report: ReportAggregato;
  onEsportaPdf: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Header con pulsante export */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-apple p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-apple-darkgray">
            Report Periodo
          </h2>
          <p className="text-xs text-apple-gray">
            {report.dataInizio} → {report.dataFine}
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
