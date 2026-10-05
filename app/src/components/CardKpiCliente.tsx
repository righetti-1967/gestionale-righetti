import { useEffect, useState } from 'react';
import { getKpiCliente, type KpiCliente } from '../lib/analytics';
import { formatEuro } from '../lib/fatture';

interface CardKpiClienteProps {
  clienteId: number;
}

export function CardKpiCliente({ clienteId }: CardKpiClienteProps) {
  const [kpi, setKpi] = useState<KpiCliente | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annullato = false;
    async function carica() {
      try {
        setLoading(true);
        const r = await getKpiCliente(clienteId);
        if (!annullato) setKpi(r);
      } catch (err) {
        console.error('Errore KPI cliente:', err);
      } finally {
        if (!annullato) setLoading(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
  }, [clienteId]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-apple p-4">
        <p className="text-xs text-apple-gray text-center">Caricamento KPI...</p>
      </div>
    );
  }

  if (!kpi) return null;

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-apple p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center sm:text-left">
          <p className="text-[10px] text-apple-gray uppercase tracking-wide font-semibold">
            🧾 Scontrini
          </p>
          <p className="text-base font-bold text-apple-darkgray mt-0.5">
            {formatEuro(kpi.spesaScontrini)}
          </p>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[10px] text-apple-gray uppercase tracking-wide font-semibold">
            📄 Fatture
          </p>
          <p className="text-base font-bold text-apple-darkgray mt-0.5">
            {formatEuro(kpi.spesaFatture)}
          </p>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[10px] text-green-800 uppercase tracking-wide font-bold">
            💰 Totale Spesa
          </p>
          <p className="text-lg font-bold text-green-700 mt-0.5">
            {formatEuro(kpi.spesaTotale)}
          </p>
        </div>

        <div className="text-center sm:text-left">
          <p className="text-[10px] text-apple-gray uppercase tracking-wide font-semibold">
            📊 Fiches media
          </p>
          <p className="text-base font-bold text-apple-darkgray mt-0.5">
            {formatEuro(kpi.fichesMedia)}
          </p>
        </div>
      </div>

      {/* Sottoriga */}
      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-green-200/60 text-[11px] text-apple-gray">
        <span>
          <strong className="text-apple-darkgray">{kpi.numeroDocumenti}</strong> documenti
        </span>
        <span>
          <strong className="text-apple-darkgray">{kpi.totaleFiches}</strong> fiches totali
        </span>
        <span>
          Scontrino medio:{' '}
          <strong className="text-apple-darkgray">
            {formatEuro(kpi.scontrinoMedio)}
          </strong>
        </span>
      </div>
    </div>
  );
}
