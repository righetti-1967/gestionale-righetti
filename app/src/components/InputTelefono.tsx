import { useState } from 'react';
import { PAESI, getPaese, messaggioCellulare } from '../lib/validazioni';

interface InputTelefonoProps {
  value: string;
  onChange: (numero: string) => void;
  paese: string;
  onChangePaese: (codicePaese: string) => void;
  placeholder?: string;
}

export function InputTelefono({
  value,
  onChange,
  paese,
  onChangePaese,
  placeholder,
}: InputTelefonoProps) {
  const [touched, setTouched] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const paeseAttuale = getPaese(paese);
  const errore = messaggioCellulare(value, paese);
  const vuoto = !value.trim();
  const valido = !errore && !vuoto;
  const mostraErrore = touched && errore;

  let bordoClass = 'border-gray-200 focus-within:ring-apple-blue/30 focus-within:border-apple-blue';
  if (mostraErrore) {
    bordoClass = 'border-red-300 focus-within:ring-red-300/30 focus-within:border-red-400';
  } else if (valido && touched) {
    bordoClass = 'border-green-300 focus-within:ring-green-300/30 focus-within:border-green-400';
  }

  return (
    <div>
      <div
        className={`flex items-stretch bg-white border rounded-apple overflow-hidden transition-all focus-within:ring-2 ${bordoClass}`}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="h-full px-3 flex items-center gap-2 border-r border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
            title={paeseAttuale.nome}
          >
            <span className="text-lg">{paeseAttuale.bandiera}</span>
            <span className="text-xs font-medium text-apple-darkgray">
              {paeseAttuale.prefisso}
            </span>
            <span className="text-xs text-apple-gray">▾</span>
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-white rounded-apple shadow-apple-lg border border-gray-200/60 overflow-hidden max-h-72 overflow-y-auto">
                {PAESI.map((p) => (
                  <button
                    key={p.codice}
                    type="button"
                    onClick={() => {
                      onChangePaese(p.codice);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-3 py-3 sm:py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                      p.codice === paese
                        ? 'bg-apple-blue text-white'
                        : 'text-apple-darkgray hover:bg-blue-50'
                    }`}
                  >
                    <span className="text-lg">{p.bandiera}</span>
                    <span className="flex-1 font-medium">{p.nome}</span>
                    <span
                      className={`text-xs ${
                        p.codice === paese ? 'text-white/80' : 'text-apple-gray'
                      }`}
                    >
                      {p.prefisso}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <input
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder || 'es. 3496780650'}
          className="flex-1 min-w-0 px-3 py-3 sm:py-2.5 bg-transparent text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none"
        />

        {touched && !vuoto && (
          <span className="flex items-center pr-3 text-sm shrink-0">
            {valido ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-red-500">✕</span>
            )}
          </span>
        )}
      </div>

      {mostraErrore && <p className="mt-1 text-xs text-red-600">{errore}</p>}
    </div>
  );
}
