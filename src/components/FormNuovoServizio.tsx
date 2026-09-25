import { useState } from 'react';
import {
  creaServizio,
  aggiornaServizio,
  eliminaServizio,
  type Servizio,
} from '../lib/servizi';

interface FormNuovoServizioProps {
  servizioIniziale?: Servizio | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FormNuovoServizio({
  servizioIniziale,
  onClose,
  onSuccess,
}: FormNuovoServizioProps) {
  const modifica = !!servizioIniziale;

  const [nome, setNome] = useState(servizioIniziale?.nome || '');
  const [prezzoLordo, setPrezzoLordo] = useState<string>(
    servizioIniziale?.prezzo_lordo !== undefined ? String(servizioIniziale.prezzo_lordo) : ''
  );
  const [durataMinuti, setDurataMinuti] = useState<string>(
    servizioIniziale?.durata_minuti !== undefined ? String(servizioIniziale.durata_minuti) : '0'
  );
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);

  async function handleSubmit() {
    // Validazione
    if (!nome.trim()) {
      setErrore('Il nome del servizio è obbligatorio');
      return;
    }
    const prezzo = parseFloat(prezzoLordo);
    if (isNaN(prezzo) || prezzo < 0) {
      setErrore('Il prezzo deve essere un numero maggiore o uguale a 0');
      return;
    }
    const durata = parseInt(durataMinuti, 10);
    if (isNaN(durata) || durata < 0) {
      setErrore('La durata deve essere un numero intero maggiore o uguale a 0');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const dati = {
        nome: nome.trim(),
        prezzo_lordo: prezzo,
        durata_minuti: durata,
      };

      if (modifica && servizioIniziale) {
        await aggiornaServizio(servizioIniziale.id, dati);
      } else {
        await creaServizio(dati);
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  async function handleElimina() {
    if (!servizioIniziale) return;
    try {
      setSalvando(true);
      setErrore(null);
      await eliminaServizio(servizioIniziale.id);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nell\'eliminazione. Il servizio potrebbe essere usato in percorsi o fatture.');
      setSalvando(false);
      setShowConfermaElimina(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-lg max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white text-xl shrink-0">
              🛠️
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                {modifica ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </h2>
              <p className="text-xs text-apple-gray">
                {modifica ? `ID ${servizioIniziale?.id}` : 'Aggiungi un servizio al catalogo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Nome Servizio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="es. Trattamento Tricologico"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Prezzo Lordo (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prezzoLordo}
                onChange={(e) => setPrezzoLordo(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Durata (minuti)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={durataMinuti}
                onChange={(e) => setDurataMinuti(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
          </div>

          {showConfermaElimina && modifica && servizioIniziale && (
            <div className="bg-red-50 border-2 border-red-300 rounded-apple p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800 mb-1">
                    Eliminare questo servizio?
                  </p>
                  <p className="text-xs text-red-700 leading-relaxed">
                    L'azione è irreversibile. Se il servizio è usato in percorsi o fatture, l'eliminazione fallirà.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleElimina}
                  disabled={salvando}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {salvando ? 'Eliminazione...' : 'Sì, elimina'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfermaElimina(false)}
                  disabled={salvando}
                  className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          {modifica && !showConfermaElimina && (
            <button
              type="button"
              onClick={() => setShowConfermaElimina(true)}
              disabled={salvando}
              className="px-4 py-3 sm:py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Elimina servizio"
            >
              🗑️
            </button>
          )}
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
            disabled={salvando || !nome.trim()}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : modifica ? 'Salva Modifiche' : 'Crea Servizio'}
          </button>
        </div>
      </div>
    </div>
  );
}
