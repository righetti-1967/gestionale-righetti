import { supabase } from './supabase';

export type ChiavePushAppuntamento =
  | 'appuntamento_nuovo'
  | 'appuntamento_confermato'
  | 'appuntamento_cancellato'
  | 'appuntamento_spostato'
  | 'appuntamento_pending';

export interface NotificaPushConfig {
  chiave: ChiavePushAppuntamento;
  enabled: boolean;
}

export interface ConfigCompleta {
  notifiche: Record<ChiavePushAppuntamento, boolean>;
  dry_run_globale: boolean;
}

export const LABEL_PUSH: Record<ChiavePushAppuntamento, { label: string; descrizione: string; icona: string }> = {
  appuntamento_nuovo: {
    label: 'Nuovo appuntamento',
    descrizione: 'Quando viene creato un appuntamento',
    icona: '📅',
  },
  appuntamento_confermato: {
    label: 'Appuntamento confermato',
    descrizione: 'Quando lo stato passa a "confermato"',
    icona: '✅',
  },
  appuntamento_cancellato: {
    label: 'Appuntamento cancellato',
    descrizione: 'Quando lo stato passa a "cancellato" (non per spostamenti)',
    icona: '❌',
  },
  appuntamento_spostato: {
    label: 'Appuntamento spostato',
    descrizione: 'Quando cambia data o ora (o viene spostato ad altro giorno)',
    icona: '🔄',
  },
  appuntamento_pending: {
    label: 'Appuntamento in attesa',
    descrizione: 'Quando lo stato passa a "pending"',
    icona: '⏸️',
  },
};

// Default consigliati (se non c'è riga in DB)
const DEFAULT_ENABLED: Record<ChiavePushAppuntamento, boolean> = {
  appuntamento_nuovo: false,
  appuntamento_confermato: true,
  appuntamento_cancellato: true,
  appuntamento_spostato: true,
  appuntamento_pending: false,
};

const CHIAVI: ChiavePushAppuntamento[] = [
  'appuntamento_nuovo',
  'appuntamento_confermato',
  'appuntamento_cancellato',
  'appuntamento_spostato',
  'appuntamento_pending',
];

export async function getNotifichePushConfig(): Promise<ConfigCompleta> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      notifiche: { ...DEFAULT_ENABLED },
      dry_run_globale: true,
    };
  }

  const { data, error } = await supabase
    .from('push_automazioni_config')
    .select('chiave, valore, dry_run')
    .eq('user_id', user.id)
    .in('chiave', [...CHIAVI, '_global']);

  if (error) {
    console.error('Errore caricamento config push:', error);
    return { notifiche: { ...DEFAULT_ENABLED }, dry_run_globale: true };
  }

  const notifiche = { ...DEFAULT_ENABLED };
  let dry_run_globale = true;

  for (const row of data ?? []) {
    if (row.chiave === '_global') {
      dry_run_globale = row.dry_run ?? true;
    } else if (CHIAVI.includes(row.chiave as ChiavePushAppuntamento)) {
      const enabled = (row.valore as any)?.enabled;
      if (typeof enabled === 'boolean') {
        notifiche[row.chiave as ChiavePushAppuntamento] = enabled;
      }
    }
  }

  return { notifiche, dry_run_globale };
}

export async function setNotificaPushToggle(
  chiave: ChiavePushAppuntamento,
  enabled: boolean
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('push_automazioni_config')
    .upsert(
      {
        user_id: user.id,
        chiave,
        valore: { enabled },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );

  if (error) throw error;
}

export async function setDryRunGlobale(enabled: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  // Verifica se la riga _global esiste già
  const { data: existing } = await supabase
    .from('push_automazioni_config')
    .select('id')
    .eq('user_id', user.id)
    .eq('chiave', '_global')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('push_automazioni_config')
      .update({ dry_run: enabled, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('push_automazioni_config')
      .insert({
        user_id: user.id,
        chiave: '_global',
        valore: { enabled: true },
        dry_run: enabled,
      });
    if (error) throw error;
  }
}
