import { useEffect, useMemo, useRef, useState } from 'react';
import { getClienti, type Cliente } from '../lib/clienti';
import { getServizi, type Servizio } from '../lib/servizi';
import { getPercorsiCliente, type Percorso } from '../lib/percorsi';
import {
  creaAppuntamento,
  aggiornaAppuntamento,
  getAppuntamentiGiorno,
  calcolaOraFine,
  coloreDefault,
  siSovrappongono,
  chiudiRebookingCliente,
  OPERATORI,
  ORA_INIZIO_LAVORO,
  ORA_FINE_LAVORO,
  type AppuntamentoConCliente,
  type Operatore,
  type StatoAppuntamento,
  type TipoAppuntamento,
} from '../lib/appuntamenti';
import { formatEuro } from '../lib/fatture';
import { getScarichiFattura } from '../lib/scarichi';
import { getOperatoriVisibili } from '../lib/appuntamenti';
import { calcolaResiduo, type ResiduoPercorso } from '../lib/percorsi-helper';
import type { VoceSelezionata } from '../lib/appuntamenti';
import { FormNuovoClienteRapido } from './FormNuovoClienteRapido';

interface FormNuovoAppuntamentoProps {
  appuntamentoIniziale?: AppuntamentoConCliente | null;
  dataIniziale?: string;
  operatoreIniziale?: Operatore;
  oraIniziale?: string;
  clienteIniziale?: Cliente | null;
  rebookingDaFissare?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function trovaServizioCheckup(lista: Servizio[]): Servizio | undefined {
  return (
    lista.find((s: any) => s.is_checkup_iniziale === true) ||
    lista.find((s) => s.nome.toLowerCase().includes('check-up') || s.nome.toLowerCase().includes('checkup')) ||
    lista.find((s) => s.nome.toLowerCase().includes('gratuito'))
  );
}

export function FormNuovoAppuntamento({
  appuntamentoIniziale,
  dataIniziale,
  operatoreIniziale,
  oraIniziale,
  clienteIniziale,
  rebookingDaFissare,
  onClose,
  onSuccess,
}: FormNuovoAppuntamentoProps) {
  const modifica = !!appuntamentoIniziale;

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState<number | null>(
    appuntamentoIniziale?.cliente_id || clienteIniziale?.id || null
  );
  const [operatore, setOperatore] = useState<Operatore>(
    appuntamentoIniziale?.operatore || operatoreIniziale || 'luca'
  );
  const [data, setData] = useState(
    appuntamentoIniziale?.data || dataIniziale || new Date().toISOString().split('T')[0]
  );
  const [oraInizio, setOraInizio] = useState(
    appuntamentoIniziale?.ora_inizio.slice(0, 5) || oraIniziale || '09:00'
  );
  const [durata, setDurata] = useState<string>(
    appuntamentoIniziale?.durata_minuti !== undefined
      ? String(appuntamentoIniziale.durata_minuti)
      : '60'
  );
  const [tipo, setTipo] = useState<TipoAppuntamento>(
    appuntamentoIniziale?.tipo || 'generico'
  );
  const [titolo, setTitolo] = useState(appuntamentoIniziale?.titolo || '');
  const [colore, setColore] = useState(appuntamentoIniziale?.colore || '');
  const [note, setNote] = useState(appuntamentoIniziale?.note || '');
  const [stato, setStato] = useState<StatoAppuntamento>(
    appuntamentoIniziale?.stato || 'prenotato'
  );
  const [percorsoId, setPercorsoId] = useState<number | null>(
    appuntamentoIniziale?.percorso_id || null
  );
  const [servizioId, setServizioId] = useState<number | null>(
    appuntamentoIniziale?.servizio_id || null
  );

  const [ricercaCliente, setRicercaCliente] = useState('');
  const [showListaClienti, setShowListaClienti] = useState(false);
  const [showFormClienteRapido, setShowFormClienteRapido] = useState(false);
  const [percorsiCliente, setPercorsiCliente] = useState<Percorso[]>([]);
  const [residuoPercorso, setResiduoPercorso] = useState<ResiduoPercorso | null>(null);
  const [vociSelezionate, setVociSelezionate] = useState<VoceSelezionata[]>(
    appuntamentoIniziale?.voci_selezionate || []
  );
  const [servizioCheckupId, setServizioCheckupId] = useState<number | null>(null);
  const [showPickerServizi, setShowPickerServizi] = useState(false);
  const percorsoSelectRef = useRef<HTMLSelectElement>(null);
  const [ricercaPickerServizi, setRicercaPickerServizi] = useState('');
  const [selezionatiPicker, setSelezionatiPicker] = useState<Set<number>>(new Set());
  const [appuntamentiGiorno, setAppuntamentiGiorno] = useState<AppuntamentoConCliente[]>([]);
  const operatoriVisibili = useMemo(() => getOperatoriVisibili(), []);

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        const [c, s] = await Promise.all([getClienti(), getServizi()]);
        setClienti(c);
        setServizi(s);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  async function ricaricaClienti() {
    try {
      const c = await getClienti();
      setClienti(c);
    } catch (err) {
      console.error('Errore ricarica clienti:', err);
    }
  }

  useEffect(() => {
    async function caricaPercorsi() {
      if (!clienteId) {
        setPercorsiCliente([]);
        return;
      }
      try {
        const tutti = await getPercorsiCliente(clienteId);
        const attivi = tutti.filter((p) => !p.terminato && !p.bloccato);
        setPercorsiCliente(attivi);

        // Auto-seleziona tab in base ai percorsi attivi
        // (solo se non stiamo modificando un appuntamento esistente)
        if (!modifica) {
          if (attivi.length > 0) {
            setTipo('percorso');
          } else {
            // Nessun percorso attivo → torna a Generico
            setTipo('generico');
            setPercorsoId(null);
          }
        }
      } catch (err) {
        console.error('Errore caricamento percorsi:', err);
      }
    }
    caricaPercorsi();
  }, [clienteId]);

  useEffect(() => {
    async function caricaResiduo() {
      if (!percorsoId || !clienteId) {
        setResiduoPercorso(null);
        return;
      }
      try {
        const p = percorsiCliente.find((x) => x.id === percorsoId);
        if (!p) {
          setResiduoPercorso(null);
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
        setResiduoPercorso(res);
      } catch (err) {
        console.error('Errore caricamento residuo:', err);
        setResiduoPercorso(null);
      }
    }
    caricaResiduo();
  }, [percorsoId, clienteId, percorsiCliente]);

  useEffect(() => {
    if (tipo !== 'checkup_nuovo' || servizi.length === 0) return;

    const checkup = trovaServizioCheckup(servizi);
    if (checkup) {
      setServizioCheckupId(checkup.id);
      setServizioId(checkup.id);
      if (!titolo || titolo === 'Righetti Check-Up Gratuito') setTitolo(checkup.nome);

      setVociSelezionate((prev) => {
        const giaPresente = prev.some(
          (v) => v.tipo === 'servizio' && (v.servizio_id === checkup.id || (v.nome || '').toLowerCase().includes('check'))
        );
        if (giaPresente) return prev;
        return [
          {
            tipo: 'servizio' as const,
            servizio_id: checkup.id,
            prodotto_id: null,
            nome: checkup.nome,
            quantita: 1,
            durata_minuti: checkup.durata_minuti || 60,
          },
          ...prev,
        ];
      });
    }
  }, [tipo, servizi]);

  useEffect(() => {
    async function carica() {
      if (!data) return;
      try {
        const apps = await getAppuntamentiGiorno(data);
        setAppuntamentiGiorno(apps);
      } catch (err) {
        console.error('Errore caricamento appuntamenti giorno:', err);
      }
    }
    carica();
  }, [data]);

  // Auto-focus sul dropdown percorso quando si attiva il tab "Percorso"
  // e il percorso non è ancora stato selezionato
  useEffect(() => {
    if (tipo === 'percorso' && !percorsoId && percorsoSelectRef.current) {
      // Delay per assicurarsi che il DOM sia renderizzato
      const timer = setTimeout(() => {
        percorsoSelectRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [tipo, percorsoId]);

  useEffect(() => {
    if (tipo === 'percorso' && percorsoId) {
      const p = percorsiCliente.find((x) => x.id === percorsoId);
      if (p) setTitolo(p.nome);
    } else if (tipo === 'checkup_nuovo') {
      const checkup = trovaServizioCheckup(servizi);
      setTitolo(checkup ? checkup.nome : 'Righetti Check-Up Gratuito');
    } else if (tipo === 'seduta') {
      setTitolo('Seduta in Studio');
    } else if (tipo === 'generico') {
      setTitolo('Appuntamento');
    }
  }, [tipo, percorsoId, percorsiCliente, servizi]);

  const clienteSelezionato = clienti.find((c) => c.id === clienteId);

  // Normalizza accenti e minuscole per ricerca
  function normalizza(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  const clientiFiltrati = useMemo(() => {
    const q = normalizza(ricercaCliente);
    if (!q) return clienti;

    const parole = q.split(/\s+/);

    return clienti.filter((c) => {
      const nome = normalizza(c.nome_cognome || '');
      const cell = (c.cellulare || '').toLowerCase().replace(/\s/g, '');
      const email = (c.email || '').toLowerCase();

      const matchNome = parole.every((p) => nome.includes(p));
      const matchCell = cell.includes(q.replace(/\s/g, ''));
      const matchEmail = email.includes(q);

      return matchNome || matchCell || matchEmail;
    });
  }, [clienti, ricercaCliente]);

  const durataVoci = vociSelezionate.reduce((sum, v) => sum + (v.durata_minuti || 0), 0);
  const durataNum = durataVoci > 0 ? durataVoci : parseInt(durata, 10) || 60;
  const oraFine = calcolaOraFine(oraInizio, durataNum);
  const coloreFinale = colore || coloreDefault(tipo);

  const conflitti = useMemo(() => {
    if (loading) return [];
    const nuovo = { ora_inizio: oraInizio, durata_minuti: durataNum };
    return appuntamentiGiorno.filter((a) => {
      if (a.id === appuntamentoIniziale?.id) return false;
      if (a.operatore !== operatore) return false;
      if (a.stato === 'cancellato') return false;
      return siSovrappongono(nuovo, {
        ora_inizio: a.ora_inizio.slice(0, 5),
        durata_minuti: a.durata_minuti,
      });
    });
  }, [appuntamentiGiorno, operatore, oraInizio, durataNum, appuntamentoIniziale?.id, loading]);

  function toggleVoce(
    tipoVoce: 'servizio' | 'prodotto',
    id: number,
    nome: string,
    residuo: number,
    durataMinuti: number = 0
  ) {
    setVociSelezionate((prev) => {
      const chiave = tipoVoce === 'servizio' ? `S-${id}` : `P-${id}`;
      const esistente = prev.findIndex(
        (v) =>
          (v.tipo === 'servizio' ? `S-${v.servizio_id}` : `P-${v.prodotto_id}`) === chiave
      );
      if (esistente >= 0) {
        return prev.filter((_, i) => i !== esistente);
      }
      return [
        ...prev,
        {
          tipo: tipoVoce,
          servizio_id: tipoVoce === 'servizio' ? id : null,
          prodotto_id: tipoVoce === 'prodotto' ? id : null,
          nome,
          quantita: Math.min(1, residuo),
          durata_minuti: durataMinuti,
        },
      ];
    });
  }

  function getDurataServizio(srvId: number | null): number {
    if (!srvId) return 0;
    const s = servizi.find((x) => x.id === srvId);
    return s?.durata_minuti || 30;
  }

  function aggiornaQuantitaVoce(tipoVoce: 'servizio' | 'prodotto', id: number, quantita: number) {
    setVociSelezionate((prev) =>
      prev.map((v) => {
        const isMatch =
          (tipoVoce === 'servizio' && v.servizio_id === id) ||
          (tipoVoce === 'prodotto' && v.prodotto_id === id);
        if (isMatch) {
          return { ...v, quantita: Math.max(1, quantita) };
        }
        return v;
      })
    );
  }

  function isVoceSelezionata(tipoVoce: 'servizio' | 'prodotto', id: number): boolean {
    return vociSelezionate.some(
      (v) =>
        (tipoVoce === 'servizio' && v.servizio_id === id) ||
        (tipoVoce === 'prodotto' && v.prodotto_id === id)
    );
  }

  function getQuantitaVoce(tipoVoce: 'servizio' | 'prodotto', id: number): number {
    const v = vociSelezionate.find(
      (x) =>
        (tipoVoce === 'servizio' && x.servizio_id === id) ||
        (tipoVoce === 'prodotto' && x.prodotto_id === id)
    );
    return v?.quantita || 0;
  }

  function toggleSelezionePicker(s: Servizio) {
    setSelezionatiPicker((prev) => {
      const nuove = new Set(prev);
      if (nuove.has(s.id)) {
        nuove.delete(s.id);
      } else {
        nuove.add(s.id);
      }
      return nuove;
    });
  }

  function aggiungiServiziSelezionati() {
    if (selezionatiPicker.size === 0) return;
    const serviziDaAggiungere = servizi.filter((s) => selezionatiPicker.has(s.id));
    setVociSelezionate((prev) => {
      const nuoveVoci = [...prev];
      for (const s of serviziDaAggiungere) {
        if (nuoveVoci.find((v) => v.tipo === 'servizio' && v.servizio_id === s.id)) continue;
        nuoveVoci.push({
          tipo: 'servizio',
          servizio_id: s.id,
          prodotto_id: null,
          nome: s.nome,
          quantita: 1,
          durata_minuti: s.durata_minuti || 30,
        });
      }
      return nuoveVoci;
    });
    setShowPickerServizi(false);
    setSelezionatiPicker(new Set());
    setRicercaPickerServizi('');
  }

  function rimuoviVoce(tipoVoce: 'servizio' | 'prodotto', id: number) {
    setVociSelezionate((prev) =>
      prev.filter(
        (v) =>
          !(
            (tipoVoce === 'servizio' && v.servizio_id === id) ||
            (tipoVoce === 'prodotto' && v.prodotto_id === id)
          )
      )
    );
  }

  async function handleSubmit() {
    if (!clienteId) {
      setErrore('Seleziona un cliente');
      return;
    }
    if (!titolo.trim()) {
      setErrore('Inserisci un titolo');
      return;
    }
    if (!data || !oraInizio) {
      setErrore('Data e ora sono obbligatorie');
      return;
    }
    if (durataNum <= 0) {
      setErrore('La durata deve essere maggiore di 0');
      return;
    }

    const inizioMin = parseInt(oraInizio.split(':')[0], 10) * 60 + parseInt(oraInizio.split(':')[1], 10);
    const fineMin = inizioMin + durataNum;
    const inizioLavMin = 8 * 60 + 30;
    const fineLavMin = 19 * 60;
    if (inizioMin < inizioLavMin || fineMin > fineLavMin) {
      setErrore('L\'orario deve essere tra 08:30 e 19:00');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const dati = {
        cliente_id: clienteId,
        percorso_id: tipo === 'percorso' ? percorsoId : null,
        servizio_id: tipo === 'checkup_nuovo' ? (servizioCheckupId || (vociSelezionate[0]?.servizio_id ?? null)) : null,
        voci_selezionate: vociSelezionate,
        operatore,
        data,
        ora_inizio: oraInizio,
        durata_minuti: durataNum,
        titolo: titolo.trim(),
        tipo,
        colore: coloreFinale,
        note: note.trim() || null,
        stato,
      };

      if (modifica && appuntamentoIniziale) {
        await aggiornaAppuntamento(appuntamentoIniziale.id, dati);
      } else {
        await creaAppuntamento(dati);
        if (rebookingDaFissare && clienteId) {
          await chiudiRebookingCliente(clienteId);
        }
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-apple shadow-apple-lg p-8">
          <div className="text-apple-gray text-sm">Caricamento...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-2xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white text-xl shrink-0">
              📅
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                {modifica ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
              </h2>
              <p className="text-xs text-apple-gray">
                {new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}{' '}
                • {oraInizio}–{oraFine}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            {clienteSelezionato ? (
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-apple">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-apple-darkgray truncate">
                    {clienteSelezionato.nome_cognome}
                  </p>
                  {percorsiCliente.length > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-apple-blue border border-blue-200">
                      🎯 Percorso
                    </span>
                  )}
                  {clienteSelezionato.cellulare && (
                    <p className="text-xs text-apple-gray w-full">
                      {clienteSelezionato.cellulare}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setClienteId(null)}
                  className="text-xs text-apple-blue hover:underline font-medium shrink-0 ml-2"
                >
                  Cambia
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={ricercaCliente}
                  onChange={(e) => {
                    setRicercaCliente(e.target.value);
                    setShowListaClienti(true);
                  }}
                  onFocus={() => setShowListaClienti(true)}
                  placeholder="Cerca per nome, cellulare, email..."
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
                {showListaClienti && (
                  <div className="mt-2 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-apple shadow-apple">
                    {clientiFiltrati.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-apple-gray mb-3">
                          Nessun cliente trovato
                        </p>
                        {ricercaCliente.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowFormClienteRapido(true);
                            }}
                            className="px-4 py-2.5 bg-green-600 text-white rounded-apple font-medium text-xs hover:bg-green-700 transition-colors"
                          >
                            + Crea nuovo cliente
                          </button>
                        )}
                      </div>
                    ) : (
                      clientiFiltrati.slice(0, 100).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClienteId(c.id);
                            setRicercaCliente('');
                            setShowListaClienti(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                        >
                          <p className="text-sm font-medium text-apple-darkgray truncate">
                            {c.nome_cognome}
                          </p>
                          {c.cellulare && (
                            <p className="text-xs text-apple-gray">{c.cellulare}</p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Operatore <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {operatoriVisibili.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOperatore(op)}
                  className={`px-4 py-3 rounded-apple font-semibold text-sm transition-all text-left ${
                    operatore === op
                      ? op === 'luca'
                        ? 'bg-blue-600 text-white shadow-apple'
                        : 'bg-green-600 text-white shadow-apple'
                      : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                  }`}
                >
                  <p className="text-sm font-bold">{OPERATORI[op].label}</p>
                  <p
                    className={`text-xs mt-0.5 ${
                      operatore === op ? 'opacity-90' : 'opacity-70'
                    }`}
                  >
                    {OPERATORI[op].ruolo}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Tipo <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'percorso', label: '🎯 Percorso' },
                  { id: 'checkup_nuovo', label: '🆕 Nuovo' },
                  { id: 'seduta', label: '💆 Seduta in Studio' },
                  { id: 'generico', label: '📌 Generico' },
                ] as { id: TipoAppuntamento; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTipo(t.id);
                    if (t.id !== 'percorso') setPercorsoId(null);
                    if (t.id !== 'checkup_nuovo') {
                      setServizioId(null);
                      setVociSelezionate((prev) =>
                        prev.filter(
                          (v) =>
                            !(
                              v.tipo === 'servizio' &&
                              (v.servizio_id === servizioCheckupId || (v.nome || '').toLowerCase().includes('check'))
                            )
                        )
                      );
                    }
                    setTitolo('');
                    setColore('');
                  }}
                  className={`px-3 py-2 rounded-apple font-medium text-xs transition-colors ${
                    tipo === t.id
                      ? 'bg-apple-darkgray text-white'
                      : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tipo === 'percorso' && (
            <>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Percorso attivo del cliente
                </label>
                {!clienteId ? (
                  <p className="text-xs text-apple-gray bg-gray-50 rounded-apple p-3">
                    Seleziona prima un cliente
                  </p>
                ) : percorsiCliente.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-apple p-3">
                    ⚠️ Il cliente non ha percorsi attivi
                  </p>
                ) : (
                  <>
                    <select
                      ref={percorsoSelectRef}
                    value={percorsoId || ''}
                    onChange={(e) => {
                      setPercorsoId(Number(e.target.value) || null);
                      setVociSelezionate([]);
                      const p = percorsiCliente.find(
                        (x) => x.id === Number(e.target.value)
                      );
                      if (p) setTitolo(p.nome);
                    }}
                    className={`w-full px-4 py-3 bg-white border rounded-apple text-sm text-apple-darkgray focus:outline-none transition-all ${
                      percorsoId === null
                        ? 'border-red-500 ring-2 ring-red-300/60 animate-pulse shadow-md'
                        : 'border-gray-200 focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue'
                    }`}
                  >
                    <option value="">
                      {percorsoId === null ? '👆 Seleziona un percorso...' : '— Seleziona percorso —'}
                    </option>
                    {percorsiCliente.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {formatEuro(p.totale_finale)}
                      </option>
                    ))}
                    </select>
                    {percorsoId === null && (
                      <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                        ⚠️ Seleziona un percorso per procedere
                      </p>
                    )}
                  </>
                )}
              </div>

              {residuoPercorso && (
                <div>
                  <label className="block text-xs font-medium text-apple-gray mb-1.5">
                    🎯 Voci da usare in questa seduta
                  </label>
                  <div className="bg-gray-50 rounded-apple overflow-hidden max-h-72 overflow-y-auto">
                    <div className="divide-y divide-gray-200">
                      {residuoPercorso.righe_residue
                        .filter((r) => r.tipo === 'servizio')
                        .map((r) => {
                          const id = r.servizio_id || r.prodotto_id || 0;
                          const selezione = isVoceSelezionata(r.tipo, id);
                          const completata = r.quantita_residua <= 0;
                          const quantitaAttuale = getQuantitaVoce(r.tipo, id);
                          return (
                            <div
                              key={`${r.tipo}-${id}`}
                              className={`flex items-center gap-3 px-3 py-2.5 ${
                                completata ? 'opacity-50' : ''
                              } ${selezione ? 'bg-blue-50' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={selezione}
                                disabled={completata}
                                onChange={() =>
                                  toggleVoce(
                                    r.tipo,
                                    id,
                                    r.nome,
                                    r.quantita_residua,
                                    r.tipo === 'servizio' ? getDurataServizio(r.servizio_id) : 5
                                  )
                                }
                                className="w-4 h-4 shrink-0 accent-apple-blue"
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm truncate ${
                                    completata
                                      ? 'text-apple-gray line-through'
                                      : 'text-apple-darkgray'
                                  }`}
                                >
                                  🛠️ {r.nome}
                                </p>
                                <p className="text-xs text-apple-gray">
                                  Residuo: {r.quantita_residua} / {r.quantita_totale}
                                </p>
                              </div>
                              {selezione && !completata && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      aggiornaQuantitaVoce(
                                        r.tipo,
                                        id,
                                        quantitaAttuale - 1
                                      )
                                    }
                                    className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-apple-darkgray font-bold text-xs"
                                  >
                                    −
                                  </button>
                                  <span className="w-8 text-center text-sm font-semibold text-apple-darkgray">
                                    {quantitaAttuale}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      aggiornaQuantitaVoce(
                                        r.tipo,
                                        id,
                                        Math.min(quantitaAttuale + 1, r.quantita_residua)
                                      )
                                    }
                                    disabled={quantitaAttuale >= r.quantita_residua}
                                    className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-apple-darkgray font-bold text-xs disabled:opacity-40"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-apple-gray">
                {tipo === 'checkup_nuovo'
                  ? 'Servizio Check-up & Altri Servizi Aggiuntivi'
                  : "Servizi dell'appuntamento"}
              </label>
              <button
                type="button"
                onClick={() => setShowPickerServizi(true)}
                className="text-xs text-apple-blue hover:underline font-semibold"
              >
                + Aggiungi altro servizio
              </button>
            </div>

            {vociSelezionate.length > 0 ? (
              <div className="bg-gray-50 rounded-apple overflow-hidden mb-2 border border-gray-200/80">
                <div className="divide-y divide-gray-200">
                  {vociSelezionate.map((v) => {
                    const id = v.servizio_id || v.prodotto_id || 0;
                    const isCheckup = (v.nome || '').toLowerCase().includes('check');
                    return (
                      <div
                        key={`${v.tipo}-${id}`}
                        className="flex items-center gap-3 px-3 py-2.5 bg-white"
                      >
                        <span className="text-lg shrink-0">
                          {v.tipo === 'servizio' ? '🛠️' : '📦'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-apple-darkgray truncate">
                              {v.nome}
                            </p>
                            {isCheckup && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">
                                100% Sconto (0€)
                              </span>
                            )}
                          </div>
                          {v.durata_minuti && (
                            <p className="text-xs text-apple-gray">
                              ⏱️ {v.durata_minuti * v.quantita} min
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => rimuoviVoce(v.tipo, id)}
                          className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 text-xs shrink-0"
                          title="Rimuovi"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPickerServizi(true)}
                className="w-full px-4 py-3 bg-blue-50/60 border border-dashed border-blue-200 text-apple-blue rounded-apple font-medium text-xs hover:bg-blue-100/60 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>+</span>
                <span>Seleziona servizi</span>
              </button>
            )}

            {vociSelezionate.length > 0 && (
              <p className="text-xs text-apple-gray mt-1.5">
                ⏱️ Durata totale calcolata: <strong className="text-apple-darkgray">{durataNum} min</strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Ora inizio <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                step={900}
                min={ORA_INIZIO_LAVORO}
                max={ORA_FINE_LAVORO}
                value={oraInizio}
                onChange={(e) => setOraInizio(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Durata (min)
              </label>
              <input
                type="number"
                step="15"
                min="15"
                value={durata}
                onChange={(e) => setDurata(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Titolo Appuntamento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Es. Seduta percorso, Check-up, Consulenza..."
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
            />
          </div>

          {stato !== 'cancellato' && stato !== 'completato' && (
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Stato
              </label>
              <button
                type="button"
                onClick={() => setStato(stato === 'pending' ? 'confermato' : 'pending')}
                className={`w-full px-4 py-3 rounded-apple font-medium text-sm transition-all text-left flex items-center justify-between ${
                  stato === 'pending'
                    ? 'bg-amber-50 border-2 border-amber-400 text-amber-800'
                    : 'bg-green-50 border-2 border-green-400 text-green-800'
                }`}
              >
                <span>
                  {stato === 'pending'
                    ? '⏳ Pending (in attesa di conferma)'
                    : '✓ Confermato dal cliente'}
                </span>
                <span className="text-xs opacity-70">
                  Clicca per {stato === 'pending' ? 'confermare' : 'tornare a pending'}
                </span>
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Note (opzionali)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note sull'appuntamento..."
              rows={2}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue resize-none"
            />
          </div>

          {conflitti.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-apple p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">
                ⚠️ Sovrapposizione con {conflitti.length} appuntamento/i
              </p>
              {conflitti.map((c) => (
                <p key={c.id} className="text-xs text-amber-700">
                  • {c.cliente?.nome_cognome} ({c.ora_inizio.slice(0, 5)}–
                  {calcolaOraFine(c.ora_inizio.slice(0, 5), c.durata_minuti)})
                </p>
              ))}
            </div>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={salvando || !clienteId || !titolo.trim()}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : modifica ? 'Salva Modifiche' : 'Crea Appuntamento'}
          </button>
        </div>
      </div>

      {showFormClienteRapido && (
        <FormNuovoClienteRapido
          nomeIniziale={ricercaCliente.trim()}
          onClose={() => setShowFormClienteRapido(false)}
          onSuccess={async (nuovoCliente) => {
            setShowFormClienteRapido(false);
            setShowListaClienti(false);
            setRicercaCliente('');
            await ricaricaClienti();
            setClienteId(nuovoCliente.id);
          }}
        />
      )}

      {showPickerServizi && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
          onClick={() => {
            setShowPickerServizi(false);
            setSelezionatiPicker(new Set());
            setRicercaPickerServizi('');
          }}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-md w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-apple-darkgray">
                  Aggiungi servizi all'appuntamento
                </h3>
                <button
                  onClick={() => {
                    setShowPickerServizi(false);
                    setSelezionatiPicker(new Set());
                    setRicercaPickerServizi('');
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                value={ricercaPickerServizi}
                onChange={(e) => setRicercaPickerServizi(e.target.value)}
                placeholder="Cerca servizio..."
                autoFocus
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {(() => {
                const filtrati = servizi.filter(
                  (s) =>
                    s.nome.toLowerCase().includes(ricercaPickerServizi.toLowerCase()) &&
                    !vociSelezionate.find((v) => v.servizio_id === s.id)
                );

                if (filtrati.length === 0) {
                  return (
                    <p className="px-5 py-8 text-center text-sm text-apple-gray">
                      Nessun servizio disponibile
                    </p>
                  );
                }

                return filtrati.map((s) => {
                  const isSelezionato = selezionatiPicker.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSelezionePicker(s)}
                      className={`w-full px-5 py-3 flex items-center gap-3 transition-colors text-left ${
                        isSelezionato ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelezionato ? 'bg-apple-blue border-apple-blue' : 'border-gray-300'
                        }`}
                      >
                        {isSelezionato && (
                          <span className="text-white text-xs font-bold">✓</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-apple-darkgray truncate">
                          {s.nome}
                        </p>
                        <p className="text-xs text-apple-gray">
                          ⏱️ {s.durata_minuti} min • {formatEuro(s.prezzo_lordo)}
                        </p>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            <div className="px-5 py-4 border-t border-gray-200/60 bg-gray-50/50 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPickerServizi(false);
                  setSelezionatiPicker(new Set());
                  setRicercaPickerServizi('');
                }}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={aggiungiServiziSelezionati}
                disabled={selezionatiPicker.size === 0}
                className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selezionatiPicker.size === 0
                  ? 'Seleziona almeno 1'
                  : `Aggiungi ${selezionatiPicker.size} servizi`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
