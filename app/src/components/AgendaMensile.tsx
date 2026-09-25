import { useMemo, useEffect, useState } from 'react';
import {
  COLORI_APPUNTAMENTO,
  coloreDefault,
  getColoreServizio,
  getOperatoriVisibili,
  type AppuntamentoConCliente,
} from '../lib/appuntamenti';
import { useAgendaConfig } from '../lib/useAgendaConfig';

interface AgendaMensileProps {
  mese: number;
  anno: number;
  appuntamenti: AppuntamentoConCliente[];
  onClickGiorno: (data: string) => void;
}

const NOMI_GIORNI: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Gio',
  5: 'Ven',
  6: 'Sab',
};

export function AgendaMensile({
  mese,
  anno,
  appuntamenti,
  onClickGiorno,
}: AgendaMensileProps) {
  const { config } = useAgendaConfig();

  // Operatori visibili dalla config
  const operatoriVisibili = useMemo(
    () => getOperatoriVisibili(),
    [config.operatoriVisibili]
  );

  // Altezza dinamica in base al viewport
  const [altezzaDisponibile, setAltezzaDisponibile] = useState(600);

  useEffect(() => {
    function calcola() {
      const h = window.innerHeight - 180;
      setAltezzaDisponibile(Math.max(400, h));
    }
    calcola();
    window.addEventListener('resize', calcola);
    return () => window.removeEventListener('resize', calcola);
  }, []);

  const giorniLavorativi = useMemo(() => {
    const set = new Set(config.giorniLavorativi);
    const ordinati: number[] = [];
    for (let d = 1; d <= 6; d++) if (set.has(d)) ordinati.push(d);
    if (set.has(0)) ordinati.push(0);
    return ordinati;
  }, [config.giorniLavorativi]);

  const settimane = useMemo(() => {
    if (giorniLavorativi.length === 0) return [];

    const primo = new Date(anno, mese, 1);
    const ultimo = new Date(anno, mese + 1, 0);

    const inizio = new Date(primo);
    while (!giorniLavorativi.includes(inizio.getDay())) {
      inizio.setDate(inizio.getDate() + 1);
    }

    const fine = new Date(ultimo);
    while (!giorniLavorativi.includes(fine.getDay())) {
      fine.setDate(fine.getDate() - 1);
    }

    const settimane: Date[][] = [];
    let corrente = new Date(inizio);

    while (corrente <= fine) {
      const settimana: Date[] = [];
      for (let i = 0; i < giorniLavorativi.length; i++) {
        while (!giorniLavorativi.includes(corrente.getDay())) {
          corrente.setDate(corrente.getDate() + 1);
        }
        if (corrente > fine) break;
        settimana.push(new Date(corrente));
        corrente.setDate(corrente.getDate() + 1);
      }
      if (settimana.length > 0) settimane.push(settimana);
    }

    return settimane;
  }, [mese, anno, giorniLavorativi]);

  const appuntamentiPerData = useMemo(() => {
    const mappa: Record<string, AppuntamentoConCliente[]> = {};
    for (const app of appuntamenti) {
      if (app.stato === 'cancellato') continue;
      // FILTRO: mostra solo appuntamenti degli operatori visibili
      if (!operatoriVisibili.includes(app.operatore)) continue;
      if (!mappa[app.data]) mappa[app.data] = [];
      mappa[app.data].push(app);
    }
    return mappa;
  }, [appuntamenti, operatoriVisibili]);

  // Altezza cella DINAMICA
  const altezzaCella = useMemo(() => {
    if (settimane.length === 0) return 80;
    const calcolata = Math.floor((altezzaDisponibile - 30) / settimane.length);
    return Math.max(60, calcolata);
  }, [settimane.length, altezzaDisponibile]);

  function dataToISO(d: Date): string {
    const anno = d.getFullYear();
    const mese = String(d.getMonth() + 1).padStart(2, '0');
    const giorno = String(d.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }

  const oggi = new Date();
  const oggiISO = dataToISO(oggi);

  if (giorniLavorativi.length === 0) {
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
        style={{ gridTemplateColumns: `repeat(${giorniLavorativi.length}, 1fr)` }}
      >
        {giorniLavorativi.map((g) => (
          <div
            key={g}
            className="px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-apple-darkgray border-r border-gray-200/60 last:border-r-0"
          >
            {NOMI_GIORNI[g]}
          </div>
        ))}
      </div>

      <div className="flex-1 divide-y divide-gray-200/60">
        {settimane.map((settimana, idxSett) => (
          <div
            key={idxSett}
            className="grid divide-x divide-gray-200/60"
            style={{
              gridTemplateColumns: `repeat(${giorniLavorativi.length}, 1fr)`,
              height: `${altezzaCella}px`,
            }}
          >
            {settimana.map((giorno) => {
              const dataISO = dataToISO(giorno);
              const isMeseCorrente = giorno.getMonth() === mese;
              const isOggi = dataISO === oggiISO;
              const appsDelGiorno = appuntamentiPerData[dataISO] || [];
              const maxVisibili = 4;
              const appsVisibili = appsDelGiorno.slice(0, maxVisibili);
              const resto = appsDelGiorno.length - maxVisibili;

              return (
                <button
                  key={dataISO}
                  type="button"
                  onClick={() => onClickGiorno(dataISO)}
                  className={`p-1.5 text-left transition-colors bg-white hover:bg-blue-50/40 cursor-pointer overflow-hidden flex flex-col ${
                    !isMeseCorrente ? 'opacity-40' : ''
                  } ${isOggi ? 'ring-2 ring-inset ring-apple-blue/40' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1 shrink-0">
                    <span
                      className={`text-xs font-semibold ${
                        isMeseCorrente ? 'text-apple-darkgray' : 'text-apple-gray'
                      } ${isOggi ? 'text-apple-blue font-bold' : ''}`}
                    >
                      {giorno.getDate()}
                    </span>
                    {appsDelGiorno.length > 0 && (
                      <span className="text-[9px] font-semibold text-apple-gray">
                        {appsDelGiorno.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {appsVisibili.map((app) => {
                      const coloreCategoria = getColoreServizio(app.servizio_id);
                      const colore = coloreCategoria || app.colore || coloreDefault(app.tipo);
                      const cfg = COLORI_APPUNTAMENTO[colore] || COLORI_APPUNTAMENTO.gray;
                      const hasNote = !!app.note && app.note.trim().length > 0;
                      return (
                        <div
                          key={app.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate ${cfg.bg} ${cfg.text} font-medium flex items-center gap-0.5`}
                        >
                          {hasNote && <span className="text-[8px] shrink-0">📝</span>}
                          <span className="truncate">
                            {app.ora_inizio.slice(0, 5)}{' '}
                            {app.cliente?.nome_cognome?.split(' ')[0] || ''}
                          </span>
                        </div>
                      );
                    })}
                    {resto > 0 && (
                      <div className="text-[9px] text-apple-gray font-medium pl-1">
                        +{resto} altri
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
