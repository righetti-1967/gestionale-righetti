import { supabase } from './supabase';

export interface Fornitore {
  id: number;
  ragione_sociale: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  codice_sdi: string | null;
  iban: string | null;
  sconto_percentuale: number;
  giorni_consegna: string | null;
  note: string | null;
  created_at: string;
}

export type NuovoFornitore = Omit<Fornitore, 'id' | 'created_at'>;

export async function getFornitori(): Promise<Fornitore[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fornitori')
    .select('*')
    .eq('user_id', user.id)
    .order('ragione_sociale', { ascending: true });

  if (error) {
    console.error('❌ Errore nel recupero fornitori:', error);
    throw error;
  }
  return data || [];
}

export async function getFornitore(id: number): Promise<Fornitore | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fornitori')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

export async function creaFornitore(fornitore: NuovoFornitore): Promise<Fornitore> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fornitori')
    .insert({ ...fornitore, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore creazione fornitore:', error);
    throw error;
  }
  return data;
}

export async function aggiornaFornitore(
  id: number,
  fornitore: Partial<NuovoFornitore>
): Promise<Fornitore> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fornitori')
    .update(fornitore)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore aggiornamento fornitore:', error);
    throw error;
  }
  return data;
}

export async function eliminaFornitore(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('fornitori')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    console.error('❌ Errore eliminazione fornitore:', error);
    throw error;
  }
}
