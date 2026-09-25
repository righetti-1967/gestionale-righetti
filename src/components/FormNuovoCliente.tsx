import { useState } from 'react';
import { creaCliente, aggiornaCliente, type NuovoCliente, type Cliente } from '../lib/clienti';
import { InputComune } from './InputComune';
import { InputVia } from './InputVia';
import { InputValidato } from './InputValidato';
import { InputTelefono } from './InputTelefono';
import {
  messaggioCodiceFiscale,
  messaggioPartitaIVA,
  messaggioCodiceSDI,
  messaggioEmail,
  componiNumeroCompleto,
  scomponiNumero,
} from '../lib/validazioni';

interface FormClienteProps {
  onClose: () => void;
  onSuccess: () => void;
  // Chiamata solo quando si crea un NUOVO cliente (non in modifica)
  onClienteCreato?: (cliente: Cliente) => void;
  clienteDaModificare?: Cliente | null;
}

const clienteVuoto: NuovoCliente = {
  nome_cognome: '',
  cellulare: '',
  email: '',
  data_nascita: '',
  codice_fiscale: '',
  partita_iva: '',
  codice_sdi: '',
  note_anamnesi: '',
  indirizzo_residenza: '',
  cap_residenza: '',
  citta_residenza: '',
  provincia_residenza: '',
  indirizzo_spedizione: '',
  cap_spedizione: '',
  citta_spedizione: '',
  provincia_spedizione: '',
  privacy_firmata: false,
};

export function FormCliente({
  onClose,
  onSuccess,
  onClienteCreato,
  clienteDaModificare,
}: FormClienteProps) {
  const isModifica = !!clienteDaModificare;

  const [cliente, setCliente] = useState<NuovoCliente>(() => {
    if (clienteDaModificare) {
      const { id: _id, created_at: _created_at, privacy_firma_immagine: _privacy_firma_immagine, privacy_data_firma: _privacy_data_firma, ...rest } =
        clienteDaModificare;
      return rest;
    }
    return clienteVuoto;
  });

  const [paeseTelefono, setPaeseTelefono] = useState(() => {
    if (clienteDaModificare?.cellulare) {
      return scomponiNumero(clienteDaModificare.cellulare).codicePaese;
    }
    return 'IT';
  });

  const [numeroLocale, setNumeroLocale] = useState(() => {
    if (clienteDaModificare?.cellulare) {
      return scomponiNumero(clienteDaModificare.cellulare).numero;
    }
    return '';
  });

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function aggiorna<K extends keyof NuovoCliente>(campo: K, valore: NuovoCliente[K]) {
    setCliente((prev) => ({ ...prev, [campo]: valore }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!cliente.nome_cognome.trim()) {
      setErrore('Il nome è obbligatorio');
      return;
    }
    const errCF = messaggioCodiceFiscale(cliente.codice_fiscale || '');
    if (errCF) {
      setErrore(`Codice Fiscale: ${errCF}`);
      return;
    }
    const errPIVA = messaggioPartitaIVA(cliente.partita_iva || '');
    if (errPIVA) {
      setErrore(`Partita IVA: ${errPIVA}`);
      return;
    }
    const errSDI = messaggioCodiceSDI(cliente.codice_sdi || '');
    if (errSDI) {
      setErrore(`Codice SDI: ${errSDI}`);
      return;
    }
    const errEmail = messaggioEmail(cliente.email || '');
    if (errEmail) {
      setErrore(`Email: ${errEmail}`);
      return;
    }

    const clienteDaSalvare: NuovoCliente = {
      ...cliente,
      cellulare: numeroLocale
        ? componiNumeroCompleto(numeroLocale, paeseTelefono)
        : '',
    };

    try {
      setSalvando(true);
      setErrore(null);
      if (isModifica && clienteDaModificare) {
        await aggiornaCliente(clienteDaModificare.id, clienteDaSalvare);
        onSuccess();
      } else {
        // Nuovo cliente
        const nuovoCliente = await creaCliente(clienteDaSalvare);
        // Se c'è la callback, notifica la creazione (per il dialog firma)
        if (onClienteCreato) {
          onClienteCreato(nuovoCliente);
        } else {
          onSuccess();
        }
      }
    } catch (err: any) {
      setErrore(err.message || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
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
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
              {isModifica ? 'Modifica Cliente' : 'Nuovo Cliente'}
            </h2>
            <p className="text-xs text-apple-gray">
              {isModifica
                ? `Modifica i dati di ${clienteDaModificare?.nome_cognome}`
                : 'Compila i campi per aggiungere un cliente'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Corpo scrollabile */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {/* Sezione: Anagrafica */}
          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              Anagrafica
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label required>Nome e Cognome</Label>
                <Input
                  value={cliente.nome_cognome}
                  onChange={(v) => aggiorna('nome_cognome', v)}
                  placeholder="es. Marco Rossi"
                />
              </div>
              <div>
                <Label>Cellulare</Label>
                <InputTelefono
                  value={numeroLocale}
                  onChange={setNumeroLocale}
                  paese={paeseTelefono}
                  onChangePaese={setPaeseTelefono}
                />
              </div>
              <div>
                <Label>Email</Label>
                <InputValidato
                  type="email"
                  value={cliente.email || ''}
                  onChange={(v) => aggiorna('email', v)}
                  placeholder="es. marco@email.com"
                  validator={messaggioEmail}
                />
              </div>
              <div>
                <Label>Data di Nascita</Label>
                <input
                  type="date"
                  value={cliente.data_nascita || ''}
                  onChange={(e) => aggiorna('data_nascita', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <Label>Codice Fiscale</Label>
                <InputValidato
                  value={cliente.codice_fiscale || ''}
                  onChange={(v) => aggiorna('codice_fiscale', v)}
                  placeholder="es. RSSMRC80A01H501X"
                  transform={(v) => v.toUpperCase()}
                  validator={messaggioCodiceFiscale}
                />
              </div>
              <div>
                <Label>Partita IVA</Label>
                <InputValidato
                  value={cliente.partita_iva || ''}
                  onChange={(v) => aggiorna('partita_iva', v)}
                  placeholder="es. 12345678901"
                  transform={(v) => v.replace(/\D/g, '')}
                  validator={messaggioPartitaIVA}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Codice SDI</Label>
                <InputValidato
                  value={cliente.codice_sdi || ''}
                  onChange={(v) => aggiorna('codice_sdi', v)}
                  placeholder="es. M5UXCR1"
                  transform={(v) => v.toUpperCase()}
                  validator={messaggioCodiceSDI}
                />
              </div>
            </div>
          </div>

          {/* Sezione: Indirizzo */}
          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              Indirizzo di Residenza
            </h3>

            <div className="space-y-3">
              <div>
                <Label required>
                  Città
                  <span className="ml-2 text-xs text-apple-blue font-normal normal-case">
                    (digita almeno 2 lettere)
                  </span>
                </Label>
                <InputComune
                  value={cliente.citta_residenza || ''}
                  onChange={(nome, cap, provincia) => {
                    setCliente((prev) => ({
                      ...prev,
                      citta_residenza: nome,
                      cap_residenza: cap || prev.cap_residenza,
                      provincia_residenza: provincia || prev.provincia_residenza,
                    }));
                  }}
                  placeholder="es. Talamona"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label>CAP</Label>
                  <Input
                    value={cliente.cap_residenza || ''}
                    onChange={(v) => aggiorna('cap_residenza', v)}
                    placeholder="23018"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Provincia</Label>
                  <Input
                    value={cliente.provincia_residenza || ''}
                    onChange={(v) => aggiorna('provincia_residenza', v.toUpperCase())}
                    placeholder="SO"
                  />
                </div>
              </div>

              <div>
                <Label>
                  Via/Piazza
                  {cliente.citta_residenza && (
                    <span className="ml-2 text-xs text-apple-blue font-normal normal-case">
                      (autocompletamento per {cliente.citta_residenza})
                    </span>
                  )}
                </Label>
                <InputVia
                  value={cliente.indirizzo_residenza || ''}
                  onChange={(v) => aggiorna('indirizzo_residenza', v)}
                  citta={cliente.citta_residenza || ''}
                  provincia={cliente.provincia_residenza || ''}
                  placeholder={
                    cliente.citta_residenza
                      ? 'es. Via Roma 1'
                      : 'Inserisci prima la Città qui sopra'
                  }
                />
              </div>
            </div>
          </div>

          {/* Sezione: Privacy */}
          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              Privacy
            </h3>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-apple bg-gray-50 hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={cliente.privacy_firmata}
                onChange={(e) => aggiorna('privacy_firmata', e.target.checked)}
                className="w-5 h-5 rounded accent-apple-blue shrink-0 mt-0.5"
              />
              <div>
                <span className="text-sm text-apple-darkgray block">
                  Il cliente ha già firmato il consenso privacy
                </span>
                <span className="text-xs text-apple-gray block mt-0.5">
                  Usa questa opzione solo se il cliente ha firmato su carta in passato.
                  Per la firma digitale, lascia vuoto e usa il pulsante "✍️ Firma ora".
                </span>
              </div>
            </label>
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        {/* Footer fisso */}
        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={salvando}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando
              ? 'Salvataggio...'
              : isModifica
              ? 'Salva Modifiche'
              : 'Salva Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-apple-gray mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
    />
  );
}
