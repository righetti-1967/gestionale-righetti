/**
 * Automazioni — Post-seduta, Compleanno, Riattivazione Cliente
 *
 * Ogni automazione ha:
 * - attivo (bool)
 * - modalita: 'automatico' | 'manuale'
 * - parametri specifici (giorni, ora, canale...)
 */
import { supabase } from './supabase';

// ============================================================
// TIPI
// ============================================================

export type TipoAutomazione = 'post_seduta' | 'compleanno' | 'riattivazione';

export type ModalitaAutomazione = 'automatico' | 'manuale';

export type CanaleAutomazione = 'whatsapp' | 'email' | 'entrambi';

export interface ParametriPostSeduta {
  quantita: number;                     // es. 1, 10, 30, 2...
  unita: 'minuti' | 'ore' | 'giorni';   // es. 'ore' = "2 ore dopo"
  canale: CanaleAutomazione;
}

export interface ParametriCompleanno {
  ora_invio: string;     // es. '09:00'
  canale: CanaleAutomazione;
}

export interface ParametriRiattivazione {
  giorni_inattivita: number; // es. 90 giorni senza appuntamenti
  canale: CanaleAutomazione;
}

export type ParametriAutomazione =
  | ParametriPostSeduta
  | ParametriCompleanno
  | ParametriRiattivazione;

export interface Automazione {
  id?: number;
  user_id?: string;
  tipo: TipoAutomazione;
  attivo: boolean;
  modalita: ModalitaAutomazione;
  parametri: ParametriAutomazione;
  updated_at?: string;
}

// ============================================================
// DEFAULT
// ============================================================

export const DEFAULT_AUTOMAZIONI: Record<TipoAutomazione, Automazione> = {
  post_seduta: {
    tipo: 'post_seduta',
    attivo: false,
    modalita: 'manuale',
    parametri: {
      quantita: 2,
      unita: 'ore',
      canale: 'whatsapp',
    } as ParametriPostSeduta,
  },
  compleanno: {
    tipo: 'compleanno',
    attivo: false,
    modalita: 'manuale',
    parametri: {
      ora_invio: '09:00',
      canale: 'whatsapp',
    } as ParametriCompleanno,
  },
  riattivazione: {
    tipo: 'riattivazione',
    attivo: false,
    modalita: 'manuale',
    parametri: {
      giorni_inattivita: 90,
      canale: 'whatsapp',
    } as ParametriRiattivazione,
  },
};

// ============================================================
// LABEL
// ============================================================

export const LABEL_AUTOMAZIONE: Record<TipoAutomazione, {
  label: string;
  descrizione: string;
  icona: string;
}> = {
  post_seduta: {
    label: 'Post-Seduta',
    descrizione: 'Messaggio dopo la seduta per chiedere come sta il cliente',
    icona: '📸',
  },
  compleanno: {
    label: 'Auguri Compleanno',
    descrizione: 'Auguri automatici nel giorno del compleanno del cliente',
    icona: '🎂',
  },
  riattivazione: {
    label: 'Riattivazione Cliente',
    descrizione: 'Messaggio ai clienti che non vengono da N giorni',
    icona: '💤',
  },
};

// ============================================================
// CRUD
// ============================================================

export async function getAutomazioni(): Promise<Record<TipoAutomazione, Automazione>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_AUTOMAZIONI;

  const { data, error } = await supabase
    .from('automazioni')
    .select('*')
    .eq('user_id', user.id);

  const risultato = { ...DEFAULT_AUTOMAZIONI };
  if (!error && data) {
    for (const row of data) {
      if (row.tipo in DEFAULT_AUTOMAZIONI) {
        risultato[row.tipo as TipoAutomazione] = row as Automazione;
      }
    }
  }
  return risultato;
}

export async function getAutomazione(tipo: TipoAutomazione): Promise<Automazione> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_AUTOMAZIONI[tipo];

  const { data, error } = await supabase
    .from('automazioni')
    .select('*')
    .eq('user_id', user.id)
    .eq('tipo', tipo)
    .maybeSingle();

  if (error || !data) return DEFAULT_AUTOMAZIONI[tipo];
  return data as Automazione;
}

export async function salvaAutomazione(
  tipo: TipoAutomazione,
  attivo: boolean,
  modalita: ModalitaAutomazione,
  parametri: ParametriAutomazione
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('automazioni')
    .upsert(
      {
        user_id: user.id,
        tipo,
        attivo,
        modalita,
        parametri,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,tipo' }
    );

  if (error) throw error;
}

export async function eliminaAutomazione(tipo: TipoAutomazione): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('automazioni')
    .delete()
    .eq('user_id', user.id)
    .eq('tipo', tipo);

  if (error) throw error;
}
