import { useEffect, useState } from 'react';
import { getProdotti, type Prodotto } from '../lib/prodotti';
import { getFornitori, type Fornitore } from '../lib/fornitori';
import { formatEuro } from '../lib/fatture';
import { FormNuovoProdotto } from '../components/FormNuovoProdotto';
import { FormNuovoFornitore } from '../components/FormNuovoFornitore';
import { Toast, type ToastTipo } from '../components/Toast';
import { FormNuovoOrdine } from '../components/FormNuovoOrdine';

type Tab = 'prodotti' | 'fornitori';

export function Prodotti() {
  const [tabAttiva, setTabAttiva] = useState<Tab>('prodotti');

  // --- State Prodotti ---
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroSottoScorta, setFiltroSottoScorta] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFormOrdine, setShowFormOrdine] = useState(false);
  const [prodottoSelezionato, setProdottoSelezionato] = useState<Prodotto | null>(null);

  // --- State Fornitori ---
  const [fornitori, setFornitori] = useState<Fornitore[]>([]);
  const [loadingFornitori, setLoadingFornitori] = useState(true);
  const [erroreFornitori, setErroreFornitori] = useState<string | null>(null);
  const [ricercaFornitori, setRicercaFornitori] = useState('');
  const [showFormFornitore, setShowFormFornitore] = useState(false);
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState<Fornitore | null>(null);

  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    caricaProdotti();
    caricaFornitori();
  }, []);

  async function caricaProdotti() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getProdotti();
      setProdotti(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento dei prodotti');
    } finally {
      setLoading(false);
    }
  }

  async function caricaFornitori() {
    try {
      setLoadingFornitori(true);
      setErroreFornitori(null);
      const data = await getFornitori();
      setFornitori(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErroreFornitori(msg || 'Errore nel caricamento dei fornitori');
    } finally {
      setLoadingFornitori(false);
    }
  }

  // --- Azioni Prodotti ---
  function apriNuovo() {
    setProdottoSelezionato(null);
    setShowForm(true);
  }

  function apriModifica(p: Prodotto) {
    setProdottoSelezionato(p);
    setShowForm(true);
  }

  function chiudiForm() {
    setShowForm(false);
    setProdottoSelezionato(null);
  }

  // --- Azioni Fornitori ---
  function apriNuovoFornitore() {
    setFornitoreSelezionato(null);
    setShowFormFornitore(true);
  }

  function apriModificaFornitore(f: Fornitore) {
    setFornitoreSelezionato(f);
    setShowFormFornitore(true);
  }

  function chiudiFormFornitore() {
    setShowFormFornitore(false);
    setFornitoreSelezionato(null);
  }

  // --- Filtri Prodotti ---
  const prodottiFiltrati = prodotti.filter((p) => {
    if (filtroSottoScorta && p.giacenza > p.scorta_minima) return false;
    if (!ricerca.trim()) return true;
    const q = ricerca.toLowerCase();
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.codice_fornitore || '').toLowerCase().includes(q)
    );
  });

  const sottoScorta = prodotti.filter((p) => p.giacenza <= p.scorta_minima).length;
  const valoreMagazzino = prodotti.reduce(
    (sum, p) =>
      sum + Number(p.prezzo_acquisto_netto_scontato || 0) * Number(p.giacenza || 0),
    0
  );

  // --- Filtri Fornitori ---
  const fornitoriFiltrati = fornitori.filter((f) => {
    if (!ricercaFornitori.trim()) return true;
    const q = ricercaFornitori.toLowerCase();
    return (
      f.ragione_sociale.toLowerCase().includes(q) ||
      (f.citta || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q) ||
      (f.partita_iva || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTabAttiva('prodotti')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-apple text-sm font-medium transition-all ${
            tabAttiva === 'prodotti'
              ? 'bg-apple-blue text-white shadow-apple'
              : 'bg-white text-apple-darkgray hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <span>📦</span>
          <span>Prodotti</span>
        </button>
        <button
          onClick={() => setTabAttiva('fornitori')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-apple text-sm font-medium transition-all ${
            tabAttiva === 'fornitori'
              ? 'bg-apple-blue text-white shadow-apple'
              : 'bg-white text-apple-darkgray hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <span>🏭</span>
          <span>Fornitori</span>
        </button>
      </div>

      {/* ============ TAB PRODOTTI ============ */}
      {tabAttiva === 'prodotti' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Prodotti</h1>
              <p className="text-sm text-apple-gray">
                {prodottiFiltrati.length} {prodottiFiltrati.length === 1 ? 'prodotto' : 'prodotti'}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowFormOrdine(true)}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-gray-800 text-white rounded-apple font-medium text-sm shadow-apple hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
              >
                <span>📦</span>
                <span>Riordina</span>
              </button>
              <button
                onClick={apriNuovo}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <span>+</span>
                <span>Nuovo Prodotto</span>
              </button>
            </div>
          </div>

          {/* Card statistiche cliccabili */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-apple shadow-apple p-5">
              <p className="text-xs text-apple-gray mb-1">📦 Totale Prodotti</p>
              <p className="text-2xl font-bold text-apple-darkgray">{prodotti.length}</p>
            </div>

            <button
              onClick={() => setFiltroSottoScorta(!filtroSottoScorta)}
              className={`rounded-apple shadow-apple p-5 text-left transition-all ${
                filtroSottoScorta
                  ? 'bg-red-500 text-white'
                  : 'bg-white hover:shadow-apple-lg'
              }`}
            >
              <p className={`text-xs mb-1 ${filtroSottoScorta ? 'text-white/90' : 'text-apple-gray'}`}>
                ⚠️ Sotto scorta
              </p>
              <p className={`text-2xl font-bold ${
                filtroSottoScorta
                  ? 'text-white'
                  : sottoScorta > 0
                  ? 'text-red-600'
                  : 'text-apple-darkgray'
              }`}>
                {sottoScorta}
              </p>
              <p className={`text-xs mt-1 ${filtroSottoScorta ? 'text-white/80' : 'text-apple-gray'}`}>
                {filtroSottoScorta ? 'Clicca per rimuovere filtro' : 'Clicca per filtrare'}
              </p>
            </button>

            <div className="bg-white rounded-apple shadow-apple p-5">
              <p className="text-xs text-apple-gray mb-1">💰 Valore magazzino</p>
              <p className="text-2xl font-bold text-green-600">{formatEuro(valoreMagazzino)}</p>
            </div>
          </div>

          {/* Barra di ricerca */}
          <div className="mb-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
              <input
                type="text"
                placeholder="Cerca prodotto per nome o codice fornitore..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-apple-gray text-sm">Caricamento...</div>
            </div>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-4 text-red-700 text-sm">
              ❌ {errore}
            </div>
          )}

          {!loading && !errore && prodottiFiltrati.length === 0 && (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-apple-darkgray font-medium mb-1">Nessun prodotto trovato</p>
              <p className="text-apple-gray text-sm">
                {ricerca ? 'Prova a modificare la ricerca' : 'Aggiungi il tuo primo prodotto'}
              </p>
            </div>
          )}

          {!loading && !errore && prodottiFiltrati.length > 0 && (
            <>
              {/* MOBILE: Card */}
              <div className="md:hidden space-y-3">
                {prodottiFiltrati.map((p) => {
                  const inSottoScorta = p.giacenza <= p.scorta_minima;
                  return (
                    <button
                      key={p.id}
                      onClick={() => apriModifica(p)}
                      className="w-full bg-white rounded-apple shadow-apple p-4 text-left hover:bg-blue-50/40 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-apple-darkgray truncate">
                            {p.nome}
                          </p>
                          {p.codice_fornitore && (
                            <p className="text-xs text-apple-gray mt-0.5 truncate">
                              Cod. {p.codice_fornitore}
                            </p>
                          )}
                        </div>
                        <span className="text-lg font-bold text-apple-darkgray shrink-0">
                          {formatEuro(Number(p.prezzo_lordo))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={inSottoScorta ? 'text-red-600 font-semibold' : 'text-apple-gray'}>
                          Giacenza: {p.giacenza}
                          {inSottoScorta && ' ⚠️'}
                        </span>
                        <span className="text-apple-gray">
                          Acq. {formatEuro(Number(p.prezzo_acquisto_lordo || 0))}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* DESKTOP: Tabella */}
              <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  <div className="col-span-5">Nome</div>
                  <div className="col-span-2 text-center">Giacenza</div>
                  <div className="col-span-2 text-right">Prezzo vendita</div>
                  <div className="col-span-3 text-right">Prezzo acquisto</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {prodottiFiltrati.map((p) => {
                    const inSottoScorta = p.giacenza <= p.scorta_minima;
                    return (
                      <button
                        key={p.id}
                        onClick={() => apriModifica(p)}
                        className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center text-left"
                      >
                        <div className="col-span-5 min-w-0">
                          <p className="text-sm font-semibold text-apple-darkgray truncate">
                            {p.nome}
                          </p>
                          {p.codice_fornitore && (
                            <p className="text-xs text-apple-gray truncate">
                              Cod. {p.codice_fornitore}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              inSottoScorta
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-apple-darkgray'
                            }`}
                          >
                            {p.giacenza}
                            {inSottoScorta && ' ⚠️'}
                          </span>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-sm font-bold text-apple-darkgray">
                            {formatEuro(Number(p.prezzo_lordo))}
                          </p>
                        </div>
                        <div className="col-span-3 text-right">
                          <p className="text-sm text-apple-gray">
                            {formatEuro(Number(p.prezzo_acquisto_lordo || 0))}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ============ TAB FORNITORI ============ */}
      {tabAttiva === 'fornitori' && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Fornitori</h1>
              <p className="text-sm text-apple-gray">
                {fornitoriFiltrati.length} {fornitoriFiltrati.length === 1 ? 'fornitore' : 'fornitori'}
              </p>
            </div>
            <button
              onClick={apriNuovoFornitore}
              className="w-full sm:w-auto px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span>
              <span>Nuovo Fornitore</span>
            </button>
          </div>

          {/* Barra di ricerca */}
          <div className="mb-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
              <input
                type="text"
                placeholder="Cerca fornitore per nome, città, email o P.IVA..."
                value={ricercaFornitori}
                onChange={(e) => setRicercaFornitori(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
              />
            </div>
          </div>

          {loadingFornitori && (
            <div className="flex items-center justify-center py-20">
              <div className="text-apple-gray text-sm">Caricamento...</div>
            </div>
          )}

          {erroreFornitori && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-4 text-red-700 text-sm">
              ❌ {erroreFornitori}
            </div>
          )}

          {!loadingFornitori && !erroreFornitori && fornitoriFiltrati.length === 0 && (
            <div className="bg-white rounded-apple shadow-apple p-12 text-center">
              <p className="text-4xl mb-3">🏭</p>
              <p className="text-apple-darkgray font-medium mb-1">Nessun fornitore trovato</p>
              <p className="text-apple-gray text-sm">
                {ricercaFornitori ? 'Prova a modificare la ricerca' : 'Aggiungi il tuo primo fornitore'}
              </p>
            </div>
          )}

          {!loadingFornitori && !erroreFornitori && fornitoriFiltrati.length > 0 && (
            <>
              {/* MOBILE: Card */}
              <div className="md:hidden space-y-3">
                {fornitoriFiltrati.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => apriModificaFornitore(f)}
                    className="w-full bg-white rounded-apple shadow-apple p-4 text-left hover:bg-purple-50/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-apple-darkgray truncate">
                          {f.ragione_sociale}
                        </p>
                        {f.citta && (
                          <p className="text-xs text-apple-gray mt-0.5 truncate">
                            📍 {f.citta} {f.provincia && `(${f.provincia})`}
                          </p>
                        )}
                      </div>
                      {f.sconto_percentuale > 0 && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700 shrink-0">
                          -{f.sconto_percentuale}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-apple-gray">
                      {f.email && <span className="truncate">✉️ {f.email}</span>}
                      {f.telefono && <span className="shrink-0">📞 {f.telefono}</span>}
                    </div>
                  </button>
                ))}
              </div>

              {/* DESKTOP: Tabella */}
              <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  <div className="col-span-4">Ragione Sociale</div>
                  <div className="col-span-3">Contatti</div>
                  <div className="col-span-2">Sede</div>
                  <div className="col-span-2 text-center">Sconto</div>
                  <div className="col-span-1 text-right">P.IVA</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {fornitoriFiltrati.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => apriModificaFornitore(f)}
                      className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-purple-50/40 transition-colors items-center text-left"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="text-sm font-semibold text-apple-darkgray truncate">
                          {f.ragione_sociale}
                        </p>
                        {f.codice_fiscale && (
                          <p className="text-xs text-apple-gray truncate">
                            CF: {f.codice_fiscale}
                          </p>
                        )}
                      </div>
                      <div className="col-span-3 min-w-0">
                        {f.email && (
                          <p className="text-xs text-apple-gray truncate">✉️ {f.email}</p>
                        )}
                        {f.telefono && (
                          <p className="text-xs text-apple-gray truncate">📞 {f.telefono}</p>
                        )}
                      </div>
                      <div className="col-span-2 min-w-0">
                        {f.citta ? (
                          <p className="text-xs text-apple-gray truncate">
                            {f.citta} {f.provincia && `(${f.provincia})`}
                          </p>
                        ) : (
                          <p className="text-xs text-apple-gray">—</p>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        {f.sconto_percentuale > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                            -{f.sconto_percentuale}%
                          </span>
                        ) : (
                          <span className="text-xs text-apple-gray">—</span>
                        )}
                      </div>
                      <div className="col-span-1 text-right">
                        <p className="text-xs text-apple-gray truncate">
                          {f.partita_iva || '—'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Modale form nuovo/modifica prodotto */}
      {showForm && (
        <FormNuovoProdotto
          key={prodottoSelezionato?.id ?? 'nuovo'}
          prodottoIniziale={prodottoSelezionato}
          onClose={chiudiForm}
          onSuccess={() => {
            const eraModifica = !!prodottoSelezionato;
            chiudiForm();
            caricaProdotti();
            setToast({
              message: eraModifica ? 'Prodotto aggiornato' : 'Prodotto creato con successo',
              tipo: 'success',
            });
          }}
        />
      )}

      {/* Modale form nuovo/modifica fornitore */}
      {showFormFornitore && (
        <FormNuovoFornitore
          key={fornitoreSelezionato?.id ?? 'nuovo-fornitore'}
          fornitoreIniziale={fornitoreSelezionato}
          onClose={chiudiFormFornitore}
          onSuccess={() => {
            const eraModifica = !!fornitoreSelezionato;
            chiudiFormFornitore();
            caricaFornitori();
            setToast({
              message: eraModifica ? 'Fornitore aggiornato' : 'Fornitore creato con successo',
              tipo: 'success',
            });
          }}
        />
      )}

      {showFormOrdine && (
        <FormNuovoOrdine
          onClose={() => setShowFormOrdine(false)}
          onSuccess={() => {
            setShowFormOrdine(false);
            caricaProdotti();
            setToast({ message: 'Ordine creato con successo', tipo: 'success' });
          }}
        />
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
