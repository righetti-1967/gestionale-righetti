/**
 * Configurazione fatturazione (salvata in `impostazioni` con chiave `fatturazione`).
 * Cache + lettura da Supabase, come per i dati aziendali.
 */
import { supabase } from './supabase';

export interface ConfigFatturazione {
  metodoPagamentoDefault: 'Bonifico' | 'Carta' | 'Bancomat' | 'Contanti' | 'Non richiesto' | '';
  prefissoFattura: string;
  prefissoProforma: string;
  numerazioneAutomatica: boolean;
  ivaDefault: number;
  giorniScadenza: number;
}

export const FATTURAZIONE_DEFAULT: ConfigFatturazione = {
  metodoPagamentoDefault: '',
  prefissoFattura: '',
  prefissoProforma: '',
  numerazioneAutomatica: true,
  ivaDefault: 22,
  giorniScadenza: 30,
};

let cache: ConfigFatturazione | null = null;
let promessaInCorso: Promise<ConfigFatturazione> | null = null;

function adatta(raw: unknown): ConfigFatturazione {
  if (!raw || typeof raw !== 'object') return FATTURAZIONE_DEFAULT;
  const r = raw as Record<string, any>;
  return {
    metodoPagamentoDefault:
      ['Bonifico', 'Carta', 'Bancomat', 'Contanti', 'Non richiesto'].includes(r.metodoPagamentoDefault)
        ? r.metodoPagamentoDefault
        : '',
    prefissoFattura: r.prefissoFattura ?? '',
    prefissoProforma: r.prefissoProforma ?? '',
    numerazioneAutomatica: r.numerazioneAutomatica !== false,
    ivaDefault: typeof r.ivaDefault === 'number' ? r.ivaDefault : 22,
    giorniScadenza: typeof r.giorniScadenza === 'number' ? r.giorniScadenza : 30,
  };
}

export async function caricaFatturazione(): Promise<ConfigFatturazione> {
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
        .eq('chiave', 'fatturazione')
        .maybeSingle();
      if (error) throw error;
      cache = adatta(data?.valore);
    } catch (err) {
      console.error('⚠️ Impossibile leggere configurazione fatturazione, uso default:', err);
      cache = FATTURAZIONE_DEFAULT;
    } finally {
      promessaInCorso = null;
    }
    return cache!;
  })();

  return promessaInCorso;
}

export function getFatturazioneSync(): ConfigFatturazione {
  return cache ?? FATTURAZIONE_DEFAULT;
}

export function invalidaCacheFatturazione(): void {
  cache = null;
  promessaInCorso = null;
}

export async function salvaFatturazione(config: ConfigFatturazione): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'fatturazione',
        valore: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );
  if (error) throw error;
  cache = config;
}
