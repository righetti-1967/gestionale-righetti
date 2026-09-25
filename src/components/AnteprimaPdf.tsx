import type { ReactNode } from 'react';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { formatSede } from '../lib/studio';
import { getLogoUrl } from '../lib/logo';

interface AnteprimaPdfProps {
  titolo: string;
  sottotitolo?: string;
  children: ReactNode;
  onScarica: () => void;
  labelScarica: string;
  coloreScarica?: 'blue' | 'amber';
  onClose: () => void;
}

export function AnteprimaPdf({
  titolo,
  sottotitolo,
  children,
  onScarica,
  labelScarica,
  coloreScarica = 'blue',
  onClose,
}: AnteprimaPdfProps) {
  const bgScarica =
    coloreScarica === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600'
      : 'bg-apple-blue hover:bg-blue-600';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-3xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div>
            <h2 className="text-lg font-bold text-apple-darkgray">
              👁️ {titolo}
            </h2>
            <p className="text-xs text-apple-gray">
              {sottotitolo || 'Come apparirà il PDF'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 bg-gray-100 max-h-[70vh] overflow-y-auto">
          <div
            className="bg-white shadow-md p-8 max-w-2xl mx-auto"
            style={{ minHeight: '500px' }}
          >
            {children}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200/60 bg-gray-50/50">
          <button
            onClick={onScarica}
            className={`flex-1 px-4 py-2.5 text-white rounded-apple font-medium text-sm transition-colors ${bgScarica}`}
          >
            {labelScarica}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Chiudi anteprima
          </button>
        </div>
      </div>
    </div>
  );
}

export function IntestazionePdf() {
  const { dati } = useDatiAziendali();

  return (
    <div className="flex justify-between items-start mb-6">
      <img src={getLogoUrl()} alt="Logo" className="h-20" />
      <div className="text-right text-xs text-gray-600">
        <p className="font-bold text-gray-900 text-sm">{dati.ragioneSociale}</p>
        <p>Sede operativa: {formatSede(dati.sedeOperativa)}</p>
        <p>Sede legale: {formatSede(dati.sedeLegale)}</p>
        <p>
          P.IVA {dati.partitaIva} | SDI {dati.codiceSdi} | Tel.{' '}
          {dati.telefono}
        </p>
      </div>
    </div>
  );
}

export function BandaBluPdf({
  testo,
  anno,
}: {
  testo: string;
  anno: number | string;
}) {
  return (
    <div className="bg-blue-600 text-white flex justify-between items-center px-4 py-3 mb-6">
      <p className="font-bold text-lg">{testo}</p>
      <p className="text-sm">Anno {anno}</p>
    </div>
  );
}

export function FooterPdf() {
  const { dati } = useDatiAziendali();

  return (
    <div className="mt-8 pt-4 text-center text-xs italic text-gray-400">
      {dati.ragioneSociale} - P.IVA {dati.partitaIva} - SDI{' '}
      {dati.codiceSdi}
    </div>
  );
}
