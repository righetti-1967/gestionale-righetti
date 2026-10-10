/**
 * Configurazione Fiscale — provider di fatturazione/scontrini
 *
 * - Regime: 'fatture' | 'scontrini_digitale' | 'scontrini_fisico'
 * - Provider per regime:
 *   - fatture: 'ade_diretto' | 'fpt'
 *   - scontrini_digitale: 'ade_diretto' | 'fpt'
 *   - scontrini_fisico: 'rch' | 'epson'
 */
import { supabase } from './supabase';

// ============================================================
// TIPI
// ============================================================

export type RegimeFiscale = 'fatture' | 'scontrini_digitale' | 'scontrini_fisico';

export type ProviderFiscale =
  | 'ade_diretto'   // SDI (fatture) o ADE Corrispettivi (scontrini) — invio manuale
  | 'fpt'           // Fatture Per Tutti (via API)
  | 'rch'           // Registratore RCH (scontrini fisici)
  | 'epson';

// ============================================================
// MODALITÀ INTEGRAZIONE (simulazione vs reale)
// ============================================================

/**
 * Modalità di comunicazione con il provider esterno:
 * - 'simulazione' → nessun invio reale, tutto a video/log
 * - 'reale'       → invio effettivo al provider (richiede driver collegato)
 *
 * Default: 'simulazione' (per sicurezza)
 */
export type ModalitaIntegrazione = 'simulazione' | 'reale';
        // Epson 80mm (scontrini fisici)

export interface ConfigFiscaleDB {
  id: number;
  user_id: string;
  regime: RegimeFiscale;
  provider: ProviderFiscale;
  config: Record<string, any>;
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// CONFIG SPECIFICHE PER PROVIDER
// ============================================================

/** Fatture Per Tutti — API REST */
export interface ConfigFPT {
  ragione_sociale?: string;
  partita_iva?: string;
  api_key?: string;
  password?: string;
  ambiente?: 'test' | 'produzione';
}

/** ADE Diretto — SDI fatture */
export interface ConfigAdeDiretto {
  codice_sdi?: string;       // es. '0000000' o 'M5UXCR1'
  pec?: string;              // in alternativa a codice_sdi
  regime_fiscale?: 'ordinario' | 'forfettario';
}

/** Registratore RCH */
export interface ConfigRCH {
  modello?: string;          // es. 'RCH 500', 'RCH 100'
  ip?: string;               // es. '192.168.1.50'
  porta?: number;            // default 9100
  matricola_rt?: string;     // matricola registratore telematico
  seriale?: string;
  modalita?: ModalitaIntegrazione;   // NEW — default 'simulazione'
  ultima_attivazione_reale?: string; // NEW — ISO date
}

/** Stampante Epson */
export interface ConfigEpson {
  modello?: string;          // es. 'TM-T88VI', 'TM-m30'
  ip?: string;               // es. '192.168.1.60'
  porta?: number;            // default 9100
  matricola_rt?: string;
  seriale?: string;
  modalita?: ModalitaIntegrazione;   // NEW — default 'simulazione'
  ultima_attivazione_reale?: string; // NEW — ISO date
}

// ============================================================
// CONFIG VUOTA
// ============================================================

export function configVuota(provider: ProviderFiscale): Record<string, any> {
  switch (provider) {
    case 'fpt':
      return {
        ragione_sociale: '',
        partita_iva: '',
        api_key: '',
        password: '',
        ambiente: 'test',
      } as ConfigFPT;
    case 'ade_diretto':
      return {
        codice_sdi: '',
        pec: '',
        regime_fiscale: 'ordinario',
      } as ConfigAdeDiretto;
    case 'rch':
      return {
        modello: '',
        ip: '',
        porta: 9100,
        matricola_rt: '',
        seriale: '',
        modalita: 'simulazione',
      } as ConfigRCH;
    case 'epson':
      return {
        modello: '',
        ip: '',
        porta: 9100,
        matricola_rt: '',
        seriale: '',
        modalita: 'simulazione',
      } as ConfigEpson;
    default:
      return {};
  }
}

// ============================================================
// CRUD
// ============================================================

export async function getConfigFiscale(
  regime: RegimeFiscale
): Promise<ConfigFiscaleDB | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('config_fiscale')
    .select('*')
    .eq('user_id', user.id)
    .eq('regime', regime)
    .maybeSingle();

  if (error) {
    console.warn('Errore lettura config fiscale:', error);
    return null;
  }
  return data;
}

export async function getTutteConfigFiscali(): Promise<ConfigFiscaleDB[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('config_fiscale')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.warn('Errore lettura config fiscali:', error);
    return [];
  }
  return data || [];
}

export async function salvaConfigFiscale(params: {
  regime: RegimeFiscale;
  provider: ProviderFiscale;
  config: Record<string, any>;
  attivo?: boolean;
}): Promise<ConfigFiscaleDB> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('config_fiscale')
    .upsert(
      {
        user_id: user.id,
        regime: params.regime,
        provider: params.provider,
        config: params.config,
        attivo: params.attivo ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,regime' }
    )
    .select()
    .single();

  if (error) {
    console.error('❌ Errore salvataggio config fiscale:', error);
    throw error;
  }
  return data;
}

export async function eliminaConfigFiscale(regime: RegimeFiscale): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('config_fiscale')
    .delete()
    .eq('user_id', user.id)
    .eq('regime', regime);

  if (error) {
    console.error('❌ Errore eliminazione config fiscale:', error);
    throw error;
  }
}

// ============================================================
// VERIFICA PROVIDER (per ora mock)
// ============================================================

export interface VerificaProviderResult {
  ok: boolean;
  messaggio: string;
}

/**
 * Verifica la configurazione di un provider fiscale.
 * Attualmente è un MOCK che ritorna sempre ok.
 * In futuro chiamerà il backend FastAPI che a sua volta
 * verifica l'autenticazione (es. FPT /auth/verify).
 */
export async function verificaConfigProvider(params: {
  provider: ProviderFiscale;
  config: Record<string, any>;
}): Promise<VerificaProviderResult> {
  const { provider, config } = params;

  // Validazione base dei campi obbligatori
  if (provider === 'fpt') {
    const c = config as ConfigFPT;
    if (!c.ragione_sociale || !c.partita_iva || !c.api_key || !c.password) {
      return {
        ok: false,
        messaggio: 'Compila tutti i campi obbligatori (ragione sociale, P.IVA, API key, password)',
      };
    }
    // MOCK: simula verifica riuscita
    return {
      ok: true,
      messaggio: '✅ Verifica FPT completata (mock — nessuna chiamata reale)',
    };
  }

  if (provider === 'ade_diretto') {
    const c = config as ConfigAdeDiretto;
    if (!c.codice_sdi && !c.pec) {
      return {
        ok: false,
        messaggio: 'Inserisci almeno Codice SDI o PEC',
      };
    }
    return {
      ok: true,
      messaggio: '✅ Codice SDI/PEC valido (mock — nessuna chiamata reale)',
    };
  }

  if (provider === 'rch' || provider === 'epson') {
    const c = config as ConfigRCH;
    if (!c.ip) {
      return { ok: false, messaggio: 'Inserisci IP stampante' };
    }
    // Valida formato IP
    const ipValido = /^(\d{1,3}\.){3}\d{1,3}$/.test(c.ip);
    if (!ipValido) {
      return { ok: false, messaggio: 'Formato IP non valido' };
    }
    const reale = c.modalita === 'reale';
    return {
      ok: true,
      messaggio: reale
        ? '✅ IP valido — modalità REALE attiva (driver RT non ancora collegato)'
        : '✅ IP valido — modalità SIMULAZIONE (nessun invio reale)',
    };
  }

  return { ok: false, messaggio: 'Provider non riconosciuto' };
}

// ============================================================
// HELPER: Etichette
// ============================================================

// ============================================================
// HELPER: Modalità
// ============================================================

/**
 * Ritorna true se il provider è configurato per l'invio reale.
 * Default: false (simulazione) — fail-safe.
 */
export function isModalitaReale(
  config: Record<string, any> | null | undefined
): boolean {
  if (!config) return false;
  return config.modalita === 'reale';
}

/**
 * Etichetta human-readable della modalità.
 */
export function labelModalita(m: ModalitaIntegrazione | undefined): string {
  return m === 'reale' ? '🔴 Reale' : '🧪 Simulazione';
}

export function labelRegime(regime: RegimeFiscale): string {
  switch (regime) {
    case 'fatture':
      return 'Fatturazione Elettronica';
    case 'scontrini_digitale':
      return 'Scontrini Digitali (Corrispettivi)';
    case 'scontrini_fisico':
      return 'Registratore Telematico (RT)';
  }
}

export function labelProvider(provider: ProviderFiscale): string {
  switch (provider) {
    case 'ade_diretto':
      return 'ADE Diretto (SDI)';
    case 'fpt':
      return 'Fatture Per Tutti (FPT)';
    case 'rch':
      return 'RCH Registratore';
    case 'epson':
      return 'Epson 80mm';
  }
}
