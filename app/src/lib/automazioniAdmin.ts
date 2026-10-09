import { supabase } from './supabase';

export interface AutomazioneLog {
  id: string;
  user_id: string;
  chiave: string;
  modalita: string;
  esito: string;
  client_id: number | null;
  client_nome: string | null;
  client_email: string | null;
  client_cell: string | null;
  canale: string | null;
  oggetto: string | null;
  corpo_html: string | null;
  corpo_testo: string | null;
  motivo_skip: string | null;
  errore: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function listAutomazioniLog(
  chiave?: string | null,
  modalita?: string | null,
  limit: number = 100
): Promise<AutomazioneLog[]> {
  const { data, error } = await supabase.rpc('admin_list_automazioni_log', {
    chiave_input: chiave ?? null,
    modalita_input: modalita ?? null,
    limit_input: limit,
  });
  if (error) throw new Error(error.message);
  return (data as AutomazioneLog[]) ?? [];
}

/**
 * Esegue il dry-run di una automazione chiamando la Edge Function automazioni-runner.
 */
export async function eseguiDryRun(chiave: string): Promise<{ ok: boolean; logCreati: number; errore?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sessione scaduta');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automazioni-runner`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chiave, force_dry_run: true }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Errore esecuzione dry-run');
  }
  return { ok: true, logCreati: json.log_creati ?? 0 };
}


/**
 * Elimina un singolo log automazione (hard-delete: i log non hanno audit).
 */
export async function eliminaAutomazioneLog(logId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_elimina_automazione_log', {
    log_id_input: logId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Pulisce tutti i log di una modalità (es. 'simulazione').
 * Ritorna il numero di log eliminati.
 */
export async function pulisciAutomazioniLog(modalita?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_pulisci_automazioni_log', {
    modalita_input: modalita ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
