import { useEffect, useState } from 'react';
import {
  getFatture,
  cercaFatture,
  formatEuro,
  formatData,
  isPagata,
  type FatturaConCliente,
} from '../lib/fatture';
import { DettaglioFattura } from '../components/DettaglioFattura';
import { FormNuovaFattura } from '../components/FormNuovaFattura';
import { Toast, type ToastTipo } from '../components/Toast';

type FiltroStato = 'tutte' | 'pagate' | 'non-pagate';

export function Fatture() {
  const [fatture, setFatture] = useState<FatturaConCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('tutte');
  const [fatturaSelezionata, setFatturaSelezionata] = useState<FatturaConCliente | null>(null);
  const [showFormNuova, setShowFormNuova] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  useEffect(() => {
    caricaFatture();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ricerca === '') caricaFatture();
      else eseguiRicerca(ricerca);
    }, 300);
    return () => clearTimeout(timer);
  }, [ricerca]);

  async function caricaFatture() {
    try {
      setLoading(true);
      setErrore(null);
      const data = await getFatture();
      setFatture(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nel caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  }

  async function eseguiRicerca(q: string) {
    try {
      setLoading(true);
      const data = await cercaFatture(q);
      setFatture(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || 'Errore nella ricerca');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handler invio (placeholder - la logica vera verrà implementata)
   */
  function handleInvia(fattura: FatturaConCliente, canale: 'email' | 'whatsapp') {
    const canaleLabel = canale === 'email' ? 'Email' : 'WhatsApp';
    setToast({
      message: `📧 Invio ${canaleLabel} di ${fattura.numero_fattura} in arrivo`,
      tipo: 'info',
    });
  }

  // Filtro per stato (pagate/non pagate)
  const fattureFiltrate = fatture.filter((f) => {
    if (filtroStato === 'pagate') return isPagata(f);
    if (filtroStato === 'non-pagate') return !isPagata(f);
    return true;
  });

  // Statistiche
  const totaleIncassato = fattureFiltrate
    .filter(isPagata)
    .reduce((sum, f) => sum + Number(f.lordo_ivato || 0), 0);
  const totaleDaIncassare = fattureFiltrate
    .filter((f) => !isPagata(f))
    .reduce((sum, f) => sum + Number(f.lordo_ivato || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-apple-darkgray mb-1">Fatture</h1>
          <p className="text-sm text-apple-gray">
            {fattureFiltrate.length} {fattureFiltrate.length === 1 ? 'fattura' : 'fatture'}
            {filtroStato !== 'tutte' && ` (${filtroStato})`}
          </p>
        </div>
        <button
          onClick={() => setShowFormNuova(true)}
          className="px-4 py-2.5 bg-apple-blue text-white rounded-apple font-medium text-sm shadow-apple hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <span>+</span>
          <span>Nuova Fattura</span>
        </button>
      </div>

      {/* Card statistiche cliccabili */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setFiltroStato(filtroStato === 'non-pagate' ? 'tutte' : 'non-pagate')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'non-pagate'
              ? 'bg-orange-500 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'non-pagate' ? 'text-white/90' : 'text-apple-gray'}`}>
            📄 Proforma
          </p>
          <p className={`text-2xl font-bold ${filtroStato === 'non-pagate' ? 'text-white' : 'text-orange-600'}`}>
            {fatture.filter((f) => !isPagata(f)).length}
          </p>
          <p className={`text-xs mt-1 ${filtroStato === 'non-pagate' ? 'text-white/80' : 'text-apple-gray'}`}>
            {formatEuro(totaleDaIncassare)}
          </p>
        </button>

        <button
          onClick={() => setFiltroStato(filtroStato === 'pagate' ? 'tutte' : 'pagate')}
          className={`rounded-apple shadow-apple p-5 text-left transition-all ${
            filtroStato === 'pagate'
              ? 'bg-green-600 text-white'
              : 'bg-white hover:shadow-apple-lg'
          }`}
        >
          <p className={`text-xs mb-1 ${filtroStato === 'pagate' ? 'text-white/90' : 'text-apple-gray'}`}>
            ✓ Pagate e Registrate
          </p>
          <p className={`text-2xl font-bold ${filtroStato === 'pagate' ? 'text-white' : 'text-green-600'}`}>
            {fatture.filter(isPagata).length}
          </p>
          <p className={`text-xs mt-1 ${filtroStato === 'pagate' ? 'text-white/80' : 'text-apple-gray'}`}>
            {formatEuro(totaleIncassato)}
          </p>
        </button>

        <div className="bg-white rounded-apple shadow-apple p-5">
          <p className="text-xs text-apple-gray mb-1">📊 Totale fatture</p>
          <p className="text-2xl font-bold text-apple-darkgray">{fatture.length}</p>
          <p className="text-xs mt-1 text-apple-gray">
            {filtroStato !== 'tutte' && `Filtrate: ${fattureFiltrate.length}`}
          </p>
        </div>
      </div>

      {/* Barra di ricerca + Filtri */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray">🔍</span>
          <input
            type="text"
            placeholder="Cerca per numero o cliente..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white rounded-apple shadow-apple text-sm text-apple-darkgray placeholder:text-apple-gray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 transition-all"
          />
        </div>
        {filtroStato !== 'tutte' && (
          <button
            onClick={() => setFiltroStato('tutte')}
            className="px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors whitespace-nowrap"
          >
            ✕ Rimuovi filtro
          </button>
        )}
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

      {!loading && !errore && fattureFiltrate.length === 0 && (
        <div className="bg-white rounded-apple shadow-apple p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-apple-darkgray font-medium mb-1">Nessuna fattura trovata</p>
          <p className="text-apple-gray text-sm">
            {ricerca
              ? 'Prova a modificare la ricerca'
              : filtroStato !== 'tutte'
              ? 'Nessuna fattura con questo stato'
              : 'Crea la tua prima fattura'}
          </p>
        </div>
      )}

      {!loading && !errore && fattureFiltrate.length > 0 && (
        <>
          {/* MOBILE: Card */}
          <div className="md:hidden space-y-3">
            {fattureFiltrate.map((fattura) => (
              <div
                key={fattura.id}
                className="w-full bg-white rounded-apple shadow-apple p-4"
              >
                <button
                  onClick={() => setFatturaSelezionata(fattura)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-apple-darkgray">
                        Fatt. {fattura.numero_fattura}
                      </p>
                      <p className="text-xs text-apple-gray truncate">
                        {fattura.cliente?.nome_cognome || '—'}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-apple-darkgray shrink-0 ml-2">
                      {formatEuro(Number(fattura.lordo_ivato))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-apple-gray">
                      {formatData(fattura.data_incasso)}
                    </span>
                    {isPagata(fattura) ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                        ✓ Pagata e Registrata
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                        📄 Proforma
                      </span>
                    )}
                  </div>
                </button>
                {/* Pulsanti invio (fuori dal button principale) */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleInvia(fattura, 'email')}
                    className={`flex-1 px-3 py-2 rounded-apple font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      fattura.inviata_email_at
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-blue-50 text-apple-blue hover:bg-blue-100'
                    }`}
                  >
                    📧 Email
                    {fattura.inviata_email_at && ' ✓'}
                  </button>
                  <button
                    onClick={() => handleInvia(fattura, 'whatsapp')}
                    className={`flex-1 px-3 py-2 rounded-apple font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                      fattura.inviata_whatsapp_at
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    💬 WhatsApp
                    {fattura.inviata_whatsapp_at && ' ✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP: Tabella */}
          <div className="hidden md:block bg-white rounded-apple shadow-apple overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-200/60 text-xs font-semibold text-apple-gray uppercase tracking-wide">
              <div className="col-span-2">Numero</div>
              <div className="col-span-2">Cliente</div>
              <div className="col-span-2">Data incasso</div>
              <div className="col-span-2 text-right">Importo</div>
              <div className="col-span-2 text-center">Stato</div>
              <div className="col-span-2 text-right">Invio</div>
            </div>

            <div className="divide-y divide-gray-100">
              {fattureFiltrate.map((fattura) => (
                <div
                  key={fattura.id}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/40 transition-colors items-center"
                >
                  <button
                    onClick={() => setFatturaSelezionata(fattura)}
                    className="col-span-2 flex items-center text-left min-w-0"
                  >
                    <p className="text-sm font-semibold text-apple-darkgray">
                      {fattura.numero_fattura}
                    </p>
                  </button>
                  <button
                    onClick={() => setFatturaSelezionata(fattura)}
                    className="col-span-2 flex items-center text-left min-w-0"
                  >
                    <p className="text-sm text-apple-darkgray truncate">
                      {fattura.cliente?.nome_cognome || '—'}
                    </p>
                  </button>
                  <button
                    onClick={() => setFatturaSelezionata(fattura)}
                    className="col-span-2 flex items-center text-left"
                  >
                    <p className="text-sm text-apple-gray">
                      {formatData(fattura.data_incasso)}
                    </p>
                  </button>
                  <button
                    onClick={() => setFatturaSelezionata(fattura)}
                    className="col-span-2 flex items-center justify-end text-right"
                  >
                    <p className="text-sm font-bold text-apple-darkgray">
                      {formatEuro(Number(fattura.lordo_ivato))}
                    </p>
                  </button>

                  {/* Colonna Stato con pallino + testo */}
                  <div className="col-span-2 flex items-center justify-center">
                    {isPagata(fattura) ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
                        ✓ Pagata
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                        📄 Proforma
                      </span>
                    )}
                  </div>

                  {/* Colonna Invio con icona + pallino di stato */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleInvia(fattura, 'email')}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-apple font-semibold text-xs transition-colors whitespace-nowrap ${
                        fattura.inviata_email_at
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-blue-50 text-apple-blue hover:bg-blue-100'
                      }`}
                      title={
                        fattura.inviata_email_at
                          ? `Email inviata il ${new Date(fattura.inviata_email_at).toLocaleDateString('it-IT')} - Clicca per reinviare`
                          : 'Invia via Email'
                      }
                    >
                      📧
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          fattura.inviata_email_at ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      ></span>
                    </button>
                    <button
                      onClick={() => handleInvia(fattura, 'whatsapp')}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-apple font-semibold text-xs transition-colors whitespace-nowrap ${
                        fattura.inviata_whatsapp_at
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                      title={
                        fattura.inviata_whatsapp_at
                          ? `WhatsApp inviato il ${new Date(fattura.inviata_whatsapp_at).toLocaleDateString('it-IT')} - Clicca per reinviare`
                          : 'Invia via WhatsApp'
                      }
                    >
                      💬
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          fattura.inviata_whatsapp_at ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      ></span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modale dettaglio fattura */}
      {showFormNuova && (
        <FormNuovaFattura
          onClose={() => setShowFormNuova(false)}
          onSuccess={() => {
            setShowFormNuova(false);
            caricaFatture();
            setToast({ message: 'Proforma creata con successo', tipo: 'success' });
          }}
        />
      )}

      {fatturaSelezionata && (
        <DettaglioFattura
          fattura={fatturaSelezionata}
          onClose={() => setFatturaSelezionata(null)}
          onUpdate={() => {
            setFatturaSelezionata(null);
            caricaFatture();
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
