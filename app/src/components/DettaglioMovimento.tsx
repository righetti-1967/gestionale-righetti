import { useState } from 'react';
import {
  eliminaMovimento,
  type MovimentoConProdotto,
} from '../lib/magazzino';

interface DettaglioMovimentoProps {
  movimento: MovimentoConProdotto;
  onClose: () => void;
  onEliminato: () => void;
}

export function DettaglioMovimento({
  movimento,
  onClose,
  onEliminato,
}: DettaglioMovimentoProps) {
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function formatData(data: string | null): string {
    if (!data) return '—';
    try {
      return new Date(data).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  async function handleElimina() {
    try {
      setEliminando(true);
      setErrore(null);
      await eliminaMovimento(movimento.id);
      onEliminato();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nell\'eliminazione');
      setEliminando(false);
      setShowConfermaElimina(false);
    }
  }

  const isCarico = movimento.tipo === 'carico';
  const coloreTipo = isCarico
    ? { bg: 'bg-green-100', text: 'text-green-700', badge: 'bg-green-600' }
    : { bg: 'bg-red-100', text: 'text-red-700', badge: 'bg-red-500' };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full my-8 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-apple ${coloreTipo.badge} flex items-center justify-center text-white text-2xl`}
            >
              {isCarico ? '📥' : '📤'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-apple-darkgray">
                {isCarico ? 'Carico' : 'Scarico'} di magazzino
              </h2>
              <p className="text-xs text-apple-gray">
                ID {movimento.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Prodotto */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
            🏪 Prodotto
          </p>
          <div className="bg-gray-50 rounded-apple p-3">
            <p className="text-sm font-semibold text-apple-darkgray">
              {movimento.prodotto?.nome || '—'}
            </p>
            {movimento.prodotto?.codice_fornitore && (
              <p className="text-xs text-apple-gray mt-0.5">
                Cod. {movimento.prodotto.codice_fornitore}
              </p>
            )}
          </div>
        </div>

        {/* Quantità */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-apple p-3">
            <p className="text-xs text-apple-gray mb-1">Quantità</p>
            <p className={`text-2xl font-bold ${coloreTipo.text}`}>
              {isCarico ? '+' : '−'}{movimento.quantita}
            </p>
          </div>
          <div className="bg-gray-50 rounded-apple p-3">
            <p className="text-xs text-apple-gray mb-1">Data</p>
            <p className="text-sm font-semibold text-apple-darkgray">
              {formatData(movimento.data_movimento)}
            </p>
          </div>
        </div>

        {/* Motivo */}
        {movimento.motivo && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              📋 Motivo
            </p>
            <p className="text-sm text-apple-darkgray bg-gray-50 rounded-apple p-3">
              {movimento.motivo}
            </p>
          </div>
        )}

        {/* Note */}
        {movimento.note && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              📝 Note
            </p>
            <p className="text-xs text-apple-gray italic bg-gray-50 rounded-apple p-3 whitespace-pre-wrap">
              {movimento.note}
            </p>
          </div>
        )}

        {/* Giacenza attuale prodotto */}
        {movimento.prodotto && (
          <div className="bg-blue-50 border border-blue-200 rounded-apple p-3 mb-6">
            <p className="text-xs text-apple-gray">
              Giacenza attuale di <strong>{movimento.prodotto.nome}</strong>:{' '}
              <strong>{movimento.prodotto.giacenza}</strong>
            </p>
            <p className="text-xs text-apple-gray mt-1">
              ℹ️ Se elimini questo movimento, la giacenza verrà <strong>aggiornata automaticamente</strong>.
            </p>
          </div>
        )}

        {/* Errore */}
        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm mb-4">
            ❌ {errore}
          </div>
        )}

        {/* Pannello conferma eliminazione */}
        {showConfermaElimina && (
          <div className="bg-red-50 border-2 border-red-300 rounded-apple p-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-bold text-red-800 mb-1">
                  Eliminare questo movimento?
                </p>
                <p className="text-xs text-red-700 leading-relaxed">
                  La giacenza del prodotto verrà <strong>aggiornata automaticamente</strong>{' '}
                  (annullando l'effetto del movimento). L'azione è irreversibile.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleElimina}
                disabled={eliminando}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {eliminando ? 'Eliminazione...' : 'Sì, elimina'}
              </button>
              <button
                onClick={() => setShowConfermaElimina(false)}
                disabled={eliminando}
                className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Azioni */}
        {!showConfermaElimina && (
          <div className="pt-6 border-t border-gray-200/60 flex gap-2">
            <button
              onClick={() => setShowConfermaElimina(true)}
              disabled={eliminando}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Elimina movimento"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Chiudi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
