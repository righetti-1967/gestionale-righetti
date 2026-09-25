import { useState } from 'react';

interface InputValidatoProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  validator?: (v: string) => string | null;
  transform?: (v: string) => string;
  required?: boolean;
}

export function InputValidato({
  value,
  onChange,
  placeholder,
  type = 'text',
  validator,
  transform,
  required,
}: InputValidatoProps) {
  const [touched, setTouched] = useState(false);

  const errore = validator ? validator(value) : null;
  const vuoto = !value.trim();
  const valido = !errore && !vuoto;
  const mostraErrore = touched && errore;
  const mostraObbligatorio = touched && required && vuoto;

  function handleChange(v: string) {
    const valore = transform ? transform(v) : v;
    onChange(valore);
  }

  let bordoClass = 'border-gray-200 focus:ring-apple-blue/30 focus:border-apple-blue';
  if (mostraErrore || mostraObbligatorio) {
    bordoClass = 'border-red-300 focus:ring-red-300/30 focus:border-red-400';
  } else if (valido && touched) {
    bordoClass = 'border-green-300 focus:ring-green-300/30 focus:border-green-400';
  }

  return (
    <div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 sm:py-2.5 pr-10 bg-white border rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 transition-all ${bordoClass}`}
        />
        {touched && !vuoto && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
            {valido ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-red-500">✕</span>
            )}
          </span>
        )}
      </div>
      {mostraErrore && <p className="mt-1 text-xs text-red-600">{errore}</p>}
      {mostraObbligatorio && <p className="mt-1 text-xs text-red-600">Campo obbligatorio</p>}
    </div>
  );
}
