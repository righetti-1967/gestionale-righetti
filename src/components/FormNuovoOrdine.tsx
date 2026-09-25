import { useEffect, useMemo, useState } from 'react';
import { getFornitori, type Fornitore } from '../lib/fornitori';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import {
  getProssimoNumeroOrdine,
  calcolaTotaliOrdine,
  creaOrdine,
  type NuovaRigaOrdine,
} from '../lib/ordini';
import { formatEuro } from '../lib/fatture';

interface FormNuovoOrdineProps {
  onClose: () => void;
  onSuccess: () => void;
  fornitoreIniziale?: number | null;
}

interface RigaEditable {
  prodotto: Prodotto;
  quantita: number;
  prezzoAcquistoLordo: number;
  scontoPercentuale: number;
}

export function FormNuovoOrdine({
  onClose,
  onSuccess,
  fornitoreIniziale,
}: FormNuovoOrdineProps) {
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [fornitoreId, setFornitoreId] = useState<number | null>(fornitoreIniziale || null);
  const [dataOrdine, setDataOrdine] = useState(new Date().toISOString().split('T')[0]);
  const [dataConsegna, setDataConsegna] = useState('');
  const [note, setNote] = useState('');
  const [numeroOrdine, setNumeroOrdine] = useState<string>('');

  const [righe, setRighe] = useState<RigaEditable[]>([]);
  const [showPickerProdotti, setShowPickerProdotti] = useState(false);
  const [ricercaPicker, setRicercaPicker] = useState('');

  // Carica dati iniziali
  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        const [f, p, num] = await Promise.all([
          getFornitori(),
          getProdotti(),
          getProssimoNumeroOrdine(),
        ]);
        setFornitori(f);
        setProdotti(p);
        setNumeroOrdine(num.numero_ordine);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  // Quando seleziono il fornitore, carico i suoi prodotti sotto scorta
  useEffect(() => {
    if (!fornitoreId) {
      setRighe([]);
      return;
    }
    const fornitore = fornitori.find((f) => f.id === fornitoreId);
    if (!fornitore) return;

    // Prossima consegna (giovedì o venerdì più vicino)
    const prossima = calcolaProssimaConsegna(fornitore.giorni_consegna);
    setDataConsegna(prossima);

    // Prodotti del fornitore sotto scorta
    const sottoScorta = prodotti.filter(
      (p) => p.fornitore_id === fornitoreId && p.giacenza <= p.scorta_minima
    );

    const righeIniziali: RigaEditable[] = sottoScorta.map((p) => ({
      prodotto: p,
      quantita: p.quantita_riordino || 1,
      prezzoAcquistoLordo: p.prezzo_acquisto_lordo || 0,
      scontoPercentuale: fornitore.sconto_percentuale || 0,
    }));

    setRighe(righeIniziali);
  }, [fornitoreId, fornitori, prodotti]);

  const fornitoreSelezionato = fornitori.find((f) => f.id === fornitoreId);

  // Righe con prezzo scontato calcolato
  const righeCalcolate: NuovaRigaOrdine[] = useMemo(() => {
    return righe.map((r) => {
      const prezzoScontato = Number(
        (r.prezzoAcquistoLordo * (1 - r.scontoPercentuale / 100)).toFixed(2)
      );
      return {
        prodotto_id: r.prodotto.id,
        nome_prodotto: r.prodotto.nome,
        nome_originale_fornitore: r.prodotto.nome_originale_fornitore || null,
        quantita: r.quantita,
        prezzo_acquisto_lordo: r.prezzoAcquistoLordo,
        sconto_percentuale: r.scontoPercentuale,
        prezzo_scontato_lordo: prezzoScontato,
      };
    });
  }, [righe]);

  const totali = useMemo(() => calcolaTotaliOrdine(righeCalcolate), [righeCalcolate]);

  function calcolaProssimaConsegna(giorniConsegna: string | null): string {
    // giorniConsegna può essere "Giovedì, Venerdì" o simile
    const oggi = new Date();
    const giorniSettimana = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    let giorniTarget: number[] = [];
    if (giorniConsegna) {
      const nomi = giorniConsegna.split(',').map((s) => s.trim());
      giorniTarget = nomi
        .map((nome) => giorniSettimana.findIndex((g) => g.toLowerCase() === nome.toLowerCase()))
        .filter((i) => i >= 0);
    }

    if (giorniTarget.length === 0) {
      // Default: giovedì (4) e venerdì (5)
      giorniTarget = [4, 5];
    }

    // Trova il prossimo giorno target
    for (let i = 1; i <= 7; i++) {
      const futura = new Date(oggi);
      futura.setDate(oggi.getDate() + i);
      if (giorniTarget.includes(futura.getDay())) {
        return futura.toISOString().split('T')[0];
      }
    }
    return oggi.toISOString().split('T')[0];
  }

  function aggiornaQuantita(index: number, quantita: number) {
    if (quantita < 1) return;
    setRighe((prev) => {
      const nuove = [...prev];
      nuove[index] = { ...nuove[index], quantita };
      return nuove;
    });
  }

  function aggiornaPrezzo(index: number, prezzo: number) {
    if (prezzo < 0) return;
    setRighe((prev) => {
      const nuove = [...prev];
      nuove[index] = { ...nuove[index], prezzoAcquistoLordo: prezzo };
      return nuove;
    });
  }

  function aggiungiProdotto(prodotto: Prodotto) {
    const fornitore = fornitori.find((f) => f.id === fornitoreId);
    setRighe((prev) => {
      // Se già presente, non lo aggiungo
      if (prev.find((r) => r.prodotto.id === prodotto.id)) return prev;
      return [
        ...prev,
        {
          prodotto,
          quantita: prodotto.quantita_riordino || 1,
          prezzoAcquistoLordo: prodotto.prezzo_acquisto_lordo || 0,
          scontoPercentuale: fornitore?.sconto_percentuale || 0,
        },
      ];
    });
    setShowPickerProdotti(false);
    setRicercaPicker('');
  }

  function rimuoviRiga(index: number) {
    setRighe((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(stato: 'bozza' | 'inviato') {
    if (!fornitoreId) {
      setErrore('Seleziona un fornitore');
      return;
    }
    if (righe.length === 0) {
      setErrore('Aggiungi almeno un prodotto da riordinare');
      return;
    }
    if (!numeroOrdine) {
      setErrore('Numero ordine non disponibile');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      await creaOrdine({
        numero_ordine: numeroOrdine,
        fornitore_id: fornitoreId,
        data_ordine: dataOrdine,
        data_consegna_prevista: dataConsegna || null,
        stato,
        totale_netto: totali.totale_netto,
        totale_iva: totali.totale_iva,
        totale_lordo: totali.totale_lordo,
        note: note.trim() || null,
        righe: righeCalcolate,
      });

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-apple shadow-apple-lg p-8">
          <div className="text-apple-gray text-sm">Caricamento...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-3xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl shrink-0">
              📦
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                Nuovo Ordine
              </h2>
              <p className="text-xs text-apple-gray">
                {numeroOrdine || '—'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit('bozza');
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {/* Info base */}
          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              Informazioni Base
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Fornitore <span className="text-red-500">*</span>
                </label>
                <select
                  value={fornitoreId || ''}
                  onChange={(e) => setFornitoreId(Number(e.target.value) || null)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                >
                  <option value="">— Seleziona fornitore —</option>
                  {fornitori.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.ragione_sociale}
                      {f.sconto_percentuale > 0 && ` (sconto ${f.sconto_percentuale}%)`}
                    </option>
                  ))}
                </select>
                {fornitori.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Nessun fornitore in archivio. Aggiungili prima.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Data Ordine
                </label>
                <input
                  type="date"
                  value={dataOrdine}
                  onChange={(e) => setDataOrdine(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Consegna prevista
                </label>
                <input
                  type="date"
                  value={dataConsegna}
                  onChange={(e) => setDataConsegna(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
                {fornitoreSelezionato?.giorni_consegna && (
                  <p className="text-xs text-apple-gray mt-1">
                    📅 Consegne: {fornitoreSelezionato.giorni_consegna}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Prodotti */}
          <div>
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              📦 Prodotti da riordinare ({righe.length})
            </h3>
            {fornitoreId && righe.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-apple p-4">
                <p className="text-xs text-amber-700 font-semibold mb-1">
                  Nessun prodotto sotto scorta per questo fornitore
                </p>
                <p className="text-xs text-apple-gray">
                  Vengono mostrati solo i prodotti con giacenza ≤ scorta minima.
                </p>
              </div>
            )}
            {/* Pulsante aggiungi prodotto */}
            {fornitoreId && (
              <button
                type="button"
                onClick={() => setShowPickerProdotti(true)}
                className="w-full px-4 py-2.5 bg-blue-50 text-apple-blue rounded-apple font-medium text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 mt-3"
              >
                <span>+</span>
                <span>Aggiungi prodotto manualmente</span>
              </button>
            )}

            {righe.length > 0 && (
              <div className="bg-gray-50 rounded-apple overflow-hidden mt-3">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-apple-gray uppercase border-b border-gray-200">
                  <div className="col-span-5">Prodotto</div>
                  <div className="col-span-2 text-center">Qtà</div>
                  <div className="col-span-2 text-right">Prezzo</div>
                  <div className="col-span-2 text-right">Totale</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="divide-y divide-gray-200">
                  {righe.map((r, i) => {
                    const prezzoScontato = Number(
                      (r.prezzoAcquistoLordo * (1 - r.scontoPercentuale / 100)).toFixed(2)
                    );
                    const totale = r.quantita * prezzoScontato;
                    return (
                      <div
                        key={r.prodotto.id}
                        className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
                      >
                        <div className="col-span-5 min-w-0">
                          <p className="text-sm font-medium text-apple-darkgray truncate">
                            {r.prodotto.nome}
                          </p>
                          {r.prodotto.nome_originale_fornitore && (
                            <p className="text-xs text-apple-gray/70 italic truncate">
                              {r.prodotto.nome_originale_fornitore}
                            </p>
                          )}
                          <p className="text-xs text-apple-gray mt-0.5">
                            Giacenza: {r.prodotto.giacenza} • Scorta min: {r.prodotto.scorta_minima}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={r.quantita}
                            onChange={(e) =>
                              aggiornaQuantita(i, parseInt(e.target.value, 10) || 1)
                            }
                            className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-sm text-center text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={r.prezzoAcquistoLordo}
                            onChange={(e) =>
                              aggiornaPrezzo(i, parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-apple text-sm text-right text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                          />
                          {r.scontoPercentuale > 0 && (
                            <p className="text-xs text-green-600 text-right mt-0.5">
                              −{r.scontoPercentuale}% = {formatEuro(prezzoScontato)}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-sm font-bold text-apple-darkgray">
                            {formatEuro(totale)}
                          </p>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => rimuoviRiga(i)}
                            className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 text-xs transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Riepilogo */}
          {righe.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 space-y-2">
              <h3 className="text-xs font-semibold text-apple-blue uppercase tracking-wide mb-2">
                💰 Riepilogo Ordine
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-apple-gray">Netto imponibile</span>
                <span className="font-semibold text-apple-darkgray">
                  {formatEuro(totali.totale_netto)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-apple-gray">IVA 22%</span>
                <span className="text-apple-darkgray">
                  {formatEuro(totali.totale_iva)}
                </span>
              </div>
              <div className="flex items-center justify-between text-base pt-2 border-t border-blue-200">
                <span className="font-bold text-apple-darkgray">Totale</span>
                <span className="font-bold text-apple-blue">
                  {formatEuro(totali.totale_lordo)}
                </span>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Note (opzionali)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note sull'ordine..."
              rows={2}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all resize-none"
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 sm:py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('bozza')}
            disabled={salvando || !fornitoreId || righe.length === 0}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-gray-200 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? '...' : '💾 Salva Bozza'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('inviato')}
            disabled={salvando || !fornitoreId || righe.length === 0}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? '...' : '📤 Salva e Invia'}
          </button>
        </div>
      </div>

      {/* Picker prodotti */}
      {showPickerProdotti && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onClick={() => setShowPickerProdotti(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-md w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-apple-darkgray">
                  Aggiungi prodotto all'ordine
                </h3>
                <button
                  onClick={() => setShowPickerProdotti(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                value={ricercaPicker}
                onChange={(e) => setRicercaPicker(e.target.value)}
                placeholder="Cerca prodotto..."
                autoFocus
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {(() => {
                const prodottiFornitore = prodotti.filter(
                  (p) =>
                    p.fornitore_id === fornitoreId &&
                    !righe.find((r) => r.prodotto.id === p.id) &&
                    p.nome.toLowerCase().includes(ricercaPicker.toLowerCase())
                );

                if (prodottiFornitore.length === 0) {
                  return (
                    <p className="px-5 py-8 text-center text-sm text-apple-gray">
                      Nessun prodotto disponibile
                    </p>
                  );
                }

                return prodottiFornitore.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => aggiungiProdotto(p)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-apple-darkgray truncate">
                        {p.nome}
                      </p>
                      {p.nome_originale_fornitore && (
                        <p className="text-xs text-apple-gray italic truncate">
                          {p.nome_originale_fornitore}
                        </p>
                      )}
                      <p className="text-xs text-apple-gray mt-0.5">
                        Giacenza: {p.giacenza} • Scorta min: {p.scorta_minima}
                        {p.giacenza <= p.scorta_minima && (
                          <span className="text-red-600 font-semibold ml-1">⚠️ Sotto scorta</span>
                        )}
                      </p>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
