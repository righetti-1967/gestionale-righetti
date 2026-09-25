import { supabase } from './supabase';

export interface Prodotto {
  id: number;
  nome: string;
  prezzo_lordo: number;
  giacenza: number;
  scorta_minima: number;
  codice_fornitore: string | null;
  nome_originale_fornitore: string | null;
  nome_customan: string | null;
  prezzo_acquisto_lordo: number | null;
  prezzo_acquisto_netto_scontato: number | null;
  sconto_fornitore_percentuale: number | null;
  quantita_riordino: number | null;
  fornitore_id: number | null;
  created_at: string;
}

/**
 * Recupera tutti i prodotti
 */
export async function getProdotti(): Promise<Prodotto[]> {
  const { data, error } = await supabase
    .from('prodotti')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('❌ Errore nel recupero prodotti:', error);
    throw error;
  }

  return data || [];
}

/**
 * Recupera un prodotto per ID
 */
export async function getProdotto(id: number): Promise<Prodotto | null> {
  const { data, error } = await supabase
    .from('prodotti')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export type NuovoProdotto = Omit<Prodotto, 'id' | 'created_at'>;

/**
 * Crea un nuovo prodotto
 */
export async function creaProdotto(prodotto: NuovoProdotto): Promise<Prodotto> {
  const { data, error } = await supabase
    .from('prodotti')
    .insert(prodotto)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione prodotto:', error);
    throw error;
  }

  return data;
}

/**
 * Aggiorna un prodotto esistente
 */
export async function aggiornaProdotto(
  id: number,
  prodotto: Partial<NuovoProdotto>
): Promise<Prodotto> {
  const { data, error } = await supabase
    .from('prodotti')
    .update(prodotto)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nell\'aggiornamento prodotto:', error);
    throw error;
  }

  return data;
}

/**
 * Elimina un prodotto
 */
export async function eliminaProdotto(id: number): Promise<void> {
  const { data, error } = await supabase
    .from('prodotti')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error('❌ Errore nell\'eliminazione prodotto:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error(
      'Eliminazione non riuscita: nessuna riga cancellata. Possibile problema di permessi (RLS) su Supabase.'
    );
  }
}
