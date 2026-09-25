/**
 * Configurazione aspetto e formati.
 * Salvata in `impostazioni` con chiave `aspetto`.
 */
import { supabase } from './supabase';

export type Tema = 'chiaro' | 'scuro' | 'auto';
export type FormatoData = 'GG/MM/AAAA' | 'MM/GG/AAAA' | 'AAAA-MM-GG';
export type PrimoGiorno = 'lunedi' | 'domenica';
export type FormatoNumero = 'italiano' | 'internazionale';
export type Lingua = 'it' | 'en';

export interface ConfigAspetto {
  tema: Tema;
  lingua: Lingua;
  valuta: string;
  formatoData: FormatoData;
  primoGiorno: PrimoGiorno;
  formatoNumero: FormatoNumero;
}

export const ASPETTO_DEFAULT: ConfigAspetto = {
  tema: 'auto',
  lingua: 'it',
  valuta: 'EUR',
  formatoData: 'GG/MM/AAAA',
  primoGiorno: 'lunedi',
  formatoNumero: 'italiano',
};

let cache: ConfigAspetto | null = null;
let promessaInCorso: Promise<ConfigAspetto> | null = null;

function adatta(raw: unknown): ConfigAspetto {
  if (!raw || typeof raw !== 'object') return ASPETTO_DEFAULT;
  const r = raw as Record<string, any>;
  return {
    tema: (['chiaro', 'scuro', 'auto'].includes(r.tema) ? r.tema : 'auto') as Tema,
    lingua: (['it', 'en'].includes(r.lingua) ? r.lingua : 'it') as Lingua,
    valuta: typeof r.valuta === 'string' ? r.valuta : 'EUR',
    formatoData: (['GG/MM/AAAA', 'MM/GG/AAAA', 'AAAA-MM-GG'].includes(r.formatoData)
      ? r.formatoData
      : 'GG/MM/AAAA') as FormatoData,
    primoGiorno: (['lunedi', 'domenica'].includes(r.primoGiorno) ? r.primoGiorno : 'lunedi') as PrimoGiorno,
    formatoNumero: (['italiano', 'internazionale'].includes(r.formatoNumero)
      ? r.formatoNumero
      : 'italiano') as FormatoNumero,
  };
}

export async function caricaAspetto(): Promise<ConfigAspetto> {
  if (cache) return cache;
  if (promessaInCorso) return promessaInCorso;

  promessaInCorso = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { data, error } = await supabase
        .from('impostazioni')
        .select('valore')
        .eq('user_id', user.id)
        .eq('chiave', 'aspetto')
        .maybeSingle();
      if (error) throw error;
      cache = adatta(data?.valore);
    } catch (err) {
      console.error('⚠️ Impossibile leggere configurazione aspetto, uso default:', err);
      cache = ASPETTO_DEFAULT;
    } finally {
      promessaInCorso = null;
    }
    return cache!;
  })();

  return promessaInCorso;
}

export function getAspettoSync(): ConfigAspetto {
  return cache ?? ASPETTO_DEFAULT;
}

export function invalidaCacheAspetto(): void {
  cache = null;
  promessaInCorso = null;
}

export async function salvaAspetto(config: ConfigAspetto): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'aspetto',
        valore: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );
  if (error) throw error;
  cache = config;
}
