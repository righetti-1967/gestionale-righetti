import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import {
  getSessioneFirmaFattura,
  completaSessioneFirmaFattura,
  salvaFirmaFattura,
  getFattura,
  type FatturaConCliente,
} from '../lib/fatture';
import { generaPdfFattura } from '../lib/pdfFattura';
import { useDatiAziendali } from '../lib/useDatiAziendali';

interface PaginaFirmaFatturaIPadProps {
  token: string;
}

export function PaginaFirmaFatturaIPad({ token }: PaginaFirmaFatturaIPadProps) {
  const { dati: azienda } = useDatiAziendali();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [fattura, setFattura] = useState<FatturaConCliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [firmaPresente, setFirmaPresente] = useState(false);
  const [completato, setCompletato] = useState(false);

  const canvasCallback = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      signaturePadRef.current?.off();
      signaturePadRef.current = null;
      return;
    }

    if (signaturePadRef.current && canvasRef.current === canvas) {
      return;
    }

    if (signaturePadRef.current) {
      signaturePadRef.current.off();
      signaturePadRef.current = null;
    }

    canvas.width = 0;
    canvas.height = 0;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(20, 20, 20)',
      minWidth: 1.5,
      maxWidth: 4,
    });
    signaturePadRef.current = pad;
    canvas.style.touchAction = 'none';

    pad.addEventListener('endStroke', () => {
      setFirmaPresente(!pad.isEmpty());
    });

    canvasRef.current = canvas;
  };

  useEffect(() => {
    async function carica() {
      try {
        const sessione = await getSessioneFirmaFattura(token);
        if (!sessione) {
          setErrore('Sessione non valida o scaduta');
          setLoading(false);
          return;
        }
        if (sessione.completata) {
          setErrore('Questa firma è già stata completata');
          setLoading(false);
          return;
        }

        const f = await getFattura(sessione.fattura_id);
        if (!f) {
          setErrore('Fattura non trovata');
          setLoading(false);
          return;
        }
        setFattura(f);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [token]);

  function pulisciFirma() {
    signaturePadRef.current?.clear();
    setFirmaPresente(false);
  }

  async function handleConferma() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty() || !fattura) {
      setErrore('Devi firmare prima di confermare');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const firmaBase64 = signaturePadRef.current.toDataURL('image/png');
      const fatturaAggiornata = await salvaFirmaFattura(fattura.id, firmaBase64);
      await completaSessioneFirmaFattura(token);

      try {
        await generaPdfFattura(fatturaAggiornata);
      } catch (err) {
        console.error('Errore generazione PDF fattura:', err);
      }

      setCompletato(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio della firma');
    } finally {
      setSalvando(false);
    }
  }

  function formatEuro(importo: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(importo);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray">
        <div className="text-apple-gray">Caricamento...</div>
      </div>
    );
  }

  if (errore && !fattura) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray p-4">
        <div className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-apple-darkgray mb-2">Sessione non valida</h1>
          <p className="text-sm text-apple-gray">{errore}</p>
        </div>
      </div>
    );
  }

  if (completato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray p-4">
        <div className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center text-4xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-apple-darkgray mb-2">Grazie!</h1>
          <p className="text-sm text-apple-gray mb-6">
            La firma della proforma è stata completata. Consegna l'iPad allo Studio Righetti.
          </p>
          <p className="text-xs text-apple-gray">Puoi chiudere questa pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-apple-lightgray flex flex-col">
      <header className="bg-apple-blue text-white px-4 py-4 shadow-apple">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-bold text-center">{azienda.ragioneSociale}</h1>
          <p className="text-xs text-center opacity-80 mt-0.5">
            Firma Proforma {fattura?.numero_fattura}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto">
        <div className="bg-white rounded-apple shadow-apple p-4 mb-4">
          <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
            Riepilogo Proforma
          </p>
          <p className="text-lg font-bold text-apple-darkgray mb-3">
            {fattura?.cliente?.nome_cognome || '—'}
          </p>
          <div className="space-y-1.5 mb-3">
            {(fattura?.righe || []).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm gap-3">
                <span className="text-apple-darkgray truncate">
                  {r.nome || (r.tipo === 'percorso' ? 'Percorso' : 'Voce fattura')}
                </span>
                <span className="text-apple-gray font-semibold shrink-0">
                  {r.quantita}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              Totale
            </span>
            <span className="text-xl font-bold text-apple-darkgray">
              {formatEuro(Number(fattura?.lordo_ivato || 0))}
            </span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 mb-4 text-center">
          <p className="text-sm text-apple-darkgray">
            ✍️ <strong>Firma con il dito o con Apple Pencil</strong> nello spazio qui sotto
          </p>
        </div>

        {fattura && (
          <div className="bg-white rounded-apple shadow-apple p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                Firma per accettazione
              </p>
              <button
                type="button"
                onClick={pulisciFirma}
                disabled={!firmaPresente || salvando}
                className="text-xs text-apple-blue hover:text-blue-700 font-medium disabled:opacity-40"
              >
                🧹 Pulisci
              </button>
            </div>
            <div className="relative border-2 border-dashed border-gray-300 rounded-apple overflow-hidden bg-white">
              <canvas
                ref={canvasCallback}
                className="w-full"
                style={{ height: '300px', touchAction: 'none' }}
              />
              {!firmaPresente && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ pointerEvents: 'none' }}
                >
                  <p className="text-apple-gray/60 text-base select-none">
                    ✍️ Firma qui con il dito
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm mb-4">
            ❌ {errore}
          </div>
        )}

        <button
          type="button"
          onClick={handleConferma}
          disabled={!firmaPresente || salvando}
          className="w-full px-6 py-4 bg-apple-blue text-white rounded-apple font-semibold text-base hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-apple"
        >
          {salvando ? 'Salvataggio...' : '✓ Conferma Firma'}
        </button>
      </main>

      <footer className="py-4 text-center text-xs text-apple-gray">
        Powered by Righetti 1967 Gestionale
      </footer>
    </div>
  );
}
