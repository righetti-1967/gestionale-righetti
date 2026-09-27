import { useEffect, useMemo, useState } from 'react';
import {
  getAppuntamenti,
  aggiornaAppuntamentiCompletati,
  setConfigAgenda,
  getProssimi3GiorniLavorativi,
  isGiornoLavorativo,
  aggiornaAppuntamento,
  type AppuntamentoConCliente,
  type Operatore,
} from '../lib/appuntamenti';
import { AgendaGiornaliera } from '../components/AgendaGiornaliera';
import { AgendaSettimanale } from '../components/AgendaSettimanale';
import { AgendaMensile } from '../components/AgendaMensile';
import { FormNuovoAppuntamento } from '../components/FormNuovoAppuntamento';
import { RicercaClienteAgenda } from '../components/RicercaClienteAgenda';
import { FormNuovoBlocco } from '../components/FormNuovoBlocco';
import { DettaglioAppuntamento } from '../components/DettaglioAppuntamento';
import { FormScaricoSeduta } from '../components/FormScaricoSeduta';
import { FormNuovaFattura } from '../components/FormNuovaFattura';
import { DettaglioFattura } from '../components/DettaglioFattura';
import { MenuSceltaPdf } from '../components/MenuSceltaPdf';
import { Toast, type ToastTipo } from '../components/Toast';
import { getPercorso, type Percorso } from '../lib/percorsi';
import { getScarichiFattura, type ScaricoSeduta } from '../lib/scarichi';
import { calcolaResiduo, type ResiduoPercorso } from '../lib/percorsi-helper';
import { getFattura, type FatturaConCliente } from '../lib/fatture';
import type { Cliente } from '../lib/clienti';
import { caricaAgendaConfig } from '../lib/agenda-config';

type Vista = 'giornaliera' | 'settimanale' | 'mensile';

function dataToLocaleISO(d: Date): string {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

export function Agenda() {
  const [vista, setVista] = useState<Vista>('giornaliera');
  const [configCaricata, setConfigCaricata] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const config = await caricaAgendaConfig();
        setConfigAgenda(config);
      } catch (err) {
        console.error('Errore caricamento config agenda:', err);
      } finally {
        setConfigCaricata(true);
      }
    })();
  }, []);

  function prossimoGiornoLavorativo(): string {
    const d = new Date();
    while (!isGiornoLavorativo(d)) {
      d.setDate(d.getDate() + 1);
    }
    return dataToLocaleISO(d);
  }

  function getDataIniziale(): string {
    const daStorage = localStorage.getItem('agenda_data_iniziale');
    if (daStorage) {
      localStorage.removeItem('agenda_data_iniziale');
      const d = new Date(daStorage + 'T00:00:00');
      if (isGiornoLavorativo(d)) return daStorage;
    }
    return prossimoGiornoLavorativo();
  }

  const [dataCorrente, setDataCorrente] = useState<string>(getDataIniziale());
  const [appuntamenti, setAppuntamenti] = useState<AppuntamentoConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showFormBlocco, setShowFormBlocco] = useState(false);
  const [formPrecompilato, setFormPrecompilato] = useState<{
    data?: string;
    operatore?: Operatore;
    ora?: string;
    appuntamento?: AppuntamentoConCliente | null;
  }>({});
  const [dettaglio, setDettaglio] = useState<AppuntamentoConCliente | null>(null);
  const [highlightAppuntamentoId, setHighlightAppuntamentoId] = useState<number | null>(null);
  const [cardAttiva, setCardAttiva] = useState<'pending' | 'rebooking' | null>(null);

  const [scaricoDaApp, setScaricoDaApp] = useState<{
    percorso: Percorso;
    cliente: Cliente;
    residuo: ResiduoPercorso;
    vociIniziali: import('../lib/appuntamenti').VoceSelezionata[];
  } | null>(null);

  const [fatturaDaApp, setFatturaDaApp] = useState<{
    cliente: Cliente;
    isCheckup: boolean;
    vociIniziali: import('../lib/appuntamenti').VoceSelezionata[];
  } | null>(null);

  const [fatturaAppenaCreata, setFatturaAppenaCreata] = useState<FatturaConCliente | null>(null);
  const [scaricoAppenaCreato, setScaricoAppenaCreato] = useState<{
    scarico: ScaricoSeduta;
    percorso: Percorso;
    cliente: Cliente;
  } | null>(null);

  const range = useMemo(() => {
    if (!configCaricata) {
      return { inizio: dataCorrente, fine: dataCorrente };
    }
    if (vista === 'giornaliera') {
      return { inizio: dataCorrente, fine: dataCorrente };
    }
    if (vista === 'settimanale') {
      const giorni = getProssimi3GiorniLavorativi(new Date(dataCorrente + 'T00:00:00'));
      if (giorni.length === 0) {
        return { inizio: dataCorrente, fine: dataCorrente };
      }
      return {
        inizio: dataToLocaleISO(giorni[0]),
        fine: dataToLocaleISO(giorni[giorni.length - 1]),
      };
    }
    const d = new Date(dataCorrente + 'T00:00:00');
    const inizio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fine = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      inizio: dataToLocaleISO(inizio),
      fine: dataToLocaleISO(fine),
    };
  }, [vista, dataCorrente, configCaricata]);

  const oggiStringa = dataToLocaleISO(new Date());

  const pendingList = useMemo(
    () =>
      appuntamenti.filter(
        (a) => a.stato === 'pending' && a.data >= oggiStringa && !a.is_blocco
      ),
    [appuntamenti, oggiStringa]
  );

  const rebookingList = useMemo(
    () =>
      appuntamenti.filter(
        (a) =>
          a.motivo_cancellazione === 'rebooking' &&
          !a.rebooking_fissato &&
          !a.is_blocco
      ),
    [appuntamenti]
  );

  function apriWhatsAppCliente(app: AppuntamentoConCliente) {
    const cellulare = app.cliente?.cellulare;
    if (!cellulare) {
      setToast({ message: 'Cliente senza cellulare', tipo: 'error' });
      return;
    }
    const pulito = cellulare.replace(/\D/g, '');
    const numero = pulito.startsWith('39') ? pulito : `39${pulito}`;
    const nomeCliente = app.cliente?.nome_cognome ?? '';
    const dataIt = new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const ora = app.ora_inizio.slice(0, 5);
    const messaggio = encodeURIComponent(
      `Ciao ${nomeCliente.split(' ')[0]}, ti scrivo dallo Studio Righetti per confermare il tuo appuntamento di ${dataIt} alle ${ora}. Confermi?`
    );
    window.open(`https://wa.me/${numero}?text=${messaggio}`, '_blank');
  }

  async function ricarica() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getAppuntamenti(range.inizio, range.fine);
      setAppuntamenti(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!configCaricata) return;
    ricarica();
  }, [range.inizio, range.fine, configCaricata]);

  const giorniSettimana = useMemo(() => {
    if (vista !== 'settimanale') return [];
    const giorni = getProssimi3GiorniLavorativi(new Date(dataCorrente + 'T00:00:00'));
    return giorni.map((d) => dataToLocaleISO(d));
  }, [vista, dataCorrente, configCaricata]);

  function vai(delta: number) {
    const d = new Date(dataCorrente + 'T00:00:00');
    if (vista === 'giornaliera') {
      do {
        d.setDate(d.getDate() + delta);
      } while (!isGiornoLavorativo(d));
    } else if (vista === 'settimanale') {
      d.setDate(d.getDate() + delta * 7);
    } else {
      d.setMonth(d.getMonth() + delta);
    }
    setDataCorrente(dataToLocaleISO(d));
  }

  function vaiAOggi() {
    setDataCorrente(dataToLocaleISO(new Date()));
  }

  function apriNuovoGenerico() {
    setFormPrecompilato({});
    setShowForm(true);
  }

  function handleVaiAAppuntamento(data: string, appuntamentoId: number) {
    setDataCorrente(data);
    setVista('giornaliera');
    setHighlightAppuntamentoId(appuntamentoId);
    setTimeout(() => setHighlightAppuntamentoId(null), 2500);
  }

  function clickSlotGiornaliera(operatore: Operatore, ora: string) {
    setFormPrecompilato({ data: dataCorrente, operatore, ora });
    setShowForm(true);
  }

  function clickSlotSettimanale(data: string, operatore: Operatore, ora: string) {
    setFormPrecompilato({ data, operatore, ora });
    setShowForm(true);
  }

  function clickGiornoMensile(data: string) {
    setDataCorrente(data);
    setVista('giornaliera');
  }

  async function handleUpdateAppuntamento(
    id: number,
    updates: {
      ora_inizio?: string;
      durata_minuti?: number;
      operatore?: Operatore;
      voci_selezionate?: import('../lib/appuntamenti').VoceSelezionata[];
    }
  ) {
    try {
      await aggiornaAppuntamento(id, updates);
      setToast({ message: 'Appuntamento aggiornato', tipo: 'success' });
      ricarica();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Errore',
        tipo: 'error',
      });
    }
  }

  function clickAppuntamento(app: AppuntamentoConCliente) {
    setDettaglio(app);
  }

  function modificaAppuntamento(app: AppuntamentoConCliente) {
    setDettaglio(null);
    setFormPrecompilato({ appuntamento: app });
    setShowForm(true);
  }

  async function apriScaricoSeduta(app: AppuntamentoConCliente) {
    if (!app.percorso_id) return;
    try {
      const p = await getPercorso(app.percorso_id);
      if (!p) {
        setToast({ message: 'Percorso non trovato', tipo: 'error' });
        return;
      }

      let righeScaricate: {
        tipo: 'servizio' | 'prodotto';
        servizio_id: number | null;
        prodotto_id: number | null;
        quantita: number;
        prezzo_scontato_lordo: number;
      }[] = [];
      if (p.fattura_id) {
        const scarichi = await getScarichiFattura(p.fattura_id);
        righeScaricate = scarichi.flatMap((s) => s.righe || []);
      }
      const res = calcolaResiduo(p.righe || [], righeScaricate);

      if (!app.cliente) {
        setToast({ message: 'Cliente non trovato', tipo: 'error' });
        return;
      }

      const clienteFull: Cliente = {
        id: app.cliente.id,
        nome_cognome: app.cliente.nome_cognome,
        cellulare: app.cliente.cellulare || null,
        email: app.cliente.email || null,
        codice_fiscale: null,
        partita_iva: null,
        codice_sdi: null,
        note_anamnesi: null,
        indirizzo_residenza: null,
        cap_residenza: null,
        citta_residenza: null,
        provincia_residenza: null,
        indirizzo_spedizione: null,
        cap_spedizione: null,
        citta_spedizione: null,
        provincia_spedizione: null,
        privacy_firmata: false,
        privacy_firma_immagine: null,
        privacy_data_firma: null,
        privacy_inviata_email_at: null,
        privacy_inviata_whatsapp_at: null,
        created_at: '',
      };

      setDettaglio(null);
      const vociIniziali = (app.voci_selezionate || []).map((v) => ({
        tipo: v.tipo,
        servizio_id: v.servizio_id,
        prodotto_id: v.prodotto_id,
        quantita: v.quantita,
      }));
      setScaricoDaApp({
        percorso: p,
        cliente: clienteFull,
        residuo: res,
        vociIniziali,
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Errore',
        tipo: 'error',
      });
    }
  }

  function apriFatturaProforma(app: AppuntamentoConCliente) {
    if (!app.cliente) return;
    const clienteFull: Cliente = {
      id: app.cliente.id,
      nome_cognome: app.cliente.nome_cognome,
      cellulare: app.cliente.cellulare || null,
      email: app.cliente.email || null,
      codice_fiscale: null,
      partita_iva: null,
      codice_sdi: null,
      note_anamnesi: null,
      indirizzo_residenza: null,
      cap_residenza: null,
      citta_residenza: null,
      provincia_residenza: null,
      indirizzo_spedizione: null,
      cap_spedizione: null,
      citta_spedizione: null,
      provincia_spedizione: null,
      privacy_firmata: false,
      privacy_firma_immagine: null,
      privacy_data_firma: null,
      privacy_inviata_email_at: null,
      privacy_inviata_whatsapp_at: null,
      created_at: '',
    };

    setDettaglio(null);
    setFatturaDaApp({
      cliente: clienteFull,
      isCheckup: true,
      vociIniziali: app.voci_selezionate || [],
    });
  }

  function apriFatturaDiretta(app: AppuntamentoConCliente) {
    if (!app.cliente) return;
    const clienteFull: Cliente = {
      id: app.cliente.id,
      nome_cognome: app.cliente.nome_cognome,
      cellulare: app.cliente.cellulare || null,
      email: app.cliente.email || null,
      codice_fiscale: null,
      partita_iva: null,
      codice_sdi: null,
      note_anamnesi: null,
      indirizzo_residenza: null,
      cap_residenza: null,
      citta_residenza: null,
      provincia_residenza: null,
      indirizzo_spedizione: null,
      cap_spedizione: null,
      citta_spedizione: null,
      provincia_spedizione: null,
      privacy_firmata: false,
      privacy_firma_immagine: null,
      privacy_data_firma: null,
      privacy_inviata_email_at: null,
      privacy_inviata_whatsapp_at: null,
      created_at: '',
    };

    setDettaglio(null);
    setFatturaDaApp({
      cliente: clienteFull,
      isCheckup: false,
      vociIniziali: app.voci_selezionate || [],
    });
  }

  function titoloData(): string {
    const d = new Date(dataCorrente + 'T00:00:00');
    if (vista === 'giornaliera') {
      return d.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (vista === 'settimanale') {
      const giorni = giorniSettimana;
      if (giorni.length > 0) {
        const inizio = new Date(giorni[0] + 'T00:00:00');
        const fine = new Date(giorni[giorni.length - 1] + 'T00:00:00');
        if (giorni.length === 1) {
          return inizio.toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        }
        return `${inizio.getDate()}–${fine.getDate()} ${fine.toLocaleDateString('it-IT', {
          month: 'long',
          year: 'numeric',
        })}`;
      }
    }
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-apple-darkgray mb-0.5">
          Agenda
        </h1>
        <p className="text-xs text-apple-gray capitalize">{titoloData()}</p>
      </div>

      {/* Riga unica: azioni + navigazione + viste */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Azioni */}
        <RicercaClienteAgenda onVaiAAppuntamento={handleVaiAAppuntamento} />
        <button
          onClick={() => setShowFormBlocco(true)}
          className="px-3 py-2.5 bg-gray-700 text-white rounded-apple font-medium text-sm shadow-apple hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
          title="Nuovo Blocco"
        >
          <span>🚫</span>
          <span className="hidden sm:inline">Blocco</span>
        </button>
        <button
          onClick={apriNuovoGenerico}
          className="px-3 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
          title="Nuovo Appuntamento"
        >
          <span>+</span>
          <span className="hidden sm:inline">Nuovo</span>
        </button>

        {/* Separatore */}
        <div className="hidden sm:block w-px h-8 bg-gray-200 mx-1" />

        {/* Navigazione data */}
        <button
          onClick={() => vai(-1)}
          className="w-10 h-10 rounded-apple bg-white shadow-apple hover:bg-gray-50 flex items-center justify-center text-apple-darkgray shrink-0"
          aria-label="Precedente"
        >
          ←
        </button>
        <button
          onClick={vaiAOggi}
          className="px-3 py-2.5 bg-white shadow-apple rounded-apple font-medium text-sm text-apple-darkgray hover:bg-gray-50 shrink-0"
        >
          Oggi
        </button>
        <button
          onClick={() => vai(1)}
          className="w-10 h-10 rounded-apple bg-white shadow-apple hover:bg-gray-50 flex items-center justify-center text-apple-darkgray shrink-0"
          aria-label="Successivo"
        >
          →
        </button>
        <input
          type="date"
          value={dataCorrente}
          onChange={(e) => {
            const d = new Date(e.target.value + 'T00:00:00');
            while (!isGiornoLavorativo(d)) {
              d.setDate(d.getDate() + 1);
            }
            setDataCorrente(dataToLocaleISO(d));
          }}
          className="px-3 py-2.5 bg-white shadow-apple rounded-apple text-sm text-apple-darkgray font-medium focus:outline-none focus:ring-2 focus:ring-apple-blue/30 cursor-pointer shrink-0"
        />

        {/* Viste a destra */}
        <div className="flex gap-1 bg-white rounded-apple shadow-apple p-1 sm:ml-auto">
          {(
            [
              { id: 'giornaliera', label: 'Giorno' },
              { id: 'settimanale', label: 'Settimana' },
              { id: 'mensile', label: 'Mese' },
            ] as { id: Vista; label: string }[]
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                vista === v.id
                  ? 'bg-apple-blue text-white'
                  : 'text-apple-darkgray hover:bg-gray-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Barra Pending/Rebooking */}
      {(pendingList.length > 0 || rebookingList.length > 0) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pendingList.length > 0 && (
            <button
              onClick={() => setCardAttiva(cardAttiva === 'pending' ? null : 'pending')}
              className={`px-3 py-2 rounded-apple text-xs font-semibold transition-all shadow-apple ${
                cardAttiva === 'pending'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
              }`}
            >
              ⏳ Pending <strong>({pendingList.length})</strong>
            </button>
          )}
          {rebookingList.length > 0 && (
            <button
              onClick={() =>
                setCardAttiva(cardAttiva === 'rebooking' ? null : 'rebooking')
              }
              className={`px-3 py-2 rounded-apple text-xs font-semibold transition-all shadow-apple ${
                cardAttiva === 'rebooking'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100'
              }`}
            >
              🔄 Rebooking <strong>({rebookingList.length})</strong>
            </button>
          )}
        </div>
      )}

      {/* Pannello Pending */}
      {cardAttiva === 'pending' && pendingList.length > 0 && (
        <div className="mb-3 space-y-2 p-3 bg-red-50/50 border border-red-200 rounded-apple">
          <h3 className="text-xs font-bold text-red-900 uppercase tracking-wide">
            ⏳ Appuntamenti da confermare
          </h3>
          {pendingList.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-red-200 rounded-apple p-3 flex flex-wrap items-center gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                  {(app.cliente?.nome_cognome ?? '?')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-apple-darkgray truncate">
                    {app.cliente?.nome_cognome ?? '—'}
                  </p>
                  <p className="text-xs text-apple-gray">
                    📅{' '}
                    {new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' • '}
                    {app.ora_inizio.slice(0, 5)}
                    {' • '}
                    {app.titolo}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {app.cliente?.cellulare && (
                  <button
                    onClick={() => apriWhatsAppCliente(app)}
                    className="w-8 h-8 rounded-apple flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
                    title="Invia WhatsApp"
                  >
                    💬
                  </button>
                )}
                <button
                  onClick={() => handleVaiAAppuntamento(app.data, app.id)}
                  className="w-8 h-8 rounded-apple flex items-center justify-center text-apple-gray hover:bg-apple-lightgray transition-colors"
                  title="Apri in Agenda"
                >
                  📅
                </button>
                <button
                  onClick={() => setDettaglio(app)}
                  className="w-8 h-8 rounded-apple flex items-center justify-center text-apple-gray hover:bg-apple-lightgray transition-colors"
                  title="Modifica"
                >
                  ✏️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pannello Rebooking */}
      {cardAttiva === 'rebooking' && rebookingList.length > 0 && (
        <div className="mb-3 space-y-2 p-3 bg-orange-50/50 border border-orange-200 rounded-apple">
          <h3 className="text-xs font-bold text-orange-900 uppercase tracking-wide">
            🔄 Clienti da riprogrammare
          </h3>
          {rebookingList.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-orange-200 rounded-apple p-3 flex flex-wrap items-center gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                  {(app.cliente?.nome_cognome ?? '?')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-apple-darkgray truncate">
                    {app.cliente?.nome_cognome ?? '—'}
                  </p>
                  <p className="text-xs text-apple-gray">
                    📅{' '}
                    {new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' • '}
                    {app.ora_inizio.slice(0, 5)}
                    {' • '}
                    {app.titolo}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {app.cliente?.cellulare && (
                  <button
                    onClick={() => apriWhatsAppCliente(app)}
                    className="w-8 h-8 rounded-apple flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors"
                    title="Invia WhatsApp"
                  >
                    💬
                  </button>
                )}
                <button
                  onClick={() => setDettaglio(app)}
                  className="w-8 h-8 rounded-apple flex items-center justify-center text-apple-gray hover:bg-apple-lightgray transition-colors"
                  title="Fissa appuntamento"
                >
                  📅
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {!loading && !errore && (
        <>
          {vista === 'giornaliera' && (
            <AgendaGiornaliera
              data={dataCorrente}
              appuntamenti={appuntamenti}
              onClickAppuntamento={clickAppuntamento}
              onClickSlot={clickSlotGiornaliera}
              onUpdateAppuntamento={handleUpdateAppuntamento}
              highlightAppuntamentoId={highlightAppuntamentoId}
            />
          )}
          {vista === 'settimanale' && (
            <AgendaSettimanale
              giorniSettimana={giorniSettimana}
              appuntamenti={appuntamenti}
              onClickAppuntamento={clickAppuntamento}
              onClickSlot={clickSlotSettimanale}
            />
          )}
          {vista === 'mensile' && (
            <AgendaMensile
              mese={new Date(dataCorrente + 'T00:00:00').getMonth()}
              anno={new Date(dataCorrente + 'T00:00:00').getFullYear()}
              appuntamenti={appuntamenti}
              onClickGiorno={clickGiornoMensile}
            />
          )}
        </>
      )}

      {showForm && (
        <FormNuovoAppuntamento
          appuntamentoIniziale={formPrecompilato.appuntamento || null}
          dataIniziale={formPrecompilato.data}
          operatoreIniziale={formPrecompilato.operatore}
          oraIniziale={formPrecompilato.operatore ? formPrecompilato.ora : undefined}
          onClose={() => {
            setShowForm(false);
            setFormPrecompilato({});
          }}
          onSuccess={() => {
            setShowForm(false);
            setFormPrecompilato({});
            setToast({ message: 'Appuntamento salvato', tipo: 'success' });
            ricarica();
          }}
        />
      )}

      {showFormBlocco && (
        <FormNuovoBlocco
          dataIniziale={dataCorrente}
          onClose={() => setShowFormBlocco(false)}
          onSuccess={() => {
            setShowFormBlocco(false);
            setToast({ message: 'Blocco creato', tipo: 'success' });
            ricarica();
          }}
        />
      )}

      {dettaglio && (
        <DettaglioAppuntamento
          appuntamento={dettaglio}
          onClose={() => setDettaglio(null)}
          onUpdated={() => {
            setDettaglio(null);
            ricarica();
          }}
          onModifica={() => modificaAppuntamento(dettaglio)}
          onScaricoSeduta={apriScaricoSeduta}
          onFatturaProforma={apriFatturaProforma}
          onFatturaDiretta={apriFatturaDiretta}
          onToast={(msg, tipo) => setToast({ message: msg, tipo })}
        />
      )}

      {scaricoDaApp && (
        <FormScaricoSeduta
          percorso={scaricoDaApp.percorso}
          cliente={scaricoDaApp.cliente}
          residuo={scaricoDaApp.residuo}
          fatturaIncassata={true}
          vociIniziali={scaricoDaApp.vociIniziali}
          onClose={() => setScaricoDaApp(null)}
          onSuccess={(nuovoScarico) => {
            const tempCtx = scaricoDaApp;
            setScaricoDaApp(null);
            setToast({ message: 'Scarico registrato', tipo: 'success' });
            ricarica();
            setScaricoAppenaCreato({
              scarico: nuovoScarico,
              percorso: tempCtx.percorso,
              cliente: tempCtx.cliente,
            });
          }}
        />
      )}

      {fatturaDaApp && (
        <FormNuovaFattura
          clienteIniziale={fatturaDaApp.cliente}
          checkupIniziale={fatturaDaApp.isCheckup}
          vociIniziali={fatturaDaApp.vociIniziali}
          onClose={() => setFatturaDaApp(null)}
          onSuccess={async (fatturaId) => {
            setFatturaDaApp(null);
            setToast({ message: 'Fattura creata con successo!', tipo: 'success' });
            ricarica();
            try {
              const f = await getFattura(fatturaId);
              if (f) setFatturaAppenaCreata(f);
            } catch (err) {
              console.error('Errore caricamento fattura appena creata', err);
            }
          }}
        />
      )}

      {fatturaAppenaCreata && (
        <DettaglioFattura
          fattura={fatturaAppenaCreata}
          onClose={() => setFatturaAppenaCreata(null)}
          onUpdate={async () => {
            const f = await getFattura(fatturaAppenaCreata.id);
            if (f) setFatturaAppenaCreata(f);
            ricarica();
          }}
        />
      )}

      {scaricoAppenaCreato && (
        <MenuSceltaPdf
          scarico={scaricoAppenaCreato.scarico}
          percorso={scaricoAppenaCreato.percorso}
          cliente={scaricoAppenaCreato.cliente}
          onClose={() => setScaricoAppenaCreato(null)}
        />
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
