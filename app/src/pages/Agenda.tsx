import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  getAppuntamenti,
  aggiornaAppuntamentiCompletati,
  setConfigAgenda,
  getProssimi3GiorniLavorativi,
  isGiornoLavorativo,
  aggiornaAppuntamento,
  getAppuntamento,
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

export function Agenda({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
} = {}) {
  const [vista, setVista] = useState<Vista>('giornaliera');
  const [raggruppaSeduta, setRaggruppaSeduta] = useState<boolean>(() => {
    return localStorage.getItem('gestionale_raggruppa_seduta') === 'true';
  });

  const toggleRaggruppaSeduta = () => {
    setRaggruppaSeduta(prev => {
      const next = !prev;
      localStorage.setItem('gestionale_raggruppa_seduta', String(next));
      return next;
    });
  };
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
  const [modalePendingRebooking, setModalePendingRebooking] = useState<'pending' | 'rebooking' | null>(null);

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

  function apriWhatsAppCliente(
    app: AppuntamentoConCliente,
    tipo: 'pending' | 'rebooking' = 'pending'
  ) {
    const cellulare = app.cliente?.cellulare;
    if (!cellulare) {
      setToast({ message: 'Cliente senza cellulare', tipo: 'error' });
      return;
    }
    const pulito = cellulare.replace(/\D/g, '');
    const numero = pulito.startsWith('39') ? pulito : `39${pulito}`;
    const nomeCliente = app.cliente?.nome_cognome ?? '';
    const primoNome = nomeCliente.split(' ')[0] || '';

    let testo: string;
    if (tipo === 'pending') {
      const dataIt = new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const ora = app.ora_inizio.slice(0, 5);
      testo = `Ciao ${primoNome}, ti scrivo dallo Studio Righetti per confermare il tuo appuntamento di ${dataIt} alle ${ora}. Confermi?`;
    } else {
      testo = `Ciao ${primoNome}, ti scrivo dallo Studio Righetti per riprogrammare il tuo appuntamento. Le nostre disponibilità sono:\n- `;
    }

    const encoded = encodeURIComponent(testo);
    // whatsapp:// apre l'APP nativa (Mac/iPhone/Android)
    // wa.me apre il web (fallback)
    const appUrl = `whatsapp://send?phone=${numero}&text=${encoded}`;
    const webUrl = `https://wa.me/${numero}?text=${encoded}`;

    // Prova ad aprire l'app nativa; se non c'è, fallback sul web
    const start = Date.now();
    window.location.href = appUrl;
    setTimeout(() => {
      // Se dopo 1.5s la pagina non è cambiata (app non installata), apri web
      if (Date.now() - start < 2000) {
        window.open(webUrl, '_blank');
      }
    }, 1500);
  }


  async function ricarica(silenzioso = false) {
    try {
      if (!silenzioso) setLoading(true);
      setErrore(null);
      const data = await getAppuntamenti(range.inizio, range.fine);
      setAppuntamenti(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento');
    } finally {
      if (!silenzioso) setLoading(false);
    }
  }

  useEffect(() => {
    if (!configCaricata) return;
    ricarica();
  }, [range.inizio, range.fine, configCaricata]);

  // ⚡ Sincronizzazione Realtime Multi-Device (MacBook, iPhone, iPad)
  useEffect(() => {
    if (!configCaricata) return;

    const channel = supabase
      .channel('realtime_agenda_appuntamenti')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appuntamenti' },
        () => {
          // Ping istantaneo da un altro dispositivo: aggiorna la griglia al volo
          ricarica(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [configCaricata, range.inizio, range.fine]);

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
      await ricarica();
      if (dettaglio?.id === id) {
        try {
          const fresco = await getAppuntamento(id);
          if (fresco) setDettaglio(fresco);
        } catch { /* ignora */ }
      }
      setToast({ message: 'Appuntamento aggiornato', tipo: 'success' });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Errore',
        tipo: 'error',
      });
    }
  }

  async function clickAppuntamento(app: AppuntamentoConCliente) {
    // Ricarica fresco dal DB per evitare dati stantii dopo drag&drop
    try {
      const fresco = await getAppuntamento(app.id);
      setDettaglio(fresco || app);
    } catch {
      setDettaglio(app);
    }
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
      {/* --- HEADER MOBILE (< 768px): Stile compatto riferimento --- */}
      <div className="sm:hidden mb-3">
        {/* Riga 1: Data centrata */}
        <div className="text-center font-bold text-base text-apple-darkgray capitalize mb-2">
          {titoloData()}
        </div>

        {/* Riga 2: Barra comandi orizzontale compatta in un unico livello */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          {/* Pillola < Oggi > */}
          <div className="inline-flex items-center rounded-apple bg-apple-blue text-white shadow-apple overflow-hidden h-9">
            <button onClick={() => vai(-1)} className="px-2.5 h-full hover:bg-blue-600 active:bg-blue-700 font-bold text-sm">‹</button>
            <button onClick={vaiAOggi} className="px-2.5 h-full hover:bg-blue-600 active:bg-blue-700 text-xs font-semibold border-x border-blue-400/40">Oggi</button>
            <button onClick={() => vai(1)} className="px-2.5 h-full hover:bg-blue-600 active:bg-blue-700 font-bold text-sm">›</button>
          </div>

          {/* Switcher M | S | G */}
          <div className="inline-flex rounded-apple bg-apple-blue text-white shadow-apple overflow-hidden h-9">
            {[
              { id: 'mensile', label: 'M' },
              { id: 'settimanale', label: 'S' },
              { id: 'giornaliera', label: 'G' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id as any)}
                className={`px-2.5 h-full text-xs font-bold transition-colors border-r last:border-r-0 border-blue-400/40 ${
                  vista === v.id ? 'bg-white text-apple-blue shadow-sm' : 'hover:bg-blue-600'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Date picker 📅 & Nuovo + */}
          <div className="flex items-center gap-1.5">
            <label className="w-9 h-9 rounded-apple bg-apple-blue text-white shadow-apple flex items-center justify-center cursor-pointer hover:bg-blue-600 active:bg-blue-700 relative shrink-0">
              <span className="text-sm">📅</span>
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
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>

            <button
              type="button"
              onClick={toggleRaggruppaSeduta}
              className={`w-9 h-9 rounded-apple flex items-center justify-center text-sm font-bold shadow-apple transition-all shrink-0 ${
                raggruppaSeduta ? 'bg-orange-500 text-white' : 'bg-white text-apple-darkgray border border-gray-200'
              }`}
              title="Toggle Blocco Unico"
            >
              {raggruppaSeduta ? '🧩' : '🗂️'}
            </button>

            <button
              onClick={apriNuovoGenerico}
              className="w-9 h-9 rounded-apple bg-apple-blue text-white shadow-apple flex items-center justify-center text-lg font-bold hover:bg-blue-600 active:bg-blue-700 shrink-0"
              title="Nuovo Appuntamento"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* --- HEADER DESKTOP (>= 768px): Lasciato esattamente come prima --- */}
      <div className="hidden sm:block mb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-apple-darkgray mb-0.5">
          Agenda
        </h1>
        <p className="text-xs text-apple-gray capitalize">{titoloData()}</p>
      </div>

      <div className="hidden sm:flex flex-wrap items-center gap-2 mb-4">
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

        {/* Toggle Blocco Unico Desktop */}
        <button
          type="button"
          onClick={toggleRaggruppaSeduta}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-apple text-xs font-semibold shadow-apple transition-all sm:ml-auto ${
            raggruppaSeduta
              ? 'bg-orange-500 text-white shadow-orange-500/25 ring-2 ring-orange-400/40'
              : 'bg-white text-apple-darkgray border border-gray-200/80 hover:bg-gray-50'
          }`}
          title={raggruppaSeduta ? 'Disattiva Blocco Unico (mostra singoli servizi)' : 'Attiva Blocco Unico (unisce tutti i servizi del cliente)'}
        >
          <span>{raggruppaSeduta ? '🧩' : '🗂️'}</span>
          <span>{raggruppaSeduta ? 'Blocco Unico' : 'Servizi Singoli'}</span>
        </button>

        {/* Viste a destra */}
        <div className="flex gap-1 bg-white rounded-apple shadow-apple p-1">
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
              onClick={() => setModalePendingRebooking('pending')}
              className="px-3 py-2 rounded-apple text-xs font-semibold transition-all shadow-apple bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
            >
              ⏳ Pending <strong>({pendingList.length})</strong>
            </button>
          )}
          {rebookingList.length > 0 && (
            <button
              onClick={() => setModalePendingRebooking('rebooking')}
              className="px-3 py-2 rounded-apple text-xs font-semibold transition-all shadow-apple bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100"
            >
              🔄 Rebooking <strong>({rebookingList.length})</strong>
            </button>
          )}
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
              raggruppaSeduta={raggruppaSeduta}
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
          onScontrina={(app) => {
            // Salva cliente + voci dell'appuntamento in localStorage
            localStorage.setItem(
              'cassa_cliente_preselezionato',
              JSON.stringify(app.cliente)
            );
            localStorage.setItem(
              'cassa_voci_preselezionate',
              JSON.stringify(app.voci_selezionate || [])
            );
            localStorage.setItem(
              'cassa_appuntamento_id',
              String(app.id)
            );
            setDettaglio(null);
            onNavigate?.('cassa_fiscale');
          }}
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

      {/* Modale Pending/Rebooking */}
      {modalePendingRebooking && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalePendingRebooking(null)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60">
              <div>
                <h2 className="text-base font-semibold text-apple-darkgray">
                  {modalePendingRebooking === 'pending'
                    ? '⏳ Appuntamenti da confermare'
                    : '🔄 Clienti da riprogrammare'}
                </h2>
                <p className="text-xs text-apple-gray mt-0.5">
                  {modalePendingRebooking === 'pending'
                    ? pendingList.length
                    : rebookingList.length}{' '}
                  {modalePendingRebooking === 'pending' ? 'appuntamenti' : 'clienti'}
                </p>
              </div>
              <button
                onClick={() => setModalePendingRebooking(null)}
                className="w-8 h-8 rounded-apple flex items-center justify-center text-apple-gray hover:bg-apple-lightgray transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto p-4 space-y-2">
              {(modalePendingRebooking === 'pending' ? pendingList : rebookingList).map(
                (app) => (
                  <div
                    key={app.id}
                    className={`rounded-apple border p-4 transition-colors ${
                      modalePendingRebooking === 'pending'
                        ? 'bg-red-50/50 border-red-200 hover:bg-red-50'
                        : 'bg-orange-50/50 border-orange-200 hover:bg-orange-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${
                          modalePendingRebooking === 'pending'
                            ? 'bg-gradient-to-br from-red-500 to-red-600'
                            : 'bg-gradient-to-br from-orange-500 to-orange-600'
                        }`}
                      >
                        {(app.cliente?.nome_cognome ?? '?')
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-apple-darkgray truncate">
                          {app.cliente?.nome_cognome ?? '—'}
                        </p>
                        <p className="text-xs text-apple-gray">
                          📅{' '}
                          {new Date(app.data + 'T00:00:00').toLocaleDateString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                          {' • '}
                          {app.ora_inizio.slice(0, 5)}
                          {' • '}
                          {app.titolo}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {app.cliente?.cellulare && (
                        <button
                          onClick={() =>
                            apriWhatsAppCliente(
                              app,
                              modalePendingRebooking === 'pending'
                                ? 'pending'
                                : 'rebooking'
                            )
                          }
                          className="flex-1 sm:flex-none px-3 py-2 rounded-apple bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5"
                        >
                          💬 WhatsApp
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setModalePendingRebooking(null);
                          if (modalePendingRebooking === 'pending') {
                            handleVaiAAppuntamento(app.data, app.id);
                          } else {
                            setDettaglio(app);
                          }
                        }}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-apple bg-white border border-gray-200 text-apple-darkgray text-xs font-medium hover:bg-apple-lightgray transition-colors flex items-center justify-center gap-1.5"
                      >
                        {modalePendingRebooking === 'pending' ? '📅 Apri' : '📅 Fissa'}
                      </button>
                      <button
                        onClick={() => {
                          setModalePendingRebooking(null);
                          setDettaglio(app);
                        }}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-apple bg-white border border-gray-200 text-apple-darkgray text-xs font-medium hover:bg-apple-lightgray transition-colors flex items-center justify-center gap-1.5"
                      >
                        ✏️ Dettaglio
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200/60 flex justify-end">
              <button
                onClick={() => setModalePendingRebooking(null)}
                className="px-4 py-2 rounded-apple bg-white border border-gray-200 text-sm font-medium text-apple-darkgray hover:bg-apple-lightgray transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
