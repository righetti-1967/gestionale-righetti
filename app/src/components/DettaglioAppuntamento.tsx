import { useState } from 'react';
import type { AppuntamentoConCliente, Operatore, VoceSelezionata } from '../lib/appuntamenti';
import { OPERATORI, aggiornaAppuntamento } from '../lib/appuntamenti';

interface DettaglioAppuntamentoProps {
  appuntamento: AppuntamentoConCliente;
  onClose: () => void;
  onUpdated: () => void;
  onModifica: () => void;
  onScaricoSeduta: (app: AppuntamentoConCliente) => void;
  onFatturaProforma: (app: AppuntamentoConCliente) => void;
  onFatturaDiretta: (app: AppuntamentoConCliente) => void;
  onToast: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

type TipoEliminazione = 'rebooking' | 'disdetta' | 'definitiva' | null;

export function DettaglioAppuntamento({
  appuntamento,
  onClose,
  onUpdated,
  onModifica,
  onScaricoSeduta,
  onFatturaProforma,
  onFatturaDiretta,
  onToast,
}: DettaglioAppuntamentoProps) {
  const [modaleElimina, setModaleElimina] = useState(false);
  const [tipoEliminazione, setTipoEliminazione] = useState<TipoEliminazione>(null);
  const [salvando, setSalvando] = useState(false);

  const opInfo = OPERATORI[appuntamento.operatore as Operatore] || {
    label: appuntamento.operatore || 'Operatore',
    ruolo: '',
  };

  function formatData(data: string | null | undefined): string {
    if (!data) return '—';
    try {
      return new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return data;
    }
  }

  function apriModaleElimina() {
    setTipoEliminazione(null);
    setModaleElimina(true);
  }

  async function confermaEliminazione() {
    if (!tipoEliminazione) return;

    setSalvando(true);
    try {
      await aggiornaAppuntamento(appuntamento.id, {
        stato: 'cancellato',
        motivo_cancellazione: tipoEliminazione,
        rebooking_fissato: false,
      });

      const messaggi: Record<string, string> = {
        rebooking: '🔄 Appuntamento spostato in Rebooking',
        disdetta: '❌ Appuntamento disdetto',
        definitiva: '🗑️ Appuntamento cancellato definitivamente',
      };
      onToast(messaggi[tipoEliminazione] || 'Appuntamento cancellato', 'success');
      setModaleElimina(false);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore nella cancellazione';
      onToast(msg, 'error');
      setSalvando(false);
    }
  }

  const isPercorso = appuntamento.tipo === 'percorso';
  const isCheckup = appuntamento.tipo === 'checkup_nuovo';
  const isGenericoO_Seduta = appuntamento.tipo === 'generico' || appuntamento.tipo === 'seduta';

  const oraInizioStr = appuntamento.ora_inizio ? String(appuntamento.ora_inizio).slice(0, 5) : '09:00';
  const oraFineStr = (appuntamento as any).ora_fine ? String((appuntamento as any).ora_fine).slice(0, 5) : '10:00';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full my-8 p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-apple flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-sm"
                style={{ backgroundColor: appuntamento.colore || '#007AFF' }}
              >
                📅
              </div>
              <div>
                <h2 className="text-lg font-bold text-apple-darkgray">
                  {appuntamento.titolo || 'Appuntamento'}
                </h2>
                <p className="text-xs text-apple-gray">
                  {appuntamento.cliente?.nome_cognome || '—'}
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

          <div className="bg-gray-50 rounded-apple p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-apple-gray">📅 Data</span>
              <span className="font-medium text-apple-darkgray capitalize">
                {formatData(appuntamento.data)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-apple-gray">⏰ Orario</span>
              <span className="font-medium text-apple-darkgray">
                {oraInizioStr} – {oraFineStr} ({appuntamento.durata_minuti || 60} min)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-apple-gray">👨‍⚕️ Operatore</span>
              <span className="font-semibold text-apple-darkgray">
                {opInfo.label} ({opInfo.ruolo})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-apple-gray">📌 Stato</span>
              <span
                className={`font-semibold text-xs px-2.5 py-0.5 rounded-full ${
                  appuntamento.stato === 'completato'
                    ? 'bg-green-100 text-green-700'
                    : appuntamento.stato === 'confermato'
                    ? 'bg-blue-100 text-blue-700'
                    : appuntamento.stato === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {(appuntamento.stato || 'prenotato').toUpperCase()}
              </span>
            </div>
          </div>

          {appuntamento.voci_selezionate && appuntamento.voci_selezionate.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
                🛠️ Servizi / Prodotti dell'appuntamento
              </h3>
              <div className="bg-gray-50 rounded-apple overflow-hidden divide-y divide-gray-200 text-sm">
                {appuntamento.voci_selezionate.map((v: VoceSelezionata, i: number) => (
                  <div key={i} className="px-3.5 py-2.5 flex items-center justify-between">
                    <span>{v.tipo === 'servizio' ? '🛠️' : '📦'} {v.nome}</span>
                    <span className="font-bold text-xs bg-white px-2 py-0.5 rounded border border-gray-200">
                      × {v.quantita}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appuntamento.note && (
            <div>
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1">
                📝 Note
              </h3>
              <p className="text-xs text-apple-gray italic bg-gray-50 rounded-apple p-3">
                {appuntamento.note}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200/60 space-y-2">
            {isPercorso && (
              <button
                onClick={() => onScaricoSeduta(appuntamento)}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-apple font-semibold text-sm hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>📋</span>
                <span>Avvia Scarico Seduta & DDT</span>
              </button>
            )}

            {isCheckup && (
              <button
                onClick={() => onFatturaProforma(appuntamento)}
                className="w-full px-4 py-3 bg-apple-blue text-white rounded-apple font-semibold text-sm hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>📄</span>
                <span>Crea Fattura Proforma Check-Up Gratuito</span>
              </button>
            )}

            {isGenericoO_Seduta && (
              <button
                onClick={() => onFatturaDiretta(appuntamento)}
                className="w-full px-4 py-3 bg-apple-blue text-white rounded-apple font-semibold text-sm hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>💵</span>
                <span>Crea Fattura (Servizi / Prodotti)</span>
              </button>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={onModifica}
                className="flex-1 px-4 py-2 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-xs hover:bg-gray-200 transition-colors"
              >
                ✏️ Modifica
              </button>
              <button
                onClick={apriModaleElimina}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-apple font-medium text-xs hover:bg-red-100 transition-colors"
              >
                🗑️ Elimina
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODALE SCELTA ELIMINAZIONE */}
      {/* ============================================================ */}
      {modaleElimina && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={() => !salvando && setModaleElimina(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center text-2xl">
                🗑️
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-1">
                Cancella appuntamento
              </h2>
              <p className="text-xs text-apple-gray">
                {appuntamento.cliente?.nome_cognome || 'Cliente'} •{' '}
                {formatData(appuntamento.data)} • {oraInizioStr}
              </p>
            </div>

            <p className="text-xs text-apple-gray text-center mb-4">
              Scegli il motivo della cancellazione:
            </p>

            <div className="space-y-2 mb-5">
              {/* Rebooking */}
              <button
                type="button"
                onClick={() => setTipoEliminazione('rebooking')}
                className={`w-full p-3.5 rounded-apple border-2 text-left transition-all ${
                  tipoEliminazione === 'rebooking'
                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">🔄</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-apple-darkgray">
                      Rebooking
                    </p>
                    <p className="text-xs text-apple-gray mt-0.5">
                      Il cliente vuole riprogrammare. Apparirà in Dashboard
                      come "da richiamare".
                    </p>
                  </div>
                </div>
              </button>

              {/* Disdetta */}
              <button
                type="button"
                onClick={() => setTipoEliminazione('disdetta')}
                className={`w-full p-3.5 rounded-apple border-2 text-left transition-all ${
                  tipoEliminazione === 'disdetta'
                    ? 'border-red-500 bg-red-50 shadow-sm'
                    : 'border-gray-200 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">❌</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-apple-darkgray">
                      Disdetta
                    </p>
                    <p className="text-xs text-apple-gray mt-0.5">
                      Il cliente ha disdetto. Nessun follow-up automatico.
                    </p>
                  </div>
                </div>
              </button>

              {/* Definitiva */}
              <button
                type="button"
                onClick={() => setTipoEliminazione('definitiva')}
                className={`w-full p-3.5 rounded-apple border-2 text-left transition-all ${
                  tipoEliminazione === 'definitiva'
                    ? 'border-gray-700 bg-gray-100 shadow-sm'
                    : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">🗑️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-apple-darkgray">
                      Cancellazione definitiva
                    </p>
                    <p className="text-xs text-apple-gray mt-0.5">
                      Rapporto chiuso. Solo storico, nessun follow-up.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModaleElimina(false)}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaEliminazione}
                disabled={!tipoEliminazione || salvando}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-apple font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? 'Salvataggio…' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
