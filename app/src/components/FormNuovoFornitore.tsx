import { useState } from 'react';
import {
  creaFornitore,
  aggiornaFornitore,
  eliminaFornitore,
  type Fornitore,
} from '../lib/fornitori';

interface FormNuovoFornitoreProps {
  fornitoreIniziale?: Fornitore | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FormNuovoFornitore({
  fornitoreIniziale,
  onClose,
  onSuccess,
}: FormNuovoFornitoreProps) {
  const modifica = !!fornitoreIniziale;

  const [ragioneSociale, setRagioneSociale] = useState(fornitoreIniziale?.ragione_sociale || '');
  const [email, setEmail] = useState(fornitoreIniziale?.email || '');
  const [telefono, setTelefono] = useState(fornitoreIniziale?.telefono || '');
  const [indirizzo, setIndirizzo] = useState(fornitoreIniziale?.indirizzo || '');
  const [cap, setCap] = useState(fornitoreIniziale?.cap || '');
  const [citta, setCitta] = useState(fornitoreIniziale?.citta || '');
  const [provincia, setProvincia] = useState(fornitoreIniziale?.provincia || '');
  const [partitaIva, setPartitaIva] = useState(fornitoreIniziale?.partita_iva || '');
  const [codiceFiscale, setCodiceFiscale] = useState(fornitoreIniziale?.codice_fiscale || '');
  const [codiceSdi, setCodiceSdi] = useState(fornitoreIniziale?.codice_sdi || '');
  const [iban, setIban] = useState(fornitoreIniziale?.iban || '');
  const [scontoPercentuale, setScontoPercentuale] = useState<string>(
    fornitoreIniziale?.sconto_percentuale !== undefined
      ? String(fornitoreIniziale.sconto_percentuale)
      : '0'
  );
  const [giorniConsegna, setGiorniConsegna] = useState(fornitoreIniziale?.giorni_consegna || '');
  const [note, setNote] = useState(fornitoreIniziale?.note || '');

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);

  async function handleSubmit() {
    if (!ragioneSociale.trim()) {
      setErrore('La ragione sociale è obbligatoria');
      return;
    }

    const sconto = parseFloat(scontoPercentuale) || 0;
    if (sconto < 0 || sconto > 100) {
      setErrore('Lo sconto deve essere compreso tra 0 e 100');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const dati = {
        ragione_sociale: ragioneSociale.trim(),
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        indirizzo: indirizzo.trim() || null,
        cap: cap.trim() || null,
        citta: citta.trim() || null,
        provincia: provincia.trim() || null,
        partita_iva: partitaIva.trim() || null,
        codice_fiscale: codiceFiscale.trim() || null,
        codice_sdi: codiceSdi.trim() || null,
        iban: iban.trim() || null,
        sconto_percentuale: sconto,
        giorni_consegna: giorniConsegna.trim() || null,
        note: note.trim() || null,
      };

      if (modifica && fornitoreIniziale) {
        await aggiornaFornitore(fornitoreIniziale.id, dati);
      } else {
        await creaFornitore(dati);
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
    if (!fornitoreIniziale) return;
    try {
      setSalvando(true);
      setErrore(null);
      await eliminaFornitore(fornitoreIniziale.id);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nell\'eliminazione. Il fornitore potrebbe essere usato in prodotti.');
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
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-2xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xl shrink-0">
              🏭
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                {modifica ? 'Modifica Fornitore' : 'Nuovo Fornitore'}
              </h2>
              <p className="text-xs text-apple-gray">
                {modifica ? `ID ${fornitoreIniziale?.id}` : 'Aggiungi un fornitore all\'anagrafica'}
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
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {/* Dati anagrafici */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              🏢 Dati Anagrafici
            </h3>

            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Ragione Sociale <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ragioneSociale}
                onChange={(e) => setRagioneSociale(e.target.value)}
                placeholder="es. Forniture Tricologiche S.r.l."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Partita IVA
                </label>
                <input
                  type="text"
                  value={partitaIva}
                  onChange={(e) => setPartitaIva(e.target.value)}
                  placeholder="IT12345678901"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Codice Fiscale
                </label>
                <input
                  type="text"
                  value={codiceFiscale}
                  onChange={(e) => setCodiceFiscale(e.target.value)}
                  placeholder="RSSLCU80A01H501Z"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
            </div>
          </div>

          {/* Contatti */}
          <div className="border-t border-gray-200/60 pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              📞 Contatti
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@fornitore.it"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+39 333 1234567"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
            </div>
          </div>

          {/* Sede */}
          <div className="border-t border-gray-200/60 pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              📍 Sede
            </h3>

            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Indirizzo
              </label>
              <input
                type="text"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="Via Roma 1"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  CAP
                </label>
                <input
                  type="text"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  placeholder="20100"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Città
                </label>
                <input
                  type="text"
                  value={citta}
                  onChange={(e) => setCitta(e.target.value)}
                  placeholder="Milano"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Provincia
                </label>
                <input
                  type="text"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  placeholder="MI"
                  maxLength={2}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
            </div>
          </div>

          {/* Dati fiscali e commerciali */}
          <div className="border-t border-gray-200/60 pt-4 space-y-4">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              💼 Dati Fiscali e Commerciali
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Codice SDI
                </label>
                <input
                  type="text"
                  value={codiceSdi}
                  onChange={(e) => setCodiceSdi(e.target.value)}
                  placeholder="0000000"
                  maxLength={7}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  IBAN
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="IT60X0542811101000000123456"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Sconto Fornitore (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={scontoPercentuale}
                  onChange={(e) => setScontoPercentuale(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
                <p className="text-xs text-apple-gray mt-1">
                  Sconto di default applicato ai prodotti di questo fornitore
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Giorni Consegna
                </label>
                <input
                  type="text"
                  value={giorniConsegna}
                  onChange={(e) => setGiorniConsegna(e.target.value)}
                  placeholder="es. 5-7 giorni"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="border-t border-gray-200/60 pt-4">
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note interne sul fornitore..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all resize-none"
            />
          </div>

          {showConfermaElimina && modifica && fornitoreIniziale && (
            <div className="bg-red-50 border-2 border-red-300 rounded-apple p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800 mb-1">
                    Eliminare questo fornitore?
                  </p>
                  <p className="text-xs text-red-700 leading-relaxed">
                    L'azione è irreversibile. Se il fornitore è usato in prodotti, l'eliminazione fallirà.
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
              title="Elimina fornitore"
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
            disabled={salvando || !ragioneSociale.trim()}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : modifica ? 'Salva Modifiche' : 'Crea Fornitore'}
          </button>
        </div>
      </div>
    </div>
  );
}
