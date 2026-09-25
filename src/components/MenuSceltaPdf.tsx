import { useState } from 'react';
import type { ScaricoSeduta } from '../lib/scarichi';
import type { Percorso } from '../lib/percorsi';
import type { Cliente } from '../lib/clienti';
import { generaPdfDdtCliente, generaPdfDdtCommercialista } from '../lib/pdfDdt';
import { rimuoviFirmaScarico } from '../lib/scarichi';
import { FirmaDdtQR } from './FirmaDdtQR';

interface MenuSceltaPdfProps {
  scarico: ScaricoSeduta;
  percorso: Percorso | null;
  cliente: Cliente | null;
  onClose: () => void;
}

export function MenuSceltaPdf({
  scarico,
  percorso,
  cliente,
  onClose,
}: MenuSceltaPdfProps) {
  const [scaricando, setScaricando] = useState<string | null>(null);
  const [showFirmaQR, setShowFirmaQR] = useState(false);
  const [scaricoCorrente, setScaricoCorrente] = useState(scarico);
  const [errore, setErrore] = useState<string | null>(null);
  const [showSceltaFirma, setShowSceltaFirma] = useState(false);

  console.log('🟢 MenuSceltaPdf: render con scarico', scaricoCorrente);

  const anno = new Date(scaricoCorrente.data_seduta).getFullYear();
  const numeroFormattato = `DDT-${String(scaricoCorrente.numero_ddt).padStart(3, '0')}-${anno}`;

  async function handleScarica(tipo: 'cliente' | 'commercialista') {
    if (tipo === 'cliente') {
      // Se già firmato → chiedi cosa fare
      if (scaricoCorrente.firma_immagine) {
        setShowSceltaFirma(true);
        return;
      }
      // Altrimenti apri il QR
      setShowFirmaQR(true);
      return;
    }

    try {
      setScaricando(tipo);
      setErrore(null);
      await generaPdfDdtCommercialista(scaricoCorrente, percorso, cliente);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nella generazione del PDF');
    } finally {
      setScaricando(null);
    }
  }

  async function handleScaricaPdfFirmato() {
    try {
      setShowSceltaFirma(false);
      setScaricando('cliente');
      setErrore(null);
      await generaPdfDdtCliente(scaricoCorrente, percorso, cliente);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nella generazione del PDF');
    } finally {
      setScaricando(null);
    }
  }

  async function handleRifirma() {
    try {
      setScaricando('cliente');
      setErrore(null);
      const pulito = await rimuoviFirmaScarico(scaricoCorrente.id);
      setScaricoCorrente(pulito);
      setShowSceltaFirma(false);
      setShowFirmaQR(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nella rimozione firma');
    } finally {
      setScaricando(null);
    }
  }

  async function handleFirmaConfermata(scaricoAggiornato: typeof scarico) {
    // Il PDF è già stato generato e scaricato dal dispositivo firmante.
    // Chiudo la modale QR e aggiorno lo stato.
    setShowFirmaQR(false);
    setScaricoCorrente(scaricoAggiornato);
  }

  if (showFirmaQR) {
    return (
      <FirmaDdtQR
        scarico={scaricoCorrente}
        cliente={cliente}
        onClose={() => setShowFirmaQR(false)}
        onSuccess={handleFirmaConfermata}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center text-2xl">
            ✓
          </div>
          <h2 className="text-lg font-bold text-apple-darkgray mb-1">
            Scarico registrato!
          </h2>
          <p className="text-xs text-apple-gray">
            {numeroFormattato}
          </p>
        </div>

        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm mb-4">
            ❌ {errore}
          </div>
        )}

        <p className="text-xs text-apple-gray text-center mb-3">
          Quale documento vuoi scaricare?
        </p>

        <div className="space-y-2 mb-4">
          <button
            onClick={() => handleScarica('cliente')}
            disabled={scaricando !== null}
            className="w-full px-4 py-3 bg-blue-50 text-apple-blue rounded-apple font-medium text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {scaricando === 'cliente' ? '...' : '📄 DDT Cliente (con firma)'}
          </button>
          <button
            onClick={() => handleScarica('commercialista')}
            disabled={scaricando !== null}
            className="w-full px-4 py-3 bg-amber-50 text-amber-700 rounded-apple font-medium text-sm hover:bg-amber-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {scaricando === 'commercialista' ? '...' : '📊 Documento di Competenza'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
        >
          Chiudi
        </button>
      </div>

      {/* Modale scelta firma già presente */}
      {showSceltaFirma && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[80]"
          onClick={() => setShowSceltaFirma(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                ✍️
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-1">
                DDT già firmato
              </h2>
              <p className="text-xs text-apple-gray">
                Questo DDT ha già una firma salvata.
              </p>
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={handleScaricaPdfFirmato}
                disabled={scaricando !== null}
                className="w-full px-4 py-3 bg-blue-50 text-apple-blue rounded-apple font-medium text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {scaricando === 'cliente' ? '...' : '📄 Scarica PDF con firma esistente'}
              </button>
              <button
                onClick={handleRifirma}
                disabled={scaricando !== null}
                className="w-full px-4 py-3 bg-amber-50 text-amber-700 rounded-apple font-medium text-sm hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {scaricando === 'cliente' ? '...' : '✍️ Rifirma (cancella la firma vecchia)'}
              </button>
            </div>

            <button
              onClick={() => setShowSceltaFirma(false)}
              className="w-full px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
