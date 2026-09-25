import { supabase } from './supabase';
import { DATI_AZIENDALI_DEFAULT, type DatiAziendali } from './studio';

let cache: DatiAziendali | null = null;
let promessaInCorso: Promise<DatiAziendali> | null = null;

function adatta(raw: unknown): DatiAziendali {
  if (!raw || typeof raw !== 'object') return DATI_AZIENDALI_DEFAULT;
  const r = raw as Record<string, any>;

  const sedeLegale: DatiAziendali['sedeLegale'] = {
    indirizzo: r.sedeLegale?.indirizzo ?? r.indirizzo ?? '',
    cap: r.sedeLegale?.cap ?? r.cap ?? '',
    citta: r.sedeLegale?.citta ?? r.citta ?? '',
    provincia: r.sedeLegale?.provincia ?? r.provincia ?? '',
  };
  const sedeOperativa = r.sedeOperativaUgualeLegale ? sedeLegale : (r.sedeOperativa ?? sedeLegale);

  return {
    ragioneSociale: r.ragioneSociale || DATI_AZIENDALI_DEFAULT.ragioneSociale,
    sedeLegale,
    sedeOperativa: {
      indirizzo: sedeOperativa.indirizzo ?? '',
      cap: sedeOperativa.cap ?? '',
      citta: sedeOperativa.citta ?? '',
      provincia: sedeOperativa.provincia ?? '',
    },
    partitaIva: r.partitaIva ?? '',
    codiceFiscale: r.codiceFiscale ?? '',
    codiceSdi: r.codiceSdi ?? '',
    telefono: r.telefono ?? '',
    email: r.email ?? '',
    pec: r.pec ?? '',
    iban: r.iban ?? '',
    sitoWeb: r.sitoWeb ?? '',
    regimeFiscale: r.regimeFiscale === 'forfettario' ? 'forfettario' : 'ordinario',
  };
}

export async function caricaDatiAziendali(): Promise<DatiAziendali> {
  if (cache) {
    console.log('🔍 [datiAziendali] Ritorno dalla CACHE:', cache);
    return cache;
  }
  if (promessaInCorso) return promessaInCorso;

  promessaInCorso = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { data, error } = await supabase
        .from('impostazioni')
        .select('valore')
        .eq('user_id', user.id)
        .eq('chiave', 'dati_aziendali')
        .maybeSingle();

      console.log('🔍 [datiAziendali] Risposta grezza da Supabase:', { data, error });

      if (error) throw error;
      cache = adatta(data?.valore);
      console.log('🔍 [datiAziendali] Dati adattati (usati dai PDF):', cache);
    } catch (err) {
      console.error('⚠️ [datiAziendali] Errore lettura, uso default:', err);
      cache = DATI_AZIENDALI_DEFAULT;
    } finally {
      promessaInCorso = null;
    }
    return cache!;
  })();

  return promessaInCorso;
}

export function getDatiAziendaliSync(): DatiAziendali {
  return cache ?? DATI_AZIENDALI_DEFAULT;
}

export function invalidaCacheDatiAziendali(): void {
  console.log('🔍 [datiAziendali] Cache INVALIDATA');
  cache = null;
  promessaInCorso = null;
}
