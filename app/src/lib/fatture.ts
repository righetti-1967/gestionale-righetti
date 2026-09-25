import { supabase } from './supabase';
import type { Cliente } from './clienti';

export type MetodoPagamento = 'Bonifico' | 'Carta' | 'Bancomat' | 'Contanti' | 'Non richiesto';

export interface RigaFattura {
  tipo: 'servizio' | 'prodotto' | 'percorso' | 'libera';
  servizio_id: number | null;
  prodotto_id: number | null;
  percorso_id?: number | null;
  nome: string;
  quantita: number;
  prezzo_unitario_lordo: number;
  data_inizio?: string | null;
  data_fine?: string | null;
}

export interface Fattura {
  id: number;
  numero_fattura: string;
  numero_progressivo: number | null;
  anno: number | null;
  numero_scontrino_madre: string | null;
  cliente_id: number;
  data_inizio: string | null;
  data_fine: string | null;
  data_incasso: string | null;
  metodo_pagamento?: MetodoPagamento | string | null;
  data_firma: string | null;
  lordo_ivato: number;
  netto_imponibile: number;
  iva_importo: number;
  righe: RigaFattura[];
  dicitura_legale: string | null;
  note_interne: string | null;
  inviato_sdi: boolean;
  firmato: boolean;
  firma_immagine: string | null;
  pacchetto_scelto_id: number | null;
  inviata_email_at: string | null;
  inviata_whatsapp_at: string | null;
  created_at: string;
}

export type NuovaFattura = Omit<Fattura, 'id' | 'created_at'>;

export interface FatturaConCliente extends Fattura {
  cliente?: Pick<
    Cliente,
    | 'id'
    | 'nome_cognome'
    | 'email'
    | 'codice_fiscale'
    | 'partita_iva'
    | 'codice_sdi'
    | 'indirizzo_residenza'
    | 'cap_residenza'
    | 'citta_residenza'
    | 'provincia_residenza'
    | 'indirizzo_spedizione'
    | 'cap_spedizione'
    | 'citta_spedizione'
    | 'provincia_spedizione'
  > | null;
}

const IVA = 0.22;

export async function getFatture(): Promise<FatturaConCliente[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .select('*, cliente:clienti(id, nome_cognome, email, codice_fiscale, partita_iva, codice_sdi, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_spedizione, cap_spedizione, citta_spedizione, provincia_spedizione)')
    .eq('user_id', user.id)
    .order('data_incasso', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('❌ Errore nel recupero fatture:', error);
    throw error;
  }

  return data || [];
}

export async function cercaFatture(query: string): Promise<FatturaConCliente[]> {
  const q = query.trim();
  if (!q) return getFatture();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data: clientiMatch, error: errClienti } = await supabase
    .from('clienti')
    .select('id')
    .eq('user_id', user.id)
    .ilike('nome_cognome', `%${q}%`);

  if (errClienti) {
    console.error('❌ Errore nella ricerca clienti:', errClienti);
    throw errClienti;
  }

  const clienteIds = (clientiMatch || []).map((c) => c.id);

  const promesse: any[] = [
    supabase
      .from('fatture')
      .select('*, cliente:clienti(id, nome_cognome, email, codice_fiscale, partita_iva, codice_sdi, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_spedizione, cap_spedizione, citta_spedizione, provincia_spedizione)')
      .eq('user_id', user.id)
      .ilike('numero_fattura', `%${q}%`),
  ];

  if (clienteIds.length > 0) {
    promesse.push(
      supabase
        .from('fatture')
        .select('*, cliente:clienti(id, nome_cognome, email, codice_fiscale, partita_iva, codice_sdi, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_spedizione, cap_spedizione, citta_spedizione, provincia_spedizione)')
        .eq('user_id', user.id)
        .in('cliente_id', clienteIds)
    );
  }

  const risultati = await Promise.all(promesse);
  const mappa = new Map<number, FatturaConCliente>();

  for (const r of risultati) {
    if (r.error) {
      console.error('❌ Errore nella ricerca fatture:', r.error);
      throw r.error;
    }
    for (const f of r.data || []) {
      mappa.set(f.id, f);
    }
  }

  return Array.from(mappa.values()).sort((a, b) => {
    const da = a.data_incasso ? new Date(a.data_incasso).getTime() : -Infinity;
    const db = b.data_incasso ? new Date(b.data_incasso).getTime() : -Infinity;
    return db - da;
  });
}

export async function getFattura(id: number): Promise<FatturaConCliente | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .select('*, cliente:clienti(id, nome_cognome, email, codice_fiscale, partita_iva, codice_sdi, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_spedizione, cap_spedizione, citta_spedizione, provincia_spedizione)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('❌ Errore nel recupero fattura:', error);
    return null;
  }

  return data;
}

export async function getFattureCliente(clienteId: number): Promise<Fattura[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .select('*')
    .eq('user_id', user.id)
    .eq('cliente_id', clienteId)
    .order('data_incasso', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('❌ Errore nel recupero fatture cliente:', error);
    throw error;
  }

  return data || [];
}

export async function getProssimoNumeroFattura(): Promise<{
  numero_progressivo: number;
  numero_fattura: string;
  anno: number;
}> {
  const annoCorrente = new Date().getFullYear();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .select('numero_progressivo')
    .eq('user_id', user.id)
    .eq('anno', annoCorrente)
    .order('numero_progressivo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Errore nel calcolo prossimo numero:', error);
  }

  const ultimoNumero = data?.numero_progressivo || 0;
  const prossimoNumero = ultimoNumero + 1;
  const numeroFormattato = `${String(prossimoNumero).padStart(5, '0')}/R`;

  return {
    numero_progressivo: prossimoNumero,
    numero_fattura: numeroFormattato,
    anno: annoCorrente,
  };
}

export async function creaFattura(fattura: NuovaFattura): Promise<Fattura> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .insert({ ...fattura, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione fattura:', error);
    throw error;
  }

  return data;
}

export async function aggiornaFattura(
  id: number,
  fattura: Partial<NuovaFattura>
): Promise<Fattura> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .update(fattura)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nell\'aggiornamento fattura:', error);
    throw error;
  }

  return data;
}

/**
 * Elimina una fattura:
 * 1) Scollega i percorsi associati (così tornano fatturabili)
 * 2) Elimina sessioni firma collegate
 * 3) Elimina la fattura dal database
 */
export async function eliminaFattura(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  // 1. Scollega i percorsi associati
  const { error: errPercorsi } = await supabase
    .from('percorsi')
    .update({ fattura_id: null })
    .eq('user_id', user.id)
    .eq('fattura_id', id);

  if (errPercorsi) {
    console.warn('Avviso scollegamento percorsi:', errPercorsi);
  }

  // 2. Elimina eventuali sessioni firma
  const { error: errSessioni } = await supabase
    .from('sessioni_firma_fattura')
    .delete()
    .eq('user_id', user.id)
    .eq('fattura_id', id);

  if (errSessioni) {
    console.warn('Avviso eliminazione sessioni firma:', errSessioni);
  }

  // 3. Elimina la fattura
  const { error } = await supabase
    .from('fatture')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('❌ Errore nell\'eliminazione fattura:', error);
    throw new Error(error.message || error.details || 'Impossibile eliminare la fattura');
  }
}

export function calcolaIvaDa(importoLordo: number): {
  lordo: number;
  netto: number;
  iva: number;
} {
  const lordo = Number(importoLordo.toFixed(2));
  const netto = Number((lordo / (1 + IVA)).toFixed(2));
  const iva = Number((lordo - netto).toFixed(2));
  return { lordo, netto, iva };
}

export function formatEuro(importo: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(importo);
}

export function formatData(data: string | null): string {
  if (!data) return '—';
  try {
    const d = new Date(data);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function isPagata(fattura: Fattura): boolean {
  return !!fattura.data_incasso;
}

export async function registraIncasso(
  id: number,
  dataISO: string,
  metodoPagamento: string
): Promise<Fattura> {
  return aggiornaFattura(id, {
    data_incasso: dataISO,
    metodo_pagamento: metodoPagamento,
  });
}

export async function annullaIncasso(id: number): Promise<Fattura> {
  return aggiornaFattura(id, {
    data_incasso: null,
    metodo_pagamento: null,
  });
}

export interface SessioneFirmaFattura {
  id: string;
  fattura_id: number;
  token: string;
  completata: boolean;
  created_at: string;
  expires_at: string;
}

function generaToken(): string {
  const caratteri = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
  }
  return token;
}

export async function salvaFirmaFattura(
  id: number,
  firmaBase64: string
): Promise<FatturaConCliente> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .update({
      firmato: true,
      firma_immagine: firmaBase64,
      data_firma: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(
      '*, cliente:clienti(id, nome_cognome, email, codice_fiscale, partita_iva, codice_sdi, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_spedizione, cap_spedizione, citta_spedizione, provincia_spedizione)'
    )
    .single();

  if (error) {
    console.error('❌ Errore nel salvataggio firma fattura:', error);
    throw error;
  }

  return data;
}

export async function rimuoviFirmaFattura(id: number): Promise<Fattura> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('fatture')
    .update({
      firmato: false,
      firma_immagine: null,
      data_firma: null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella rimozione firma fattura:', error);
    throw error;
  }

  return data;
}

export async function creaSessioneFirmaFattura(
  fatturaId: number
): Promise<SessioneFirmaFattura> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const token = generaToken();

  const { data, error } = await supabase
    .from('sessioni_firma_fattura')
    .insert({ fattura_id: fatturaId, token, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione sessione firma fattura:', error);
    throw error;
  }

  return data;
}

export async function getSessioneFirmaFattura(
  token: string
): Promise<SessioneFirmaFattura | null> {
  const { data, error } = await supabase
    .from('sessioni_firma_fattura')
    .select('*')
    .eq('token', token)
    .single();

  if (error) {
    console.error('❌ Sessione firma fattura non trovata:', error);
    return null;
  }

  return data;
}

export async function completaSessioneFirmaFattura(token: string): Promise<void> {
  const { error } = await supabase
    .from('sessioni_firma_fattura')
    .update({ completata: true })
    .eq('token', token);

  if (error) {
    console.error('❌ Errore nel completamento sessione firma fattura:', error);
  }
}
