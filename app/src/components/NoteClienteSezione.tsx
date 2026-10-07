import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface NotaCliente {
  id: string;
  contenuto: string;
  visibile_cliente: boolean;
  letta: boolean;
  letta_at: string | null;
  created_at: string;
  updated_at: string;
  autore_nome: string | null;
}

export function NoteClienteSezione({ clientId }: { clientId: number }) {
  const [note, setNote] = useState<NotaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  // Nuova nota
  const [nuovoContenuto, setNuovoContenuto] = useState('');
  const [nuovaVisibile, setNuovaVisibile] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Modifica inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editContenuto, setEditContenuto] = useState('');
  const [editVisibile, setEditVisibile] = useState(true);

  async function carica() {
    setLoading(true);
    setErrore(null);
    const { data, error } = await supabase.rpc('admin_list_note_cliente', {
      client_id_input: clientId,
    });
    if (error) setErrore(error.message);
    else setNote((data as NotaCliente[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carica();
    // Auto-refresh ogni 20 sec (per vedere se il cliente legge)
    const interval = setInterval(carica, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleCrea() {
    if (!nuovoContenuto.trim()) return;
    setSalvando(true);
    setErrore(null);
    const { error } = await supabase.rpc('admin_create_nota_cliente', {
      client_id_input: clientId,
      contenuto_input: nuovoContenuto,
      visibile_input: nuovaVisibile,
    });
    setSalvando(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setNuovoContenuto('');
    setNuovaVisibile(true);
    carica();
  }

  async function handleSalvaModifica() {
    if (!editandoId || !editContenuto.trim()) return;
    setSalvando(true);
    setErrore(null);
    const { error } = await supabase.rpc('admin_update_nota_cliente', {
      nota_id_input: editandoId,
      contenuto_input: editContenuto,
      visibile_input: editVisibile,
    });
    setSalvando(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    setEditandoId(null);
    carica();
  }

  async function handleElimina(id: string) {
    if (!confirm('Eliminare questa nota? L\'operazione non è reversibile.')) return;
    setSalvando(true);
    setErrore(null);
    const { error } = await supabase.rpc('admin_delete_nota_cliente', {
      nota_id_input: id,
    });
    setSalvando(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    carica();
  }

  function formatDataOra(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  return (
    <section className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📝</span>
        <h4 className="text-sm font-semibold text-gray-900">Note per il cliente</h4>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Scrivi note che il cliente vedrà nella sua app. Le note sono cumulate nel tempo.
      </p>

      {/* Nuova nota */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-4">
        <textarea
          value={nuovoContenuto}
          onChange={(e) => setNuovoContenuto(e.target.value)}
          placeholder="Scrivi una nota per il cliente..."
          rows={3}
          maxLength={2000}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
        />
        <div className="flex items-center justify-between mt-2 gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
            <input
              type="checkbox"
              checked={nuovaVisibile}
              onChange={(e) => setNuovaVisibile(e.target.checked)}
              className="w-4 h-4"
            />
            👁 Visibile al cliente
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">{nuovoContenuto.length}/2000</span>
            <button
              type="button"
              onClick={handleCrea}
              disabled={salvando || !nuovoContenuto.trim()}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? 'Salvo…' : '➕ Aggiungi'}
            </button>
          </div>
        </div>
      </div>

      {/* Errore */}
      {errore && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {errore}
        </div>
      )}

      {/* Lista note */}
      {loading ? (
        <div className="text-xs text-gray-400 py-3 text-center">Caricamento…</div>
      ) : note.length === 0 ? (
        <div className="text-xs text-gray-400 py-3 text-center">
          Nessuna nota ancora
        </div>
      ) : (
        <div className="space-y-2">
          {note.map((n) => (
            <div
              key={n.id}
              className={`border rounded-lg p-3 text-sm ${
                !n.visibile_cliente
                  ? 'bg-gray-50 border-gray-200 opacity-70'
                  : n.letta
                  ? 'bg-green-50/40 border-green-100'
                  : 'bg-white border-gray-200'
              }`}
            >
              {editandoId === n.id ? (
                // Modalità modifica
                <div>
                  <textarea
                    value={editContenuto}
                    onChange={(e) => setEditContenuto(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={editVisibile}
                        onChange={(e) => setEditVisibile(e.target.checked)}
                        className="w-4 h-4"
                      />
                      👁 Visibile
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditandoId(null)}
                        className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={handleSalvaModifica}
                        disabled={salvando || !editContenuto.trim()}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {salvando ? '…' : 'Salva'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Modalità visualizzazione
                <div>
                  <div className="text-gray-800 whitespace-pre-wrap break-words">{n.contenuto}</div>
                  <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                    <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                      <span>📅 {formatDataOra(n.created_at)}</span>
                      {n.autore_nome && <span>· {n.autore_nome}</span>}
                      {!n.visibile_cliente && (
                        <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          👁‍🗨 Interna
                        </span>
                      )}
                      {n.visibile_cliente && (
                        n.letta ? (
                          <span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-medium">
                            ✓ Letta {n.letta_at ? formatDataOra(n.letta_at) : ''}
                          </span>
                        ) : (
                          <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                            Non letta
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoId(n.id);
                          setEditContenuto(n.contenuto);
                          setEditVisibile(n.visibile_cliente);
                        }}
                        className="px-2 py-1 text-[10px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleElimina(n.id)}
                        className="px-2 py-1 text-[10px] text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Elimina"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
