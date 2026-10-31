/**
 * Funzioni per caricare le spese dal backend Railway.
 */
const API_URL = 'https://gestionale-righetti-production.up.railway.app';

export interface Spesa {
  id: number;
  user_id: string;
  data: string;
  descrizione: string;
  importo: number;
  imponibile: number | null;
  iva: number | null;
  categoria: string | null;
  tipo: string;
  ricorrenza: string | null;
  data_scadenza: string | null;
  pagata: boolean;
  data_pagamento: string | null;
  note: string | null;
  ricorrenza_attiva: boolean;
  giorno_scadenza: number | null;
  created_at: string;
}

/**
 * Carica le spese del periodo (solo quelle pagate o tutte, a scelta).
 */
export async function getSpesePeriodo(
  userId: string,
  dataInizio: string,
  dataFine: string,
  opzioni?: { soloPagate?: boolean }
): Promise<Spesa[]> {
  try {
    const url = new URL(`${API_URL}/api/spese`);
    url.searchParams.set('user_id', userId);
    url.searchParams.set('da', dataInizio);
    url.searchParams.set('a', dataFine);
    if (opzioni?.soloPagate) {
      url.searchParams.set('pagata', 'true');
    }

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.spese || [];
  } catch (e: any) {
    console.error('Errore caricamento spese:', e);
    return [];
  }
}

/**
 * Somma totale spese del periodo (solo pagate).
 */
export async function getTotaleSpesePeriodo(
  userId: string,
  dataInizio: string,
  dataFine: string
): Promise<number> {
  const spese = await getSpesePeriodo(userId, dataInizio, dataFine, { soloPagate: true });
  return spese.reduce((sum, s) => sum + Number(s.importo || 0), 0);
}
