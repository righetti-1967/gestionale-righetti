/**
 * Gestione password gestionale (per operazioni critiche tipo annullo scontrini/fatture).
 *
 * La password è hashata con SHA-256 + salt fisso (per ambiente locale).
 * Il valore hash è salvato in `impostazioni` chiave `sicurezza`.
 *
 * Struttura JSON in `impostazioni.valore`:
 *   {
 *     "password_annullo_hash": "<hash_sha256>",
 *     "password_annullo_set": true
 *   }
 */
import { supabase } from './supabase';

// ============================================================
// HASH
// ============================================================

/**
 * Hash SHA-256 di una stringa (sincrona via Web Crypto non è banale,
 * usiamo un fallback semplice). Per uso interno, non crittografia militare.
 */
async function sha256(testo: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(testo);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Salt fisso (non segreto, serve solo a evitare rainbow table banali)
const SALT = 'gestionale-righetti-1967-annullo-v1';

export async function hashPassword(plain: string): Promise<string> {
  return sha256(SALT + ':' + plain);
}

// ============================================================
// CRUD
// ============================================================

interface SicurezzaConfig {
  password_annullo_hash: string | null;
  password_annullo_set: boolean;
}

async function leggiConfigSicurezza(): Promise<SicurezzaConfig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', user.id)
    .eq('chiave', 'sicurezza')
    .maybeSingle();

  if (error) {
    console.warn('Errore lettura sicurezza:', error);
  }

  const v = (data?.valore || {}) as Partial<SicurezzaConfig>;
  return {
    password_annullo_hash: v.password_annullo_hash ?? null,
    password_annullo_set: v.password_annullo_set ?? false,
  };
}

async function salvaConfigSicurezza(cfg: SicurezzaConfig): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'sicurezza',
        valore: cfg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );

  if (error) throw error;
}

// ============================================================
// API PUBBLICA
// ============================================================

/**
 * Verifica se la password gestionale è già stata impostata.
 */
export async function isPasswordImpostata(): Promise<boolean> {
  const cfg = await leggiConfigSicurezza();
  return cfg.password_annullo_set && !!cfg.password_annullo_hash;
}

/**
 * Imposta (o reimposta) la password gestionale.
 * Richiede la password attuale se già impostata (per conferma).
 */
export async function impostaPassword(
  nuovaPassword: string,
  vecchiaPassword?: string
): Promise<void> {
  if (!nuovaPassword || nuovaPassword.length < 4) {
    throw new Error('La password deve avere almeno 4 caratteri');
  }

  const cfg = await leggiConfigSicurezza();

  // Se già impostata, richiedi la vecchia per conferma
  if (cfg.password_annullo_set && cfg.password_annullo_hash) {
    if (!vecchiaPassword) {
      throw new Error('Devi inserire la password attuale per cambiarla');
    }
    const hashVecchia = await hashPassword(vecchiaPassword);
    if (hashVecchia !== cfg.password_annullo_hash) {
      throw new Error('Password attuale non corretta');
    }
  }

  const nuovoHash = await hashPassword(nuovaPassword);
  await salvaConfigSicurezza({
    password_annullo_hash: nuovoHash,
    password_annullo_set: true,
  });
}

/**
 * Verifica una password inserita.
 */
export async function verificaPassword(plain: string): Promise<boolean> {
  const cfg = await leggiConfigSicurezza();
  if (!cfg.password_annullo_set || !cfg.password_annullo_hash) {
    return false;
  }
  const hashInserito = await hashPassword(plain);
  return hashInserito === cfg.password_annullo_hash;
}

/**
 * Rimuove la password gestionale (per reset).
 * ⚠️ Usare con cautela: dopo questo, le operazioni critiche non chiederanno più la password.
 */
export async function rimuoviPassword(): Promise<void> {
  await salvaConfigSicurezza({
    password_annullo_hash: null,
    password_annullo_set: false,
  });
}
