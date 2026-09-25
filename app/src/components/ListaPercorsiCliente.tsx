import { useEffect, useState } from 'react';
import {
  getPercorsiCliente,
  type Percorso,
  type StatoPercorso,
} from '../lib/percorsi';
import { getScarichiFattura } from '../lib/scarichi';
import { getFatture } from '../lib/fatture';
import {
  calcolaResiduo,
  formatEuro,
  type ResiduoPercorso,
} from '../lib/percorsi-helper';

interface ListaPercorsiClienteProps {
  clienteId: number;
  onApriPercorso: (dati: {
    percorso: Percorso;
    residuo: ResiduoPercorso;
    stato: StatoPercorso;
    fatturaIncassata: boolean;
  }) => void;
}

interface PercorsoConResiduo {
  percorso: Percorso;
  residuo: ResiduoPercorso;
  stato: StatoPercorso;
  fatturaIncassata: boolean;
}

const STATO_CONFIG: Record<StatoPercorso, { label: string; colore: string }> = {
  attivo: { label: '🟢 Attivo', colore: 'bg-green-100 text-green-700' },
  'in-scadenza': { label: '🟡 In scadenza', colore: 'bg-amber-100 text-amber-700' },
  'da-incassare': { label: '🟠 Da incassare', colore: 'bg-orange-100 text-orange-700' },
  'da-fatturare': { label: '🟡 Da fatturare', colore: 'bg-yellow-100 text-yellow-700' },
  completato: { label: '🔵 Completato', colore: 'bg-blue-100 text-blue-700' },
  scaduto: { label: '🔴 Scaduto', colore: 'bg-red-100 text-red-700' },
  bloccato: { label: '🔴 Bloccato', colore: 'bg-red-100 text-red-700' },
  terminato: { label: '⚫ Terminato', colore: 'bg-gray-200 text-gray-700' },
};

export function ListaPercorsiCliente({
  clienteId,
  onApriPercorso,
}: ListaPercorsiClienteProps) {
  const [percorsi, setPercorsi] = useState<PercorsoConResiduo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        setErrore(null);

        const [percorsiCliente, tutteFatture] = await Promise.all([
          getPercorsiCliente(clienteId),
          getFatture(),
        ]);

        const fattureIncassate = new Set(
          tutteFatture.filter((f) => !!f.data_incasso).map((f) => f.id)
        );

        const oggi = new Date();
        const trentaGiorniMs = 30 * 24 * 60 * 60 * 1000;
        const risultati: PercorsoConResiduo[] = [];

        for (const p of percorsiCliente) {
          let scarichi: Awaited<ReturnType<typeof getScarichiFattura>> = [];
          if (p.fattura_id) {
            try {
              scarichi = await getScarichiFattura(p.fattura_id);
            } catch {
              scarichi = [];
            }
          }

          // Conserva TUTTE le informazioni degli scarichi (incluso prodotto_percorso_id)
          const righeScaricate = scarichi.flatMap((s) => s.righe || []);

          const residuo = calcolaResiduo(p.righe || [], righeScaricate);
          const completato = residuo.valore_residuo_lordo <= 0;

          const dataFine = new Date(p.data_fine);
          const scaduto = dataFine < oggi;
          const inScadenza =
            !scaduto && dataFine.getTime() - oggi.getTime() <= trentaGiorniMs;

          let stato: StatoPercorso;
          if (completato) {
            stato = 'completato';
          } else if (p.terminato) {
            stato = 'terminato';
          } else if (p.bloccato) {
            stato = 'bloccato';
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

          const fatturaIncassata = p.fattura_id
            ? fattureIncassate.has(p.fattura_id)
            : false;

          risultati.push({ percorso: p, residuo, stato, fatturaIncassata });
        }

        setPercorsi(risultati);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore nel caricamento percorsi');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [clienteId]);

  if (loading) {
    return (
      <div className="py-4 text-center text-xs text-apple-gray">
        Caricamento percorsi...
      </div>
    );
  }

  if (errore) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-xs">
        ❌ {errore}
      </div>
    );
  }

  if (percorsi.length === 0) {
    return (
      <div className="bg-gray-50 rounded-apple p-4 text-center">
        <p className="text-xs text-apple-gray">
          Nessun percorso attivo. Crea il primo con il pulsante "🎯 Nuovo Percorso".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {percorsi.map((dati) => (
        <CardPercorso
          key={dati.percorso.id}
          percorso={dati.percorso}
          residuo={dati.residuo}
          stato={dati.stato}
          onClick={() => onApriPercorso(dati)}
        />
      ))}
    </div>
  );
}

function CardPercorso({
  percorso,
  residuo,
  stato,
  onClick,
}: {
  percorso: Percorso;
  residuo: ResiduoPercorso;
  stato: StatoPercorso;
  onClick: () => void;
}) {
  const cfg = STATO_CONFIG[stato];
  const percentuale = residuo.percentuale_consumata;

  return (
    <button
      onClick={onClick}
      className="w-full bg-gray-50 hover:bg-blue-50/60 rounded-apple p-4 text-left transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-apple-darkgray truncate">
          {percorso.nome}
        </p>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${cfg.colore}`}
        >
          {cfg.label}
        </span>
      </div>

      <p className="text-xs text-apple-gray mb-3">
        📅 {formatData(percorso.data_inizio)} → {formatData(percorso.data_fine)}
      </p>

      <div className="mb-3">
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-apple-blue rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, percentuale))}%` }}
          />
        </div>
        <p className="text-xs text-apple-gray mt-1 font-medium">
          {percentuale.toFixed(0)}% completato
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-apple-gray">Residuo</p>
          <p className="text-base font-bold text-apple-darkgray">
            {formatEuro(residuo.valore_residuo_lordo)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-apple-gray">Totale</p>
          <p className="text-xs text-apple-gray font-medium">
            {formatEuro(residuo.valore_totale_lordo)}
          </p>
        </div>
        <span className="text-apple-blue text-lg">→</span>
      </div>
    </button>
  );
}

function formatData(data: string | null): string {
  if (!data) return '—';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
