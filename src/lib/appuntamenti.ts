import { supabase } from './supabase';
import type { Cliente } from './clienti';
import { AGENDA_DEFAULT, type ConfigAgenda } from './agenda-config';

export type Operatore = string;
export type StatoAppuntamento = 'pending' | 'prenotato' | 'confermato' | 'completato' | 'cancellato';
export type MotivoCancellazione = 'rebooking' | 'disdetta' | 'definitiva';
export type TipoAppuntamento = 'percorso' | 'checkup_nuovo' | 'seduta' | 'generico' | 'blocco';

export interface VoceSelezionata {
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  nome?: string;
  quantita: number;
  durata_minuti?: number;
  ora_inizio?: string;
  operatore?: Operatore;
}

export interface Appuntamento {
  id: number;
  cliente_id: number | null;
  percorso_id: number | null;
  operatore: Operatore;
  data: string;
  ora_inizio: string;
  durata_minuti: number;
  titolo: string;
  tipo: TipoAppuntamento;
  colore: string | null;
  note: string | null;
  stato: StatoAppuntamento;
  motivo_cancellazione?: MotivoCancellazione | null;
  servizio_id: number | null;
  voci_selezionate: VoceSelezionata[] | null;
  scarico_id?: number | null;
  fattura_proforma_id?: number | null;
  reminder_email_at: string | null;
  reminder_email_inviato: boolean;
  reminder_whatsapp_at: string | null;
  reminder_whatsapp_inviato: boolean;
  completato_at: string | null;
  rebooking_fissato?: boolean;
  rebooking_da_id?: number | null;
  is_blocco?: boolean;
  created_at: string;
}

export interface AppuntamentoConCliente extends Appuntamento {
  cliente?: Pick<Cliente, 'id' | 'nome_cognome' | 'cellulare' | 'email'> | null;
}

export type NuovoAppuntamento = Omit<
  Appuntamento,
  | 'id'
  | 'created_at'
  | 'completato_at'
  | 'reminder_email_at'
  | 'reminder_email_inviato'
  | 'reminder_whatsapp_at'
  | 'reminder_whatsapp_inviato'
>;

// ============================================================
// COSTANTI GLOBALI
// ============================================================

export let ORA_INIZIO_LAVORO = '08:30';
export let ORA_FINE_LAVORO = '19:00';
export let SLOT_MINUTI = 15;

// ============================================================
// CONFIGURAZIONE AGENDA (variabile globale mutabile)
// ============================================================

let _configAgenda: ConfigAgenda = AGENDA_DEFAULT;

export let OPERATORI: Record<
  string,
  { label: string; ruolo: string; colore: string }
> = {
  luca: { label: 'Luca Righetti', ruolo: 'Consulente Tricologo', colore: 'blue' },
  lorenzo: { label: 'Lorenzo Righetti', ruolo: 'Tecnico Tricologo', colore: 'green' },
};

export function setConfigAgenda(config: ConfigAgenda): void {
  _configAgenda = config;
  aggiornaCostantiAgenda(config);
}

export function aggiornaCostantiAgenda(config: ConfigAgenda): void {
  _configAgenda = config;
  ORA_INIZIO_LAVORO = config.oraApertura || '08:30';
  ORA_FINE_LAVORO = config.oraChiusura || '19:00';
  SLOT_MINUTI = config.granularitaMinuti || 15;

  if (config.operatori && config.operatori.length > 0) {
    const nuovaMappa: Record<string, { label: string; ruolo: string; colore: string }> = {};
    for (const op of config.operatori) {
      nuovaMappa[op.id] = {
        label: op.label,
        ruolo: op.ruolo,
        colore: op.colore,
      };
    }
    OPERATORI = nuovaMappa;
  }
}

export function getConfigAgenda(): ConfigAgenda {
  return _configAgenda;
}

// ============================================================
// CONFIGURAZIONE UI
// ============================================================

export const COLORI_APPUNTAMENTO: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-l-4 border-blue-500', label: 'Blu' },
  green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-l-4 border-green-500', label: 'Verde' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-l-4 border-orange-500', label: 'Arancione' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-l-4 border-purple-500', label: 'Viola' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-l-4 border-pink-500', label: 'Rosa' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-l-4 border-yellow-500', label: 'Giallo' },
  red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-l-4 border-red-500', label: 'Rosso' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-l-4 border-gray-400', label: 'Grigio' },
};

export function coloreDefault(tipo: TipoAppuntamento): string {
  const coloriTipi = _configAgenda.coloriTipi;
  switch (tipo) {
    case 'percorso': return coloriTipi.percorso || 'yellow';
    case 'checkup_nuovo': return coloriTipi.checkup_nuovo || 'blue';
    case 'seduta': return coloriTipi.seduta || 'green';
    case 'blocco': return 'gray';
    default: return coloriTipi.generico || 'gray';
  }
}

export function getColoreServizio(servizioId: number | null | undefined): string | null {
  if (!servizioId) return null;
  const catId = _configAgenda.servizioCategoria[String(servizioId)];
  if (!catId) return null;
  const cat = _configAgenda.categorie.find((c) => c.id === catId);
  return cat ? cat.colore : null;
}

// ============================================================
// CRUD APPUNTAMENTI
// ============================================================

export async function getAppuntamenti(dataInizio: string, dataFine: string): Promise<AppuntamentoConCliente[]> {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, cliente:clienti(id, nome_cognome, cellulare, email)')
    .gte('data', dataInizio)
    .lte('data', dataFine)
    .order('data', { ascending: true })
    .order('ora_inizio', { ascending: true });

  if (error) {
    console.error('❌ Errore nel recupero appuntamenti:', error);
    throw error;
  }
  return data || [];
}

export async function getAppuntamentiGiorno(data: string): Promise<AppuntamentoConCliente[]> {
  return getAppuntamenti(data, data);
}

export async function getAppuntamentiCliente(clienteId: number): Promise<Appuntamento[]> {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false })
    .order('ora_inizio', { ascending: false });

  if (error) {
    console.error('❌ Errore nel recupero appuntamenti cliente:', error);
    throw error;
  }
  return data || [];
}

export async function getAppuntamento(id: number): Promise<AppuntamentoConCliente | null> {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*, cliente:clienti(id, nome_cognome, cellulare, email)')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function creaAppuntamento(appuntamento: NuovoAppuntamento): Promise<Appuntamento> {
  const { data, error } = await supabase
    .from('appuntamenti')
    .insert(appuntamento)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nella creazione appuntamento:', error);
    throw error;
  }
  return data;
}

export async function creaBlocco(params: {
  operatore: Operatore;
  data: string;
  ora_inizio: string;
  durata_minuti: number;
  titolo: string;
  note?: string | null;
  colore?: string | null;
}): Promise<Appuntamento> {
  const nuovo: NuovoAppuntamento = {
    cliente_id: null,
    percorso_id: null,
    operatore: params.operatore,
    data: params.data,
    ora_inizio: params.ora_inizio,
    durata_minuti: params.durata_minuti,
    titolo: params.titolo,
    tipo: 'blocco',
    colore: params.colore ?? 'gray',
    note: params.note ?? null,
    stato: 'confermato',
    motivo_cancellazione: null,
    servizio_id: null,
    voci_selezionate: null,
    scarico_id: null,
    fattura_proforma_id: null,
    rebooking_fissato: false,
    rebooking_da_id: null,
    is_blocco: true,
  };
  return creaAppuntamento(nuovo);
}

export async function aggiornaAppuntamento(
  id: number,
  appuntamento: Partial<NuovoAppuntamento>
): Promise<Appuntamento> {
  const { data, error } = await supabase
    .from('appuntamenti')
    .update(appuntamento)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ Errore nell\'aggiornamento appuntamento:', error);
    throw error;
  }
  return data;
}

export async function cambiaStatoAppuntamento(id: number, stato: StatoAppuntamento): Promise<Appuntamento> {
  const extra: Partial<Appuntamento> = {};
  if (stato === 'completato') {
    extra.completato_at = new Date().toISOString();
  }
  return aggiornaAppuntamento(id, { stato, ...extra });
}

export async function eliminaAppuntamento(id: number): Promise<void> {
  const { error } = await supabase.from('appuntamenti').delete().eq('id', id);
  if (error) {
    console.error('❌ Errore nell\'eliminazione appuntamento:', error);
    throw error;
  }
}

// ============================================================
// HELPERS
// ============================================================

export function calcolaOraFine(oraInizio: string, durataMinuti: number): string {
  const [h, m] = oraInizio.split(':').map(Number);
  const totaleMinuti = h * 60 + m + durataMinuti;
  const hFine = Math.floor(totaleMinuti / 60) % 24;
  const mFine = totaleMinuti % 60;
  return `${String(hFine).padStart(2, '0')}:${String(mFine).padStart(2, '0')}`;
}

export function siSovrappongono(
  a: { ora_inizio: string; durata_minuti: number },
  b: { ora_inizio: string; durata_minuti: number }
): boolean {
  const inizioA = oraToMinuti(a.ora_inizio);
  const fineA = inizioA + a.durata_minuti;
  const inizioB = oraToMinuti(b.ora_inizio);
  const fineB = inizioB + b.durata_minuti;
  return inizioA < fineB && inizioB < fineA;
}

export function oraToMinuti(ora: string): number {
  const [h, m] = ora.split(':').map(Number);
  return h * 60 + m;
}

export function minutiToOra(minuti: number): string {
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isGiornoLavorativo(data: Date | string): boolean {
  const d = typeof data === 'string' ? new Date(data) : data;
  const giorno = d.getDay();
  return _configAgenda.giorniLavorativi.includes(giorno);
}

export function getProssimi3GiorniLavorativi(dataPartenza: Date = new Date()): Date[] {
  const giorni: Date[] = [];
  const giorniLavorativi = _configAgenda.giorniLavorativi?.length > 0
    ? _configAgenda.giorniLavorativi
    : [4, 5, 6];

  const d = new Date(dataPartenza);
  d.setHours(0, 0, 0, 0);

  const giorno = d.getDay();
  const offsetLunedi = giorno === 0 ? -6 : 1 - giorno;
  d.setDate(d.getDate() + offsetLunedi);

  for (let i = 0; i < 7; i++) {
    if (giorniLavorativi.includes(d.getDay())) {
      giorni.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  return giorni;
}

export function getOraInizioLavoro(): string {
  return _configAgenda.oraApertura || ORA_INIZIO_LAVORO;
}

export function getOraFineLavoro(): string {
  return _configAgenda.oraChiusura || ORA_FINE_LAVORO;
}

export function getSlotMinuti(): number {
  return _configAgenda.granularitaMinuti || SLOT_MINUTI;
}

export function getOperatoriVisibili(): Operatore[] {
  if (_configAgenda.operatoriVisibili && _configAgenda.operatoriVisibili.length > 0) {
    return _configAgenda.operatoriVisibili;
  }
  return _configAgenda.operatori?.map((o) => o.id) || ['luca', 'lorenzo'];
}

// ============================================================
// RPC
// ============================================================

export async function aggiornaAppuntamentiCompletati(): Promise<void> {
  const { error } = await supabase.rpc('aggiorna_appuntamenti_completati');
  if (error) {
    console.error('❌ Errore aggiornamento appuntamenti completati:', error);
  }
}

// ============================================================
// REBOOKING
// ============================================================

/**
 * Chiude tutti i rebooking aperti di un cliente (rebooking_fissato = true).
 * Chiamare quando il cliente fissa un nuovo appuntamento.
 * I record restano nello storico (stato: cancellato, motivo: rebooking).
 */
export async function chiudiRebookingCliente(clienteId: number): Promise<void> {
  const { error } = await supabase
    .from('appuntamenti')
    .update({ rebooking_fissato: true })
    .eq('cliente_id', clienteId)
    .eq('stato', 'cancellato')
    .eq('motivo_cancellazione', 'rebooking')
    .eq('rebooking_fissato', false);

  if (error) {
    console.error('❌ Errore chiusura rebooking:', error);
    throw error;
  }
}
