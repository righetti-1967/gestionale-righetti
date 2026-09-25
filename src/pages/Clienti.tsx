import { useEffect, useState } from 'react';
import {
  getClienti,
  cercaClienti,
  eliminaCliente,
  aggiornaCliente,
  type Cliente,
} from '../lib/clienti';
import { getTuttiPercorsi, type Percorso, type StatoPercorso } from '../lib/percorsi';
import { getFatture } from '../lib/fatture';
import { getScarichiFattura, type ScaricoSeduta } from '../lib/scarichi';
import { getAppuntamenti, OPERATORI } from '../lib/appuntamenti';
import { calcolaResiduo, type ResiduoPercorso } from '../lib/percorsi-helper';
import { FormCliente } from '../components/FormNuovoCliente';
import { FormNuovoPercorso } from '../components/FormNuovoPercorso';
import { FormNuovaFattura } from '../components/FormNuovaFattura';
import { FormNuovoAppuntamento } from '../components/FormNuovoAppuntamento';
import { ListaPercorsiCliente } from '../components/ListaPercorsiCliente';
import { ListaAppuntamentiCliente } from '../components/ListaAppuntamentiCliente';
import { FormScaricoSeduta } from '../components/FormScaricoSeduta';
import { StoricoProdottiCliente } from '../components/StoricoProdottiCliente';
import { FirmaPrivacy } from '../components/FirmaPrivacy';
import { DialogoFirmaPrivacy } from '../components/DialogoFirmaPrivacy';
import { MenuSceltaPdf } from '../components/MenuSceltaPdf';
import {
  AnteprimaPdf,
  IntestazionePdf,
  FooterPdf,
} from '../components/AnteprimaPdf';
import { usePrivacy } from '../lib/usePrivacy';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { formatSede } from '../lib/studio';
import { DettaglioPercorso } from '../components/DettaglioPercorso';
import { Toast, type ToastTipo } from '../components/Toast';

interface PercorsoAttivo {
  percorso: Percorso;
  residuo: ResiduoPercorso;
  dataAttivazione: string;
  stato: StatoPercorso;
}

export function Clienti({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { config: privacy } = usePrivacy();
  const { dati: azienda } = useDatiAziendali();
  const placeholder = "[Verrà compilato automaticamente con la ragione sociale e la sede legale dell'azienda]";
  const datiTitolare = `${azienda.ragioneSociale}, Sede Legale: ${formatSede(azienda.sedeLegale)}, nella persona del suo legale rappresentante.`;
  const testoInformativaFinale = privacy.testoInformativa.includes(placeholder)
    ? privacy.testoInformativa.replace(placeholder, datiTitolare)
    : privacy.testoInformativa;

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null);
  const [clienteDaModificare, setClienteDaModificare] = useState<Cliente | null>(null);
  const [clienteDaFirmare, setClienteDaFirmare] = useState<Cliente | null>(null);
  const [clienteAppenaCreato, setClienteAppenaCreato] = useState<Cliente | null>(null);
  const [clientePerPercorso, setClientePerPercorso] = useState<Cliente | null>(null);
  const [clienteRebooking, setClienteRebooking] = useState<Cliente | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFormPercorso, setShowFormPercorso] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState<Cliente | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTipo, setToastTipo] = useState<ToastTipo>('success');

  const [noteInterneTesto, setNoteInterneTesto] = useState('');
  const [salvandoNote, setSalvandoNote] = useState(false);

  const [percorsiPerCliente, setPercorsiPerCliente] = useState<
    Map<number, PercorsoAttivo[]>
  >(new Map());

  const [percorsoScarico, setPercorsoScarico] = useState<{
    percorso: Percorso;
    cliente: Cliente;
    residuo: ResiduoPercorso;
    fatturaIncassata: boolean;
  } | null>(null);
  const [scaricoPerPdf, setScaricoPerPdf] = useState<{
    scarico: ScaricoSeduta;
    percorso: Percorso;
    cliente: Cliente;
  } | null>(null);

  const [sceltaPercorso, setSceltaPercorso] = useState<{
    cliente: Cliente;
    percorsi: PercorsoAttivo[];
  } | null>(null);

  const [showAnteprimaPrivacy, setShowAnteprimaPrivacy] = useState(false);
  const [filtroClienti, setFiltroClienti] = useState<'pending' | 'rebooking' | null>(null);
  const [clientiIdsFiltrati, setClientiIdsFiltrati] = useState<Set<number> | null>(null);
  const [appuntamentiPendingByCliente, setAppuntamentiPendingByCliente] = useState<
    Map<number, import('../lib/appuntamenti').Appuntamento>
  >(new Map());
  const [scaricoDaApp, setScaricoDaApp] = useState<{
    percorso: Percorso;
    cliente: Cliente;
    residuo: ResiduoPercorso;
    vociIniziali: {
      tipo: 'servizio' | 'prodotto';
      servizio_id: number | null;
      prodotto_id: number | null;
      quantita: number;
    }[];
  } | null>(null);
  const [fatturaDaApp, setFatturaDaApp] = useState<{
    cliente: Cliente;
  } | null>(null);
  const [percorsoDettaglio, setPercorsoDettaglio] = useState<{
    percorso: Percorso;
    residuo: ResiduoPercorso;
    stato: StatoPercorso;
    fatturaIncassata: boolean;
    cliente: Cliente;
  } | null>(null);

  const [fatturaDaPercorso, setFatturaDaPercorso] = useState<{
    percorso: Percorso;
    cliente: Cliente;
  } | null>(null);

  useEffect(() => {
    const filtro = localStorage.getItem('clienti_filtro');
    if (filtro === 'pending' || filtro === 'rebooking') {
      setFiltroClienti(filtro);
      localStorage.removeItem('clienti_filtro');
    }
    caricaClienti();
  }, []);

  useEffect(() => {
    async function caricaFiltro() {
      if (!filtroClienti) {
        setClientiIdsFiltrati(null);
        setAppuntamentiPendingByCliente(new Map());
        return;
      }
      try {
        const oggi = new Date().toISOString().split('T')[0];
        const tra90 = new Date();
        tra90.setDate(tra90.getDate() + 90);
        const dataFine = tra90.toISOString().split('T')[0];

        const appuntamenti = await getAppuntamenti(oggi, dataFine);
        const ids = new Set<number>();
        const mappaAppuntamenti = new Map<
          number,
          import('../lib/appuntamenti').Appuntamento
        >();

        for (const a of appuntamenti) {
          if (a.cliente_id === null) continue;
          if (filtroClienti === 'pending') {
            if (a.stato === 'pending' && a.data >= oggi) {
              ids.add(a.cliente_id);
              if (!mappaAppuntamenti.has(a.cliente_id)) {
                mappaAppuntamenti.set(a.cliente_id, a);
              }
            }
          } else if (filtroClienti === 'rebooking') {
            if (
              a.stato === 'cancellato' &&
              a.motivo_cancellazione === 'rebooking' &&
              !a.rebooking_fissato
            ) {
              ids.add(a.cliente_id);
            }
          }
        }

        setClientiIdsFiltrati(ids);
        setAppuntamentiPendingByCliente(mappaAppuntamenti);
      } catch (err) {
        console.error('Errore caricamento filtro clienti:', err);
        setClientiIdsFiltrati(new Set());
        setAppuntamentiPendingByCliente(new Map());
      }
    }
    caricaFiltro();
  }, [filtroClienti]);

  useEffect(() => {
    if (clienteSelezionato) {
      setNoteInterneTesto(clienteSelezionato.note_anamnesi || '');
    }
  }, [clienteSelezionato]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ricerca === '') caricaClienti();
      else eseguiRicerca(ricerca);
    }, 300);
    return () => clearTimeout(timer);
  }, [ricerca]);

  async function caricaClienti() {
    try {
      setLoading(true);
      setErrore(null);

      const [data, tuttiPercorsi, tutteFatture] = await Promise.all([
        getClienti(),
        getTuttiPercorsi(),
        getFatture(),
      ]);

      setClienti(data);

      const fattureIncassate = new Set(
        tutteFatture.filter((f) => !!f.data_incasso).map((f) => f.id)
      );

      const scarichiCache = new Map<
        number,
        Awaited<ReturnType<typeof getScarichiFattura>>
      >();

      const mappa = new Map<number, PercorsoAttivo[]>();
      const oggi = new Date();
      const trentaGiorniMs = 30 * 24 * 60 * 60 * 1000;

      for (const p of tuttiPercorsi) {
        let scarichi: Awaited<ReturnType<typeof getScarichiFattura>> = [];
        if (p.fattura_id) {
          let cached = scarichiCache.get(p.fattura_id);
          if (!cached) {
            cached = await getScarichiFattura(p.fattura_id);
            scarichiCache.set(p.fattura_id, cached);
          }
          scarichi = cached;
        }

        const righeScaricate = scarichi.flatMap((s) => s.righe || []);
        const residuo = calcolaResiduo(p.righe || [], righeScaricate);
        const completato = residuo.valore_residuo_lordo <= 0;

        const dataFine = new Date(p.data_fine);
        const scaduto = dataFine < oggi;
        const inScadenza =
          !scaduto && dataFine.getTime() - oggi.getTime() <= trentaGiorniMs;

        let stato: StatoPercorso;
        if (p.terminato) {
          stato = 'terminato';
        } else if (p.bloccato) {
          stato = 'bloccato';
        } else if (completato) {
          stato = 'completato';
        } else if (!p.fattura_id) {
          stato = 'da-fatturare';
        } else if (!fattureIncassate.has(p.fattura_id)) {
          stato = 'da-incassare';
        } else if (scaduto) {
          stato = 'scaduto';
        } else if (inScadenza) {
          stato = 'in-scadenza';
        } else {
          stato = 'attivo';
        }

        const lista = mappa.get(p.cliente_id) || [];
        lista.push({
          percorso: p,
          residuo,
          dataAttivazione: p.data_inizio,
          stato,
        });
        mappa.set(p.cliente_id, lista);
      }

      for (const [clienteId, lista] of mappa.entries()) {
        lista.sort(
          (a, b) =>
            new Date(b.dataAttivazione).getTime() - new Date(a.dataAttivazione).getTime()
        );
        mappa.set(clienteId, lista);
      }

      setPercorsiPerCliente(mappa);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento dei clienti');
    } finally {
      setLoading(false);
    }
  }

  async function eseguiRicerca(q: string) {
    try {
      setLoading(true);
      const data = await cercaClienti(q);
      setClienti(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nella ricerca');
    } finally {
      setLoading(false);
    }
  }

  async function handleSalvaNoteInterne() {
    if (!clienteSelezionato) return;
    try {
      setSalvandoNote(true);
      const testoPulito = noteInterneTesto.trim() || null;
      await aggiornaCliente(clienteSelezionato.id, { note_anamnesi: testoPulito });
      setClienteSelezionato((prev) => (prev ? { ...prev, note_anamnesi: testoPulito } : null));
      caricaClienti();
      setToastMessage('Note interne aggiornate con successo!');
      setToastTipo('success');
    } catch (err: any) {
      setToastMessage('Errore nel salvataggio note: ' + err.message);
      setToastTipo('error');
    } finally {
      setSalvandoNote(false);
    }
  }

  function apriNuovoCliente() {
    setClienteDaModificare(null);
    setShowForm(true);
  }

  function apriModificaCliente(cliente: Cliente) {
    setClienteDaModificare(cliente);
    setClienteSelezionato(null);
    setShowForm(true);
  }

  function apriFirmaPrivacy(cliente: Cliente) {
    setClienteDaFirmare(cliente);
  }

  function handleInviaPrivacy(cliente: Cliente, canale: 'email' | 'whatsapp') {
    const canaleLabel = canale === 'email' ? 'Email' : 'WhatsApp';
    setToastMessage(`📧 Invio Privacy ${canaleLabel} di ${cliente.nome_cognome} in arrivo`);
    setToastTipo('info');
  }

  function apriNuovoPercorso(cliente: Cliente) {
    setClientePerPercorso(cliente);
    setClienteSelezionato(null);
    setShowFormPercorso(true);
  }

  function apriFissaAppuntamento(cliente: Cliente) {
    setClienteRebooking(cliente);
  }

  function handleClienteCreato(nuovoCliente: Cliente) {
    setShowForm(false);
    setClienteDaModificare(null);
    caricaClienti();
    if (nuovoCliente.privacy_firmata) return;
    setClienteAppenaCreato(nuovoCliente);
  }

  async function confermaEliminazione() {
    if (!confermaElimina) return;
    try {
      await eliminaCliente(confermaElimina.id);
      setConfermaElimina(null);
      setClienteSelezionato(null);
      caricaClienti();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToastMessage("Errore nell'eliminazione: " + msg);
      setToastTipo('error');
    }
  }

  function apriScarico(cliente: Cliente, statoFiltro: StatoPercorso) {
    const tuttiPercorsi = percorsiPerCliente.get(cliente.id) || [];
    const percorsi = tuttiPercorsi.filter((p) => p.stato === statoFiltro);

    if (statoFiltro !== 'attivo' && statoFiltro !== 'in-scadenza') return;

    if (percorsi.length === 0) return;
    if (percorsi.length === 1) {
      setPercorsoScarico({
        percorso: percorsi[0].percorso,
        cliente,
        residuo: percorsi[0].residuo,
        fatturaIncassata: true,
      });
    } else {
      setSceltaPercorso({ cliente, percorsi });
    }
  }

  function statiPercorsi(cliente: Cliente): { stato: StatoPercorso; count: number }[] {
    const percorsi = percorsiPerCliente.get(cliente.id) || [];
    if (percorsi.length === 0) return [];

    const ordine: StatoPercorso[] = [
      'attivo', 'in-scadenza', 'da-incassare', 'da-fatturare',
      'completato', 'scaduto', 'terminato', 'bloccato',
    ];

    const risultato: { stato: StatoPercorso; count: number }[] = [];
    for (const s of ordine) {
      const count = percorsi.filter((x) => x.stato === s).length;
      if (count > 0) risultato.push({ stato: s, count });
    }
    return risultato;
  }

  function BadgePercorso({ cliente }: { cliente: Cliente }) {
    const lista = statiPercorsi(cliente);
    if (lista.length === 0) {
      return (
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-apple-gray">
          Nessuno
        </span>
      );
    }

    const config: Record<StatoPercorso, { colore: string; pallino: string; etichettaSing: string; etichettaPlur: string; cliccabile: boolean }> = {
      attivo: { colore: 'bg-green-100 text-green-700 hover:bg-green-200', pallino: 'bg-green-500', etichettaSing: 'Attivo', etichettaPlur: 'attivi', cliccabile: true },
      'in-scadenza': { colore: 'bg-amber-100 text-amber-700 hover:bg-amber-200', pallino: 'bg-amber-500', etichettaSing: 'In scadenza', etichettaPlur: 'in scadenza', cliccabile: true },
      'da-incassare': { colore: 'bg-orange-100 text-orange-700', pallino: 'bg-orange-500', etichettaSing: 'Da incassare', etichettaPlur: 'da incassare', cliccabile: false },
      'da-fatturare': { colore: 'bg-yellow-100 text-yellow-700', pallino: 'bg-yellow-500', etichettaSing: 'Da fatturare', etichettaPlur: 'da fatturare', cliccabile: false },
      scaduto: { colore: 'bg-red-100 text-red-700', pallino: 'bg-red-500', etichettaSing: 'Scaduto', etichettaPlur: 'scaduti', cliccabile: false },
      bloccato: { colore: 'bg-red-100 text-red-700', pallino: 'bg-red-500', etichettaSing: 'Bloccato', etichettaPlur: 'bloccati', cliccabile: false },
      terminato: { colore: 'bg-gray-200 text-gray-700', pallino: 'bg-gray-500', etichettaSing: 'Terminato', etichettaPlur: 'terminati', cliccabile: false },
      completato: { colore: 'bg-blue-100 text-blue-700', pallino: 'bg-blue-500', etichettaSing: 'Completato', etichettaPlur: 'completati', cliccabile: false },
    };

    return (
      <div className="flex flex-wrap gap-1.5 justify-end">
        {lista.map(({ stato, count }) => {
          const c = config[stato];
          const etichetta = count === 1 ? c.etichettaSing : `${count} ${c.etichettaPlur}`;

          if (!c.cliccabile) {
            return (
              <span key={stato} className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap ${c.colore}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.pallino}`}></span>
                {etichetta}
              </span>
            );
          }

          return (
            <button
              key={stato}
              onClick={(e) => { e.stopPropagation(); apriScarico(cliente, stato); }}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap ${c.colore}`}
              title={stato === 'attivo' || stato === 'in-scadenza' ? 'Registra Scarico Seduta' : 'Apri percorsi'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.pallino}`}></span>
              {etichetta}
            </button>
          );
        })}
      </div>
    );
  }

  const clientiVisualizzati = clientiIdsFiltrati
    ? clienti.filter((c) => clientiIdsFiltrati.has(c.id))
    : clienti;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">
            Clienti
          </h1>
          <p className="text-sm text-apple-gray">
            {clientiVisualizzati.length}{' '}
            {clientiVisualizzati.length === 1 ? 'cliente' : 'clienti'} in archivio
          </p>
        </div>
        <button
          onClick={apriNuovoCliente}
          className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <span>+</span>
          <span>Nuovo Cliente</span>
        </button>
      </div>

      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">
            🔍
          </span>
          <input
            type="text"
            placeholder="Cerca per nome, email o cellulare..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
          />
        </div>
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

      {!loading && !errore && clienti.length > 0 && (
        <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
            <div className="col-span-3">Cliente</div>
            <div className="col-span-3">Contatti</div>
            <div className="col-span-2">Città</div>
            <div className="col-span-2 text-center">Percorso</div>
            <div className="col-span-2 text-right">Privacy</div>
          </div>

          <div className="divide-y divide-gray-100">
            {clientiVisualizzati.map((cliente) => (
              <div
                key={cliente.id}
                className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center"
              >
                <button
                  onClick={() => setClienteSelezionato(cliente)}
                  className="col-span-3 flex items-center gap-3 text-left min-w-0"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {cliente.nome_cognome
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {cliente.nome_cognome}
                    </p>
                    {cliente.codice_fiscale && (
                      <p className="text-xs text-apple-gray truncate uppercase">
                        {cliente.codice_fiscale}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setClienteSelezionato(cliente)}
                  className="col-span-3 flex flex-col justify-center min-w-0 text-left"
                >
                  {cliente.email && (
                    <p className="text-xs text-apple-darkgray truncate">{cliente.email}</p>
                  )}
                  {cliente.cellulare && (
                    <p className="text-xs text-apple-gray truncate">{cliente.cellulare}</p>
                  )}
                </button>
                <button
                  onClick={() => setClienteSelezionato(cliente)}
                  className="col-span-2 flex items-center text-left"
                >
                  <p className="text-sm text-apple-darkgray truncate">
                    {cliente.citta_residenza || '—'}
                  </p>
                </button>
                <div className="col-span-2 flex justify-center">
                  <BadgePercorso cliente={cliente} />
                </div>
                <button
                  onClick={() => setClienteSelezionato(cliente)}
                  className="col-span-2 flex items-center justify-end"
                >
                  {cliente.privacy_firmata ? (
                    <span
                      className="text-xs font-semibold px-2 py-1 rounded-full bg-apple-blue text-white"
                      title={
                        cliente.privacy_data_firma
                          ? `Firmata il ${new Date(cliente.privacy_data_firma).toLocaleString('it-IT')}`
                          : 'Firmata'
                      }
                    >
                      ✓ Firmata
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-apple-gray">
                      Non firmata
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !errore && filtroClienti === 'pending' && (
        <div className="hidden md:block mt-4 space-y-2">
          <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
            ⏳ Appuntamenti da confermare
          </h3>
          {clientiVisualizzati
            .filter((c) => appuntamentiPendingByCliente.has(c.id))
            .map((cliente) => {
              const app = appuntamentiPendingByCliente.get(cliente.id)!;
              return (
                <button
                  key={cliente.id}
                  onClick={() => {
                    localStorage.setItem('agenda_data_iniziale', app.data);
                    setClienteSelezionato(null);
                    onNavigate?.('agenda');
                  }}
                  className="w-full text-left bg-red-50 border border-red-200 rounded-apple p-4 hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                        {cliente.nome_cognome
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-red-800 truncate">
                          {cliente.nome_cognome}
                        </p>
                        <p className="text-xs text-red-700">
                          📅{' '}
                          {new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                          {' • '}
                          {app.ora_inizio.slice(0, 5)}
                          {(() => {
                            const [h, m] = app.ora_inizio.slice(0, 5).split(':').map(Number);
                            const totale = h * 60 + m + app.durata_minuti;
                            const hF = Math.floor(totale / 60);
                            const mF = totale % 60;
                            return `–${String(hF).padStart(2, '0')}:${String(mF).padStart(2, '0')}`;
                          })()}
                          {' • '}
                          {OPERATORI[app.operatore].label}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-red-600 font-medium shrink-0">
                      Apri Agenda →
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {!loading && !errore && filtroClienti === 'rebooking' && (
        <div className="hidden md:block mt-4 space-y-2">
          <div className="bg-orange-50 border border-orange-200 rounded-apple p-4">
            <p className="text-sm font-semibold text-orange-800">
              🔄 Clienti da riprogrammare
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Clicca "📅 Fissa appuntamento" per aprire la form di creazione con il
              cliente già selezionato.
            </p>
          </div>
          {clientiVisualizzati.map((cliente) => (
            <div
              key={cliente.id}
              className="w-full bg-orange-50 border border-orange-200 rounded-apple p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                  {cliente.nome_cognome
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-orange-900 truncate">
                    {cliente.nome_cognome}
                  </p>
                  {cliente.cellulare && (
                    <p className="text-xs text-orange-700 truncate">
                      {cliente.cellulare}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => apriFissaAppuntamento(cliente)}
                className="px-4 py-2 bg-orange-500 text-white rounded-apple font-medium text-xs hover:bg-orange-600 transition-colors shrink-0 shadow-sm"
              >
                📅 Fissa appuntamento
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !errore && clientiVisualizzati.length > 0 && (
        <div className="md:hidden space-y-3">
          {clientiVisualizzati.map((cliente) => (
            <div
              key={cliente.id}
              className="w-full bg-white rounded-apple shadow-apple p-4 text-left"
            >
              <button
                onClick={() => setClienteSelezionato(cliente)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {cliente.nome_cognome
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {cliente.nome_cognome}
                    </p>
                    {cliente.codice_fiscale && (
                      <p className="text-xs text-apple-gray truncate uppercase">
                        {cliente.codice_fiscale}
                      </p>
                    )}
                  </div>
                  {cliente.privacy_firmata ? (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-apple-blue text-white shrink-0">
                      ✓
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-apple-gray shrink-0">
                      —
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-xs text-apple-gray">
                  {cliente.email && <p className="truncate">📧 {cliente.email}</p>}
                  {cliente.cellulare && <p className="truncate">📱 {cliente.cellulare}</p>}
                  {cliente.citta_residenza && (
                    <p className="truncate">📍 {cliente.citta_residenza}</p>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {clienteSelezionato && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setClienteSelezionato(null)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-2xl w-full my-8 p-6 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {clienteSelezionato.nome_cognome
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-apple-darkgray">
                    {clienteSelezionato.nome_cognome}
                  </h2>
                  <p className="text-xs text-apple-gray">ID: {clienteSelezionato.id}</p>
                </div>
              </div>
              <button
                onClick={() => setClienteSelezionato(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm mb-6">
              <InfoRow label="📧 Email" value={clienteSelezionato.email} />
              <InfoRow label="📱 Cellulare" value={clienteSelezionato.cellulare} />
              <InfoRow label="🆔 Codice Fiscale" value={clienteSelezionato.codice_fiscale} />
              <InfoRow label="🏢 Partita IVA" value={clienteSelezionato.partita_iva} />
              <InfoRow label="📍 Città" value={clienteSelezionato.citta_residenza} />
              <InfoRow label="🗺️ Provincia" value={clienteSelezionato.provincia_residenza} />
            </div>

            <div className="mb-6 p-4 bg-amber-50/50 border border-amber-200/80 rounded-apple space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  📝 Note Interne & Anamnesi
                </h3>
                <button
                  type="button"
                  onClick={handleSalvaNoteInterne}
                  disabled={salvandoNote}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-apple text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                >
                  {salvandoNote ? 'Salvo...' : '💾 Salva Note'}
                </button>
              </div>
              <textarea
                value={noteInterneTesto}
                onChange={(e) => setNoteInterneTesto(e.target.value)}
                placeholder="Scrivi qui preferenze, concessioni speciali, note cliniche o storiche su questo cliente..."
                rows={3}
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-apple text-xs text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>

            <div
              className={`mb-6 p-3 rounded-apple ${
                clienteSelezionato.privacy_firmata
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}
            >
              {clienteSelezionato.privacy_firmata ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-apple-blue uppercase">
                        ✓ Privacy firmata
                      </p>
                      {clienteSelezionato.privacy_data_firma && (
                        <p className="text-xs text-apple-gray mt-0.5">
                          il{' '}
                          {new Date(clienteSelezionato.privacy_data_firma).toLocaleString('it-IT')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowAnteprimaPrivacy(true)}
                        className="text-xs font-medium text-apple-darkgray hover:underline"
                      >
                        👁️ Anteprima
                      </button>
                      <button
                        onClick={() => apriFirmaPrivacy(clienteSelezionato)}
                        className="text-xs font-medium text-apple-blue hover:underline"
                      >
                        📄 Ristampa PDF
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-blue-200">
                    <button
                      onClick={() => handleInviaPrivacy(clienteSelezionato, 'email')}
                      className={`flex-1 px-3 py-2 rounded-apple font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                        clienteSelezionato.privacy_inviata_email_at
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-blue-100 text-apple-blue hover:bg-blue-200'
                      }`}
                    >
                      📧 {clienteSelezionato.privacy_inviata_email_at ? 'Reinvia Email' : 'Invia Email'}
                    </button>
                    <button
                      onClick={() => handleInviaPrivacy(clienteSelezionato, 'whatsapp')}
                      className={`flex-1 px-3 py-2 rounded-apple font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                        clienteSelezionato.privacy_inviata_whatsapp_at
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                      }`}
                    >
                      💬 {clienteSelezionato.privacy_inviata_whatsapp_at ? 'Reinvia WhatsApp' : 'Invia WhatsApp'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase">
                      ⚠️ Privacy non firmata
                    </p>
                    <p className="text-xs text-apple-gray mt-0.5">
                      Il cliente non ha ancora firmato
                    </p>
                  </div>
                  <button
                    onClick={() => apriFirmaPrivacy(clienteSelezionato)}
                    className="px-3 py-1.5 bg-apple-blue text-white rounded-apple text-xs font-medium hover:bg-blue-600 transition-colors"
                  >
                    ✍️ Firma ora
                  </button>
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  🎯 Percorsi
                </h3>
                <button
                  onClick={() => apriNuovoPercorso(clienteSelezionato)}
                  className="text-xs text-apple-blue hover:underline font-medium"
                >
                  + Nuovo
                </button>
              </div>
              <ListaPercorsiCliente
                clienteId={clienteSelezionato.id}
                onApriPercorso={(dati) => {
                  const cliente = clienteSelezionato;
                  setClienteSelezionato(null);
                  setPercorsoDettaglio({ ...dati, cliente });
                }}
              />
            </div>

            <ListaAppuntamentiCliente
              clienteId={clienteSelezionato.id}
              onApriAppuntamento={(app) => {
                localStorage.setItem('agenda_data_iniziale', app.data);
                setClienteSelezionato(null);
                onNavigate?.('agenda');
              }}
            />

            <div className="mb-6">
              <StoricoProdottiCliente clienteId={clienteSelezionato.id} />
            </div>

            <div className="pt-6 border-t border-gray-200/60 flex gap-2">
              <button
                onClick={() => setConfermaElimina(clienteSelezionato)}
                className="px-4 py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors"
                title="Elimina cliente"
              >
                🗑️
              </button>
              <button
                onClick={() => apriModificaCliente(clienteSelezionato)}
                className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors"
              >
                ✏️ Modifica
              </button>
              <button
                onClick={() => apriNuovoPercorso(clienteSelezionato)}
                className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-apple font-medium text-sm hover:bg-green-600 transition-colors"
              >
                🎯 Nuovo Percorso
              </button>
            </div>
          </div>
        </div>
      )}

      {confermaElimina && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setConfermaElimina(null)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-2xl">
                🗑️
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                Eliminare questo cliente?
              </h2>
              <p className="text-sm text-apple-gray">
                Stai per eliminare <strong>{confermaElimina.nome_cognome}</strong>.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfermaElimina(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={confermaEliminazione}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-apple font-medium text-sm hover:bg-red-600 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <FormCliente
          clienteDaModificare={clienteDaModificare}
          onClose={() => {
            setShowForm(false);
            setClienteDaModificare(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setClienteDaModificare(null);
            caricaClienti();
          }}
          onClienteCreato={handleClienteCreato}
        />
      )}

      {showFormPercorso && (
        <FormNuovoPercorso
          clienteIniziale={clientePerPercorso}
          onClose={() => {
            setShowFormPercorso(false);
            setClientePerPercorso(null);
          }}
          onSuccess={(percorsoId) => {
            setShowFormPercorso(false);
            setClientePerPercorso(null);
            caricaClienti();
            setToastMessage(`Percorso creato con successo! (ID: ${percorsoId})`);
            setToastTipo('success');
          }}
        />
      )}

      {clienteAppenaCreato && (
        <DialogoFirmaPrivacy
          nomeCliente={clienteAppenaCreato.nome_cognome}
          onFirmaOra={() => {
            const cliente = clienteAppenaCreato;
            setClienteAppenaCreato(null);
            setClienteDaFirmare(cliente);
          }}
          onPiuTardi={() => {
            setClienteAppenaCreato(null);
          }}
        />
      )}

      {clienteDaFirmare && (
        <FirmaPrivacy
          cliente={clienteDaFirmare}
          onClose={() => setClienteDaFirmare(null)}
          onSuccess={(clienteAggiornato) => {
            setClienteDaFirmare(null);
            setClienteSelezionato(null);
            caricaClienti();
            setToastMessage(`Firma completata per ${clienteAggiornato.nome_cognome}!`);
            setToastTipo('success');
          }}
        />
      )}

      {sceltaPercorso && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={() => setSceltaPercorso(null)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-apple-darkgray">Scegli percorso</h2>
                <p className="text-xs text-apple-gray">
                  {sceltaPercorso.cliente.nome_cognome}
                </p>
              </div>
              <button
                onClick={() => setSceltaPercorso(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {sceltaPercorso.percorsi.map((p) => (
                <button
                  key={p.percorso.id}
                  onClick={() => {
                    setPercorsoScarico({
                      percorso: p.percorso,
                      cliente: sceltaPercorso.cliente,
                      residuo: p.residuo,
                      fatturaIncassata: true,
                    });
                    setSceltaPercorso(null);
                  }}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-apple border border-gray-200 transition-colors"
                >
                  <p className="text-sm font-semibold text-apple-darkgray truncate">
                    {p.percorso.nome}
                  </p>
                  <p className="text-xs text-apple-gray mt-0.5">
                    📅 Attivato il {new Date(p.dataAttivazione).toLocaleDateString('it-IT')}
                  </p>
                  <p className="text-xs text-green-600 font-semibold mt-1">
                    Residuo: {new Intl.NumberFormat('it-IT', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(p.residuo.valore_residuo_lordo)}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setSceltaPercorso(null)}
              className="w-full px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {percorsoScarico && (
        <FormScaricoSeduta
          percorso={percorsoScarico.percorso}
          cliente={percorsoScarico.cliente}
          residuo={percorsoScarico.residuo}
          fatturaIncassata={percorsoScarico.fatturaIncassata}
          onClose={() => setPercorsoScarico(null)}
          onSuccess={(scaricoCreato) => {
            const ctx = percorsoScarico;
            setPercorsoScarico(null);
            setScaricoPerPdf({
              scarico: scaricoCreato,
              percorso: ctx.percorso,
              cliente: ctx.cliente,
            });
          }}
        />
      )}

      {scaricoPerPdf && (
        <MenuSceltaPdf
          scarico={scaricoPerPdf.scarico}
          percorso={scaricoPerPdf.percorso}
          cliente={scaricoPerPdf.cliente}
          onClose={() => {
            setScaricoPerPdf(null);
            caricaClienti();
            setToastMessage('Scarico registrato con successo');
            setToastTipo('success');
          }}
        />
      )}

      {percorsoDettaglio && (
        <DettaglioPercorso
          percorso={percorsoDettaglio.percorso}
          cliente={percorsoDettaglio.cliente}
          residuo={percorsoDettaglio.residuo}
          fatturaIncassata={percorsoDettaglio.fatturaIncassata}
          stato={percorsoDettaglio.stato}
          onClose={() => setPercorsoDettaglio(null)}
          onUpdated={() => {
            setPercorsoDettaglio(null);
            caricaClienti();
          }}
          onFattura={() => {
            const p = percorsoDettaglio;
            setPercorsoDettaglio(null);
            setFatturaDaPercorso({ percorso: p.percorso, cliente: p.cliente });
          }}
        />
      )}

      {fatturaDaPercorso && (
        <FormNuovaFattura
          clienteIniziale={fatturaDaPercorso.cliente}
          percorsoIniziale={fatturaDaPercorso.percorso}
          onClose={() => setFatturaDaPercorso(null)}
          onSuccess={() => {
            setFatturaDaPercorso(null);
            caricaClienti();
            setToastMessage('Fattura proforma creata con successo!');
            setToastTipo('success');
          }}
        />
      )}

      {clienteRebooking && (
        <FormNuovoAppuntamento
          clienteIniziale={clienteRebooking}
          rebookingDaFissare={true}
          onClose={() => setClienteRebooking(null)}
          onSuccess={() => {
            setClienteRebooking(null);
            setClienteSelezionato(null);
            caricaClienti();
            setToastMessage('Appuntamento fissato! Il cliente è stato rimosso dal rebooking.');
            setToastTipo('success');
          }}
        />
      )}

      {showAnteprimaPrivacy && clienteSelezionato && (
        <AnteprimaPdf
          titolo="Anteprima Privacy"
          sottotitolo={clienteSelezionato.nome_cognome}
          onScarica={() => {
            setShowAnteprimaPrivacy(false);
            apriFirmaPrivacy(clienteSelezionato);
          }}
          labelScarica="📄 Ristampa PDF Privacy"
          onClose={() => setShowAnteprimaPrivacy(false)}
        >
          <IntestazionePdf />

          <div className="text-center mb-6 mt-2">
            <h2 className="font-bold text-base text-gray-900">
              INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              ai sensi del Regolamento UE 2016/679 (GDPR)
            </p>
          </div>

          <div className="mb-5">
            <p className="text-xs font-bold text-blue-600 uppercase mb-2">
              DATI DELL'INTERESSATO
            </p>
            <div className="text-xs space-y-0.5 text-gray-800">
              <p><strong>Nome e Cognome:</strong> {clienteSelezionato.nome_cognome}</p>
              {clienteSelezionato.codice_fiscale && (
                <p><strong>Codice Fiscale:</strong> {clienteSelezionato.codice_fiscale.toUpperCase()}</p>
              )}
              {clienteSelezionato.partita_iva && (
                <p><strong>Partita IVA:</strong> {clienteSelezionato.partita_iva}</p>
              )}
              {clienteSelezionato.email && (
                <p><strong>Email:</strong> {clienteSelezionato.email}</p>
              )}
              {clienteSelezionato.cellulare && (
                <p><strong>Telefono:</strong> {clienteSelezionato.cellulare}</p>
              )}
              {clienteSelezionato.indirizzo_residenza && (
                <p>
                  <strong>Indirizzo:</strong> {clienteSelezionato.indirizzo_residenza}
                  {clienteSelezionato.cap_residenza && `, ${clienteSelezionato.cap_residenza}`}
                  {clienteSelezionato.citta_residenza && ` ${clienteSelezionato.citta_residenza}`}
                  {clienteSelezionato.provincia_residenza && ` (${clienteSelezionato.provincia_residenza})`}
                </p>
              )}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-bold text-blue-600 uppercase mb-2">INFORMATIVA</p>
            <div className="space-y-2 text-xs text-gray-700">
              {testoInformativaFinale.split('\n').map((riga, i) => (
                <p key={i} className="leading-relaxed">{riga || ' '}</p>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs font-bold text-blue-600 uppercase mb-2">
              PRESA VISIONE DELL'INFORMATIVA
            </p>
            <p className="text-xs text-gray-700 mb-3">
              Il/La sottoscritto/a dichiara di aver ricevuto e letto la presente informativa sul trattamento dei dati personali ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR).
            </p>
            <p className="text-xs text-gray-700 mb-3">
              Luogo: Talamona (SO)
              {clienteSelezionato.privacy_data_firma && (
                <>
                  {' | '}
                  Data: {new Date(clienteSelezionato.privacy_data_firma).toLocaleDateString('it-IT')}
                </>
              )}
            </p>
            <p className="text-xs font-bold text-gray-800 mb-2">Firma per presa visione:</p>
            {clienteSelezionato.privacy_firma_immagine && (
              <img
                src={clienteSelezionato.privacy_firma_immagine}
                alt="Firma cliente (presa visione)"
                className="h-16"
              />
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs font-bold text-blue-600 uppercase mb-2">
              CONSENSO AL TRATTAMENTO DEI DATI PERSONALI
            </p>
            <p className="text-xs text-gray-700 mb-3 leading-relaxed">
              Il/La sottoscritto/a, essendo stato/a informato/a dell'identità del Titolare del trattamento, delle modalità e delle finalità del trattamento, del diritto di revoca del consenso, così come indicato nell'informativa sottoscritta ai sensi dell'art. 13 del GDPR, con la sottoscrizione del presente modulo <strong>ACCONSENTE</strong> al trattamento dei propri dati personali, anche particolari (dati sanitari), secondo le modalità descritte nella presente informativa.
            </p>
            <p className="text-xs text-gray-700 mb-3">
              Luogo: Talamona (SO)
              {clienteSelezionato.privacy_data_firma && (
                <>
                  {' | '}
                  Data: {new Date(clienteSelezionato.privacy_data_firma).toLocaleDateString('it-IT')}
                </>
              )}
            </p>
            <p className="text-xs font-bold text-gray-800 mb-2">Firma per consenso:</p>
            {clienteSelezionato.privacy_firma_immagine && (
              <img
                src={clienteSelezionato.privacy_firma_immagine}
                alt="Firma cliente (consenso)"
                className="h-16"
              />
            )}
          </div>

          <FooterPdf />
        </AnteprimaPdf>
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          tipo={toastTipo}
          duration={5000}
          onComplete={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-apple-gray">{label}</span>
      <span className="text-apple-darkgray font-medium">{value || '—'}</span>
    </div>
  );
}
