import { supabase } from './supabase';
import { DATI_AZIENDALI_DEFAULT, type DatiAziendali } from './studio';

let cache: DatiAziendali | null = null;
let promessaInCorso: Promise<DatiAziendali> | null = null;

const DATI_AZIENDALI_VUOTI: DatiAziendali = {
  ragioneSociale: '',
  sedeLegale: {
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
  },
  sedeOperativa: {
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
  },
  partitaIva: '',
  codiceFiscale: '',
  codiceSdi: '',
  telefono: '',
  email: '',
  pec: '',
  iban: '',
  sitoWeb: '',
  regimeFiscale: 'ordinario',
  regimeDocumenti: 'fatture',
  cassaModalita: 'digitale',
  cassaGestioneGiornaliera: false,
  cassaFondoIniziale: 0,

};

function adatta(raw: unknown, isRighetti: boolean, nomeAziendaUser?: string): DatiAziendali {
  const fallback = isRighetti
    ? DATI_AZIENDALI_DEFAULT
    : { ...DATI_AZIENDALI_VUOTI, ragioneSociale: nomeAziendaUser || '' };

  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, any>;

  const sedeLegale: DatiAziendali['sedeLegale'] = {
    indirizzo: r.sedeLegale?.indirizzo ?? r.indirizzo ?? fallback.sedeLegale.indirizzo,
    cap: r.sedeLegale?.cap ?? r.cap ?? fallback.sedeLegale.cap,
    citta: r.sedeLegale?.citta ?? r.citta ?? fallback.sedeLegale.citta,
    provincia: r.sedeLegale?.provincia ?? r.provincia ?? fallback.sedeLegale.provincia,
  };
  const sedeOperativa = r.sedeOperativaUgualeLegale ? sedeLegale : (r.sedeOperativa ?? sedeLegale);

  return {
    ragioneSociale: r.ragioneSociale || (isRighetti ? fallback.ragioneSociale : (nomeAziendaUser || '')),
    sedeLegale,
    sedeOperativa: {
      indirizzo: sedeOperativa.indirizzo ?? fallback.sedeOperativa.indirizzo,
      cap: sedeOperativa.cap ?? fallback.sedeOperativa.cap,
      citta: sedeOperativa.citta ?? fallback.sedeOperativa.citta,
      provincia: sedeOperativa.provincia ?? fallback.sedeOperativa.provincia,
    },
    partitaIva: r.partitaIva ?? (isRighetti ? fallback.partitaIva : ''),
    codiceFiscale: r.codiceFiscale ?? (isRighetti ? fallback.codiceFiscale : ''),
    codiceSdi: r.codiceSdi ?? (isRighetti ? fallback.codiceSdi : ''),
    telefono: r.telefono ?? (isRighetti ? fallback.telefono : ''),
    email: r.email ?? (isRighetti ? fallback.email : ''),
    pec: r.pec ?? (isRighetti ? fallback.pec : ''),
    iban: r.iban ?? (isRighetti ? fallback.iban : ''),
    sitoWeb: r.sitoWeb ?? (isRighetti ? fallback.sitoWeb : ''),

    regimeFiscale: r.regimeFiscale === 'forfettario' ? 'forfettario' : 'ordinario',
    regimeDocumenti: r.regimeDocumenti === 'scontrini' ? 'scontrini' : 'fatture',
    cassaModalita: r.cassaModalita === 'fisico' ? 'fisico' : 'digitale',
    cassaGestioneGiornaliera: r.cassaGestioneGiornaliera === true,
    cassaFondoIniziale: typeof r.cassaFondoIniziale === 'number' ? r.cassaFondoIniziale : 0,
  };
}

export async function caricaDatiAziendali(): Promise<DatiAziendali> {
  if (cache) {
    return cache;
  }
  if (promessaInCorso) return promessaInCorso;

  promessaInCorso = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const isRighetti = user.email?.toLowerCase().trim() === 'righetti@righetti.club';
      const nomeAzienda = (user.user_metadata?.azienda as string | undefined) || '';

      const { data, error } = await supabase
        .from('impostazioni')
        .select('valore')
        .eq('user_id', user.id)
        .eq('chiave', 'dati_aziendali')
        .maybeSingle();

      if (error) throw error;
      cache = adatta(data?.valore, isRighetti, nomeAzienda);
    } catch (err) {
      console.warn('⚠️ [datiAziendali] Fallback dati:', err);
      cache = DATI_AZIENDALI_VUOTI;
    } finally {
      promessaInCorso = null;
    }
    return cache!;
  })();

  return promessaInCorso;
}

export function getDatiAziendaliSync(): DatiAziendali {
  return cache ?? DATI_AZIENDALI_VUOTI;
}

export function invalidaCacheDatiAziendali(): void {
  cache = null;
  promessaInCorso = null;
}

export async function salvaDatiAziendali(dati: DatiAziendali): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'dati_aziendali',
        valore: dati,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );
  if (error) throw error;
  cache = dati;

  // 🔔 Notifica tutti gli ascoltatori che i dati sono cambiati
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('datiAziendali-aggiornati', { detail: dati }));
  }
}

// ============================================================
// EVENT SYSTEM — Notifica cambi dati aziendali
// ============================================================

/**
 * Nome dell'evento custom dispatchato dopo salvaDatiAziendali.
 * Componenti possono ascoltarlo con:
 *   window.addEventListener('datiAziendali-aggiornati', handler as EventListener);
 */
export const EVENT_DATI_AZIENDALI_AGGIORNATI = 'datiAziendali-aggiornati';
