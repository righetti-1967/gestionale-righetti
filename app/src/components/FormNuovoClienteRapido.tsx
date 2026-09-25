import { useState } from 'react';
import { creaCliente, type Cliente } from '../lib/clienti';

interface FormNuovoClienteRapidoProps {
  onClose: () => void;
  onSuccess: (nuovoCliente: Cliente) => void;
  nomeIniziale?: string;
}

export function FormNuovoClienteRapido({
  nomeIniziale,
  onClose,
  onSuccess,
}: FormNuovoClienteRapidoProps) {
  const [nomeCognome, setNomeCognome] = useState(nomeIniziale || '');
  const [cellulare, setCellulare] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function handleSubmit() {
    // Validazioni
    if (!nomeCognome.trim()) {
      setErrore('Inserisci nome e cognome');
      return;
    }
    if (!cellulare.trim()) {
      setErrore('Inserisci il cellulare');
      return;
    }
    if (!email.trim()) {
      setErrore('Inserisci l\'email');
      return;
    }
    if (!dataNascita) {
      setErrore('Inserisci la data di nascita');
      return;
    }

    // Validazione email basilare
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrore('Email non valida');
      return;
    }

    // Data di nascita non può essere nel futuro
    const oggi = new Date();
    const dn = new Date(dataNascita);
    if (dn > oggi) {
      setErrore('La data di nascita non può essere nel futuro');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const nuovoCliente = await creaCliente({
        nome_cognome: nomeCognome.trim(),
        cellulare: cellulare.trim(),
        email: email.trim(),
        codice_fiscale: null,
        partita_iva: null,
        codice_sdi: null,
        note_anamnesi: null,
        indirizzo_residenza: null,
        cap_residenza: null,
        citta_residenza: null,
        provincia_residenza: null,
        indirizzo_spedizione: null,
        cap_spedizione: null,
        citta_spedizione: null,
        provincia_spedizione: null,
        privacy_firmata: false,
        data_nascita: dataNascita,
      });

      onSuccess(nuovoCliente);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
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
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-xl shrink-0">
              👤
            </div>
            <div>
              <h2 className="text-lg font-bold text-apple-darkgray">
                Nuovo Cliente Veloce
              </h2>
              <p className="text-xs text-apple-gray">
                Compila i dati obbligatori
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
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
        >
          {/* Nome e Cognome */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Nome e Cognome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nomeCognome}
              onChange={(e) => setNomeCognome(e.target.value)}
              placeholder="Es. Mario Rossi"
              autoFocus
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            />
          </div>

          {/* Cellulare */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Cellulare <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={cellulare}
              onChange={(e) => setCellulare(e.target.value)}
              placeholder="Es. 333 1234567"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Es. mario.rossi@email.com"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            />
          </div>

          {/* Data di nascita */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Data di Nascita <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dataNascita}
              onChange={(e) => setDataNascita(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            />
          </div>

          <p className="text-xs text-apple-gray italic">
            ℹ️ Potrai completare gli altri dati (indirizzo, CF, ecc.) dalla pagina Clienti.
          </p>

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
            disabled={salvando || !nomeCognome.trim() || !cellulare.trim() || !email.trim() || !dataNascita}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-green-600 text-white rounded-apple font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : 'Crea Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
