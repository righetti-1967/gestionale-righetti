import { useEffect, useState } from 'react';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { useAuth } from '../lib/auth';
import { formatEuro } from '../lib/fatture';
import type { Scontrino } from '../lib/scontrini';
import { annullaScontrino } from '../lib/scontrini';
import { generaPdfScontrino } from '../lib/pdfScontrino';
import {
  inviaScontrinoEmail,
  inviaScontrinoWhatsApp,
} from '../lib/scontrini-figli';
import { verificaPassword } from '../lib/sicurezza';
import { Toast, type ToastTipo } from './Toast';

interface StampaScontrinoProps {
  scontrino: Scontrino;
  onClose: () => void;
  onAnnullato?: () => void;
}

export function StampaScontrino({ scontrino, onClose, onAnnullato }: StampaScontrinoProps) {
  const { dati: azienda } = useDatiAziendali();
  const { user } = useAuth();
  const [animazione, setAnimazione] = useState(false);
  const [inviandoEmail, setInviandoEmail] = useState(false);
  const [inviandoWa, setInviandoWa] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  // Stato modale annullo
  const [showAnnulla, setShowAnnulla] = useState(false);
  const [passwordAnnullo, setPasswordAnnullo] = useState('');
  const [motivoAnnullo, setMotivoAnnullo] = useState('');
  const [ripristinoMagazzino, setRipristinoMagazzino] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [annullando, setAnnullando] = useState(false);
  const [erroreAnnullo, setErroreAnnullo] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimazione(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showAnnulla) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showAnnulla]);

  const isFisico = scontrino.modalita_cassa === 'fisico';
  const isFiglio = scontrino.tipo === 'figlio';
  const isAnnullato = scontrino.annullato;
  const dataFormattata = new Date(scontrino.data_emissione).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const sede = azienda.sedeOperativa?.indirizzo
    ? azienda.sedeOperativa
    : azienda.sedeLegale;

  const barcodeSeed = `${scontrino.numero_scontrino}-${scontrino.id}`;
  const barcodeBars = Array.from({ length: 60 }, (_, i) => {
    const code = barcodeSeed.charCodeAt(i % barcodeSeed.length);
    return (code + i) % 3 === 0 ? 1 : (code + i) % 2 === 0 ? 2 : 3;
  });

  const subtotaleRighe = (scontrino.righe || []).reduce(
    (sum, r) => sum + r.quantita * r.prezzo_unitario_lordo,
    0
  );

  const scontoTotale =
    scontrino.sconto_totale_valore && scontrino.sconto_totale_valore > 0
      ? scontrino.sconto_totale_tipo === 'percentuale'
        ? Number((subtotaleRighe * (scontrino.sconto_totale_valore / 100)).toFixed(2))
        : scontrino.sconto_totale_valore
      : 0;

  // --- Azioni ---
  async function handleScaricaPdf() {
    try {
      await generaPdfScontrino({ scontrino, scarica: true });
    } catch (err: any) {
      setToast({ message: '❌ Errore PDF: ' + (err?.message || 'sconosciuto'), tipo: 'error' });
    }
  }

  async function handleInviaEmail() {
    const email = scontrino.cliente?.email;
    if (!email) {
      setToast({ message: '❌ Email cliente non disponibile', tipo: 'error' });
      return;
    }
    try {
      setInviandoEmail(true);
      await inviaScontrinoEmail(scontrino, email);
      setToast({ message: `✅ Email inviata a ${email}`, tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore invio email'), tipo: 'error' });
    } finally {
      setInviandoEmail(false);
    }
  }

  async function handleInviaWhatsApp() {
    const cell = scontrino.cliente?.cellulare;
    if (!cell) {
      setToast({ message: '❌ Cellulare cliente non disponibile', tipo: 'error' });
      return;
    }
    try {
      setInviandoWa(true);
      await inviaScontrinoWhatsApp(scontrino, cell);
      setToast({ message: '✅ WhatsApp aperto', tipo: 'success' });
    } catch (err: any) {
      setToast({ message: '❌ ' + (err?.message || 'Errore WhatsApp'), tipo: 'error' });
    } finally {
      setInviandoWa(false);
    }
  }

  async function handleAnnulla() {
    setErroreAnnullo(null);

    if (!passwordAnnullo.trim()) {
      setErroreAnnullo('Inserisci la password gestionale');
      return;
    }
    if (motivoAnnullo.trim().length < 10) {
      setErroreAnnullo('Il motivo deve avere almeno 10 caratteri');
      return;
    }

    try {
      setVerificando(true);
      const ok = await verificaPassword(passwordAnnullo.trim());
      if (!ok) {
        setErroreAnnullo('Password gestionale non corretta');
        return;
      }

      setAnnullando(true);
      await annullaScontrino({
        id: scontrino.id,
        motivo: motivoAnnullo.trim(),
        ripristinoMagazzino,
        annullatoDa: user?.email || 'utente',
      });

      setToast({ message: '✅ Scontrino annullato', tipo: 'success' });
      setTimeout(() => {
        setShowAnnulla(false);
        onAnnullato?.();
        onClose();
      }, 800);
    } catch (err: any) {
      setErroreAnnullo(err?.message || 'Errore annullamento');
    } finally {
      setVerificando(false);
      setAnnullando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            isFisico
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {isFisico ? '🖨️ Scontrino FISICO' : '📱 Scontrino DIGITALE'}
          </span>
          {isFiglio && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              👶 FIGLIO (0€)
            </span>
          )}
          {isAnnullato && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
              ❌ ANNULLATO
            </span>
          )}
        </div>

        <div
          className={`bg-white shadow-2xl transition-all duration-500 ${
            animazione ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          } ${isAnnullato ? 'opacity-70' : ''}`}
          style={{
            width: '340px',
            fontFamily: '"Courier New", "Menlo", monospace',
          }}
        >
          <div className="h-3 w-full" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 4px, #e5e7eb 4px, #e5e7eb 8px)',
          }} />

          <div className="px-4 py-4 text-[10px] leading-tight text-black">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-xs uppercase tracking-wider">
                {azienda.ragioneSociale || 'Studio'}
              </p>
              {azienda.partitaIva && <p>P.Iva {azienda.partitaIva}</p>}
              {azienda.codiceFiscale && !azienda.partitaIva && (
                <p>C.F. {azienda.codiceFiscale}</p>
              )}
              {sede?.indirizzo && <p>{sede.indirizzo}</p>}
              {(sede?.citta || sede?.cap) && (
                <p>
                  {sede.cap ? `${sede.cap} ` : ''}
                  {sede.citta || ''}
                  {sede.provincia ? ` (${sede.provincia})` : ''}
                </p>
              )}
              {azienda.telefono && <p>Tel.{azienda.telefono}</p>}
            </div>

            <p className="text-center my-2 tracking-[0.3em]">****************</p>

            <p className="text-center font-bold">DOCUMENTO COMMERCIALE</p>
            <p className="text-center">di vendita o prestazione</p>

            <p className="text-center my-2 tracking-[0.3em]">----------------</p>

            <div className="flex justify-between font-bold border-b border-black pb-0.5 mb-1">
              <span className="flex-1">DESCRIZIONE</span>
              <span className="w-8 text-center">IVA</span>
              <span className="w-20 text-right">EURO</span>
            </div>

            <div className="space-y-1">
              {(scontrino.righe || []).map((r, idx) => {
                const importo = r.quantita * r.prezzo_unitario_lordo;
                const isStorno = r.quantita < 0 || r.nome.toUpperCase().startsWith('STORNO');
                const haSconto = r.sconto_valore && r.sconto_valore > 0;

                let importoScontoRiga = 0;
                if (haSconto && r.sconto_valore) {
                  if (r.sconto_tipo === 'percentuale') {
                    importoScontoRiga = Number((importo * (r.sconto_valore / 100)).toFixed(2));
                  } else {
                    importoScontoRiga = Number((r.sconto_valore * r.quantita).toFixed(2));
                  }
                }

                return (
                  <div key={r.id ?? idx}>
                    <div className="flex justify-between items-start gap-1">
                      <span className={`flex-1 uppercase pr-1 ${isStorno ? 'font-bold' : ''}`}>
                        {r.quantita !== 1 && !isStorno && (
                          <span className="text-gray-700">NR.{r.quantita} </span>
                        )}
                        {r.nome}
                      </span>
                      <span className="w-8 text-center">
                        {r.iva_percentuale || 22}%
                      </span>
                      <span className={`w-20 text-right ${isStorno ? 'font-bold' : ''}`}>
                        {formatEuro(importo)}
                      </span>
                    </div>

                    {haSconto && !isStorno && (
                      <div className="flex justify-between items-start gap-1 text-[9px] italic">
                        <span className="flex-1 pl-3">
                          Sconto{' '}
                          {r.sconto_tipo === 'percentuale'
                            ? `${r.sconto_valore}%`
                            : `${formatEuro(r.sconto_valore || 0)}/pz`}
                        </span>
                        <span className="w-8 text-center" />
                        <span className="w-20 text-right text-red-600">
                          -{formatEuro(importoScontoRiga)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-center my-2 tracking-[0.3em]">----------------</p>

            <div className="space-y-0.5">
              {scontoTotale > 0 && (
                <>
                  <div className="flex justify-between text-[9px]">
                    <span>Subtotale</span>
                    <span className="w-20 text-right">{formatEuro(subtotaleRighe)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] italic text-red-600">
                    <span>
                      Sconto totale{' '}
                      {scontrino.sconto_totale_tipo === 'percentuale'
                        ? `${scontrino.sconto_totale_valore}%`
                        : formatEuro(scontrino.sconto_totale_valore || 0)}
                    </span>
                    <span className="w-20 text-right">-{formatEuro(scontoTotale)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between font-bold">
                <span>TOTALE COMPLESSIVO</span>
                <span className="w-20 text-right">{formatEuro(scontrino.totale_lordo)}</span>
              </div>
              <div className="flex justify-between">
                <span>di cui IVA</span>
                <span className="w-20 text-right">{formatEuro(scontrino.iva_importo)}</span>
              </div>
            </div>

            <p className="text-center my-2 tracking-[0.3em]">----------------</p>

            {scontrino.metodo_pagamento && scontrino.metodo_pagamento !== 'Non richiesto' && (
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>{scontrino.metodo_pagamento}</span>
                  <span className="w-20 text-right">{formatEuro(scontrino.totale_lordo)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Importo pagato</span>
                  <span className="w-20 text-right">{formatEuro(scontrino.totale_lordo)}</span>
                </div>
              </div>
            )}

            {isFiglio && (
              <p className="text-[9px] italic text-center text-gray-600 mt-1">
                Documento di cortesia — nessun pagamento
              </p>
            )}

            {isFiglio && scontrino.scontrino_madre_numero && (
              <>
                <p className="text-center my-2 tracking-[0.3em]">----------------</p>
                <p className="text-[9px] leading-tight">
                  CARTA {scontrino.scontrino_madre_numero}{' '}
                  DOC.N.{scontrino.scontrino_madre_numero} DEL {scontrino.scontrino_madre_data}
                </p>
              </>
            )}

            {scontrino.note && (
              <>
                <p className="text-center my-2 tracking-[0.3em]">----------------</p>
                <p className="text-[9px] italic text-center">{scontrino.note}</p>
              </>
            )}

            {isAnnullato && (
              <>
                <p className="text-center my-2 tracking-[0.3em]">XXXXXXXXXXXXXXXX</p>
                <p className="text-center font-bold text-red-600 text-sm">*** ANNULLATO ***</p>
                {scontrino.annullato_motivo && (
                  <p className="text-[9px] italic text-center text-red-700 mt-1">
                    Motivo: {scontrino.annullato_motivo}
                  </p>
                )}
                {scontrino.annullato_at && (
                  <p className="text-[8px] italic text-center text-red-700">
                    il {new Date(scontrino.annullato_at).toLocaleString('it-IT')}
                  </p>
                )}
                <p className="text-center my-2 tracking-[0.3em]">XXXXXXXXXXXXXXXX</p>
              </>
            )}

            <div className="text-center mt-4 space-y-0.5">
              <p className="text-[10px]">
                {dataFormattata} {scontrino.ora_emissione}
              </p>
              <p className="text-[10px] font-bold">
                {scontrino.numero_scontrino}-{scontrino.id}
              </p>
            </div>

            <div className="mt-3 flex justify-center items-end gap-[1px] h-8">
              {barcodeBars.map((w, i) => (
                <div
                  key={i}
                  className="bg-black"
                  style={{ width: `${w}px`, height: `${24 + (i % 3) * 3}px` }}
                />
              ))}
            </div>
            <p className="text-center mt-1 text-[8px] tracking-widest">{barcodeSeed}</p>

            {isFisico && (
              <p className="text-center mt-2 text-[9px] italic text-gray-500">
                — simulazione stampa termica 80mm —
              </p>
            )}
          </div>

          <div className="h-3 w-full" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 4px, #e5e7eb 4px, #e5e7eb 8px)',
          }} />
        </div>

        {/* Pulsanti azioni */}
        <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
          <button
            onClick={handleScaricaPdf}
            className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-semibold text-xs shadow-apple hover:bg-gray-50 transition-colors border border-gray-200"
          >
            ⬇️ Scarica PDF
          </button>

          <button
            onClick={handleInviaEmail}
            disabled={inviandoEmail || !scontrino.cliente?.email}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-apple font-semibold text-xs shadow-apple hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {inviandoEmail ? '⏳...' : '📧 Email'}
          </button>

          <button
            onClick={handleInviaWhatsApp}
            disabled={inviandoWa || !scontrino.cliente?.cellulare}
            className="px-4 py-2.5 bg-green-600 text-white rounded-apple font-semibold text-xs shadow-apple hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {inviandoWa ? '⏳...' : '💬 WhatsApp'}
          </button>

          {!isAnnullato && (
            <button
              onClick={() => setShowAnnulla(true)}
              className="px-4 py-2.5 bg-red-600 text-white rounded-apple font-semibold text-xs shadow-apple hover:bg-red-700 transition-colors"
              title="Annulla questo documento (richiede password)"
            >
              🗑️ Annulla
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-semibold text-xs shadow-apple hover:bg-gray-200 transition-colors"
          >
            ✕ Chiudi
          </button>
        </div>
      </div>

      {/* Modale annullo */}
      {showAnnulla && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <h2 className="text-lg font-bold text-apple-darkgray mb-2">
                Annulla documento?
              </h2>
              <p className="text-xs text-apple-gray">
                Stai per annullare <strong>{scontrino.numero_scontrino}</strong>.
                L'operazione è <strong>tracciata</strong> e reversibile solo dall'assistenza.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                  🔐 Password gestionale
                </label>
                <input
                  type="password"
                  value={passwordAnnullo}
                  onChange={(e) => setPasswordAnnullo(e.target.value)}
                  placeholder="Inserisci password"
                  autoFocus
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                  📝 Motivo (min. 10 caratteri) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoAnnullo}
                  onChange={(e) => setMotivoAnnullo(e.target.value)}
                  placeholder="Es. errore battitura, cliente ha restituito merce, scontrino duplicato..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40 resize-none"
                />
                <p className="text-[10px] text-apple-gray mt-1">
                  {motivoAnnullo.length} / 10 caratteri minimi
                </p>
              </div>

              <label className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-apple cursor-pointer">
                <input
                  type="checkbox"
                  checked={ripristinoMagazzino}
                  onChange={(e) => setRipristinoMagazzino(e.target.checked)}
                  className="w-4 h-4 accent-amber-600"
                />
                <div className="text-xs">
                  <p className="font-semibold text-amber-900">📦 Ripristina merce a magazzino</p>
                  <p className="text-amber-700 text-[11px]">
                    Attiva se il cliente ha restituito i prodotti o se l'annullo è lo stesso giorno.
                    I prodotti verranno ri-caricati in giacenza.
                  </p>
                </div>
              </label>

              {erroreAnnullo && (
                <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
                  ❌ {erroreAnnullo}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowAnnulla(false);
                  setErroreAnnullo(null);
                  setPasswordAnnullo('');
                  setMotivoAnnullo('');
                  setRipristinoMagazzino(false);
                }}
                disabled={annullando || verificando}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleAnnulla}
                disabled={annullando || verificando || motivoAnnullo.trim().length < 10 || !passwordAnnullo.trim()}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verificando ? '🔐 Verifica...' : annullando ? '⏳ Annullo...' : '🗑️ Annulla documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          tipo={toast.tipo}
          onComplete={() => setToast(null)}
        />
      )}
    </div>
  );
}
