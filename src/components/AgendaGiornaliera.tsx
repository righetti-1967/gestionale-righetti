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

interface AgendaGiornalieraProps {
  data: string;
  appuntamenti: AppuntamentoConCliente[];
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
}

export function AgendaGiornaliera({
  data,
  appuntamenti,
  onClickAppuntamento,
  onClickSlot,
  onUpdateAppuntamento,
}: AgendaGiornalieraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [larghezzaColonna, setLarghezzaColonna] = useState(400);

  const { config: agendaConfig } = useAgendaConfig();
  const [nota, setNota] = useState<string | null>(null);

  const operatoriVisibili = useMemo(
    () => getOperatoriVisibili(),
    [agendaConfig.operatoriVisibili, agendaConfig.operatori]
  );
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

  const altezzaSlot = useMemo(() => {
    if (slots.length === 0) return 22;
    const calcolata = Math.floor(altezzaDisponibile / slots.length);
    return Math.max(10, Math.min(40, calcolata));
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
      if (app.stato === 'cancellato') continue;

      const voci = app.voci_selezionate || [];

      if (voci.length === 0) {
        const inizioApp = oraToMinuti(app.ora_inizio.slice(0, 5));
        const top = (inizioApp - inizioGiornata) * pxPerMinuto;
        const height = app.durata_minuti * pxPerMinuto;
        if (!mappa[app.operatore]) mappa[app.operatore] = [];
        mappa[app.operatore].push({
          app,
          voceIndex: null,
          voce: null,
          top,
          height,
          oraInizio: app.ora_inizio.slice(0, 5),
          oraFine: minutiToOra(inizioApp + app.durata_minuti),
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

    return mappa;
  }, [appuntamenti, agendaConfig.oraApertura, pxPerMinuto, operatoriVisibili]);

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
      const nuovoNome = OPERATORI[nuovoOperatore]?.label || nuovoOperatore;
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
        onUpdateAppuntamento(app.id, {
          operatore: nuovoOperatore,
          ora_inizio: nuovaOra,
        });
      } else {
        const vociAggiornate = [...(app.voci_selezionate || [])];
        vociAggiornate[voceIndex] = {
          ...vociAggiornate[voceIndex],
          ora_inizio: nuovaOra,
          operatore: nuovoOperatore,
        };
        onUpdateAppuntamento(app.id, { voci_selezionate: vociAggiornate });
      }
      setNota(`Spostato su ${OPERATORI[nuovoOperatore]?.label || nuovoOperatore} ✅`);
    } else if (tipo === 'sposta' && nuovaOra) {
      if (voceIndex === null) {
        onUpdateAppuntamento(app.id, { ora_inizio: nuovaOra });
        setNota(`Spostato alle ${nuovaOra} ✅`);
      } else {
        const vociAggiornate = [...(app.voci_selezionate || [])];
        vociAggiornate[voceIndex] = { ...vociAggiornate[voceIndex], ora_inizio: nuovaOra };
        onUpdateAppuntamento(app.id, { voci_selezionate: vociAggiornate });
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
        onUpdateAppuntamento(app.id, { voci_selezionate: vociAggiornate });
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
          const info = OPERATORI[op] || { label: op, colore: 'blue' };
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
                onClickSlot={onClickSlot}
                altezzaSlot={altezzaSlot}
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
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SfondoColonna({
  operatore,
  slots,
  onClickSlot,
  altezzaSlot,
}: {
  operatore: Operatore;
  slots: string[];
  onClickSlot: (operatore: Operatore, ora: string) => void;
  altezzaSlot: number;
}) {
  return (
    <>
      {slots.map((slot) => (
        <button
          key={`${operatore}-${slot}`}
          type="button"
          onClick={() => onClickSlot(operatore, slot)}
          style={{ height: `${altezzaSlot}px` }}
          className={`w-full block border-b transition-colors hover:bg-blue-50/60 ${
            slot.endsWith(':00') ? 'border-gray-200/60' : 'border-gray-100'
          }`}
          aria-label={`Aggiungi appuntamento ${operatore} alle ${slot}`}
        />
      ))}
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

  const classeBase = isBlocco
    ? 'h-full w-full bg-gray-50 text-gray-700 border-2 border-dashed border-gray-400 rounded-md overflow-hidden px-1.5 py-0.5 cursor-grab active:cursor-grabbing'
    : `h-full w-full ${cfg.bg} ${cfg.text} ${cfg.border} rounded-md overflow-hidden px-1.5 py-0.5 cursor-grab active:cursor-grabbing`;

  return (
    <Rnd
      default={{ x: 4, y: top, width: larghezzaColonna - 8, height: height }}
      size={{ width: larghezzaColonna - 8, height }}
      position={{ x: 4, y: top }}
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
      }}
      onDragStop={(_e, d) => {
        const start = (window as any).__dragStart || { x: d.x, y: d.y };
        const deltaY = d.y - start.y;
        const deltaX = d.x - start.x;
        setLiveDeltaY(0);
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
        className={`${classeBase} ${
          app.stato === 'completato' ? 'opacity-60' : ''
        } ${isLive ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'} transition-shadow`}
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
          <div className="h-full flex flex-col overflow-hidden">
            <p
              className={`text-[10px] truncate leading-tight ${
                isLive ? 'font-bold' : 'opacity-90'
              }`}
            >
              {oraLiveInizio} – {oraLiveFine}
            </p>
            <p className="text-xs font-bold truncate leading-tight flex items-center gap-1">
              {isFirst && hasNote && <span className="text-[10px]">📝</span>}
              <span className="truncate">{app.cliente?.nome_cognome || '—'}</span>
              {isFirst && app.stato === 'completato' && <span className="text-[10px]">✓</span>}
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
