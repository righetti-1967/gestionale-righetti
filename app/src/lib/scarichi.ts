import { supabase } from './supabase';

function generaToken(): string {
  const caratteri = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += caratteri.charAt(Math.floor(Math.random() * caratteri.length));
  }
  return token;
}

export interface RigaScarico {
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  prodotto_percorso_id?: number | null; // Collega allo shampoo/prodotto generico del percorso
  nome: string;
  quantita: number;
  prezzo_listino_lordo: number;
  prezzo_scontato_lordo: number;
  netto_iva_scontato: number;
}

export interface ScaricoSeduta {
  id: number;
  numero_ddt: number;
  fattura_madre_id: number;
  cliente_id: number;
  data_seduta: string;
  righe: RigaScarico[];
  totale_lordo_scontato: number;
  totale_netto_iva: number;
  firmato: boolean;
  firma_immagine: string | null;
  data_firma: string | null;
  note: string | null;
  report_commercialista_inviato_at?: string | null;
  report_commercialista_email_at?: string | null;
  ddt_inviato_email_at?: string | null;
  ddt_inviato_whatsapp_at?: string | null;
  created_at: string;
}

export type NuovoScarico = Omit<
  ScaricoSeduta,
  'id' | 'created_at' | 'numero_ddt' | 'firma_immagine' | 'data_firma' | 'firmato'
>;

export async function getScarichiFattura(
  fatturaId: number
): Promise<ScaricoSeduta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .select('*')
    .eq('user_id', user.id)
    .eq('fattura_madre_id', fatturaId)
    .order('data_seduta', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero scarichi:', error);
    throw error;
  }

  return data || [];
}

export async function getScarichiCliente(
  clienteId: number
): Promise<ScaricoSeduta[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .select('*')
    .eq('user_id', user.id)
    .eq('cliente_id', clienteId)
    .order('data_seduta', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero scarichi cliente:', error);
    throw error;
  }

  return data || [];
}

export async function getProssimoNumeroDDT(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .select('numero_ddt')
    .eq('user_id', user.id)
    .order('numero_ddt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 1;
  return (data.numero_ddt || 0) + 1;
}

export async function creaScarico(
  scarico: NuovoScarico
): Promise<ScaricoSeduta> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const prossimoNumero = await getProssimoNumeroDDT();

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .insert({
      ...scarico,
      numero_ddt: prossimoNumero,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione scarico:', error);
    throw error;
  }

  return data;
}

export async function salvaFirmaScarico(
  id: number,
  firmaBase64: string
): Promise<ScaricoSeduta> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .update({
      firmato: true,
      firma_immagine: firmaBase64,
      data_firma: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nel salvataggio firma scarico:', error);
    throw error;
  }

  return data;
}

export async function eliminaScarico(id: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('scarichi_seduta')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('❌ Errore nell\'eliminazione scarico:', error);
    throw error;
  }
}

export interface SessioneFirmaDdt {
  id: string;
  scarico_id: number;
  token: string;
  completata: boolean;
  created_at: string;
  expires_at: string;
}

export async function getScarico(id: number): Promise<ScaricoSeduta | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('❌ Errore nel recupero scarico:', error);
    return null;
  }

  return data;
}

export async function creaSessioneFirmaDdt(
  scaricoId: number
): Promise<SessioneFirmaDdt> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const token = generaToken();

  const { data, error } = await supabase
    .from('sessioni_firma_ddt')
    .insert({ scarico_id: scaricoId, token, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione sessione firma DDT:', error);
    throw error;
  }

  return data;
}

export async function getSessioneFirmaDdt(
  token: string
): Promise<SessioneFirmaDdt | null> {
  const { data, error } = await supabase
    .from('sessioni_firma_ddt')
    .select('*')
    .eq('token', token)
    .single();

  if (error) {
    console.error('❌ Sessione firma DDT non trovata:', error);
    return null;
  }

  return data;
}

export async function completaSessioneFirmaDdt(token: string): Promise<void> {
  const { error } = await supabase
    .from('sessioni_firma_ddt')
    .update({ completata: true })
    .eq('token', token);

  if (error) {
    console.error('❌ Errore nel completamento sessione firma DDT:', error);
  }
}

export async function isSessioneDdtCompletata(token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessioni_firma_ddt')
    .select('completata')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.warn('⚠️ isSessioneDdtCompletata errore:', error);
    return false;
  }
  return !!data?.completata;
}

export async function rimuoviFirmaScarico(id: number): Promise<ScaricoSeduta> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
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
    console.error('❌ Errore nella rimozione firma scarico:', error);
    throw error;
  }

  return data;
}

export interface ScaricoConCliente extends ScaricoSeduta {
  cliente: {
    id: number;
    nome_cognome: string;
    codice_fiscale: string | null;
    partita_iva: string | null;
    indirizzo_residenza: string | null;
    cap_residenza: string | null;
    citta_residenza: string | null;
    provincia_residenza: string | null;
  } | null;
}

export async function getTuttiScarichi(): Promise<ScaricoConCliente[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scarichi_seduta')
    .select(
      '*, cliente:clienti(id, nome_cognome, codice_fiscale, partita_iva, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza)'
    )
    .eq('user_id', user.id)
    .order('data_seduta', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero scarichi:', error);
    throw error;
  }

  return data || [];
}

export function filtraScarichiPerMese(
  scarichi: ScaricoSeduta[],
  mese: string
): ScaricoSeduta[] {
  return scarichi.filter((s) => {
    const d = new Date(s.data_seduta);
    const annoMese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return annoMese === mese;
  });
}

export async function segnaReportCommercialistaInviato(
  ids: number[]
): Promise<void> {
  if (ids.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('scarichi_seduta')
    .update({ report_commercialista_inviato_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('id', ids);

  if (error) {
    console.error('❌ Errore aggiornamento report inviato:', error);
    throw error;
  }
}
