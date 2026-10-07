import { useState } from 'react';

type Priorita = 'alta' | 'media' | 'bassa';

export function InviaNotificaSezione({ clientId }: { clientId: number }) {
  const [titolo, setTitolo] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [priorita, setPriorita] = useState<Priorita>('media');
  const [url, setUrl] = useState('');
  const [inviando, setInviando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState<string | null>(null);

  async function handleInvia() {
    if (!titolo.trim() || !messaggio.trim()) {
      setErrore('Titolo e messaggio obbligatori');
      return;
    }
    setInviando(true);
    setErrore(null);
    setSuccesso(null);

    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrore('Sessione scaduta');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            titolo: titolo.trim(),
            messaggio: messaggio.trim(),
            priorita,
            url: url.trim() || undefined,
            tipo: 'custom',
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrore(json.error || 'Errore invio notifica');
        return;
      }

      if (json.sent === 0) {
        setSuccesso('⚠️ Notifica salvata ma nessun dispositivo attivo (cliente non ha attivato le notifiche)');
      } else {
        setSuccesso(`✅ Notifica inviata a ${json.sent} dispositivo${json.sent > 1 ? 'i' : ''}`);
      }

      setTitolo('');
      setMessaggio('');
      setUrl('');
      setPriorita('media');
    } catch (e: any) {
      setErrore(e.message || 'Errore di rete');
    } finally {
      setInviando(false);
    }
  }

  return (
    <section className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔔</span>
        <h4 className="text-sm font-semibold text-gray-900">Invia notifica push</h4>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Invia una notifica al cliente. Funziona solo se il cliente ha attivato le notifiche nell'app.
      </p>

      <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-3 space-y-3">
        {/* Titolo */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Titolo *</label>
          <input
            type="text"
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Es. Nuovo appuntamento"
            maxLength={80}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          />
        </div>

        {/* Messaggio */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Messaggio *</label>
          <textarea
            value={messaggio}
            onChange={(e) => setMessaggio(e.target.value)}
            placeholder="Es. Ti aspettiamo mercoledì alle 10:00"
            rows={2}
            maxLength={200}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white resize-none"
          />
          <div className="text-[10px] text-gray-400 mt-0.5 text-right">{messaggio.length}/200</div>
        </div>

        {/* Priorità */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Priorità</label>
          <div className="flex gap-2">
            {(['alta', 'media', 'bassa'] as Priorita[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorita(p)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  priorita === p
                    ? p === 'alta'
                      ? 'bg-red-100 border-red-300 text-red-800'
                      : p === 'media'
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-gray-100 border-gray-300 text-gray-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {p === 'alta' ? '🔴 Alta' : p === 'media' ? '🟡 Media' : '🟢 Bassa'}
              </button>
            ))}
          </div>
        </div>

        {/* URL opzionale */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">URL (opzionale)</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Es. /appuntamenti, /documenti, /note"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          />
          <div className="text-[10px] text-gray-400 mt-0.5">
            Dove va il cliente cliccando la notifica (default: /notifiche)
          </div>
        </div>

        {errore && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {errore}
          </div>
        )}
        {successo && (
          <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
            {successo}
          </div>
        )}

        <button
          type="button"
          onClick={handleInvia}
          disabled={inviando || !titolo.trim() || !messaggio.trim()}
          className="w-full py-2 text-sm bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          {inviando ? '📤 Invio…' : '📤 Invia notifica'}
        </button>
      </div>
    </section>
  );
}
