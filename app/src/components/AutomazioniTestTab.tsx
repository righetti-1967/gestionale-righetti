import { useEffect, useState } from 'react';
import { listAutomazioniLog, eseguiDryRun, eliminaAutomazioneLog, pulisciAutomazioniLog, type AutomazioneLog } from '../lib/automazioniAdmin';
import { LABEL_AUTOMAZIONE, type TipoAutomazione } from '../lib/automazioni';

const CHIAVI_DISPONIBILI: { chiave: TipoAutomazione; label: string }[] = [
  { chiave: 'promemoria_appuntamento', label: LABEL_AUTOMAZIONE.promemoria_appuntamento.label },
  { chiave: 'promemoria_checkup', label: LABEL_AUTOMAZIONE.promemoria_checkup.label },
  { chiave: 'post_seduta', label: LABEL_AUTOMAZIONE.post_seduta.label },
  { chiave: 'compleanno', label: LABEL_AUTOMAZIONE.compleanno.label },
  { chiave: 'riattivazione', label: LABEL_AUTOMAZIONE.riattivazione.label },
];

export function AutomazioniTestTab() {
  const [logs, setLogs] = useState<AutomazioneLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [filtroChiave, setFiltroChiave] = useState<string>('');
  const [filtroModalita, setFiltroModalita] = useState<string>('');
  const [filtroEsito, setFiltroEsito] = useState<string>('');
  const [filtroGiorni, setFiltroGiorni] = useState<number>(7);
  const [eseguendo, setEseguendo] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [eliminandoLogId, setEliminandoLogId] = useState<string | null>(null);
  const [pulendo, setPulendo] = useState(false);

  async function carica() {
    setLoading(true);
    setErrore(null);
    try {
      const data = await listAutomazioniLog(
        filtroChiave || null,
        filtroModalita || null,
        200
      );
      // Filtraggio client-side per esito e giorni (la lib non li supporta)
      let filtrati = data;
      if (filtroEsito) {
        filtrati = filtrati.filter((l) => l.esito === filtroEsito);
      }
      if (filtroGiorni > 0) {
        const da = Date.now() - filtroGiorni * 24 * 60 * 60 * 1000;
        filtrati = filtrati.filter((l) => new Date(l.created_at).getTime() >= da);
      }
      setLogs(filtrati);
    } catch (e: any) {
      setErrore(e.message || 'Errore caricamento log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroChiave, filtroModalita, filtroEsito, filtroGiorni]);

  async function handleEliminaLog(logId: string, titolo: string) {
    if (!confirm(`Eliminare questo log?\n\n"${titolo}"`)) return;
    setEliminandoLogId(logId);
    try {
      await eliminaAutomazioneLog(logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (e: any) {
      alert(e.message || 'Errore eliminazione');
    } finally {
      setEliminandoLogId(null);
    }
  }

  async function handlePulisci() {
    if (!confirm('Eliminare TUTTI i log di simulazione?\n\nAzione irreversibile.')) return;
    setPulendo(true);
    try {
      const n = await pulisciAutomazioniLog('simulazione');
      await carica();
      alert(`✅ ${n} log eliminati`);
    } catch (e: any) {
      alert(e.message || 'Errore pulizia');
    } finally {
      setPulendo(false);
    }
  }

  async function handleEsegui(chiave: string) {
    setEseguendo(chiave);
    setErrore(null);
    try {
      const res = await eseguiDryRun(chiave);
      await carica();
      alert(`✅ Dry-run completato: ${res.logCreati} log creati`);
    } catch (e: any) {
      setErrore(e.message || 'Errore esecuzione');
    } finally {
      setEseguendo(null);
    }
  }

  // Contatori per chiave
  const contatori = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.chiave] = (acc[l.chiave] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-apple-darkgray">
            🧪 Log Simulazione Automazioni
          </h3>
          <p className="text-xs text-apple-gray mt-0.5">
            Anteprime delle automazioni in modalità simulazione (nessun invio reale).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePulisci}
            disabled={pulendo || loading || logs.length === 0}
            className="px-3 py-1.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-apple hover:bg-red-100 disabled:opacity-50"
          >
            {pulendo ? '🧹 Pulisco…' : '🧹 Pulisci log simulazione'}
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

      {/* Pulsanti Esegui Dry-Run */}
      <div className="flex flex-wrap gap-2">
        {CHIAVI_DISPONIBILI.map(({ chiave, label }) => (
          <button
            key={chiave}
            onClick={() => handleEsegui(chiave)}
            disabled={eseguendo === chiave}
            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-apple hover:bg-purple-700 disabled:opacity-50"
          >
            {eseguendo === chiave ? '⏳ Eseguo…' : `▶️ Esegui dry-run: ${label}`}
          </button>
        ))}
      </div>

      {/* Contatori per chiave */}
      {logs.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          {Object.entries(contatori).map(([chiave, n]) => (
            <span
              key={chiave}
              className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold"
            >
              {LABEL_AUTOMAZIONE[chiave as TipoAutomazione]?.label || chiave}: {n}
            </span>
          ))}
        </div>
      )}

      {/* Filtri */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select
          value={filtroChiave}
          onChange={(e) => setFiltroChiave(e.target.value)}
          className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-apple"
        >
          <option value="">Tutte le automazioni</option>
          {CHIAVI_DISPONIBILI.map(({ chiave, label }) => (
            <option key={chiave} value={chiave}>{label}</option>
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
          <option value="ok">OK</option>
          <option value="skip">Skip</option>
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

      {/* Lista log */}
      {loading ? (
        <div className="text-xs text-apple-gray py-6 text-center">Caricamento…</div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-apple-gray py-6 text-center border border-dashed border-gray-200 rounded-apple">
          Nessun log. Clicca "▶️ Esegui dry-run" per generare anteprime.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandId === log.id;
            const esitoColor =
              log.esito === 'ok' ? 'green' :
              log.esito === 'skip' ? 'amber' :
              'red';
            const labelAuto = LABEL_AUTOMAZIONE[log.chiave as TipoAutomazione]?.label || log.chiave;
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
                      <span className="font-semibold text-apple-darkgray">{labelAuto}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        log.modalita === 'simulazione'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {log.modalita === 'simulazione' ? '🧪 simulazione' : '🔴 reale'}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        esitoColor === 'green' ? 'bg-green-100 text-green-700' :
                        esitoColor === 'amber' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.esito}
                      </span>
                      {log.canale && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {log.canale}
                        </span>
                      )}
                    </div>
                    <div className="text-apple-gray mt-1">
                      {log.client_nome || '(nessun cliente)'}
                      {log.client_email ? ` · ${log.client_email}` : ''}
                      {log.client_cell ? ` · ${log.client_cell}` : ''}
                    </div>
                    {log.motivo_skip && (
                      <div className="text-amber-600 mt-1">⚠️ {log.motivo_skip}</div>
                    )}
                    {log.errore && (
                      <div className="text-red-600 mt-1">❌ {log.errore}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandId(isExpanded ? null : log.id)}
                      className="text-[10px] text-gray-500 hover:text-blue-600"
                    >
                      {isExpanded ? '▲ Chiudi' : '▼ Anteprima'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminaLog(log.id, log.oggetto || log.chiave)}
                      disabled={eliminandoLogId === log.id}
                      title="Elimina log"
                      className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 p-0.5 text-sm"
                    >
                      {eliminandoLogId === log.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {log.oggetto && (
                      <div>
                        <div className="text-[10px] font-semibold text-apple-gray uppercase">Oggetto</div>
                        <div className="text-apple-darkgray">{log.oggetto}</div>
                      </div>
                    )}
                    {log.corpo_testo && (
                      <div>
                        <div className="text-[10px] font-semibold text-apple-gray uppercase">Testo</div>
                        <pre className="whitespace-pre-wrap text-[11px] text-apple-darkgray bg-gray-50 p-2 rounded overflow-x-auto">{log.corpo_testo}</pre>
                      </div>
                    )}
                    {log.corpo_html && (
                      <div>
                        <div className="text-[10px] font-semibold text-apple-gray uppercase">HTML</div>
                        <div className="border border-gray-200 rounded p-2 bg-white" dangerouslySetInnerHTML={{ __html: log.corpo_html }} />
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
