import { useEffect, useRef, useState } from 'react';
import { cercaComune, trovaComune, type Comune } from '../lib/comuni';

interface InputComuneProps {
  value: string;
  onChange: (comune: string, cap: string, provincia: string) => void;
  placeholder?: string;
}

export function InputComune({ value, onChange, placeholder }: InputComuneProps) {
  const [suggerimenti, setSuggerimenti] = useState<Comune[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [indiceAttivo, setIndiceAttivo] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(valore: string) {
    onChange(valore, '', '');

    if (valore.trim().length < 2) {
      setSuggerimenti([]);
      setShowDropdown(false);
      return;
    }

    const risultati = cercaComune(valore);
    setSuggerimenti(risultati);
    setShowDropdown(risultati.length > 0);
    setIndiceAttivo(-1);
  }

  function selezionaComune(comune: Comune) {
    const cap = comune.cap[0] || '';
    const provincia = comune.sigla || '';
    onChange(comune.nome, cap, provincia);
    setShowDropdown(false);
    setSuggerimenti([]);
    setIndiceAttivo(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggerimenti.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAttivo((prev) => (prev + 1) % suggerimenti.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAttivo((prev) => (prev - 1 + suggerimenti.length) % suggerimenti.length);
    } else if (e.key === 'Enter' && indiceAttivo >= 0) {
      e.preventDefault();
      selezionaComune(suggerimenti[indiceAttivo]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  const comuneValido = value.length >= 2 && trovaComune(value) !== null;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggerimenti.length > 0) setShowDropdown(true);
        }}
        placeholder={placeholder || 'es. Talamona'}
        className={`w-full px-4 py-3 sm:py-2.5 pr-10 bg-white border rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 transition-all ${
          comuneValido
            ? 'border-green-300 focus:ring-green-300/30 focus:border-green-400'
            : 'border-gray-200 focus:ring-apple-blue/30 focus:border-apple-blue'
        }`}
      />
      {comuneValido && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-sm">
          ✓
        </span>
      )}

      {showDropdown && suggerimenti.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-apple shadow-apple-lg border border-gray-200/60 overflow-hidden max-h-72 overflow-y-auto">
          {suggerimenti.map((comune, i) => (
            <button
              key={comune.codice}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selezionaComune(comune)}
              className={`w-full px-4 py-3 sm:py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                i === indiceAttivo
                  ? 'bg-apple-blue text-white'
                  : 'text-apple-darkgray hover:bg-blue-50'
              }`}
            >
              <span className="font-medium truncate">
                {comune.nome}
                <span
                  className={`ml-2 text-xs ${
                    i === indiceAttivo ? 'text-white/80' : 'text-apple-gray'
                  }`}
                >
                  {comune.sigla}
                </span>
              </span>
              <span
                className={`text-xs shrink-0 ml-2 ${
                  i === indiceAttivo ? 'text-white/80' : 'text-apple-gray'
                }`}
              >
                {comune.cap[0]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
