import { supabase } from './supabase';

export type TipoMovimento = 'carico' | 'scarico';

export interface MovimentoMagazzino {
  id: number;
  prodotto_id: number;
  tipo: TipoMovimento;
  quantita: number;
  motivo: string | null;
  note: string | null;
  data_movimento: string;
  created_at: string;
}

export interface MovimentoConProdotto extends MovimentoMagazzino {
  prodotto: {
    id: number;
    nome: string;
    codice_fornitore: string | null;
    giacenza: number;
  } | null;
}

export type NuovoMovimento = Omit<MovimentoMagazzino, 'id' | 'created_at'>;

/**
 * Recupera tutti i movimenti con dati prodotto
 */
export async function getMovimenti(): Promise<MovimentoConProdotto[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('movimenti_magazzino')
    .select('*, prodotto:prodotti(id, nome, codice_fornitore, giacenza)')
    .eq('user_id', user.id)
    .order('data_movimento', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero movimenti:', error);
    throw error;
  }

  return data || [];
}

/**
 * Recupera i movimenti di un singolo prodotto
 */
export async function getMovimentiProdotto(
  prodottoId: number
): Promise<MovimentoMagazzino[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('movimenti_magazzino')
    .select('*')
    .eq('user_id', user.id)
    .eq('prodotto_id', prodottoId)
    .order('data_movimento', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero movimenti prodotto:', error);
    throw error;
  }

  return data || [];
}

/**
 * Crea un nuovo movimento.
 * Il trigger SQL aggiorna automaticamente la giacenza del prodotto.
 */
export async function creaMovimento(
  movimento: NuovoMovimento
): Promise<MovimentoMagazzino> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('movimenti_magazzino')
    .insert({ ...movimento, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione movimento:', error);
    throw error;
  }

  return data;
}

/**
 * Elimina un movimento.
 * Il trigger SQL annulla automaticamente l'effetto sulla giacenza.
 */
export async function eliminaMovimento(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('movimenti_magazzino')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('❌ Errore nell\'eliminazione movimento:', error);
    throw error;
  }
}

/**
 * Statistiche magazzino
 */
export function calcolaStatisticheMovimenti(movimenti: MovimentoConProdotto[]): {
  totaleCarichi: number;
  totaleScarichi: number;
  numCarichi: number;
  numScarichi: number;
} {
  let totaleCarichi = 0;
  let totaleScarichi = 0;
  let numCarichi = 0;
  let numScarichi = 0;

  for (const m of movimenti) {
    if (m.tipo === 'carico') {
      totaleCarichi += m.quantita;
      numCarichi += 1;
    } else {
      totaleScarichi += m.quantita;
      numScarichi += 1;
    }
  }

  return { totaleCarichi, totaleScarichi, numCarichi, numScarichi };
}
