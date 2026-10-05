import { useEffect, useMemo, useRef, useState } from 'react';
import { useAgendaConfig } from '../lib/useAgendaConfig';
import { Rnd } from 'react-rnd';
import {
  OPERATORI,
  COLORI_APPUNTAMENTO,
  coloreDefault,
  getOperatoriVisibili,
  oraToMinuti,
  minutiToOra,
  type AppuntamentoConCliente,
  type Operatore,
  type VoceSelezionata,
} from '../lib/appuntamenti';
import { getFasceDaDataISO, type Fascia } from '../lib/agenda-config';

interface AgendaGiornalieraProps {
  data: string;
  appuntamenti: AppuntamentoConCliente[];
  raggruppaSeduta?: boolean;
  onClickAppuntamento: (app: AppuntamentoConCliente) => void;
  onClickSlot: (operatore: Operatore, ora: string) => void;
  onUpdateAppuntamento: (
    id: number,
    updates: {
      ora_inizio?: string;
      durata_minuti?: number;
      operatore?: Operatore;
      voci_selezionate?: VoceSelezionata[];
    }
  ) => void;
  highlightAppuntamentoId?: number | null;
}

const LARGHEZZA_COLONNA_ORA = 55;

const COLORI_DOT: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  gray: 'bg-gray-500',
};

interface BloccoCalcolato {
  app: AppuntamentoConCliente;
  voceIndex: number | null;
  voce: VoceSelezionata | null;
  top: number;
  height: number;
  oraInizio: string;
  oraFine: string;
  isFirst: boolean;
  colIndex?: number;
  totalCols?: number;
}

export function AgendaGiornaliera({
  data,
  appuntamenti,
  raggruppaSeduta = false,
  onClickAppuntamento,
  onClickSlot,
  onUpdateAppuntamento,
  highlightAppuntamentoId,
}: AgendaGiornalieraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [larghezzaColonna, setLarghezzaColonna] = useState(400);

  const { config: agendaConfig } = useAgendaConfig();
  const [nota, setNota] = useState<string | null>(null);

  // Helper: cerca info operatore nella config (fallback su OPERATORI hardcoded)
  const getOpInfo = (opId: string): { label: string; colore: string } => {
    const fromConfig = agendaConfig.operatori?.find((o) => o.id === opId);
    if (fromConfig) {
      return { label: fromConfig.label, colore: fromConfig.colore || 'blue' };
    }
    const fromCost = OPERATORI[opId];
    if (fromCost) {
      return { label: fromCost.label, colore: fromCost.colore || 'blue' };
    }
    return { label: opId, colore: 'blue' };
  };

  const operatoriVisibili = useMemo(() => {
    const config = getOperatoriVisibili();
    // Aggiungi operatori "orfani" (presenti negli appuntamenti ma non in config)
    // Serve per non perdere appuntamenti quando un utente rinomina un operatore
    const idOrfani = new Set<string>();
    for (const app of appuntamenti) {
      if (app.operatore && !config.includes(app.operatore)) {
        idOrfani.add(app.operatore);
      }
      for (const v of app.voci_selezionate || []) {
        if (v.operatore && !config.includes(v.operatore)) {
          idOrfani.add(v.operatore);
        }
      }
    }
    return [...config, ...Array.from(idOrfani)];
  }, [agendaConfig.operatoriVisibili, agendaConfig.operatori, appuntamenti]);
  const colonneCount = operatoriVisibili.length;

  const [altezzaDisponibile, setAltezzaDisponibile] = useState(600);

  useEffect(() => {
    function calcola() {
      const h = window.innerHeight - 260;
      setAltezzaDisponibile(Math.max(400, h));
    }
    calcola();
    window.addEventListener('resize', calcola);
    return () => window.removeEventListener('resize', calcola);
  }, []);

  const slots = useMemo(() => {
    const lista: string[] = [];
    const inizio = oraToMinuti(agendaConfig.oraApertura);
    const fine = oraToMinuti(agendaConfig.oraChiusura);
    for (let m = inizio; m < fine; m += agendaConfig.granularitaMinuti) {
      lista.push(minutiToOra(m));
    }
    return lista;
  }, [agendaConfig.oraApertura, agendaConfig.oraChiusura, agendaConfig.granularitaMinuti]);

  // Fasce del giorno corrente (dal config orariGiorni)
  const fasceOggi = useMemo(() => {
    return getFasceDaDataISO(agendaConfig, data);
  }, [agendaConfig, data]);

  const altezzaSlot = useMemo(() => {
    if (slots.length === 0) return 22;
    // Su mobile (< 768px): slot da 28px per dare aria e leggibilita (30 min = 56px)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) return 28;
    const calcolata = Math.floor(altezzaDisponibile / slots.length);
    return Math.max(18, Math.min(45, calcolata));
  }, [slots.length, altezzaDisponibile]);

  const pxPerMinuto = altezzaSlot / agendaConfig.granularitaMinuti;

  const [conferma, setConferma] = useState<{
    app: AppuntamentoConCliente;
    voceIndex: number | null;
    tipo: 'sposta' | 'resize' | 'cambia-operatore';
    nuovaOra?: string;
    nuovaDurata?: number;
    nuovoOperatore?: Operatore;
    messaggio: string;
  } | null>(null);

  // Modale avviso click su cella chiusa
  const [avvisoFuoriOrario, setAvvisoFuoriOrario] = useState<{
    operatore: Operatore;
    ora: string;
    motivo: string;
  } | null>(null);

  // Info "fuori orario" per blocco corrente
  function bloccoFuoriOrario(oraInizio: string, oraFine: string): boolean {
    if (!fasceOggi || fasceOggi.length === 0) return false;
    // Se l'inizio O la fine cadono fuori da ogni fascia
    const dentroInizio = fasceOggi.some((f) => oraInizio >= f.inizio && oraInizio < f.fine);
    const dentroFine = fasceOggi.some((f) => oraFine > f.inizio && oraFine <= f.fine);
    return !dentroInizio || !dentroFine;
  }

  useEffect(() => {
    if (!colRef.current) return;
    const update = () => {
      if (colRef.current) {
        setLarghezzaColonna(colRef.current.offsetWidth);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(colRef.current);
    return () => ro.disconnect();
  }, [colonneCount]);

  const blocchiPerOperatore = useMemo(() => {
    const mappa: Record<string, BloccoCalcolato[]> = {};
    for (const op of operatoriVisibili) {
      mappa[op] = [];
    }

    const inizioGiornata = oraToMinuti(agendaConfig.oraApertura);

    for (const app of appuntamenti) {
      if (
        app.stato === 'cancellato' &&
        app.motivo_cancellazione !== 'rebooking' &&
        app.motivo_cancellazione !== 'spostamento'
      ) continue;

      const voci = app.voci_selezionate || [];

      // Calcolo reale dinamico della seduta basato sui singoli servizi
      if (raggruppaSeduta || voci.length === 0) {
        let minInizioMin = oraToMinuti(app.ora_inizio.slice(0, 5));
        let maxFineMin = minInizioMin + (app.durata_minuti || 60);

        if (voci.length > 0) {
          // Calcola l'inizio del primo servizio e la fine dell'ultimo servizio reale
          let minutoCorrente = minInizioMin;
          const inizi: number[] = [];
          const fini: number[] = [];

          for (const v of voci) {
            const vIni = v.ora_inizio ? oraToMinuti(v.ora_inizio) : minutoCorrente;
            const vDur = v.durata_minuti || 30;
            inizi.push(vIni);
            fini.push(vIni + vDur);
            minutoCorrente = vIni + vDur;
          }

          minInizioMin = Math.min(...inizi);
          maxFineMin = Math.max(...fini);
        }

        const durataEffettiva = Math.max(15, maxFineMin - minInizioMin);
        const top = (minInizioMin - inizioGiornata) * pxPerMinuto;
        const height = durataEffettiva * pxPerMinuto;
        const opDest = app.operatore;

        if (!mappa[opDest]) mappa[opDest] = [];
        mappa[opDest].push({
          app,
          voceIndex: null,
          voce: voci.length > 0 ? {
            tipo: 'servizio',
            servizio_id: null,
            prodotto_id: null,
            nome: voci.map(v => v.nome).join(' + '),
            quantita: 1,
            durata_minuti: durataEffettiva,
          } : null,
          top,
          height,
          oraInizio: minutiToOra(minInizioMin),
          oraFine: minutiToOra(maxFineMin),
          isFirst: true,
        });
      } else {
        let minutoCorrente = oraToMinuti(app.ora_inizio.slice(0, 5));
        for (let i = 0; i < voci.length; i++) {
          const voce = voci[i];
          const durata = voce.durata_minuti || 30;
          const inizioVoce = voce.ora_inizio
            ? oraToMinuti(voce.ora_inizio)
            : minutoCorrente;
          const top = (inizioVoce - inizioGiornata) * pxPerMinuto;
          const height = durata * pxPerMinuto;
          const operatoreVoce = voce.operatore || app.operatore;
          if (!mappa[operatoreVoce]) mappa[operatoreVoce] = [];
          mappa[operatoreVoce].push({
            app,
            voceIndex: i,
            voce,
            top,
            height,
            oraInizio: minutiToOra(inizioVoce),
            oraFine: minutiToOra(inizioVoce + durata),
            isFirst: i === 0,
          });
          minutoCorrente = inizioVoce + durata;
        }
      }
    }

    // ⚡ Algoritmo Multi-Colonna per blocchi sovrapposti
    for (const op of operatoriVisibili) {
      const lista = mappa[op] || [];
      if (lista.length <= 1) {
        lista.forEach(b => { b.colIndex = 0; b.totalCols = 1; });
        continue;
      }

      // Convertiamo gli orari in minuti numerici
      const items = lista.map((b, idx) => ({
        b,
        start: oraToMinuti(b.oraInizio),
        end: oraToMinuti(b.oraFine),
        idx
      })).sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

      // Raggruppamento in cluster di eventi che si toccano/sovrappongono
      const clusters: (typeof items)[] = [];
      let currentCluster: typeof items = [];
      let clusterEnd = -1;

      for (const it of items) {
        if (currentCluster.length === 0) {
          currentCluster.push(it);
          clusterEnd = it.end;
        } else if (it.start < clusterEnd) {
          currentCluster.push(it);
          clusterEnd = Math.max(clusterEnd, it.end);
        } else {
          clusters.push(currentCluster);
          currentCluster = [it];
          clusterEnd = it.end;
        }
      }
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      // Per ciascun cluster, assegniamo la colonna disponibile (greedy coloring)
      for (const cluster of clusters) {
        const columns: number[] = []; // Tiene traccia della fine minuto per corsia
        for (const it of cluster) {
          let assignedCol = -1;
          for (let c = 0; c < columns.length; c++) {
            if (columns[c] <= it.start) {
              assignedCol = c;
              columns[c] = it.end;
              break;
            }
          }
          if (assignedCol === -1) {
            assignedCol = columns.length;
            columns.push(it.end);
          }
          it.b.colIndex = assignedCol;
        }
        const total = Math.max(1, columns.length);
        for (const it of cluster) {
          it.b.totalCols = total;
        }
      }
    }

    return mappa;
  }, [appuntamenti, agendaConfig.oraApertura, pxPerMinuto, operatoriVisibili, raggruppaSeduta]);

  function handleDragStop(
    app: AppuntamentoConCliente,
    voceIndex: number | null,
    bloccoTop: number,
    nuovaY: number,
    nuovaX: number
  ) {
    const sogliaPixel = 8;
    if (Math.abs(nuovaY) < sogliaPixel && Math.abs(nuovaX) < sogliaPixel) return;

    isDraggingRef.current = true;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 300);

    const inizioGiornata = oraToMinuti(agendaConfig.oraApertura);
    const nuovoTop = bloccoTop + nuovaY;
    const minutoAssoluto = inizioGiornata + Math.round(nuovoTop / pxPerMinuto);
    const minutoSnap =
      Math.round(minutoAssoluto / agendaConfig.granularitaMinuti) *
      agendaConfig.granularitaMinuti;
    const oraInizio = minutiToOra(minutoSnap);

    const operatoreAttuale =
      voceIndex !== null
        ? app.voci_selezionate?.[voceIndex]?.operatore || app.operatore
        : app.operatore;

    // Calcolo dinamico colonna di arrivo
    const currentIdx = operatoriVisibili.indexOf(operatoreAttuale);
    const colDiff = Math.round(nuovaX / larghezzaColonna);
    const targetIdx = currentIdx + colDiff;

    let nuovoOperatore: Operatore = operatoreAttuale;
    if (targetIdx >= 0 && targetIdx < operatoriVisibili.length) {
      nuovoOperatore = operatoriVisibili[targetIdx];
    }

    const cambiaOperatore = nuovoOperatore !== operatoreAttuale;

    if (cambiaOperatore) {
      const nuovoNome = getOpInfo(nuovoOperatore).label;
      const msg =
        voceIndex === null
          ? `Spostare l'appuntamento su ${nuovoNome} alle ${oraInizio}?`
          : `Spostare questa voce su ${nuovoNome} alle ${oraInizio}?`;
      setConferma({
        app,
        voceIndex,
        tipo: 'cambia-operatore',
        nuovaOra: oraInizio,
        nuovoOperatore,
        messaggio: msg,
      });
    } else if (voceIndex === null) {
      setConferma({
        app,
        voceIndex,
        tipo: 'sposta',
        nuovaOra: oraInizio,
        messaggio: `Spostare l'appuntamento alle ${oraInizio}?`,
      });
    } else {
      setConferma({
        app,
        voceIndex,
        tipo: 'sposta',
        nuovaOra: oraInizio,
        messaggio: `Spostare la voce alle ${oraInizio}?`,
      });
    }
  }

  function handleResizeStop(
    app: AppuntamentoConCliente,
    voceIndex: number | null,
    nuovaHeight: number
  ) {
    isDraggingRef.current = true;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 300);

    const minutiTotali = Math.round(nuovaHeight / pxPerMinuto);
    const minutiSnap = Math.max(
      agendaConfig.granularitaMinuti,
      Math.round(minutiTotali / agendaConfig.granularitaMinuti) *
        agendaConfig.granularitaMinuti
    );

    setConferma({
      app,
      voceIndex,
      tipo: 'resize',
      nuovaDurata: minutiSnap,
      messaggio: `Confermare durata ${minutiSnap} min?`,
    });
  }

  function eseguiConferma() {
    if (!conferma) return;
    const { app, voceIndex, tipo, nuovaOra, nuovaDurata, nuovoOperatore } = conferma;

    if (tipo === 'cambia-operatore' && nuovoOperatore) {
      if (voceIndex === null) {
        // Ricalcola orari sequenziali per tutte le voci con il nuovo operatore
        let minutoProg = nuovaOra ? oraToMinuti(nuovaOra) : oraToMinuti(app.ora_inizio.slice(0, 5));
        const vociRicalcolate = (app.voci_selezionate || []).map(v => {
          const h = Math.floor(minutoProg / 60);
          const m = minutoProg % 60;
          const oraVoce = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          minutoProg += (v.durata_minuti || 30);
          return {
            ...v,
            operatore: nuovoOperatore,
            ora_inizio: oraVoce,
          };
        });

        onUpdateAppuntamento(app.id, {
          operatore: nuovoOperatore,
          ora_inizio: nuovaOra || app.ora_inizio,
          voci_selezionate: vociRicalcolate,
        });
      } else {
        const vociAggiornate = [...(app.voci_selezionate || [])];
        vociAggiornate[voceIndex] = {
          ...vociAggiornate[voceIndex],
          ora_inizio: nuovaOra,
          operatore: nuovoOperatore,
        };

        // Se sposti la prima voce (o se tutte le voci vanno allineate), aggiorna anche le colonne madri
        const updates = {
          voci_selezionate: vociAggiornate,
          operatore: voceIndex === 0 ? nuovoOperatore : app.operatore,
          ora_inizio: voceIndex === 0 && nuovaOra ? nuovaOra : app.ora_inizio,
        };
        onUpdateAppuntamento(app.id, updates);
      }
      setNota(`Spostato su ${getOpInfo(nuovoOperatore).label} ✅`);
    } else if (tipo === 'sposta' && nuovaOra) {
      if (voceIndex === null) {
        // Ricalcola orari sequenziali per tutte le voci mantenendo l'operatore
        let minutoProg = oraToMinuti(nuovaOra);
        const vociRicalcolate = (app.voci_selezionate || []).map(v => {
          const h = Math.floor(minutoProg / 60);
          const m = minutoProg % 60;
          const oraVoce = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          minutoProg += (v.durata_minuti || 30);
          return {
            ...v,
            ora_inizio: oraVoce,
          };
        });

        onUpdateAppuntamento(app.id, {
          ora_inizio: nuovaOra,
          voci_selezionate: vociRicalcolate,
        });
        setNota(`Spostato alle ${nuovaOra} ✅`);
      } else {
        const vociAggiornate = [...(app.voci_selezionate || [])];
        vociAggiornate[voceIndex] = { ...vociAggiornate[voceIndex], ora_inizio: nuovaOra };

        // Trova l'orario della prima voce per aggiornare la colonna madre ora_inizio
        const primaOra = vociAggiornate[0]?.ora_inizio || nuovaOra;

        const updates = {
          voci_selezionate: vociAggiornate,
          ora_inizio: primaOra,
        };
        onUpdateAppuntamento(app.id, updates);
        setNota(`Voce spostata alle ${nuovaOra} ✅`);
      }
    } else if (tipo === 'resize' && nuovaDurata) {
      if (voceIndex === null) {
        onUpdateAppuntamento(app.id, { durata_minuti: nuovaDurata });
        setNota(`Durata: ${nuovaDurata} min ✅`);
      } else {
        const vociAggiornate = [...(app.voci_selezionate || [])];
        vociAggiornate[voceIndex] = {
          ...vociAggiornate[voceIndex],
          durata_minuti: nuovaDurata,
        };

        // Ricalcola la durata complessiva reale della seduta
        let minInizio = oraToMinuti(app.ora_inizio.slice(0, 5));
        let maxFine = minInizio;
        let prog = minInizio;
        for (const v of vociAggiornate) {
          const vIni = v.ora_inizio ? oraToMinuti(v.ora_inizio) : prog;
          const vDur = v.durata_minuti || 30;
          maxFine = Math.max(maxFine, vIni + vDur);
          prog = vIni + vDur;
        }

        onUpdateAppuntamento(app.id, {
          voci_selezionate: vociAggiornate,
          durata_minuti: Math.max(15, maxFine - minInizio),
        });
        setNota(`Durata voce: ${nuovaDurata} min ✅`);
      }
    }

    setConferma(null);
    setTimeout(() => setNota(null), 2500);
  }

  function formattaData(dataISO: string): string {
    const d = new Date(dataISO + 'T00:00:00');
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const altezzaTotale = slots.length * altezzaSlot;

  return (
    <div className="bg-white rounded-apple shadow-apple overflow-hidden select-none flex flex-col">
      <div className="px-4 py-2 border-b border-gray-200/60 bg-gray-50/50 flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold text-apple-darkgray capitalize">
          {formattaData(data)}
        </h2>
        {nota && (
          <span className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full animate-pulse">
            {nota}
          </span>
        )}
      </div>

      <div
        className="border-b border-gray-200/60 shrink-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `${LARGHEZZA_COLONNA_ORA}px repeat(${colonneCount}, 1fr)`,
        }}
      >
        <div className="bg-gray-50/50 border-r border-gray-200/60"></div>
        {operatoriVisibili.map((op) => {
          const info = getOpInfo(op);
          const dotColor = COLORI_DOT[info.colore] || 'bg-blue-500';
          return (
            <div
              key={op}
              className="px-3 py-1.5 border-r border-gray-200/60 last:border-r-0 bg-gray-50/50"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                <p className="text-xs font-semibold text-apple-darkgray truncate">
                  {info.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {conferma && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
          onClick={() => setConferma(null)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                {conferma.tipo === 'resize' ? '↕️' : conferma.tipo === 'cambia-operatore' ? '👥' : '📅'}
              </div>
              <p className="text-base font-bold text-apple-darkgray mb-1">
                {conferma.messaggio}
              </p>
              <p className="text-xs text-apple-gray">
                {conferma.tipo === 'cambia-operatore' && 'Confermi il cambio operatore?'}
                {conferma.tipo === 'sposta' && 'Confermi lo spostamento?'}
                {conferma.tipo === 'resize' && 'Confermi la nuova durata?'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConferma(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={eseguiConferma}
                className="flex-1 px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${LARGHEZZA_COLONNA_ORA}px repeat(${colonneCount}, 1fr)`,
            height: `${altezzaTotale}px`,
          }}
        >
          <div className="border-r border-gray-200/60 bg-gray-50/30 relative">
            {slots.map((slot) => {
              const isOraPiena = slot.endsWith(':00');
              return (
                <div
                  key={slot}
                  style={{ height: `${altezzaSlot}px` }}
                  className="relative flex items-start justify-end pr-1.5"
                >
                  {isOraPiena && (
                    <span
                      className="text-[10px] text-apple-gray leading-none"
                      style={{ marginTop: '-4px' }}
                    >
                      {slot}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {operatoriVisibili.map((op, idx) => (
            <div
              key={op}
              ref={idx === 0 ? colRef : undefined}
              className={`relative ${
                idx < colonneCount - 1 ? 'border-r border-gray-200/60' : ''
              }`}
            >
              <SfondoColonna
                operatore={op}
                slots={slots}
                onClickSlot={(operatore, ora) => {
                  // Se cella chiusa → apri modale avviso
                  if (fasceOggi && fasceOggi.length > 0) {
                    const dentro = fasceOggi.some((f) => ora >= f.inizio && ora < f.fine);
                    if (!dentro) {
                      setAvvisoFuoriOrario({ operatore, ora, motivo: '' });
                      return;
                    }
                  }
                  onClickSlot(operatore, ora);
                }}
                altezzaSlot={altezzaSlot}
                fasceGiorno={fasceOggi}
                slotMinuti={agendaConfig.granularitaMinuti}
              />
              {(blocchiPerOperatore[op] || []).map((b, i) => (
                <BloccoRnd
                  key={`${b.app.id}-${b.voceIndex ?? 'single'}-${b.app.operatore}-${b.app.ora_inizio}-${i}`}
                  blocco={b}
                  containerRef={containerRef}
                  larghezzaColonna={larghezzaColonna}
                  isDraggingRef={isDraggingRef}
                  altezzaSlot={altezzaSlot}
                  pxPerMinuto={pxPerMinuto}
                  slotMinuti={agendaConfig.granularitaMinuti}
                  onClick={() => onClickAppuntamento(b.app)}
                  onDragStop={(deltaY, deltaX) =>
                    handleDragStop(b.app, b.voceIndex, b.top, deltaY, deltaX)
                  }
                  onResizeStop={(h) => handleResizeStop(b.app, b.voceIndex, h)}
                  isHighlighted={highlightAppuntamentoId === b.app.id}
                  fuoriOrario={bloccoFuoriOrario(b.oraInizio, b.oraFine)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modale avviso: creazione appuntamento fuori orario */}
      {avvisoFuoriOrario && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[95]"
          onClick={() => setAvvisoFuoriOrario(null)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-apple-darkgray mb-2">
                Fuori orario di apertura
              </h3>
              <p className="text-xs text-apple-gray leading-relaxed">
                Stai creando un appuntamento alle <strong>{avvisoFuoriOrario.ora}</strong> di un
                orario fuori dalle fasce configurate.
                {fasceOggi && fasceOggi.length > 0 && (
                  <>
                    <br />
                    <span className="text-[11px]">
                      Orari di oggi:{' '}
                      <strong>{fasceOggi.map((f) => `${f.inizio}-${f.fine}`).join(' · ')}</strong>
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                Motivo (facoltativo)
              </label>
              <textarea
                value={avvisoFuoriOrario.motivo}
                onChange={(e) =>
                  setAvvisoFuoriOrario({ ...avvisoFuoriOrario, motivo: e.target.value })
                }
                placeholder="Es. cliente in ritardo, urgenza, straordinario..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setAvvisoFuoriOrario(null)}
                className="flex-1 px-4 py-2.5 rounded-apple bg-gray-100 text-apple-darkgray text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  const { operatore, ora, motivo } = avvisoFuoriOrario;
                  // Salva il motivo in localStorage per il form (opzionale, il form lo può leggere)
                  if (motivo.trim()) {
                    try {
                      localStorage.setItem('cassa_motivo_fuori_orario', motivo.trim());
                    } catch {}
                  }
                  setAvvisoFuoriOrario(null);
                  onClickSlot(operatore, ora);
                }}
                className="flex-1 px-4 py-2.5 rounded-apple bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors shadow-apple"
              >
                Procedi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SfondoColonna({
  operatore,
  slots,
  onClickSlot,
  altezzaSlot,
  fasceGiorno,
  slotMinuti,
}: {
  operatore: Operatore;
  slots: string[];
  onClickSlot: (operatore: Operatore, ora: string) => void;
  altezzaSlot: number;
  fasceGiorno?: Fascia[];
  slotMinuti?: number;
}) {
  // Ritorna true se lo slot è DENTRO una fascia aperta
  function isSlotAperto(slot: string): boolean {
    if (!fasceGiorno || fasceGiorno.length === 0) return true; // nessuna config → tutto aperto
    return fasceGiorno.some((f) => slot >= f.inizio && slot < f.fine);
  }

  // Ritorna info del blocco "Chiuso" se lo slot è il PRIMO di un gruppo chiuso
  function infoBloccoChiuso(index: number): { durata: string } | null {
    if (!fasceGiorno || fasceGiorno.length === 0) return null;
    if (isSlotAperto(slots[index])) return null;
    // Se lo slot precedente era chiuso → non sono il primo, non metto label
    if (index > 0 && !isSlotAperto(slots[index - 1])) return null;
    // Conto quanti slot consecutivi sono chiusi
    let count = 0;
    for (let i = index; i < slots.length; i++) {
      if (isSlotAperto(slots[i])) break;
      count++;
    }
    const minuti = count * (slotMinuti || 15);
    const h = Math.floor(minuti / 60);
    const m = minuti % 60;
    const durata = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
    return { durata };
  }

  return (
    <>
      {slots.map((slot, index) => {
        const aperto = isSlotAperto(slot);
        const bloccoChiuso = infoBloccoChiuso(index);
        return (
          <button
            key={`${operatore}-${slot}`}
            type="button"
            onClick={() => onClickSlot(operatore, slot)}
            style={{ height: `${altezzaSlot}px` }}
            className={`w-full block border-b transition-colors relative ${
              aperto
                ? slot.endsWith(':00')
                  ? 'border-gray-200/60 hover:bg-blue-50/60'
                  : 'border-gray-100 hover:bg-blue-50/60'
                : 'bg-gray-100 border-gray-100 hover:bg-gray-200/70'
            }`}
            aria-label={`${aperto ? 'Aggiungi appuntamento' : 'Slot chiuso (fuori orario)'} ${operatore} alle ${slot}`}
          >
            {bloccoChiuso && (
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap pointer-events-none">
                Chiuso {bloccoChiuso.durata}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

interface BloccoRndProps {
  blocco: BloccoCalcolato;
  containerRef: React.RefObject<HTMLDivElement | null>;
  larghezzaColonna: number;
  isDraggingRef: React.MutableRefObject<boolean>;
  altezzaSlot: number;
  pxPerMinuto: number;
  slotMinuti: number;
  onClick: () => void;
  onDragStop: (deltaY: number, deltaX: number) => void;
  onResizeStop: (height: number) => void;
  isHighlighted?: boolean;
  fuoriOrario?: boolean;
}

function BloccoRnd({
  blocco,
  containerRef,
  larghezzaColonna,
  isDraggingRef,
  altezzaSlot,
  slotMinuti,
  onClick,
  onDragStop,
  onResizeStop,
  isHighlighted,
  fuoriOrario,
}: BloccoRndProps) {
  const { config: agendaConfig } = useAgendaConfig();

  const { app, voce, top, height, oraInizio, oraFine, isFirst } = blocco;
  const isBlocco = app.is_blocco === true;

  const sid = voce?.servizio_id ?? app.servizio_id;
  const catId = sid ? agendaConfig.servizioCategoria[String(sid)] : null;
  const cat = catId ? agendaConfig.categorie.find((c) => c.id === catId) : null;
  const coloreCategoria = cat ? cat.colore : null;
  const colore = coloreCategoria || app.colore || coloreDefault(app.tipo);
  const cfg = COLORI_APPUNTAMENTO[colore] || COLORI_APPUNTAMENTO.gray;
  const hasNote = !!app.note && app.note.trim().length > 0;

  const [liveDeltaY, setLiveDeltaY] = useState(0);
  const [liveDeltaX, setLiveDeltaX] = useState(0);
  const [liveDeltaHeight, setLiveDeltaHeight] = useState(0);

  const minutiSpostatiLive = Math.round(liveDeltaY / altezzaSlot) * slotMinuti;
  const minutiAggiuntiLive = Math.round(liveDeltaHeight / altezzaSlot) * slotMinuti;

  function calcolaOrarioLive(oraBase: string, minutiExtra: number): string {
    const [h, m] = oraBase.split(':').map(Number);
    const totale = h * 60 + m + minutiExtra;
    const hF = Math.floor(totale / 60);
    const mF = totale % 60;
    return `${String(hF).padStart(2, '0')}:${String(mF).padStart(2, '0')}`;
  }

  const oraLiveInizio = calcolaOrarioLive(oraInizio, minutiSpostatiLive);
  const oraLiveFine = calcolaOrarioLive(
    oraInizio,
    minutiSpostatiLive + (voce?.durata_minuti || app.durata_minuti) + minutiAggiuntiLive
  );

  const isLive = liveDeltaY !== 0 || liveDeltaHeight !== 0;

  const colIdx = blocco.colIndex ?? 0;
  const totCols = blocco.totalCols ?? 1;
  const larghezzaUtile = larghezzaColonna - 8;
  const larghezzaSingola = totCols > 1 ? Math.floor(larghezzaUtile / totCols) - 2 : larghezzaUtile;
  const posX = 4 + colIdx * Math.floor(larghezzaUtile / totCols);

  const classeBase = isBlocco
    ? 'h-full w-full bg-gray-50 text-gray-700 border-2 border-dashed border-gray-400 rounded-md overflow-hidden px-1.5 py-0.5 cursor-grab active:cursor-grabbing'
    : `h-full w-full ${cfg.bg} ${cfg.text} ${cfg.border} rounded-md overflow-hidden px-1.5 py-0.5 cursor-grab active:cursor-grabbing`;

  const classiStato = [
    app.stato === 'completato' ? 'opacity-60' : '',
    app.stato === 'pending' ? 'ring-2 ring-yellow-400' : '',
    app.motivo_cancellazione === 'rebooking' && app.rebooking_fissato !== true ? 'opacity-40 ring-2 ring-red-500' : '',
    app.motivo_cancellazione === 'rebooking' && app.rebooking_fissato === true ? 'opacity-60 grayscale bg-gray-200 text-gray-600' : '',
    app.motivo_cancellazione === 'spostamento' ? 'opacity-50 !bg-blue-100 !text-blue-700 border border-blue-300' : '',
  ].filter(Boolean).join(' ');

  return (
    <Rnd
      default={{ x: posX, y: top, width: larghezzaSingola, height: height }}
      size={{ width: larghezzaSingola, height }}
      position={{ x: liveDeltaX !== 0 ? posX + liveDeltaX : posX, y: liveDeltaY !== 0 ? top + liveDeltaY : top }}
      dragAxis="both"
      enableResizing={{
        top: false,
        right: false,
        bottom: true,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      }}
      dragGrid={[1, altezzaSlot]}
      resizeGrid={[1, altezzaSlot]}
      onDragStart={(_e, d) => {
        (window as any).__dragStart = { x: d.x, y: d.y };
      }}
      onDrag={(_e, d) => {
        const start = (window as any).__dragStart || { x: d.x, y: d.y };
        setLiveDeltaY(d.y - start.y);
        setLiveDeltaX(d.x - start.x);
      }}
      onDragStop={(_e, d) => {
        const start = (window as any).__dragStart || { x: d.x, y: d.y };
        const deltaY = d.y - start.y;
        const deltaX = d.x - start.x;
        setLiveDeltaY(0);
        setLiveDeltaX(0);
        onDragStop(deltaY, deltaX);
      }}
      onResize={(_e, _dir, ref) => {
        const nuovaHeight = parseFloat((ref as HTMLElement).style.height);
        setLiveDeltaHeight(nuovaHeight - height);
      }}
      onResizeStop={(_e, _dir, ref) => {
        const nuovaHeight = parseFloat((ref as HTMLElement).style.height);
        setLiveDeltaHeight(0);
        onResizeStop(nuovaHeight);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      className="group"
      style={{ zIndex: 10 }}
    >
      {fuoriOrario && (
        <div className="absolute -top-1.5 -right-1.5 z-20 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md" title="Fuori orario di apertura">
          ⚠
        </div>
      )}
      <div
        onClick={(e) => {
          if (isDraggingRef.current) {
            e.stopPropagation();
            return;
          }
          onClick();
        }}
        onTouchEnd={(e) => {
          if (isDraggingRef.current) {
            e.stopPropagation();
            return;
          }
          onClick();
        }}
        className={`${classeBase} ${classiStato} ${isLive ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'} ${
          isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-2 shadow-xl animate-pulse' : ''
        } transition-shadow`}
        style={{ touchAction: 'manipulation' }}
        title={hasNote ? app.note || '' : undefined}
      >
        {isBlocco ? (
          <div className="h-full flex flex-col overflow-hidden">
            <p className="text-[10px] font-bold truncate leading-tight flex items-center gap-1 text-gray-600">
              <span className="shrink-0">🚫</span>
              <span className="truncate">{app.titolo || 'Blocco'}</span>
            </p>
            {hasNote && height >= 30 && (
              <p className="text-[9px] italic truncate leading-tight text-gray-500 mt-0.5">
                {app.note}
              </p>
            )}
            {height >= 40 && (
              <p className="text-[9px] truncate leading-none text-gray-400 mt-0.5">
                {oraLiveInizio} – {oraLiveFine}
              </p>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col justify-start overflow-hidden leading-tight">
              <p className={`text-[10px] truncate leading-tight ${isLive ? "font-bold" : "opacity-90"}`}>
                {oraLiveInizio} – {oraLiveFine}
              </p>
              <p className="text-xs font-bold truncate leading-tight" title={hasNote ? app.note || undefined : undefined}>
                <span className="truncate">{app.cliente?.nome_cognome || "—"}</span>
                {isFirst && app.stato === "completato" && <span className="ml-1 text-[10px]">✓</span>}
                {isFirst && (app as any).promemoria_inviato_at && (
                  <span
                    className="ml-1 text-[10px] opacity-90"
                    title={`Promemoria inviato ${(app as any).promemoria_canale || ''}`}
                  >
                    ⏰✓
                  </span>
                )}
                {isFirst && hasNote && (
                  <span className="ml-1 text-[11px] font-semibold text-red-600 tracking-tight">
                    | 📝 {app.note}
                  </span>
                )}
              </p>
              <p className="text-[10px] truncate opacity-90 leading-tight">
                {voce?.nome || app.titolo}
              </p>
            </div>
        )}
      </div>
    
    </Rnd>
  );
}
