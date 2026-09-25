import { supabase } from './supabase';
import type { Fornitore } from './fornitori';

export interface RigaOrdine {
  id: number;
  ordine_id: number;
  prodotto_id: number;
  nome_prodotto: string;
  nome_originale_fornitore: string | null;
  quantita: number;
  prezzo_acquisto_lordo: number;
  sconto_percentuale: number;
  prezzo_scontato_lordo: number;
  created_at: string;
}

export interface OrdineFornitore {
  id: number;
  numero_ordine: string;
  fornitore_id: number;
  data_ordine: string;
  data_consegna_prevista: string | null;
  stato: 'bozza' | 'inviato' | 'ricevuto' | 'annullato';
  totale_netto: number;
  totale_iva: number;
  totale_lordo: number;
  note: string | null;
  inviato_email_at: string | null;
  inviato_whatsapp_at: string | null;
  ricevuto_at: string | null;
  created_at: string;
}

export interface OrdineConFornitore extends OrdineFornitore {
  fornitore?: Fornitore | null;
  righe?: RigaOrdine[];
}

export interface NuovaRigaOrdine {
  prodotto_id: number;
  nome_prodotto: string;
  nome_originale_fornitore: string | null;
  quantita: number;
  prezzo_acquisto_lordo: number;
  sconto_percentuale: number;
  prezzo_scontato_lordo: number;
}

export interface NuovoOrdine {
  numero_ordine: string;
  fornitore_id: number;
  data_ordine: string;
  data_consegna_prevista: string | null;
  stato: 'bozza' | 'inviato' | 'ricevuto' | 'annullato';
  totale_netto: number;
  totale_iva: number;
  totale_lordo: number;
  note: string | null;
  righe: NuovaRigaOrdine[];
}

const IVA = 0.22;

/**
 * Calcola il prossimo numero ordine dell'anno corrente (formato ORD-00001/YYYY)
 */
export async function getProssimoNumeroOrdine(): Promise<{
  numero_progressivo: number;
  numero_ordine: string;
  anno: number;
}> {
  const annoCorrente = new Date().getFullYear();

  const { data } = await supabase
    .from('ordini_fornitore')
    .select('numero_ordine')
    .ilike('numero_ordine', `%/R`)
    .order('id', { ascending: false })
    .limit(100);

  // Prendo il progressivo massimo tra quelli dell'anno corrente
  let maxProgressivo = 0;
  if (data) {
    for (const row of data) {
      const match = row.numero_ordine.match(/ORD-(\d+)\/(\d+)/);
      if (match) {
        const progressivo = parseInt(match[1], 10);
        const anno = parseInt(match[2], 10);
        if (anno === annoCorrente && progressivo > maxProgressivo) {
          maxProgressivo = progressivo;
        }
      }
    }
  }

  const prossimo = maxProgressivo + 1;
  const numeroFormattato = `ORD-${String(prossimo).padStart(5, '0')}/${annoCorrente}`;

  return {
    numero_progressivo: prossimo,
    numero_ordine: numeroFormattato,
    anno: annoCorrente,
  };
}

/**
 * Calcola i totali di un ordine partendo dalle righe
 */
export function calcolaTotaliOrdine(righe: NuovaRigaOrdine[]): {
  totale_netto: number;
  totale_iva: number;
  totale_lordo: number;
} {
  const totaleLordo = righe.reduce(
    (sum, r) => sum + r.quantita * r.prezzo_scontato_lordo,
    0
  );
  const totaleNetto = Number((totaleLordo / (1 + IVA)).toFixed(2));
  const totaleIva = Number((totaleLordo - totaleNetto).toFixed(2));

  return {
    totale_netto: totaleNetto,
    totale_iva: totaleIva,
    totale_lordo: Number(totaleLordo.toFixed(2)),
  };
}

/**
 * Crea un nuovo ordine con righe (transazione manuale)
 */
export async function creaOrdine(ordine: NuovoOrdine): Promise<OrdineFornitore> {
  const { righe, ...intestazione } = ordine;

  // 1) Inserisci intestazione
  const { data: ordineCreato, error: errOrdine } = await supabase
    .from('ordini_fornitore')
    .insert(intestazione)
    .select()
    .single();

  if (errOrdine) {
    console.error('❌ Errore creazione ordine:', errOrdine);
    throw errOrdine;
  }

  // 2) Inserisci righe
  const righeConOrdine = righe.map((r) => ({ ...r, ordine_id: ordineCreato.id }));

  const { error: errRighe } = await supabase
    .from('righe_ordine_fornitore')
    .insert(righeConOrdine);

  if (errRighe) {
    console.error('❌ Errore creazione righe ordine:', errRighe);
    // Rollback: elimina l'ordine appena creato
    await supabase.from('ordini_fornitore').delete().eq('id', ordineCreato.id);
    throw errRighe;
  }

  return ordineCreato;
}

/**
 * Recupera tutti gli ordini con fornitore e righe
 */
export async function getOrdini(): Promise<OrdineConFornitore[]> {
  const { data, error } = await supabase
    .from('ordini_fornitore')
    .select(`
      *,
      fornitore:fornitori(*),
      righe:righe_ordine_fornitore(*)
    `)
    .order('data_ordine', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('❌ Errore recupero ordini:', error);
    throw error;
  }
  return data || [];
}

/**
 * Recupera un singolo ordine con dettagli
 */
export async function getOrdine(id: number): Promise<OrdineConFornitore | null> {
  const { data, error } = await supabase
    .from('ordini_fornitore')
    .select(`
      *,
      fornitore:fornitori(*),
      righe:righe_ordine_fornitore(*)
    `)
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

/**
 * Aggiorna stato ordine
 */
export async function aggiornaStatoOrdine(
  id: number,
  stato: 'bozza' | 'inviato' | 'ricevuto' | 'annullato',
  extra?: Partial<OrdineFornitore>
): Promise<OrdineFornitore> {
  const { data, error } = await supabase
    .from('ordini_fornitore')
    .update({ stato, ...extra })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore aggiornamento stato ordine:', error);
    throw error;
  }
  return data;
}

/**
 * Elimina un ordine (le righe vengono eliminate in cascata)
 */
export async function eliminaOrdine(id: number): Promise<void> {
  const { error } = await supabase.from('ordini_fornitore').delete().eq('id', id);

  if (error) {
    console.error('❌ Errore eliminazione ordine:', error);
    throw error;
  }
}
