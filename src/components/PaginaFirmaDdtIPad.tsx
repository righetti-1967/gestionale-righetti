import { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import {
  getSessioneFirmaDdt,
  getScarico,
  salvaFirmaScarico,
  completaSessioneFirmaDdt,
  type ScaricoSeduta,
} from '../lib/scarichi';
import { getCliente, type Cliente } from '../lib/clienti';
import { generaPdfDdtCliente } from '../lib/pdfDdt';
import { useDatiAziendali } from '../lib/useDatiAziendali';

interface PaginaFirmaDdtIPadProps {
  token: string;
}

export function PaginaFirmaDdtIPad({ token }: PaginaFirmaDdtIPadProps) {
  const { dati: azienda } = useDatiAziendali();
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [scarico, setScarico] = useState<ScaricoSeduta | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [firmaPresente, setFirmaPresente] = useState(false);
  const [completato, setCompletato] = useState(false);

  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      signaturePadRef.current = null;
      return;
    }

    if (signaturePadRef.current) return;

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
  }, []);

  useEffect(() => {
    async function carica() {
      try {
        const sessione = await getSessioneFirmaDdt(token);
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

        const s = await getScarico(sessione.scarico_id);
        if (!s) {
          setErrore('Scarico non trovato');
          setLoading(false);
          return;
        }
        setScarico(s);

        const c = await getCliente(s.cliente_id);
        setCliente(c);
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
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty() || !scarico) {
      setErrore('Devi firmare prima di confermare');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const firmaBase64 = signaturePadRef.current.toDataURL('image/png');
      const scaricoAggiornato = await salvaFirmaScarico(scarico.id, firmaBase64);
      await completaSessioneFirmaDdt(token);

      try {
        await generaPdfDdtCliente(scaricoAggiornato, null, cliente);
      } catch (err) {
        console.error('Errore generazione PDF DDT:', err);
      }

      setCompletato(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio della firma');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray">
        <div className="text-apple-gray">Caricamento...</div>
      </div>
    );
  }

  if (errore && !scarico) {
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
            La firma del DDT è stata raccolta. Consegna l'iPad allo Studio Righetti.
          </p>
          <p className="text-xs text-apple-gray">Puoi chiudere questa pagina.</p>
        </div>
      </div>
    );
  }

  const anno = scarico ? new Date(scarico.data_seduta).getFullYear() : 0;
  const numeroFormattato = scarico
    ? `DDT-${String(scarico.numero_ddt).padStart(3, '0')}-${anno}`
    : '';

  return (
    <div className="min-h-screen bg-apple-lightgray flex flex-col">
      <header className="bg-apple-blue text-white px-4 py-4 shadow-apple">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-lg font-bold text-center">{azienda.ragioneSociale}</h1>
          <p className="text-xs text-center opacity-80 mt-0.5">
            Firma DDT {numeroFormattato}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto">
        <div className="bg-white rounded-apple shadow-apple p-4 mb-4">
          <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
            Riepilogo DDT
          </p>
          <p className="text-lg font-bold text-apple-darkgray mb-3">
            {cliente?.nome_cognome || '—'}
          </p>
          <div className="space-y-1.5">
            {scarico?.righe.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-apple-darkgray truncate">
                  {r.tipo === 'servizio' ? '🛠️' : '📦'} {r.nome}
                </span>
                <span className="text-apple-gray font-semibold shrink-0 ml-2">
                  × {r.quantita}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 mb-4 text-center">
          <p className="text-sm text-apple-darkgray">
            ✍️ <strong>Firma con il dito o con Apple Pencil</strong> nello spazio qui sotto
          </p>
        </div>

        {scarico && (
          <div className="bg-white rounded-apple shadow-apple p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                Firma del cliente per ricevuta
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
                ref={canvasRef}
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
