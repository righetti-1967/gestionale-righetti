/**
 * Admin — Log integrazioni esterne (stampa RT, FPT, ADE)
 * Lettura, filtri, cancellazione riga, pulizia totale.
 */
import { supabase } from './supabase';

export interface IntegrazioneLog {
  id: number;
  user_id: string | null;
  user_email: string | null;
  tipo: string;
  provider: string | null;
  modalita: string;
  riferimento_id: string | null;
  payload: Record<string, any> | null;
  esito: string | null;
  errore: string | null;
  durata_ms: number | null;
  created_at: string;
}

export interface IntegrazioniFiltri {
  tipo?: string | null;
  modalita?: string | null;
  esito?: string | null;
  giorni?: number | null;   // ultimi N giorni; null = tutto
}

export async function listIntegrazioniLog(
  filtri: IntegrazioniFiltri = {},
  limit = 200
): Promise<IntegrazioneLog[]> {
  let q = supabase
    .from('integrazioni_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filtri.tipo) q = q.eq('tipo', filtri.tipo);
  if (filtri.modalita) q = q.eq('modalita', filtri.modalita);
  if (filtri.esito) q = q.eq('esito', filtri.esito);

  if (filtri.giorni && filtri.giorni > 0) {
    const da = new Date(Date.now() - filtri.giorni * 24 * 60 * 60 * 1000).toISOString();
    q = q.gte('created_at', da);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as IntegrazioneLog[];
}

export async function eliminaIntegrazioneLog(id: number): Promise<void> {
  const { error } = await supabase.rpc('admin_elimina_integrazione_log', { p_id: id });
  if (error) throw error;
}

export async function pulisciIntegrazioniLog(modalita?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_pulisci_integrazioni_log', {
    p_modalita: modalita ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ============================================================
// HELPER: etichette
// ============================================================

export function labelTipoIntegrazione(tipo: string): string {
  switch (tipo) {
    case 'stampa_scontrino': return '🖨️ Stampa scontrino';
    case 'fattura_fpt': return '📤 Fattura → FPT';
    case 'fattura_ade': return '📤 Fattura → ADE/SDI';
    case 'corrispettivi_fpt': return '📤 Corrispettivi → FPT';
    case 'corrispettivi_ade': return '📤 Corrispettivi → ADE';
    default: return tipo;
  }
}

export function labelProviderIntegrazione(p: string | null): string {
  if (!p) return '—';
  switch (p) {
    case 'fpt': return 'FPT';
    case 'ade_diretto': return 'ADE';
    case 'rch': return 'RCH';
    case 'epson': return 'Epson';
    default: return p;
  }
}
