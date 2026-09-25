import { supabase } from './supabase';
import type { RigaPercorso } from './percorsi-helper';

export type StatoPercorso =
  | 'attivo'
  | 'in-scadenza'
  | 'da-incassare'
  | 'da-fatturare'
  | 'completato'
  | 'bloccato'
  | 'terminato'
  | 'scaduto';

export interface Percorso {
  id: number;
  cliente_id: number;
  fattura_id: number | null;
  nome: string;
  data_inizio: string;
  data_fine: string;
  righe: RigaPercorso[];
  totale_listino: number;
  totale_finale: number;
  sconto_percentuale: number;
  terminato: boolean;
  terminato_manualmente: boolean;
  bloccato?: boolean;
  motivo_blocco?: string | null;
  note: string | null;
  created_at: string;
}

export type NuovoPercorso = Omit<Percorso, 'id' | 'created_at'>;

/**
 * Recupera tutti i percorsi di un cliente
 */
export async function getPercorsiCliente(clienteId: number): Promise<Percorso[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('percorsi')
    .select('*')
    .eq('user_id', user.id)
    .eq('cliente_id', clienteId)
    .order('data_inizio', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero percorsi:', error);
    throw error;
  }

  return data || [];
}

/**
 * Recupera un singolo percorso
 */
export async function getPercorso(id: number): Promise<Percorso | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('percorsi')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

/**
 * Crea un nuovo percorso
 */
export async function creaPercorso(percorso: NuovoPercorso): Promise<Percorso> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('percorsi')
    .insert({ ...percorso, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione percorso:', error);
    throw error;
  }

  return data;
}

/**
 * Aggiorna un percorso
 */
export async function aggiornaPercorso(
  id: number,
  percorso: Partial<NuovoPercorso>
): Promise<Percorso> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('percorsi')
    .update(percorso)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nell\'aggiornamento percorso:', error);
    throw error;
  }

  return data;
}

/**
 * Elimina un percorso
 */
export async function eliminaPercorso(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('percorsi')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('❌ Errore nell\'eliminazione percorso:', error);
    throw error;
  }
}

/**
 * Blocca un percorso (es. cliente non paga)
 */
export async function bloccaPercorso(
  id: number,
  motivo: string
): Promise<Percorso> {
  return aggiornaPercorso(id, {
    bloccato: true,
    motivo_blocco: motivo.trim() || null,
  });
}

/**
 * Sblocca un percorso
 */
export async function sbloccaPercorso(id: number): Promise<Percorso> {
  return aggiornaPercorso(id, {
    bloccato: false,
    motivo_blocco: null,
  });
}

/**
 * Termina manualmente un percorso
 */
export async function terminaPercorso(id: number): Promise<Percorso> {
  return aggiornaPercorso(id, {
    terminato: true,
    terminato_manualmente: true,
  });
}

/**
 * Riapre un percorso terminato
 */
export async function riapriPercorso(id: number): Promise<Percorso> {
  return aggiornaPercorso(id, {
    terminato: false,
    terminato_manualmente: false,
  });
}

/**
 * Proroga la data di scadenza di un percorso
 */
export async function prorogaPercorso(
  id: number,
  nuovaDataFine: string
): Promise<Percorso> {
  return aggiornaPercorso(id, {
    data_fine: nuovaDataFine,
  });
}

/**
 * Recupera tutti i percorsi (per admin)
 */
export async function getTuttiPercorsi(): Promise<Percorso[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('percorsi')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero percorsi:', error);
    throw error;
  }

  return data || [];
}
