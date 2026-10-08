import { useState } from 'react';

interface Props {
  tipo: 'email' | 'whatsapp';
  valoreIniziale: string;
  onSave: (nuovoTesto: string) => void;
  onClose: () => void;
}

const VARIABILI_EMAIL = ['{nome}', '{cognome}', '{azienda}', '{data_estesa}', '{ora}', '{servizio}'];
const VARIABILI_WHATSAPP = ['{nome}', '{data}', '{ora}', '{servizio}', '{azienda}'];

export function ModaleTestoPromemoria({ tipo, valoreIniziale, onSave, onClose }: Props) {
  const [testo, setTesto] = useState(valoreIniziale);

  const isEmail = tipo === 'email';
  const variabili = isEmail ? VARIABILI_EMAIL : VARIABILI_WHATSAPP;

  function handleSave() {
    onSave(testo);
    onClose();
  }

  function inserisciVariabile(v: string) {
    // Aggiungi alla fine
    setTesto((prev) => prev + ' ' + v);
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div>
            <h2 className="text-base font-bold text-apple-darkgray flex items-center gap-2">
              {isEmail ? '📧' : '💬'} Modifica testo {isEmail ? 'Email' : 'WhatsApp'}
            </h2>
            <p className="text-xs text-apple-gray mt-0.5">
              Modifica temporanea per questa sessione di invio
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Testo del messaggio
            </label>
            <textarea
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              rows={10}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-purple-300/40 resize-none font-mono bg-gray-50"
              placeholder={isEmail
                ? 'Ciao {nome}, ti ricordiamo il tuo appuntamento di {data} alle ore {ora}...'
                : 'Ciao {nome}, ti ricordo l\'appuntamento di {data} alle {ora}!'}
            />
          </div>

          {/* Variabili */}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Variabili disponibili (clicca per inserire)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {variabili.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserisciVariabile(v)}
                  className="px-2 py-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono hover:bg-blue-100 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {!isEmail && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-apple text-xs text-green-800 leading-relaxed">
              💬 <strong>Nota</strong>: il testo WhatsApp viene inviato come messaggio precompilato.
              Le variabili vengono sostituite automaticamente al momento dell'invio.
            </div>
          )}

          {isEmail && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-apple text-xs text-blue-800 leading-relaxed space-y-2">
              <div>
                📧 <strong>Nota</strong>: l'email ha sempre logo aziendale + footer.
              </div>
              <div>
                <strong>Placeholder automatici:</strong>
                <ul className="mt-1 ml-4 list-disc">
                  <li><code className="bg-white px-1 rounded">{'[[BOX]]'}</code> → box grigio con data/ora appuntamento</li>
                  <li><code className="bg-white px-1 rounded">{'[[WHATSAPP]]'}</code> → bottone verde WhatsApp</li>
                </ul>
              </div>
              <div>
                Se rimuovi un placeholder, quella parte <strong>non appare</strong> nell'email.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200/60 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-apple-gray hover:bg-gray-100 rounded-apple"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-apple font-semibold text-sm hover:bg-purple-700 transition-colors"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
