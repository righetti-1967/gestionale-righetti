import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  creaSessioneFirmaFattura,
  getFattura,
  type FatturaConCliente,
} from '../lib/fatture';
import type { Cliente } from '../lib/clienti';

interface FirmaFatturaQRProps {
  fattura: FatturaConCliente;
  cliente: Cliente | null;
  onClose: () => void;
  onSuccess: (fatturaAggiornata: FatturaConCliente) => void;
}

export function FirmaFatturaQR({
  fattura,
  cliente,
  onClose,
  onSuccess,
}: FirmaFatturaQRProps) {
  const [token, setToken] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<number | null>(null);
  const apertoRef = useRef(true);
  const firmaInizialeRef = useRef<string | null>(fattura.firma_immagine ?? null);
  const isTouchDevice =
    typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

  // Crea la sessione firma all'apertura
  useEffect(() => {
    apertoRef.current = true;
    async function creaSessione() {
      try {
        setLoading(true);
        const sessione = await creaSessioneFirmaFattura(fattura.id);
        setToken(sessione.token);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore nella creazione della sessione');
      } finally {
        setLoading(false);
      }
    }
    creaSessione();

    return () => {
      apertoRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fattura.id]);

  // Polling ogni 2 secondi — chiude la modale quando rileva una firma nuova
  useEffect(() => {
    if (!token) return;

    pollingRef.current = window.setInterval(async () => {
      if (!apertoRef.current) return;

      const fatturaAggiornata = await getFattura(fattura.id);
      if (!fatturaAggiornata) return;

      const firmaCorrente = fatturaAggiornata.firma_immagine ?? null;
      const firmaNuova =
        firmaCorrente !== null && firmaCorrente !== firmaInizialeRef.current;

      if (firmaNuova && apertoRef.current) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        onSuccess(fatturaAggiornata);
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [token, fattura.id, onSuccess]);

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const urlFirma = token ? `${baseUrl}/firma-fattura/${token}` : '';

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-apple-darkgray">Firma Proforma</h2>
            <p className="text-xs text-apple-gray">
              {fattura.numero_fattura} • {cliente?.nome_cognome || fattura.cliente?.nome_cognome || '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-apple-gray text-sm">Creazione sessione...</div>
          </div>
        )}

        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
            ❌ {errore}
          </div>
        )}

        {!loading && !errore && token && (
          <>
            <div className="text-center mb-5">
              <p className="text-sm text-apple-darkgray mb-1">
                <strong>{cliente?.nome_cognome || fattura.cliente?.nome_cognome || '—'}</strong>
              </p>
              <p className="text-xs text-apple-gray">
                {isTouchDevice
                  ? 'Clicca il pulsante per aprire la firma'
                  : "Inquadra il QR con l'iPad per aprire la firma"}
              </p>
            </div>

            {isTouchDevice ? (
              <a
                href={urlFirma}
                className="block w-full text-center px-6 py-4 bg-apple-blue text-white rounded-apple font-semibold text-base hover:bg-blue-600 transition-colors shadow-apple mb-5"
              >
                🖊️ Firma su questo dispositivo
              </a>
            ) : (
              <div className="flex justify-center mb-5">
                <div className="bg-white p-4 rounded-apple border-2 border-gray-100">
                  <QRCodeSVG
                    value={urlFirma}
                    size={220}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#1C1C1E"
                  />
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-apple p-3 mb-5">
              <div className="flex items-center gap-2 text-xs text-apple-darkgray">
                <div className="w-2 h-2 rounded-full bg-apple-blue animate-pulse shrink-0" />
                <span>In attesa che il cliente firmi...</span>
              </div>
            </div>

            {!isTouchDevice && (
              <div className="text-center">
                <p className="text-xs text-apple-gray mb-1">
                  Oppure apri questo link sull'iPad:
                </p>
                <p className="text-xs text-apple-blue font-mono break-all">
                  {urlFirma}
                </p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200/60 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
