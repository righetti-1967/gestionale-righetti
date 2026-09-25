import { useEffect, useState } from 'react';
import { getFatture } from '../lib/fatture';
import { getClienti } from '../lib/clienti';
import { getTuttiPercorsi } from '../lib/percorsi';
import { getProdotti } from '../lib/prodotti';
import { getTuttiScarichi } from '../lib/scarichi';
import { getAppuntamenti } from '../lib/appuntamenti';
import { formatEuro } from '../lib/percorsi-helper';

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

interface Attivita {
  icona: string;
  testo: string;
  data: Date;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  // Statistiche
  const [fatturatoMese, setFatturatoMese] = useState(0);
  const [proformaInAttesa, setProformaInAttesa] = useState(0);
  const [proformaTotale, setProformaTotale] = useState(0);
  const [clientiTotali, setClientiTotali] = useState(0);
  const [percorsiAttivi, setPercorsiAttivi] = useState(0);
  const [prodottiSottoScorta, setProdottiSottoScorta] = useState(0);
  const [appuntamentiPending, setAppuntamentiPending] = useState(0);
  const [appuntamentiDaRiprogrammare, setAppuntamentiDaRiprogrammare] = useState(0);

  // Attività
  const [attivita, setAttivita] = useState<Attivita[]>([]);

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        setErrore(null);

        const oggiStringa = new Date().toISOString().split('T')[0];
        const tra90Giorni = new Date();
        tra90Giorni.setDate(tra90Giorni.getDate() + 90);
        const dataFine90 = tra90Giorni.toISOString().split('T')[0];

        const [fatture, clienti, percorsi, prodotti, scarichi, appuntamenti] = await Promise.all([
          getFatture(),
          getClienti(),
          getTuttiPercorsi(),
          getProdotti(),
          getTuttiScarichi(),
          getAppuntamenti(oggiStringa, dataFine90),
        ]);

        // Mese corrente
        const oggi = new Date();
        const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
        const inizioMeseScorso = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);

        // === STATISTICHE ===

        // 1) Fatturato mese: somma fatture con data_incasso nel mese corrente
        const fatturatoMeseCalc = fatture
          .filter((f) => {
            if (!f.data_incasso) return false;
            const d = new Date(f.data_incasso);
            return d >= inizioMese;
          })
          .reduce((sum, f) => sum + Number(f.lordo_ivato || 0), 0);
        setFatturatoMese(fatturatoMeseCalc);

        // 2) Proforma in attesa
        const proforma = fatture.filter((f) => !f.data_incasso);
        setProformaInAttesa(proforma.length);
        setProformaTotale(proforma.reduce((sum, f) => sum + Number(f.lordo_ivato || 0), 0));

        // 3) Clienti totali
        setClientiTotali(clienti.length);

        // 4) Percorsi attivi (non completati, non terminati, non bloccati)
        const percorsiAttiviCalc = percorsi.filter(
          (p) => !p.terminato && !p.bloccato
        ).length;
        setPercorsiAttivi(percorsiAttiviCalc);

        // 5) Prodotti sotto scorta
        const sottoScorta = prodotti.filter((p) => p.giacenza <= p.scorta_minima).length;
        setProdottiSottoScorta(sottoScorta);

        // 6) Appuntamenti Pending (futuri)
        const pending = appuntamenti.filter(
          (a) => a.stato === 'pending' && a.data >= oggiStringa
        ).length;
        setAppuntamentiPending(pending);

        // 7) Appuntamenti da riprogrammare (cancellati con rebooking non fissato)
        const daRiprogrammare = appuntamenti.filter(
          (a) =>
            a.stato === 'cancellato' &&
            a.motivo_cancellazione === 'rebooking' &&
            !a.rebooking_fissato
        ).length;
        setAppuntamentiDaRiprogrammare(daRiprogrammare);

        // === ATTIVITÀ RECENTI (ultimo mese) ===
        const lista: Attivita[] = [];

        // Fatture emesse
        for (const f of fatture) {
          const dataCreazione = new Date(f.created_at);
          if (dataCreazione >= inizioMeseScorso) {
            lista.push({
              icona: '📄',
              testo: `Nuova proforma ${f.numero_fattura} per ${f.cliente?.nome_cognome || 'cliente'}`,
              data: dataCreazione,
            });
          }
        }

        // Clienti registrati
        for (const c of clienti) {
          const dataCreazione = new Date(c.created_at);
          if (dataCreazione >= inizioMeseScorso) {
            lista.push({
              icona: '👥',
              testo: `Nuovo cliente: ${c.nome_cognome}`,
              data: dataCreazione,
            });
          }
        }

        // Percorsi creati
        for (const p of percorsi) {
          const dataCreazione = new Date(p.created_at);
          if (dataCreazione >= inizioMeseScorso) {
            const cliente = clienti.find((c) => c.id === p.cliente_id);
            lista.push({
              icona: '🎯',
              testo: `Nuovo percorso "${p.nome}" per ${cliente?.nome_cognome || 'cliente'}`,
              data: dataCreazione,
            });
          }
        }

        // DDT firmati
        for (const s of scarichi) {
          if (s.firmato && s.data_firma) {
            const dataFirma = new Date(s.data_firma);
            if (dataFirma >= inizioMeseScorso) {
              const numDdt = `DDT-${String(s.numero_ddt).padStart(3, '0')}-${new Date(s.data_seduta).getFullYear()}`;
              lista.push({
                icona: '✍️',
                testo: `${numDdt} firmato da ${s.cliente?.nome_cognome || 'cliente'}`,
                data: dataFirma,
              });
            }
          }
        }

        // Ordina per data discendente
        lista.sort((a, b) => b.data.getTime() - a.data.getTime());

        // Prendi le ultime 10
        setAttivita(lista.slice(0, 10));
      } catch (err: unknown) {
        console.error("ERRORE DASHBOARD:", err);
        let msg = "Errore nel caricamento";
        if (err instanceof Error) msg = err.message;
        else if (typeof err === "string") msg = err;
        else if (err && typeof err === "object" && "message" in err) {
          msg = String((err as { message: unknown }).message);
        }
        setErrore(msg);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  function formatDataRelativa(data: Date): string {
    const oggi = new Date();
    const diffMs = oggi.getTime() - data.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffOre = Math.floor(diffMs / (1000 * 60 * 60));
    const diffGiorni = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMin < 1) return 'Adesso';
    if (diffMin < 60) return `${diffMin} min fa`;
    if (diffOre < 24) return `${diffOre} ${diffOre === 1 ? 'ora' : 'ore'} fa`;
    if (diffGiorni === 1) return 'Ieri';
    if (diffGiorni < 7) return `${diffGiorni} giorni fa`;
    return data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-apple-gray">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">
          Buongiorno, Luca 👋
        </h1>
        <p className="text-apple-gray text-sm">Ecco un riepilogo della tua attività</p>
      </div>

      {errore && (
        <div className="bg-red-50 border border-red-200 rounded-apple p-4 text-red-700 text-sm mb-6">
          ❌ {errore}
        </div>
      )}

      {/* Card statistiche cliccabili */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        {/* Card Pending (sempre visibile) */}
        <button
          onClick={() => {
            if (appuntamentiPending > 0) {
              localStorage.setItem('clienti_filtro', 'pending');
              onNavigate?.('clienti');
            }
          }}
          disabled={appuntamentiPending === 0}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            appuntamentiPending > 0
              ? 'bg-red-50 border-2 border-red-300 hover:shadow-apple-lg cursor-pointer'
              : 'bg-white border-2 border-transparent cursor-default'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">⏳</span>
          </div>
          <p className={`text-xs mb-1 ${appuntamentiPending > 0 ? 'text-red-700 font-semibold' : 'text-apple-gray'}`}>
            Pending
          </p>
          <p className={`text-2xl font-bold ${appuntamentiPending > 0 ? 'text-red-800' : 'text-apple-darkgray'}`}>
            {appuntamentiPending}
          </p>
        </button>

        {/* Card Rebooking (sempre visibile) */}
        <button
          onClick={() => {
            if (appuntamentiDaRiprogrammare > 0) {
              localStorage.setItem('clienti_filtro', 'rebooking');
              onNavigate?.('clienti');
            }
          }}
          disabled={appuntamentiDaRiprogrammare === 0}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            appuntamentiDaRiprogrammare > 0
              ? 'bg-orange-50 border-2 border-orange-300 hover:shadow-apple-lg cursor-pointer'
              : 'bg-white border-2 border-transparent cursor-default'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">🔄</span>
          </div>
          <p className={`text-xs mb-1 ${appuntamentiDaRiprogrammare > 0 ? 'text-orange-700 font-semibold' : 'text-apple-gray'}`}>
            Rebooking
          </p>
          <p className={`text-2xl font-bold ${appuntamentiDaRiprogrammare > 0 ? 'text-orange-800' : 'text-apple-darkgray'}`}>
            {appuntamentiDaRiprogrammare}
          </p>
        </button>

        {/* Fatturato Mese */}
        <button
          onClick={() => onNavigate?.('fatture')}
          className="bg-white rounded-apple shadow-apple p-5 text-left hover:shadow-apple-lg transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-xs text-apple-gray mb-1">Fatturato Mese</p>
          <p className="text-xl font-bold text-green-600">{formatEuro(fatturatoMese)}</p>
        </button>

        <button
          onClick={() => onNavigate?.('fatture')}
          className="bg-white rounded-apple shadow-apple p-5 text-left hover:shadow-apple-lg transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">📄</span>
          </div>
          <p className="text-xs text-apple-gray mb-1">Proforma in attesa</p>
          <p className={`text-xl font-bold ${proformaInAttesa > 0 ? 'text-orange-600' : 'text-apple-darkgray'}`}>
            {proformaInAttesa}
          </p>
          <p className="text-xs text-apple-gray mt-1">{formatEuro(proformaTotale)}</p>
        </button>

        <button
          onClick={() => onNavigate?.('clienti')}
          className="bg-white rounded-apple shadow-apple p-5 text-left hover:shadow-apple-lg transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-xs text-apple-gray mb-1">Clienti Totali</p>
          <p className="text-xl font-bold text-apple-darkgray">{clientiTotali}</p>
        </button>

        <button
          onClick={() => onNavigate?.('percorsi')}
          className="bg-white rounded-apple shadow-apple p-5 text-left hover:shadow-apple-lg transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-xs text-apple-gray mb-1">Percorsi Attivi</p>
          <p className="text-xl font-bold text-apple-darkgray">{percorsiAttivi}</p>
        </button>

        <button
          onClick={() => onNavigate?.('prodotti')}
          className="bg-white rounded-apple shadow-apple p-5 text-left hover:shadow-apple-lg transition-all col-span-2 lg:col-span-1"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-xs text-apple-gray mb-1">Sotto scorta</p>
          <p className={`text-xl font-bold ${prodottiSottoScorta > 0 ? 'text-red-600' : 'text-apple-darkgray'}`}>
            {prodottiSottoScorta}
          </p>
        </button>
      </div>

      {/* Attività recenti */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <h2 className="text-lg font-semibold text-apple-darkgray mb-4">
          📋 Attività Recenti
          <span className="text-xs font-normal text-apple-gray ml-2">(ultimo mese)</span>
        </h2>

        {attivita.length === 0 ? (
          <p className="text-sm text-apple-gray text-center py-8">
            Nessuna attività nell'ultimo mese
          </p>
        ) : (
          <div className="space-y-3">
            {attivita.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <p className="text-sm text-apple-darkgray">
                  <span className="mr-2">{a.icona}</span>
                  {a.testo}
                </p>
                <p className="text-xs text-apple-gray whitespace-nowrap ml-4">
                  {formatDataRelativa(a.data)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
