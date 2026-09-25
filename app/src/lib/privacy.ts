/**
 * Configurazione privacy (informativa GDPR, firma, conservazione).
 * Salvata in `impostazioni` con chiave `privacy`.
 */
import { supabase } from './supabase';

export interface ConfigPrivacy {
  testoInformativa: string;
  richiediFirma: boolean;
  conservaPdfFirmato: boolean;
  giorniConservazione: number;
  avvisaScadenza: boolean;
}

export const INFORMATIVA_DEFAULT = `Gentile Cliente,

Ai fini previsti dal Regolamento UE n. 2016/679 (GDPR), relativo alla protezione delle persone fisiche con riguardo al trattamento dei dati personali, desideriamo informarLa che i dati personali da Lei forniti saranno oggetto di trattamento nel rispetto della normativa prevista dal predetto Regolamento e che:

1. FINALITÀ DEL TRATTAMENTO
I Suoi dati saranno trattati: (a) senza consenso espresso per la gestione ed esecuzione delle attività connesse alla fornitura del servizio; (b) previo consenso per finalità di marketing.

2. MODALITÀ DEL TRATTAMENTO
Il trattamento avverrà con strumenti elettronici e/o cartacei e consiste nella raccolta, registrazione, organizzazione, conservazione, consultazione, elaborazione, modificazione, selezione, estrazione, raffronto, utilizzo, interconnessione, blocco, comunicazione, cancellazione e distruzione dei dati.

3. CONFERIMENTO E RIFIUTO
Il conferimento dei dati personali è necessario per lo svolgimento delle attività di cui al punto 1(a). Il rifiuto comporta l'impossibilità di adempiere a tali attività.

4. COMUNICAZIONE DEI DATI
I dati potranno essere comunicati al personale autorizzato del Titolare e a società terze che svolgono attività in outsourcing per conto del Titolare.

5. TRASFERIMENTO ALL'ESTERO
Il Titolare ha facoltà di trasferire i dati in paesi extra-UE, assicurando che il trasferimento avvenga in conformità alle disposizioni di legge applicabili.

6. CONSERVAZIONE DEI DATI
I dati sono conservati all'interno dell'Unione Europea per un anno dall'espletamento dell'ultima attività o 10 anni per adempimenti fiscali.

7. TITOLARE DEL TRATTAMENTO
[Verrà compilato automaticamente con la ragione sociale e la sede legale dell'azienda]

8. DIRITTI DELL'INTERESSATO
L'interessato ha diritto: (a) all'accesso, rettifica, cancellazione, limitazione e opposizione al trattamento; (b) ad ottenere i dati in un formato strutturato; (c) a revocare il consenso; (d) a proporre reclamo all'Autorità Garante.`;

export const PRIVACY_DEFAULT: ConfigPrivacy = {
  testoInformativa: INFORMATIVA_DEFAULT,
  richiediFirma: true,
  conservaPdfFirmato: true,
  giorniConservazione: 3650,
  avvisaScadenza: false,
};

let cache: ConfigPrivacy | null = null;
let promessaInCorso: Promise<ConfigPrivacy> | null = null;

function adatta(raw: unknown): ConfigPrivacy {
  if (!raw || typeof raw !== 'object') return PRIVACY_DEFAULT;
  const r = raw as Record<string, any>;
  return {
    testoInformativa:
      typeof r.testoInformativa === 'string' && r.testoInformativa.trim().length > 0
        ? r.testoInformativa
        : INFORMATIVA_DEFAULT,
    richiediFirma: r.richiediFirma !== false,
    conservaPdfFirmato: r.conservaPdfFirmato !== false,
    giorniConservazione:
      typeof r.giorniConservazione === 'number' ? r.giorniConservazione : 3650,
    avvisaScadenza: r.avvisaScadenza === true,
  };
}

export async function caricaPrivacy(): Promise<ConfigPrivacy> {
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
        .eq('chiave', 'privacy')
        .maybeSingle();
      if (error) throw error;
      cache = adatta(data?.valore);
    } catch (err) {
      console.error('⚠️ Impossibile leggere configurazione privacy, uso default:', err);
      cache = PRIVACY_DEFAULT;
    } finally {
      promessaInCorso = null;
    }
    return cache!;
  })();

  return promessaInCorso;
}

export function getPrivacySync(): ConfigPrivacy {
  return cache ?? PRIVACY_DEFAULT;
}

export function invalidaCachePrivacy(): void {
  cache = null;
  promessaInCorso = null;
}

export async function salvaPrivacy(config: ConfigPrivacy): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'privacy',
        valore: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );
  if (error) throw error;
  cache = config;
}
