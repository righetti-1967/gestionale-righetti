import { supabase } from './supabase';

/**
 * Genera un token casuale di 32 caratteri alfanumerici.
 * Non usa crypto.randomUUID perché non è disponibile su HTTP in Safari iOS.
 */
function generaToken(): string {
  const caratteri = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
  }
  return token;
}

export interface Cliente {
  id: number;
  nome_cognome: string;
  cellulare: string | null;
  email: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  codice_sdi: string | null;
  note_anamnesi: string | null;
  indirizzo_residenza: string | null;
  cap_residenza: string | null;
  citta_residenza: string | null;
  provincia_residenza: string | null;
  indirizzo_spedizione: string | null;
  cap_spedizione: string | null;
  citta_spedizione: string | null;
  provincia_spedizione: string | null;
  privacy_firmata: boolean;
  privacy_firma_immagine: string | null;
  privacy_data_firma: string | null;
  privacy_inviata_email_at?: string | null;
  privacy_inviata_whatsapp_at?: string | null;
  data_nascita?: string | null;
  created_at: string;
}

export type NuovoCliente = Omit<
  Cliente,
  'id' | 'created_at' | 'privacy_firma_immagine' | 'privacy_data_firma'
>;

export interface SessioneFirma {
  id: string;
  cliente_id: number;
  token: string;
  completata: boolean;
  created_at: string;
  expires_at: string;
}

/**
 * Recupera tutti i clienti
 */
export async function getClienti(): Promise<Cliente[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('user_id', user.id)
    .order('nome_cognome', { ascending: true });

  if (error) {
    console.error('❌ Errore nel recupero clienti:', error);
    throw error;
  }

  return data || [];
}

/**
 * Recupera un singolo cliente per ID
 */
export async function getCliente(id: number): Promise<Cliente | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('❌ Errore nel recupero cliente:', error);
    return null;
  }

  return data;
}

/**
 * Cerca clienti per nome, email o cellulare
 */
export async function cercaClienti(query: string): Promise<Cliente[]> {
  if (!query.trim()) return getClienti();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('user_id', user.id)
    .or(`nome_cognome.ilike.%${query}%,email.ilike.%${query}%,cellulare.ilike.%${query}%`)
    .order('nome_cognome', { ascending: true });

  if (error) {
    console.error('❌ Errore nella ricerca:', error);
    throw error;
  }

  return data || [];
}

/**
 * Crea un nuovo cliente
 */
export async function creaCliente(cliente: NuovoCliente): Promise<Cliente> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .insert({ ...cliente, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione:', error);
    throw error;
  }

  return data;
}

/**
 * Aggiorna un cliente
 */
export async function aggiornaCliente(
  id: number,
  cliente: Partial<NuovoCliente>
): Promise<Cliente> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .update(cliente)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nell\'aggiornamento:', error);
    throw error;
  }

  return data;
}

/**
 * Elimina un cliente
 */
export async function eliminaCliente(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('clienti')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('❌ Errore nell\'eliminazione:', error);
    throw error;
  }
}

/**
 * Salva la firma privacy di un cliente
 */
export async function salvaFirmaPrivacy(
  id: number,
  firmaBase64: string
): Promise<Cliente> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .update({
      privacy_firmata: true,
      privacy_firma_immagine: firmaBase64,
      privacy_data_firma: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nel salvataggio firma:', error);
    throw error;
  }

  return data;
}

/**
 * Rimuove la firma privacy di un cliente
 */
export async function rimuoviFirmaPrivacy(id: number): Promise<Cliente> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('clienti')
    .update({
      privacy_firmata: false,
      privacy_firma_immagine: null,
      privacy_data_firma: null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella rimozione firma:', error);
    throw error;
  }

  return data;
}

/**
 * Crea una sessione di firma per un cliente.
 * Ritorna il token univoco che verrà usato nel QR code.
 */
export async function creaSessioneFirma(clienteId: number): Promise<SessioneFirma> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  // Genera token univoco (32 caratteri casuali)
  const token = generaToken();

  const { data, error } = await supabase
    .from('sessioni_firma')
    .insert({ cliente_id: clienteId, token, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione sessione:', error);
    throw error;
  }

  return data;
}

/**
 * Recupera una sessione di firma dal token
 */
export async function getSessioneFirma(token: string): Promise<SessioneFirma | null> {
  const { data, error } = await supabase
    .from('sessioni_firma')
    .select('*')
    .eq('token', token)
    .single();

  if (error) {
    console.error('❌ Sessione non trovata:', error);
    return null;
  }

  return data;
}

/**
 * Marca una sessione come completata
 */
export async function completaSessioneFirma(token: string): Promise<void> {
  const { error } = await supabase
    .from('sessioni_firma')
    .update({ completata: true })
    .eq('token', token);

  if (error) {
    console.error('❌ Errore nel completamento sessione:', error);
  }
}

/**
 * Verifica se una sessione è stata completata (per polling)
 */
export async function isSessioneCompletata(token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessioni_firma')
    .select('completata')
    .eq('token', token)
    .single();

  if (error || !data) return false;
  return data.completata;
}
