import { useEffect, useRef, useState } from 'react';
import { cercaVia, type ViaSuggerita } from '../lib/vie';

interface InputViaProps {
  value: string;
  onChange: (via: string) => void;
  citta: string;
  provincia?: string;
  placeholder?: string;
}

export function InputVia({ value, onChange, citta, provincia, placeholder }: InputViaProps) {
  const [suggerimenti, setSuggerimenti] = useState<ViaSuggerita[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [indiceAttivo, setIndiceAttivo] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ultimaQueryRef = useRef<string>('');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value.trim().length < 3 || !citta.trim()) {
      setSuggerimenti([]);
      setShowDropdown(false);
      return;
    }

    if (value === ultimaQueryRef.current) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const risultati = await cercaVia(value, citta, provincia);
        setSuggerimenti(risultati);
        setShowDropdown(risultati.length > 0);
        setIndiceAttivo(-1);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, citta, provincia]);

  function selezionaVia(s: ViaSuggerita) {
    const viaCompleta = s.civico ? `${s.via} ${s.civico}` : s.via;
    ultimaQueryRef.current = viaCompleta;
    onChange(viaCompleta);
    setShowDropdown(false);
    setSuggerimenti([]);
    setIndiceAttivo(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggerimenti.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAttivo((p) => (p + 1) % suggerimenti.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAttivo((p) => (p - 1 + suggerimenti.length) % suggerimenti.length);
    } else if (e.key === 'Enter' && indiceAttivo >= 0) {
      e.preventDefault();
      selezionaVia(suggerimenti[indiceAttivo]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  const cittaMancante = value.trim().length >= 3 && !citta.trim();

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          ultimaQueryRef.current = '';
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => suggerimenti.length > 0 && setShowDropdown(true)}
        placeholder={placeholder || 'es. Via Roma 1'}
        disabled={cittaMancante}
        className={`w-full px-4 py-3 sm:py-2.5 bg-white border rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 transition-all ${
          cittaMancante
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-200 focus:ring-apple-blue/30 focus:border-apple-blue'
        }`}
      />

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-apple-blue/30 border-t-apple-blue rounded-full animate-spin" />
        </div>
      )}

      {cittaMancante && (
        <p className="mt-1 text-xs text-amber-600">
          ⚠️ Inserisci prima la Città per cercare la via
        </p>
      )}

      {showDropdown && suggerimenti.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-apple shadow-apple-lg border border-gray-200/60 overflow-hidden max-h-72 overflow-y-auto">
          {suggerimenti.map((s, i) => (
            <button
              key={`${s.lat}-${s.lon}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selezionaVia(s)}
              className={`w-full px-4 py-3 sm:py-2.5 text-left text-sm flex flex-col transition-colors ${
                i === indiceAttivo
                  ? 'bg-apple-blue text-white'
                  : 'text-apple-darkgray hover:bg-blue-50'
              }`}
            >
              <span className="font-medium">
                {s.via}
                {s.civico && (
                  <span
                    className={`ml-2 text-xs ${
                      i === indiceAttivo ? 'text-white/80' : 'text-apple-gray'
                    }`}
                  >
                    n. {s.civico}
                  </span>
                )}
              </span>
              <span
                className={`text-xs mt-0.5 ${
                  i === indiceAttivo ? 'text-white/80' : 'text-apple-gray'
                }`}
              >
                {s.citta} {s.cap && `• ${s.cap}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
