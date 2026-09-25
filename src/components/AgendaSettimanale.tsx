import { useMemo, useEffect, useState } from 'react';
import { useAgendaConfig } from '../lib/useAgendaConfig';
import {
  OPERATORI,
  COLORI_APPUNTAMENTO,
  coloreDefault,
  getColoreServizio,
  getOperatoriVisibili,
  oraToMinuti,
  type AppuntamentoConCliente,
  type Operatore,
} from '../lib/appuntamenti';

interface AgendaSettimanaleProps {
  giorniSettimana: string[];
  appuntamenti: AppuntamentoConCliente[];
  onClickAppuntamento: (app: AppuntamentoConCliente) => void;
  onClickSlot: (data: string, operatore: Operatore, ora: string) => void;
}

const ORA_COL_WIDTH = '55px';

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

export function AgendaSettimanale({
  giorniSettimana,
  appuntamenti,
  onClickAppuntamento,
  onClickSlot,
}: AgendaSettimanaleProps) {
  const { config: agendaConfig } = useAgendaConfig();

  const operatoriVisibili = useMemo(
    () => getOperatoriVisibili(),
    [agendaConfig.operatoriVisibili, agendaConfig.operatori]
  );
  const colonneCount = operatoriVisibili.length;

  const [altezzaDisponibile, setAltezzaDisponibile] = useState(600);

  useEffect(() => {
    function calcola() {
      const h = window.innerHeight - 220;
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
      const h = Math.floor(m / 60);
      const min = m % 60;
      lista.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    return lista;
  }, [agendaConfig.oraApertura, agendaConfig.oraChiusura, agendaConfig.granularitaMinuti]);

  const altezzaSlot = useMemo(() => {
    if (slots.length === 0) return 15;
    const calcolata = Math.floor(altezzaDisponibile / slots.length);
    return Math.max(10, Math.min(60, calcolata));
  }, [slots.length, altezzaDisponibile]);

  const pxPerMinuto = altezzaSlot / agendaConfig.granularitaMinuti;

  const griglia = useMemo(() => {
    const mappa: Record<
      string,
      Record<string, { app: AppuntamentoConCliente; top: number; height: number }[]>
    > = {};

    const inizioGiornata = oraToMinuti(agendaConfig.oraApertura);

    for (const data of giorniSettimana) {
      mappa[data] = {};
      for (const op of operatoriVisibili) {
        mappa[data][op] = [];
      }
    }

    for (const app of appuntamenti) {
      if (app.stato === 'cancellato') continue;
      if (!mappa[app.data]) continue;

      if (!mappa[app.data][app.operatore]) {
        mappa[app.data][app.operatore] = [];
      }

      const inizio = oraToMinuti(app.ora_inizio.slice(0, 5));
      const top = (inizio - inizioGiornata) * pxPerMinuto;
      const height = app.durata_minuti * pxPerMinuto;

      mappa[app.data][app.operatore].push({ app, top, height });
    }

    return mappa;
  }, [giorniSettimana, appuntamenti, agendaConfig.oraApertura, pxPerMinuto, operatoriVisibili]);

  function formattaGiorno(dataISO: string): { giornoSett: string; giornoNum: string } {
    const d = new Date(dataISO + 'T00:00:00');
    return {
      giornoSett: d.toLocaleDateString('it-IT', { weekday: 'short' }),
      giornoNum: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    };
  }

  if (giorniSettimana.length === 0) {
    return (
      <div className="bg-white rounded-apple shadow-apple p-8 text-center">
        <p className="text-apple-gray">
          Nessun giorno lavorativo configurato. Vai in Impostazioni → Agenda per configurarli.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-apple shadow-apple overflow-hidden flex flex-col">
      <div
        className="grid border-b border-gray-200/60 bg-gray-50/50 shrink-0"
        style={{
          gridTemplateColumns: `${ORA_COL_WIDTH} repeat(${giorniSettimana.length}, 1fr)`,
        }}
      >
        <div className="border-r border-gray-200/60"></div>
        {giorniSettimana.map((data) => {
          const { giornoSett, giornoNum } = formattaGiorno(data);
          return (
            <div key={data} className="border-r border-gray-200/60 last:border-r-0">
              <div className="px-2 py-1 text-center border-b border-gray-200/60">
                <p className="text-xs font-bold text-apple-darkgray capitalize">
                  {giornoSett} {giornoNum}
                </p>
              </div>
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${colonneCount}, 1fr)` }}
              >
                {operatoriVisibili.map((op) => {
                  const info = OPERATORI[op] || { label: op, colore: 'blue' };
                  const dotColor = COLORI_DOT[info.colore] || 'bg-blue-500';
                  return (
                    <div
                      key={op}
                      className="px-1 py-1 border-r border-gray-200/60 last:border-r-0 text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                        <p className="text-[10px] font-semibold text-apple-darkgray truncate">
                          {info.label.split(' ')[0]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `${ORA_COL_WIDTH} repeat(${giorniSettimana.length}, 1fr)`,
          }}
        >
          <div className="border-r border-gray-200/60 bg-gray-50/30">
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
                      className="text-[9px] text-apple-gray leading-none"
                      style={{ marginTop: '-4px' }}
                    >
                      {slot}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {giorniSettimana.map((data) => (
            <div
              key={data}
              className="border-r border-gray-200/60 last:border-r-0"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${colonneCount}, 1fr)`,
              }}
            >
              {operatoriVisibili.map((op) => (
                <div
                  key={op}
                  className="relative border-r border-gray-200/60 last:border-r-0"
                >
                  {slots.map((slot) => (
                    <button
                      key={`${data}-${op}-${slot}`}
                      type="button"
                      onClick={() => onClickSlot(data, op, slot)}
                      style={{ height: `${altezzaSlot}px` }}
                      className={`w-full block border-b transition-colors hover:bg-blue-50/60 ${
                        slot.endsWith(':00') ? 'border-gray-200/60' : 'border-gray-100'
                      }`}
                      aria-label={`Aggiungi ${op} ${data} ${slot}`}
                    />
                  ))}

                  {(griglia[data]?.[op] || []).map(({ app, top, height }) => (
                    <AppuntamentoBloccoSett
                      key={app.id}
                      app={app}
                      top={top}
                      height={height}
                      onClick={() => onClickAppuntamento(app)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AppuntamentoBloccoSettProps {
  app: AppuntamentoConCliente;
  top: number;
  height: number;
  onClick: () => void;
}

function AppuntamentoBloccoSett({
  app,
  top,
  height,
  onClick,
}: AppuntamentoBloccoSettProps) {
  const coloreCategoria = getColoreServizio(app.servizio_id);
  const colore = coloreCategoria || app.colore || coloreDefault(app.tipo);
  const cfg = COLORI_APPUNTAMENTO[colore] || COLORI_APPUNTAMENTO.gray;
  const hasNote = !!app.note && app.note.trim().length > 0;

  const mostraOra = height >= 26;
  const mostraTitolo = height >= 16;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute',
        top: `${top}px`,
        height: `${height}px`,
        left: '1px',
        right: '1px',
      }}
      title={hasNote ? app.note || '' : undefined}
      className={`${cfg.bg} ${cfg.text} rounded px-1 py-0.5 text-left hover:shadow-md transition-shadow overflow-hidden ${
        app.stato === 'completato' ? 'opacity-60' : ''
      }`}
    >
      {mostraTitolo && (
        <p className="text-[9px] font-bold truncate leading-none flex items-center gap-0.5">
          {hasNote && <span className="text-[8px]">📝</span>}
          {(app.voci_selezionate?.length || 0) > 1 && (
            <span className="text-[8px]">×{app.voci_selezionate!.length}</span>
          )}
          <span className="truncate">{app.cliente?.nome_cognome || '—'}</span>
        </p>
      )}
      {mostraOra && (
        <p className="text-[8px] truncate opacity-80 leading-none mt-0.5">
          {app.ora_inizio.slice(0, 5)}
        </p>
      )}
    </button>
  );
}
