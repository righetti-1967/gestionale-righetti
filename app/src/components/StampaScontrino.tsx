import { useEffect, useState } from 'react';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { formatEuro } from '../lib/fatture';
import type { Scontrino, RigaScontrino } from '../lib/scontrini';

interface StampaScontrinoProps {
  scontrino: Scontrino;
  onClose: () => void;
}

export function StampaScontrino({ scontrino, onClose }: StampaScontrinoProps) {
  const { dati: azienda } = useDatiAziendali();
  const [animazione, setAnimazione] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimazione(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isFisico = scontrino.modalita_cassa === 'fisico';
  const isFiglio = scontrino.tipo === 'figlio';
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

  // Calcola subtotale righe (per capire se c'è sconto totale)
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
        </div>

        <div
          className={`bg-white shadow-2xl transition-all duration-500 ${
            animazione ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
          }`}
          style={{
            width: '340px',
            fontFamily: '"Courier New", "Menlo", monospace',
          }}
        >
          <div className="h-3 w-full" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 4px, #e5e7eb 4px, #e5e7eb 8px)',
          }} />

          <div className="px-4 py-4 text-[10px] leading-tight text-black">
            {/* === INTESTAZIONE AZIENDA === */}
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

            {/* === INTESTAZIONE COLONNE === */}
            <div className="flex justify-between font-bold border-b border-black pb-0.5 mb-1">
              <span className="flex-1">DESCRIZIONE</span>
              <span className="w-8 text-center">IVA</span>
              <span className="w-20 text-right">EURO</span>
            </div>

            {/* === RIGHE + SOTTO-RIGHE SCONTO === */}
            <div className="space-y-1">
              {(scontrino.righe || []).map((r, idx) => {
                const importo = r.quantita * r.prezzo_unitario_lordo;
                const isStorno = r.quantita < 0 || r.nome.toUpperCase().startsWith('STORNO');
                const haSconto = r.sconto_valore && r.sconto_valore > 0;

                // Calcola importo sconto (se presente)
                let importoScontoRiga = 0;
                if (haSconto && r.sconto_valore) {
                  if (r.sconto_tipo === 'percentuale') {
                    importoScontoRiga = Number(
                      (importo * (r.sconto_valore / 100)).toFixed(2)
                    );
                  } else {
                    importoScontoRiga = Number(
                      (r.sconto_valore * r.quantita).toFixed(2)
                    );
                  }
                }

                return (
                  <div key={r.id ?? idx}>
                    {/* Riga normale */}
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

                    {/* Sotto-riga sconto (se presente) */}
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

            {/* === TOTALI === */}
            <div className="space-y-0.5">
              {scontoTotale > 0 && (
                <>
                  <div className="flex justify-between text-[9px]">
                    <span>Subtotale</span>
                    <span className="w-20 text-right">
                      {formatEuro(subtotaleRighe)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] italic text-red-600">
                    <span>
                      Sconto totale{' '}
                      {scontrino.sconto_totale_tipo === 'percentuale'
                        ? `${scontrino.sconto_totale_valore}%`
                        : formatEuro(scontrino.sconto_totale_valore || 0)}
                    </span>
                    <span className="w-20 text-right">
                      -{formatEuro(scontoTotale)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between font-bold">
                <span>TOTALE COMPLESSIVO</span>
                <span className="w-20 text-right">
                  {formatEuro(scontrino.totale_lordo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>di cui IVA</span>
                <span className="w-20 text-right">
                  {formatEuro(scontrino.iva_importo)}
                </span>
              </div>
            </div>

            <p className="text-center my-2 tracking-[0.3em]">----------------</p>

            {/* === PAGAMENTO === */}
            {scontrino.metodo_pagamento && scontrino.metodo_pagamento !== 'Non richiesto' && (
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span>{scontrino.metodo_pagamento}</span>
                  <span className="w-20 text-right">
                    {formatEuro(scontrino.totale_lordo)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Importo pagato</span>
                  <span className="w-20 text-right">
                    {formatEuro(scontrino.totale_lordo)}
                  </span>
                </div>
              </div>
            )}

            {isFiglio && (
              <p className="text-[9px] italic text-center text-gray-600 mt-1">
                Documento di cortesia — nessun pagamento
              </p>
            )}

            {/* === RIFERIMENTO MADRE (per figli) === */}
            {isFiglio && scontrino.scontrino_madre_numero && (
              <>
                <p className="text-center my-2 tracking-[0.3em]">----------------</p>
                <p className="text-[9px] leading-tight">
                  CARTA {scontrino.scontrino_madre_numero}{' '}
                  DOC.N.{scontrino.scontrino_madre_numero} DEL {scontrino.scontrino_madre_data}
                </p>
              </>
            )}

            {/* === NOTE === */}
            {scontrino.note && (
              <>
                <p className="text-center my-2 tracking-[0.3em]">----------------</p>
                <p className="text-[9px] italic text-center">{scontrino.note}</p>
              </>
            )}

            {scontrino.annullato && (
              <>
                <p className="text-center my-2 tracking-[0.3em]">XXXXXXXXXXXXXXXX</p>
                <p className="text-center font-bold text-red-600 text-sm">
                  *** ANNULLATO ***
                </p>
                <p className="text-center my-2 tracking-[0.3em]">XXXXXXXXXXXXXXXX</p>
              </>
            )}

            {/* === DATA/ORA + ID DOCUMENTO === */}
            <div className="text-center mt-4 space-y-0.5">
              <p className="text-[10px]">
                {dataFormattata} {scontrino.ora_emissione}
              </p>
              <p className="text-[10px] font-bold">
                {scontrino.numero_scontrino}-{scontrino.id}
              </p>
            </div>

            {/* === BARCODE FINTO === */}
            <div className="mt-3 flex justify-center items-end gap-[1px] h-8">
              {barcodeBars.map((w, i) => (
                <div
                  key={i}
                  className="bg-black"
                  style={{ width: `${w}px`, height: `${24 + (i % 3) * 3}px` }}
                />
              ))}
            </div>
            <p className="text-center mt-1 text-[8px] tracking-widest">
              {barcodeSeed}
            </p>

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

        <button
          onClick={onClose}
          className="mt-4 px-6 py-2.5 bg-white text-apple-darkgray rounded-apple font-semibold text-sm shadow-apple hover:bg-gray-50 transition-colors"
        >
          ✕ Chiudi
        </button>
      </div>
    </div>
  );
}
