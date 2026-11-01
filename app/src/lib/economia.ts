/**
 * Configurazione Economia per operatore + costi fissi azienda.
 * Salvata in `impostazioni` (tabella Supabase) come JSON.
 */
import { supabase } from './supabase';

// ============================================================
// TIPI
// ============================================================

export interface EconomiaOperatore {
  operatore_id: string;          // "luca", "lorenzo", ecc.
  tipo: 'dipendente' | 'titolare' | 'collaboratore';
  busta_paga_lorda: number;      // € mensili lordi
  busta_paga_netta: number;      // € mensili netti
  contributi_pct: number;        // % INPS (es. 30)
  tfr_pct: number;               // % TFR (es. 7)
  ore_settimanali: number;       // es. 40
  giorni_settimanali: number;    // es. 5
  note: string;
}

export interface ConfigCostiFissi {
  categorie_fisse: string[];     // es. ['Affitto', 'Utenze', 'Stipendi', 'Assicurazioni']
  aliquota_titolare_pct: number; // % contributi titolare (es. 26)
}

export interface ConfigEconomia {
  operatori: EconomiaOperatore[];
  costi_fissi: ConfigCostiFissi;
}

// ============================================================
// DEFAULT
// ============================================================

export const ECONOMIA_DEFAULT: ConfigEconomia = {
  operatori: [],
  costi_fissi: {
    categorie_fisse: ['Affitto', 'Utenze', 'Stipendi', 'Assicurazioni', 'Consulenze'],
    aliquota_titolare_pct: 26,
  },
};

// ============================================================
// CARICA / SALVA
// ============================================================

export async function caricaEconomia(): Promise<ConfigEconomia> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ECONOMIA_DEFAULT;

  const { data, error } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', user.id)
    .eq('chiave', 'economia')
    .maybeSingle();

  if (error || !data?.valore) return ECONOMIA_DEFAULT;

  const valore = data.valore as Partial<ConfigEconomia>;
  return {
    operatori: Array.isArray(valore.operatori) ? valore.operatori : [],
    costi_fissi: {
      categorie_fisse: Array.isArray(valore.costi_fissi?.categorie_fisse)
        ? valore.costi_fissi!.categorie_fisse!
        : ECONOMIA_DEFAULT.costi_fissi.categorie_fisse,
      aliquota_titolare_pct: typeof valore.costi_fissi?.aliquota_titolare_pct === 'number'
        ? valore.costi_fissi!.aliquota_titolare_pct!
        : ECONOMIA_DEFAULT.costi_fissi.aliquota_titolare_pct,
    },
  };
}

export async function salvaEconomia(config: ConfigEconomia): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'economia',
        valore: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );

  if (error) throw error;
}

// ============================================================
// HELPER: calcolo costo orario
// ============================================================

export function calcolaCostoOrario(op: EconomiaOperatore): number {
  if (!op.ore_settimanali || op.ore_settimanali <= 0) return 0;
  const oreMese = op.ore_settimanali * 4.33;
  const costoMensile = op.busta_paga_lorda * (1 + op.contributi_pct / 100 + op.tfr_pct / 100);
  return Math.round((costoMensile / oreMese) * 100) / 100;
}

export function calcolaCostoMensile(op: EconomiaOperatore): number {
  return Math.round(op.busta_paga_lorda * (1 + op.contributi_pct / 100 + op.tfr_pct / 100) * 100) / 100;
}
