import { useEffect, useState } from 'react';

export type ToastTipo = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  tipo?: ToastTipo;
  duration?: number;
  onComplete?: () => void;
}

const STILI: Record<ToastTipo, { bg: string; text: string; icona: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-600', icona: '✓' },
  error:   { bg: 'bg-red-100',   text: 'text-red-600',   icona: '✕' },
  info:    { bg: 'bg-blue-100',  text: 'text-blue-600',  icona: 'ℹ' },
};

export function Toast({
  message,
  tipo = 'success',
  duration = 3000,
  onComplete,
}: ToastProps) {
  const [visibile, setVisibile] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibile(false);
      setTimeout(() => {
        onComplete?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const stile = STILI[tipo];

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0
        z-[100] transition-all duration-300 ease-out
        ${visibile ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="bg-white rounded-apple shadow-apple-lg border border-gray-200/60 px-5 py-4 flex items-center gap-3 max-w-sm">
        <div
          className={`w-8 h-8 rounded-full ${stile.bg} flex items-center justify-center ${stile.text} font-bold shrink-0`}
        >
          {stile.icona}
        </div>
        <p className="text-sm font-medium text-apple-darkgray">{message}</p>
      </div>
    </div>
  );
}
