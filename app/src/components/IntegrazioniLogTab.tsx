import { useEffect, useState } from 'react';
import {
  listIntegrazioniLog,
  eliminaIntegrazioneLog,
  pulisciIntegrazioniLog,
  labelTipoIntegrazione,
  labelProviderIntegrazione,
  type IntegrazioneLog,
} from '../lib/integrazioniAdmin';

const TIPI_DISPONIBILI = [
  { valore: 'stampa_scontrino', label: '🖨️ Stampa scontrino' },
  { valore: 'fattura_fpt', label: '📤 Fattura → FPT' },
  { valore: 'fattura_ade', label: '📤 Fattura → ADE/SDI' },
  { valore: 'corrispettivi_fpt', label: '📤 Corrispettivi → FPT' },
  { valore: 'corrispettivi_ade', label: '📤 Corrispettivi → ADE' },
];

export function IntegrazioniLogTab() {
  const [logs, setLogs] = useState<IntegrazioneLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [pulendo, setPulendo] = useState(false);

  // Filtri
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroModalita, setFiltroModalita] = useState<string>('');
  const [filtroEsito, setFiltroEsito] = useState<string>('');
  const [filtroGiorni, setFiltroGiorni] = useState<number>(7);

  async function carica() {
    setLoading(true);
    setErrore(null);
    try {
      const data = await listIntegrazioniLog(
        {
          tipo: filtroTipo || null,
          modalita: filtroModalita || null,
          esito: filtroEsito || null,
          giorni: filtroGiorni || null,
        },
        200
      );
      setLogs(data);
    } catch (e: any) {
      setErrore(e?.message || 'Errore caricamento log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroModalita, filtroEsito, filtroGiorni]);

  async function handleElimina(id: number) {
    if (!confirm('Eliminare questa riga di log?')) return;
    setEliminando(id);
    try {
      await eliminaIntegrazioneLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      alert(e?.message || 'Errore eliminazione');
    } finally {
      setEliminando(null);
    }
  }

  async function handlePulisci() {
    const msg = filtroModalita
      ? `Eliminare tutti i log in modalità "${filtroModalita}"?`
      : 'Eliminare TUTTI i log di integrazioni?\n\nAzione irreversibile.';
    if (!confirm(msg + '\n\nAzione irreversibile.')) return;
    setPulendo(true);
    try {
      const n = await pulisciIntegrazioniLog(filtroModalita || undefined);
      await carica();
      alert(`✅ ${n} log eliminati`);
    } catch (e: any) {
      alert(e?.message || 'Errore pulizia');
    } finally {
      setPulendo(false);
    }
  }

  // Contatori per tipo
  const contatori = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.tipo] = (acc[l.tipo] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-apple-darkgray">
            🔌 Log Integrazioni Esterne
          </h3>
          <p className="text-xs text-apple-gray mt-0.5">
            Tutte le chiamate ai sistemi esterni (stampa RT, FPT, ADE/SDI) — simulazione e reale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePulisci}
            disabled={pulendo || loading || logs.length === 0}
            className="px-3 py-1.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-apple hover:bg-red-100 disabled:opacity-50"
          >
            {pulendo ? '🧹 Pulisco…' : '🧹 Pulisci log'}
          </button>
          <button
            onClick={carica}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-apple hover:bg-gray-50 disabled:opacity-50"
          >
            🔄 Aggiorna
          </button>
        </div>
      </div>

      {/* Contatori rapidi */}
      {logs.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          {Object.entries(contatori).map(([tipo, n]) => (
            <span
              key={tipo}
              className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold"
            >
              {labelTipoIntegrazione(tipo)}: {n}
            </span>
          ))}
        </div>
      )}

      {/* Filtri */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple"
        >
          <option value="">Tutti i tipi</option>
          {TIPI_DISPONIBILI.map((t) => (
            <option key={t.valore} value={t.valore}>{t.label}</option>
          ))}
        </select>

        <select
          value={filtroModalita}
          onChange={(e) => setFiltroModalita(e.target.value)}
          className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple"
        >
          <option value="">Tutte le modalità</option>
          <option value="simulazione">🧪 Simulazione</option>
          <option value="reale">🔴 Reale</option>
        </select>

        <select
          value={filtroEsito}
          onChange={(e) => setFiltroEsito(e.target.value)}
          className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple"
        >
          <option value="">Tutti gli esiti</option>
          <option value="simulato">Simulato</option>
          <option value="pending_driver">Pending driver</option>
          <option value="ok">OK</option>
          <option value="errore">Errore</option>
        </select>

        <select
          value={filtroGiorni}
          onChange={(e) => setFiltroGiorni(parseInt(e.target.value) || 0)}
          className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple"
        >
          <option value={1}>Ultime 24h</option>
          <option value={7}>Ultimi 7 giorni</option>
          <option value={30}>Ultimi 30 giorni</option>
          <option value={0}>Tutto</option>
        </select>
      </div>

      {errore && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-apple text-xs text-red-700">
          {errore}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-xs text-apple-gray py-6 text-center">Caricamento…</div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-apple-gray py-6 text-center border border-dashed border-gray-200 rounded-apple">
          Nessun log per i filtri selezionati.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandId === log.id;
            const isReale = log.modalita === 'reale';
            const esitoColor =
              log.esito === 'ok' || log.esito === 'simulato' ? 'green' :
              log.esito === 'pending_driver' ? 'amber' :
              'red';
            return (
              <div
                key={log.id}
                className={`border rounded-apple p-3 text-xs bg-white ${
                  esitoColor === 'green' ? 'border-green-100' :
                  esitoColor === 'amber' ? 'border-amber-100' :
                  'border-red-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-apple-darkgray">
                        {labelTipoIntegrazione(log.tipo)}
                      </span>
                      {log.provider && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {labelProviderIntegrazione(log.provider)}
                        </span>
                      )}
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isReale
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isReale ? '🔴 reale' : '🧪 simulazione'}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        esitoColor === 'green' ? 'bg-green-100 text-green-700' :
                        esitoColor === 'amber' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.esito || '—'}
                      </span>
                      {log.durata_ms !== null && (
                        <span className="text-[9px] text-gray-400">{log.durata_ms}ms</span>
                      )}
                    </div>
                    <div className="text-apple-gray mt-1">
                      {log.riferimento_id && (
                        <span className="font-mono">Rif: {log.riferimento_id}</span>
                      )}
                      {log.user_email && (
                        <span className="ml-2">· {log.user_email}</span>
                      )}
                    </div>
                    {log.errore && (
                      <div className="text-amber-700 mt-1">⚠️ {log.errore}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandId(isExpanded ? null : log.id)}
                      className="text-[10px] text-gray-500 hover:text-blue-600"
                    >
                      {isExpanded ? '▲ Chiudi' : '▼ Payload'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleElimina(log.id)}
                      disabled={eliminando === log.id}
                      title="Elimina log"
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-0.5 text-sm"
                    >
                      {eliminando === log.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {log.payload && (
                      <div>
                        <div className="text-[10px] font-semibold text-apple-gray uppercase mb-1">
                          Payload
                        </div>
                        <pre className="whitespace-pre-wrap text-[11px] text-apple-darkgray bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">
                      {new Date(log.created_at).toLocaleString('it-IT')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
