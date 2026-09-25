/**
 * Tipi e default dei dati aziendali.
 * I dati VERI vengono letti da Supabase (tabella `impostazioni`, chiave `dati_aziendali`)
 * tramite il modulo `datiAziendali.ts`.
 * Quelli qui sotto sono SOLO un fallback se Supabase non risponde o è vuoto.
 */

export interface Sede {
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
}

export interface DatiAziendali {
  ragioneSociale: string;
  sedeLegale: Sede;
  sedeOperativa: Sede;
  partitaIva: string;
  codiceFiscale: string;
  codiceSdi: string;
  telefono: string;
  email: string;
  pec: string;
  iban: string;
  sitoWeb: string;
  regimeFiscale: 'ordinario' | 'forfettario';
}

export const DATI_AZIENDALI_DEFAULT: DatiAziendali = {
  ragioneSociale: 'RIGHETTI CONSULTING SRL',
  sedeLegale: {
    indirizzo: 'Via Maffezzini 179',
    cap: '23018',
    citta: 'Talamona',
    provincia: 'SO',
  },
  sedeOperativa: {
    indirizzo: 'Piazza III Novembre 38',
    cap: '23017',
    citta: 'Morbegno',
    provincia: 'SO',
  },
  partitaIva: '00823620141',
  codiceFiscale: '00823620141',
  codiceSdi: '6JXPS2J',
  telefono: '0342 234040',
  email: '',
  pec: '',
  iban: '',
  sitoWeb: '',
  regimeFiscale: 'ordinario',
};

/** Compone "Via Roma 1, 20100 Milano (MI)" */
export function formatSede(sede: Sede): string {
  return [sede.indirizzo, sede.cap, sede.citta, sede.provincia ? `(${sede.provincia})` : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * @deprecated Export di compatibilità per il vecchio codice.
 * Usare `caricaDatiAziendali()` da `datiAziendali.ts` per i dati aggiornati.
 */
export const STUDIO = {
  ragioneSociale: DATI_AZIENDALI_DEFAULT.ragioneSociale,
  sedeOperativa: formatSede(DATI_AZIENDALI_DEFAULT.sedeOperativa),
  sedeLegale: formatSede(DATI_AZIENDALI_DEFAULT.sedeLegale),
  partitaIva: DATI_AZIENDALI_DEFAULT.partitaIva,
  codiceSdi: DATI_AZIENDALI_DEFAULT.codiceSdi,
  telefono: DATI_AZIENDALI_DEFAULT.telefono,
};
