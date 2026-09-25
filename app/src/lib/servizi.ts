import { supabase } from './supabase';

export interface Servizio {
  id: number;
  nome: string;
  prezzo_lordo: number;
  durata_minuti: number;
  is_checkup_iniziale?: boolean;
  created_at: string;
}

/**
 * Recupera tutti i servizi
 */
export async function getServizi(): Promise<Servizio[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('servizi')
    .select('*')
    .eq('user_id', user.id)
    .order('nome', { ascending: true });

  if (error) {
    console.error('❌ Errore nel recupero servizi:', error);
    throw error;
  }

  return data || [];
}

/**
 * Recupera un servizio per ID
 */
export async function getServizio(id: number): Promise<Servizio | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('servizi')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

export type NuovoServizio = Omit<Servizio, 'id' | 'created_at'>;

/**
 * Crea un nuovo servizio
 */
export async function creaServizio(servizio: NuovoServizio): Promise<Servizio> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('servizi')
    .insert({ ...servizio, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione servizio:', error);
    throw error;
  }

  return data;
}

/**
 * Aggiorna un servizio esistente
 */
export async function aggiornaServizio(
  id: number,
  servizio: Partial<NuovoServizio>
): Promise<Servizio> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('servizi')
    .update(servizio)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nell\'aggiornamento servizio:', error);
    throw error;
  }

  return data;
}

/**
 * Elimina un servizio
 */
export async function eliminaServizio(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('servizi')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select();

  if (error) {
    console.error('❌ Errore nell\'eliminazione servizio:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Eliminazione non riuscita: nessuna riga cancellata. Possibile problema di permessi (RLS) su Supabase.'
    );
  }
}
