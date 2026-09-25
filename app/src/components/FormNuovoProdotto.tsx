import { useEffect, useState } from 'react';
import {
  creaProdotto,
  aggiornaProdotto,
  eliminaProdotto,
  type Prodotto,
} from '../lib/prodotti';
import {
  getMovimentiProdotto,
  type MovimentoMagazzino,
} from '../lib/magazzino';
import { getFornitori, type Fornitore } from '../lib/fornitori';
import { formatEuro } from '../lib/fatture';
import { FormNuovoMovimento } from './FormNuovoMovimento';

interface FormNuovoProdottoProps {
  prodottoIniziale?: Prodotto | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FormNuovoProdotto({
  prodottoIniziale,
  onClose,
  onSuccess,
}: FormNuovoProdottoProps) {
  const modifica = !!prodottoIniziale;

  // Campi base
  const [nome, setNome] = useState(prodottoIniziale?.nome || '');
  const [prezzoLordo, setPrezzoLordo] = useState<string>(
    prodottoIniziale?.prezzo_lordo !== undefined ? String(prodottoIniziale.prezzo_lordo) : ''
  );
  const [giacenza, setGiacenza] = useState<string>(
    prodottoIniziale?.giacenza !== undefined ? String(prodottoIniziale.giacenza) : '0'
  );
  const [scortaMinima, setScortaMinima] = useState<string>(
    prodottoIniziale?.scorta_minima !== undefined ? String(prodottoIniziale.scorta_minima) : '0'
  );

  // Campi avanzati
  const [codiceFornitore, setCodiceFornitore] = useState(
    prodottoIniziale?.codice_fornitore || ''
  );
  const [nomeOriginaleFornitore, setNomeOriginaleFornitore] = useState(
    prodottoIniziale?.nome_originale_fornitore || ''
  );
  const [nomeCustoman, setNomeCustoman] = useState(prodottoIniziale?.nome_customan || '');
  const [prezzoAcquistoLordo, setPrezzoAcquistoLordo] = useState<string>(
    prodottoIniziale?.prezzo_acquisto_lordo !== undefined &&
      prodottoIniziale?.prezzo_acquisto_lordo !== null
      ? String(prodottoIniziale.prezzo_acquisto_lordo)
      : ''
  );
  const [quantitaRiordino, setQuantitaRiordino] = useState<string>(
    prodottoIniziale?.quantita_riordino !== undefined &&
      prodottoIniziale?.quantita_riordino !== null
      ? String(prodottoIniziale.quantita_riordino)
      : '1'
  );
  const [fornitoreId, setFornitoreId] = useState<string>(
    prodottoIniziale?.fornitore_id !== undefined && prodottoIniziale?.fornitore_id !== null
      ? String(prodottoIniziale.fornitore_id)
      : ''
  );

  // Stato UI
  const [showAvanzati, setShowAvanzati] = useState(false);
  const [movimenti, setMovimenti] = useState<MovimentoMagazzino[]>([]);
  const [loadingMovimenti, setLoadingMovimenti] = useState(false);
  const [showFormMovimento, setShowFormMovimento] = useState(false);
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [prezzoAcquistoNettoScontato, setPrezzoAcquistoNettoScontato] = useState<string>(
    prodottoIniziale?.prezzo_acquisto_netto_scontato !== undefined &&
      prodottoIniziale?.prezzo_acquisto_netto_scontato !== null
      ? String(prodottoIniziale.prezzo_acquisto_netto_scontato)
      : ''
  );
  const [scontoFornitore, setScontoFornitore] = useState<string>(
    prodottoIniziale?.sconto_fornitore_percentuale !== undefined &&
      prodottoIniziale?.sconto_fornitore_percentuale !== null
      ? String(prodottoIniziale.sconto_fornitore_percentuale)
      : '0'
  );
  const [tipoMovimento, setTipoMovimento] = useState<'carico' | 'scarico'>('carico');
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);

  // Carica fornitori
  useEffect(() => {
    async function caricaFornitori() {
      try {
        const f = await getFornitori();
        setFornitori(f);
      } catch (err) {
        console.error('Errore caricamento fornitori:', err);
      }
    }
    caricaFornitori();
  }, []);

  // Se seleziono un fornitore e non ho sconto custom, uso lo sconto del fornitore
  useEffect(() => {
    if (fornitoreId && fornitori.length > 0) {
      const f = fornitori.find((x) => Number(x.id) === Number(fornitoreId));
      if (f && scontoFornitore === '0') {
        setScontoFornitore(String(f.sconto_percentuale));
      }
    }
  }, [fornitoreId, fornitori]);

  // Carica movimenti (solo se modifica)
  useEffect(() => {
    if (!prodottoIniziale) return;
    let annullato = false;
    async function caricaMovimenti() {
      try {
        setLoadingMovimenti(true);
        const m = await getMovimentiProdotto(prodottoIniziale!.id);
        if (!annullato) setMovimenti(m.slice(0, 5));
      } catch (err) {
        console.error('Errore caricamento movimenti:', err);
      } finally {
        if (!annullato) setLoadingMovimenti(false);
      }
    }
    caricaMovimenti();
    return () => {
      annullato = true;
    };
  }, [prodottoIniziale]);

  async function ricaricaProdotto() {
    if (!prodottoIniziale) return;
    try {
      const { getProdotto } = await import('../lib/prodotti');
      const aggiornato = await getProdotto(prodottoIniziale.id);
      if (aggiornato) {
        setGiacenza(String(aggiornato.giacenza));
      }
    } catch (err) {
      console.error('Errore ricaricamento prodotto:', err);
    }
  }

  async function ricaricaMovimenti() {
    if (!prodottoIniziale) return;
    try {
      const m = await getMovimentiProdotto(prodottoIniziale.id);
      setMovimenti(m.slice(0, 5));
    } catch (err) {
      console.error('Errore ricaricamento movimenti:', err);
    }
  }

  // Calcoli derivati
  const prezzoNettoScontatoNum = parseFloat(prezzoAcquistoNettoScontato) || 0;
  const scontoNum = parseFloat(scontoFornitore) || 0;
  const prezzoNettoNonScontato =
    scontoNum > 0 && scontoNum < 100
      ? prezzoNettoScontatoNum / (1 - scontoNum / 100)
      : prezzoNettoScontatoNum;
  const prezzoLordoCalcolato = prezzoNettoScontatoNum * 1.22;

  async function handleSubmit() {
    // Validazione base
    if (!nome.trim()) {
      setErrore('Il nome del prodotto è obbligatorio');
      return;
    }
    const prezzo = parseFloat(prezzoLordo);
    if (isNaN(prezzo) || prezzo < 0) {
      setErrore('Il prezzo di vendita deve essere un numero maggiore o uguale a 0');
      return;
    }
    const giac = parseInt(giacenza, 10);
    if (isNaN(giac) || giac < 0) {
      setErrore('La giacenza deve essere un numero intero maggiore o uguale a 0');
      return;
    }
    const scorta = parseInt(scortaMinima, 10);
    if (isNaN(scorta) || scorta < 0) {
      setErrore('La scorta minima deve essere un numero intero maggiore o uguale a 0');
      return;
    }

    // Validazione avanzati (tutti opzionali)
    let prezzoAcquisto: number | null = null;
    if (prezzoAcquistoLordo.trim() !== '') {
      const pa = parseFloat(prezzoAcquistoLordo);
      if (isNaN(pa) || pa < 0) {
        setErrore('Il prezzo di acquisto deve essere un numero maggiore o uguale a 0');
        return;
      }
      prezzoAcquisto = pa;
    }

    let qtaRiordino: number | null = null;
    if (quantitaRiordino.trim() !== '') {
      const qr = parseInt(quantitaRiordino, 10);
      if (isNaN(qr) || qr < 0) {
        setErrore('La quantità di riordino deve essere un numero intero maggiore o uguale a 0');
        return;
      }
      qtaRiordino = qr;
    }

    const fornId: number | null = fornitoreId ? Number(fornitoreId) : null;

    try {
      setSalvando(true);
      setErrore(null);

      const dati = {
        nome: nome.trim(),
        prezzo_lordo: prezzo,
        giacenza: giac,
        scorta_minima: scorta,
        codice_fornitore: codiceFornitore.trim() || null,
        nome_originale_fornitore: nomeOriginaleFornitore.trim() || null,
        nome_customan: nomeCustoman.trim() || null,
        prezzo_acquisto_lordo: prezzoLordoCalcolato || null,
        prezzo_acquisto_netto_scontato: prezzoNettoScontatoNum || null,
        sconto_fornitore_percentuale: scontoNum || null,
        quantita_riordino: qtaRiordino,
        fornitore_id: fornId,
      };

      if (modifica && prodottoIniziale) {
        await aggiornaProdotto(prodottoIniziale.id, dati);
      } else {
        await creaProdotto(dati);
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  }

  async function handleElimina() {
    if (!prodottoIniziale) return;
    try {
      setSalvando(true);
      setErrore(null);
      await eliminaProdotto(prodottoIniziale.id);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nell\'eliminazione. Il prodotto potrebbe essere usato in percorsi o fatture.');
      setSalvando(false);
      setShowConfermaElimina(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-2xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white text-xl shrink-0">
              📦
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                {modifica ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
              </h2>
              <p className="text-xs text-apple-gray">
                {modifica ? `ID ${prodottoIniziale?.id}` : 'Aggiungi un prodotto al catalogo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Corpo */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {/* Dati base */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              📋 Dati Base
            </h3>

            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Nome Prodotto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="es. Shampoo Tricologico 250ml"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Prezzo Vendita (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={prezzoLordo}
                  onChange={(e) => setPrezzoLordo(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Giacenza
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={giacenza}
                  onChange={(e) => setGiacenza(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-gray mb-1.5">
                  Scorta Minima
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={scortaMinima}
                  onChange={(e) => setScortaMinima(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
              </div>
            </div>
          </div>

          {/* Dati avanzati (richiudibile) */}
          <div className="border-t border-gray-200/60 pt-4">
            <button
              type="button"
              onClick={() => setShowAvanzati(!showAvanzati)}
              className="w-full flex items-center justify-between text-xs font-semibold text-apple-gray uppercase tracking-wide hover:text-apple-darkgray transition-colors"
            >
              <span>⚙️ Dati Avanzati (fornitore, codici)</span>
              <span className="text-base">{showAvanzati ? '▲' : '▼'}</span>
            </button>

            {showAvanzati && (
              <div className="mt-4 space-y-4">
                {/* Fornitore */}
                <div>
                  <label className="block text-xs font-medium text-apple-gray mb-1.5">
                    Fornitore
                  </label>
                  <select
                    value={fornitoreId || ''}
                    onChange={(e) => setFornitoreId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                  >
                    <option value="">— Nessun fornitore —</option>
                    {fornitori.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.ragione_sociale}
                        {f.sconto_percentuale > 0 && ` (${f.sconto_percentuale}%)`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Codici fornitore */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-apple-gray mb-1.5">
                      Codice Fornitore
                    </label>
                    <input
                      type="text"
                      value={codiceFornitore}
                      onChange={(e) => setCodiceFornitore(e.target.value)}
                      placeholder="es. ABC-123"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-apple-gray mb-1.5">
                      Nome Customan
                    </label>
                    <input
                      type="text"
                      value={nomeCustoman}
                      onChange={(e) => setNomeCustoman(e.target.value)}
                      placeholder="Nome nel catalogo Customan..."
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                    />
                  </div>
                </div>

                {/* Nome originale fornitore */}
                <div>
                  <label className="block text-xs font-medium text-apple-gray mb-1.5">
                    Nome Originale Fornitore
                  </label>
                  <input
                    type="text"
                    value={nomeOriginaleFornitore}
                    onChange={(e) => setNomeOriginaleFornitore(e.target.value)}
                    placeholder="Nome come da catalogo fornitore..."
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                  />
                </div>

                {/* Prezzi acquisto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-apple-gray mb-1.5">
                      Prezzo Acquisto Netto Scontato (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prezzoAcquistoNettoScontato}
                      onChange={(e) => setPrezzoAcquistoNettoScontato(e.target.value)}
                      placeholder="es. 100.00"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                    />
                    <p className="text-xs text-apple-gray mt-1">
                      Il prezzo che leggi in fattura dal fornitore
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-apple-gray mb-1.5">
                      Sconto Fornitore (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={scontoFornitore}
                      onChange={(e) => setScontoFornitore(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                    />
                    <p className="text-xs text-apple-gray mt-1">
                      Default dal fornitore (modificabile)
                    </p>
                  </div>
                </div>

                {/* Prezzi calcolati */}
                {prezzoNettoScontatoNum > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50 border border-blue-200 rounded-apple p-4">
                    <div>
                      <p className="text-xs text-apple-gray mb-1">
                        Netto NON scontato (calc.)
                      </p>
                      <p className="text-sm font-bold text-apple-darkgray">
                        {formatEuro(prezzoNettoNonScontato)}
                      </p>
                      <p className="text-xs text-apple-gray mt-0.5">
                        Risparmio: {formatEuro(prezzoNettoNonScontato - prezzoNettoScontatoNum)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-apple-gray mb-1">
                        Lordo (calc. + IVA 22%)
                      </p>
                      <p className="text-sm font-bold text-apple-blue">
                        {formatEuro(prezzoLordoCalcolato)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quantità riordino */}
                <div>
                  <label className="block text-xs font-medium text-apple-gray mb-1.5">
                    Quantità Riordino
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={quantitaRiordino}
                    onChange={(e) => setQuantitaRiordino(e.target.value)}
                    placeholder="1"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {showConfermaElimina && modifica && prodottoIniziale && (
            <div className="bg-red-50 border-2 border-red-300 rounded-apple p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800 mb-1">
                    Eliminare questo prodotto?
                  </p>
                  <p className="text-xs text-red-700 leading-relaxed">
                    L'azione è irreversibile. Se il prodotto è usato in percorsi o fatture, l'eliminazione fallirà.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleElimina}
                  disabled={salvando}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {salvando ? 'Eliminazione...' : 'Sì, elimina'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfermaElimina(false)}
                  disabled={salvando}
                  className="px-4 py-2.5 bg-white text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-100 transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Sezione movimenti recenti (solo in modifica) */}
          {modifica && prodottoIniziale && (
            <div className="pt-4 border-t border-gray-200/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  📦 Movimenti recenti
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMovimento('carico');
                      setShowFormMovimento(true);
                    }}
                    className="px-3 py-1.5 bg-green-50 text-green-700 rounded-apple font-semibold text-xs hover:bg-green-100 transition-colors"
                  >
                    + Carico
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMovimento('scarico');
                      setShowFormMovimento(true);
                    }}
                    className="px-3 py-1.5 bg-red-50 text-red-700 rounded-apple font-semibold text-xs hover:bg-red-100 transition-colors"
                  >
                    − Scarico
                  </button>
                </div>
              </div>

              {loadingMovimenti ? (
                <p className="text-xs text-apple-gray text-center py-4">
                  Caricamento...
                </p>
              ) : movimenti.length === 0 ? (
                <p className="text-xs text-apple-gray bg-gray-50 rounded-apple p-4 text-center">
                  Nessun movimento registrato
                </p>
              ) : (
                <div className="bg-gray-50 rounded-apple overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {movimenti.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              m.tipo === 'carico'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {m.tipo === 'carico' ? '+' : '−'}
                            {m.quantita}
                          </span>
                          <span className="text-xs text-apple-gray truncate">
                            {new Date(m.data_movimento).toLocaleDateString('it-IT')}
                            {m.motivo && ` • ${m.motivo}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}
        </form>

        {/* Form Movimento — FUORI dal form principale (HTML non permette form annidati) */}
        {showFormMovimento && prodottoIniziale && (
          <FormNuovoMovimento
            prodottoIniziale={prodottoIniziale.id}
            tipoIniziale={tipoMovimento}
            onClose={() => setShowFormMovimento(false)}
            onSuccess={() => {
              setShowFormMovimento(false);
              ricaricaMovimenti();
              ricaricaProdotto();
            }}
          />
        )}

        {/* Footer */}
        <div className="flex gap-2 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          {modifica && !showConfermaElimina && (
            <button
              type="button"
              onClick={() => setShowConfermaElimina(true)}
              disabled={salvando}
              className="px-4 py-3 sm:py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Elimina prodotto"
            >
              🗑️
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={salvando || !nome.trim()}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : modifica ? 'Salva Modifiche' : 'Crea Prodotto'}
          </button>
        </div>
      </div>
    </div>
  );
}

