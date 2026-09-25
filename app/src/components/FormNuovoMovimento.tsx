import { useEffect, useState } from 'react';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { creaMovimento, type TipoMovimento } from '../lib/magazzino';

interface FormNuovoMovimentoProps {
  prodottoIniziale?: number | null;
  tipoIniziale?: TipoMovimento;
  onClose: () => void;
  onSuccess: () => void;
}

const MOTIVI_CARICO = [
  'Arrivo merce da fornitore',
  'Reso cliente',
  'Rettifica inventario',
  'Altro',
];

const MOTIVI_SCARICO = [
  'Rottura / Danno',
  'Campione omaggio',
  'Uso interno',
  'Regalo cliente',
  'Rettifica inventario',
  'Altro',
];

export function FormNuovoMovimento({
  prodottoIniziale,
  tipoIniziale,
  onClose,
  onSuccess,
}: FormNuovoMovimentoProps) {
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [prodottoId, setProdottoId] = useState<number | null>(prodottoIniziale || null);

  // Sincronizza prodottoId quando cambia prodottoIniziale
  useEffect(() => {
    setProdottoId(prodottoIniziale || null);
  }, [prodottoIniziale]);
  const [tipo, setTipo] = useState<TipoMovimento>(tipoIniziale || 'carico');

  // Sincronizza tipo quando cambia tipoIniziale
  useEffect(() => {
    setTipo(tipoIniziale || 'carico');
  }, [tipoIniziale]);
  const [quantita, setQuantita] = useState<string>('1');
  const [dataMovimento, setDataMovimento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [motivoSelezionato, setMotivoSelezionato] = useState<string>('');
  const [motivoCustom, setMotivoCustom] = useState('');
  const [note, setNote] = useState('');

  const [ricercaProdotto, setRicercaProdotto] = useState('');
  const [showProdottiList, setShowProdottiList] = useState(false);

  // Carica prodotti
  useEffect(() => {
    async function carica() {
      try {
        setLoading(true);
        const p = await getProdotti();
        setProdotti(p);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrore(msg);
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  const prodottoSelezionato = prodotti.find((p) => p.id === prodottoId);

  const prodottiFiltrati = prodotti.filter((p) =>
    p.nome.toLowerCase().includes(ricercaProdotto.toLowerCase())
  );

  const motiviDisponibili = tipo === 'carico' ? MOTIVI_CARICO : MOTIVI_SCARICO;

  async function handleSubmit() {
    // Validazioni
    if (!prodottoId) {
      setErrore('Seleziona un prodotto');
      return;
    }
    const q = parseInt(quantita, 10);
    if (isNaN(q) || q <= 0) {
      setErrore('Inserisci una quantità maggiore di 0');
      return;
    }
    if (!dataMovimento) {
      setErrore('Inserisci la data del movimento');
      return;
    }
    // Verifica giacenza sufficiente per scarico
    if (tipo === 'scarico' && prodottoSelezionato) {
      if (q > prodottoSelezionato.giacenza) {
        setErrore(
          `Giacenza insufficiente. Disponibili: ${prodottoSelezionato.giacenza}`
        );
        return;
      }
    }

    const motivoFinale =
      motivoSelezionato === 'Altro'
        ? motivoCustom.trim() || 'Altro'
        : motivoSelezionato || null;

    try {
      setSalvando(true);
      setErrore(null);

      console.log('🔵 Creo movimento:', { prodottoId, tipo, q, motivoFinale });
      await creaMovimento({
        prodotto_id: prodottoId,
        tipo,
        quantita: q,
        motivo: motivoFinale,
        note: note.trim() || null,
        data_movimento: dataMovimento,
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
          <div className="text-apple-gray text-sm">Caricamento prodotti...</div>
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
        className="bg-white sm:rounded-apple rounded-t-3xl shadow-apple-lg w-full sm:max-w-2xl max-h-[95vh] sm:my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center text-white text-xl shrink-0">
              🏪
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-apple-darkgray">
                Nuovo Movimento
              </h2>
              <p className="text-xs text-apple-gray">
                Registra un carico o scarico di magazzino
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
          {/* Tipo movimento — toggle */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-2">
              Tipo Movimento <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTipo('carico');
                  setMotivoSelezionato('');
                  setMotivoCustom('');
                }}
                className={`px-4 py-3 rounded-apple font-semibold text-sm transition-all ${
                  tipo === 'carico'
                    ? 'bg-green-600 text-white shadow-apple'
                    : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                }`}
              >
                📥 Carico
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipo('scarico');
                  setMotivoSelezionato('');
                  setMotivoCustom('');
                }}
                className={`px-4 py-3 rounded-apple font-semibold text-sm transition-all ${
                  tipo === 'scarico'
                    ? 'bg-red-500 text-white shadow-apple'
                    : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                }`}
              >
                📤 Scarico
              </button>
            </div>
          </div>

          {/* Prodotto */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Prodotto <span className="text-red-500">*</span>
            </label>
            {prodottoSelezionato ? (
              <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-apple">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-apple-darkgray truncate">
                    {prodottoSelezionato.nome}
                  </p>
                  <p className="text-xs text-apple-gray">
                    Giacenza attuale: {prodottoSelezionato.giacenza}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProdottoId(null)}
                  className="text-xs text-apple-blue hover:underline font-medium shrink-0 ml-2"
                >
                  Cambia
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={ricercaProdotto}
                  onChange={(e) => {
                    setRicercaProdotto(e.target.value);
                    setShowProdottiList(true);
                  }}
                  onFocus={() => setShowProdottiList(true)}
                  placeholder="Cerca prodotto per nome..."
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
                />
                {showProdottiList && (
                  <div className="mt-2 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-apple shadow-apple">
                    {prodottiFiltrati.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-apple-gray">
                        Nessun prodotto trovato
                      </p>
                    ) : (
                      prodottiFiltrati.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProdottoId(p.id);
                            setRicercaProdotto('');
                            setShowProdottiList(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                        >
                          <p className="text-sm font-medium text-apple-darkgray truncate">
                            {p.nome}
                          </p>
                          <p className="text-xs text-apple-gray">
                            Giacenza: {p.giacenza}
                            {p.codice_fornitore && ` • Cod. ${p.codice_fornitore}`}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quantità + Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Quantità <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={quantita}
                onChange={(e) => setQuantita(e.target.value)}
                min="1"
                step="1"
                placeholder="1"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-gray mb-1.5">
                Data movimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dataMovimento}
                onChange={(e) => setDataMovimento(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Motivo
            </label>
            <select
              value={motivoSelezionato}
              onChange={(e) => setMotivoSelezionato(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
            >
              <option value="">— Seleziona motivo —</option>
              {motiviDisponibili.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {motivoSelezionato === 'Altro' && (
              <input
                type="text"
                value={motivoCustom}
                onChange={(e) => setMotivoCustom(e.target.value)}
                placeholder="Specifica il motivo..."
                className="w-full mt-2 px-4 py-3 bg-white border border-gray-200 rounded-apple text-sm text-apple-darkgray placeholder:text-apple-gray/60 focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue transition-all"
              />
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Note (opzionali)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note sul movimento..."
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
        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
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
            disabled={salvando || !prodottoId}
            className="flex-1 px-4 py-3 sm:py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? 'Salvataggio...' : 'Registra Movimento'}
          </button>
        </div>
      </div>
    </div>
  );
}
