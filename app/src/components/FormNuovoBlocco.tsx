import { useState, type FormEvent } from 'react';
import {
  creaBlocco,
  OPERATORI,
  getOperatoriVisibili,
  type Operatore,
} from '../lib/appuntamenti';

interface FormNuovoBloccoProps {
  dataIniziale?: string;
  operatoreIniziale?: Operatore;
  oraIniziale?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DURATA_DEFAULT = 60;

export function FormNuovoBlocco({
  dataIniziale,
  operatoreIniziale,
  oraIniziale,
  onClose,
  onSuccess,
}: FormNuovoBloccoProps) {
  const oggi = new Date().toISOString().split('T')[0];

  const operatoriVisibili = getOperatoriVisibili();

  const [titolo, setTitolo] = useState('');
  const [note, setNote] = useState('');
  const [operatore, setOperatore] = useState<Operatore>(operatoreIniziale ?? 'luca');
  const [data, setData] = useState(dataIniziale ?? oggi);
  const [oraInizio, setOraInizio] = useState(oraIniziale ?? '12:00');
  const [durata, setDurata] = useState(DURATA_DEFAULT);

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!titolo.trim()) {
      setErrore('Inserisci un titolo (es. Ferie, Pranzo, Occupato).');
      return;
    }
    if (!data || !oraInizio) {
      setErrore('Compila data e ora.');
      return;
    }

    setSalvando(true);
    setErrore(null);

    try {
      await creaBlocco({
        operatore,
        data,
        ora_inizio: oraInizio,
        durata_minuti: durata,
        titolo: titolo.trim(),
        note: note.trim() || null,
        colore: 'gray',
      });
      onSuccess();
    } catch (err) {
      console.error('Errore creazione blocco:', err);
      const msg = err instanceof Error ? err.message : 'Errore nel salvataggio.';
      setErrore(msg);
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[70]"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-md max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center text-white text-xl shrink-0">
              🚫
            </div>
            <div>
              <h2 className="text-lg font-bold text-apple-darkgray">
                Nuovo Blocco
              </h2>
              <p className="text-xs text-apple-gray">
                Blocca uno slot in agenda con una nota
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
        >
          {/* Titolo */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Titolo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Es. Ferie, Pausa pranzo, Occupato…"
              autoFocus
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            />
          </div>

          {/* Operatore */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Operatore <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {operatoriVisibili.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOperatore(op)}
                  className={`px-3 py-2.5 rounded-apple text-sm font-medium transition-all ${
                    operatore === op
                      ? 'bg-apple-blue text-white shadow-apple'
                      : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                  }`}
                >
                  {OPERATORI[op].label}
                </button>
              ))}
            </div>
          </div>

          {/* Data + Ora + Durata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-3 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Ora inizio <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={oraInizio}
                onChange={(e) => setOraInizio(e.target.value)}
                className="w-full px-3 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Durata (min)
              </label>
              <input
                type="number"
                min={15}
                step={15}
                value={durata}
                onChange={(e) => setDurata(Number(e.target.value) || DURATA_DEFAULT)}
                className="w-full px-3 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Note (visibili in agenda)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. Ferie fino a lunedì, rientro mercoledì…"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all resize-none"
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
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
            disabled={salvando || !titolo.trim()}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-gray-700 text-white rounded-apple font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio…' : '🚫 Crea Blocco'}
          </button>
        </div>
      </div>
    </div>
  );
}
