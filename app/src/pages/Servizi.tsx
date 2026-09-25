import { useEffect, useState } from 'react';
import { getServizi, type Servizio } from '../lib/servizi';
import { formatEuro } from '../lib/fatture';
import { FormNuovoServizio } from '../components/FormNuovoServizio';
import { Toast, type ToastTipo } from '../components/Toast';

export function Servizi() {
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [servizioSelezionato, setServizioSelezionato] = useState<Servizio | null>(null);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    caricaServizi();
  }, []);

  async function caricaServizi() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getServizi();
      setServizi(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento dei servizi');
    } finally {
      setLoading(false);
    }
  }

  function apriNuovo() {
    setServizioSelezionato(null);
    setShowForm(true);
  }

  function apriModifica(s: Servizio) {
    setServizioSelezionato(s);
    setShowForm(true);
  }

  function chiudiForm() {
    setShowForm(false);
    setServizioSelezionato(null);
  }

  // Filtro ricerca
  const serviziFiltrati = servizi.filter((s) => {
    if (!ricerca.trim()) return true;
    return s.nome.toLowerCase().includes(ricerca.toLowerCase());
  });

  // Statistiche
  const prezzoMedio =
    servizi.length > 0
      ? servizi.reduce((sum, s) => sum + Number(s.prezzo_lordo || 0), 0) / servizi.length
      : 0;
  const durataMedia =
    servizi.length > 0
      ? Math.round(
          servizi.reduce((sum, s) => sum + Number(s.durata_minuti || 0), 0) / servizi.length
        )
      : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Servizi</h1>
          <p className="text-sm text-apple-gray">
            {serviziFiltrati.length} {serviziFiltrati.length === 1 ? 'servizio' : 'servizi'}
          </p>
        </div>
        <button
          onClick={apriNuovo}
          className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <span>+</span>
          <span>Nuovo Servizio</span>
        </button>
      </div>

      {/* Card statistiche */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">🛠️ Totale Servizi</p>
          <p className="text-2xl font-bold text-apple-darkgray">{servizi.length}</p>
        </div>
        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">💶 Prezzo medio</p>
          <p className="text-2xl font-bold text-green-600">{formatEuro(prezzoMedio)}</p>
        </div>
        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">⏱️ Durata media</p>
          <p className="text-2xl font-bold text-apple-blue">{durataMedia} min</p>
        </div>
      </div>

      {/* Barra di ricerca */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca servizio per nome..."
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

      {!loading && !errore && serviziFiltrati.length === 0 && (
        <div className="bg-white rounded-apple shadow-apple p-12 text-center">
          <p className="text-4xl mb-3">🛠️</p>
          <p className="text-apple-darkgray font-medium mb-1">Nessun servizio trovato</p>
          <p className="text-apple-gray text-sm">
            {ricerca ? 'Prova a modificare la ricerca' : 'Aggiungi il tuo primo servizio'}
          </p>
        </div>
      )}

      {!loading && !errore && serviziFiltrati.length > 0 && (
        <>
          {/* MOBILE: Card */}
          <div className="md:hidden space-y-3">
            {serviziFiltrati.map((s) => (
              <button
                key={s.id}
                onClick={() => apriModifica(s)}
                className="w-full bg-white rounded-apple shadow-apple p-4 text-left hover:bg-blue-50/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {s.nome}
                    </p>
                    <p className="text-xs text-apple-gray mt-0.5">
                      ⏱️ {s.durata_minuti} min
                    </p>
                  </div>
                  <span className="text-lg font-bold text-apple-darkgray shrink-0 ml-2">
                    {formatEuro(Number(s.prezzo_lordo))}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* DESKTOP: Tabella */}
          <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
              <div className="col-span-7">Servizio</div>
              <div className="col-span-3 text-right">Durata</div>
              <div className="col-span-2 text-right">Prezzo</div>
            </div>

            <div className="divide-y divide-gray-100">
              {serviziFiltrati.map((s) => (
                <button
                  key={s.id}
                  onClick={() => apriModifica(s)}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center text-left"
                >
                  <div className="col-span-7 min-w-0">
                    <p className="text-sm font-semibold text-apple-darkgray truncate">
                      {s.nome}
                    </p>
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-sm text-apple-gray">⏱️ {s.durata_minuti} min</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-bold text-apple-darkgray">
                      {formatEuro(Number(s.prezzo_lordo))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modale form nuovo/modifica servizio */}
      {showForm && (
        <FormNuovoServizio
          servizioIniziale={servizioSelezionato}
          onClose={chiudiForm}
          onSuccess={() => {
            const eraModifica = !!servizioSelezionato;
            console.log('🔵 onSuccess chiamato, eraModifica:', eraModifica);
            chiudiForm();
            console.log('🔵 dopo chiudiForm');
            caricaServizi();
            console.log('🔵 dopo caricaServizi');
            setToast({
              message: eraModifica ? 'Servizio aggiornato' : 'Servizio creato con successo',
              tipo: 'success',
            });
            console.log('🔵 dopo setToast');
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
