/**
 * Configurazione Agenda (orari, giorni, granularità, operatori visibili, colori servizi).
 * Salvata in `impostazioni` con chiave `agenda`.
 */
import { supabase } from './supabase';

export interface CategoriaServizio {
  id: string;        // "cat-XXXXX" — generato
  nome: string;      // "Stilistico", "Tecnico", ...
  colore: string;    // "blue", "green", ...
}

export interface OperatoreConfig {
  id: string;        // "luca", "lorenzo", o generato es. "op_xxxx"
  label: string;     // "Luca Righetti"
  ruolo: string;     // "Consulente Tricologo"
  colore: string;    // "blue", "green", ecc.

  // NEW — Orari personalizzati per operatore (opzionale).
  // Se usaOrariGlobali !== false → usa gli orari globali della sede.
  // Se usaOrariGlobali === false → usa orariGiorni qui sotto.
  orariGiorni?: Record<number, OrarioGiorno>;  // 0=Dom, 1=Lun, ..., 6=Sab
  usaOrariGlobali?: boolean;                   // default true (o undefined = true)
}

export interface Fascia {
  inizio: string;  // "09:00"
  fine: string;    // "13:00"
}

export interface OrarioGiorno {
  aperto: boolean;
  fasce: Fascia[];
}

export interface ConfigAgenda {
  // Orari globali (backward compat + fallback)
  oraApertura: string;           // "08:30"
  oraChiusura: string;           // "19:00"

  // Orari per giorno settimana (0=Dom, 1=Lun, ..., 6=Sab).
  // Se mancante, viene generato automaticamente da oraApertura/oraChiusura/giorniLavorativi.
  orariGiorni?: Record<number, OrarioGiorno>;

  // Giorni lavorativi (0=Dom, 1=Lun, ..., 6=Sab)
  giorniLavorativi: number[];    // [4, 5, 6] default attuale

  // Granularità griglia
  granularitaMinuti: 10 | 15 | 20 | 30;

  // Lista operatori configurati
  operatori: OperatoreConfig[];

  // ID degli operatori visibili in agenda (nell'ordine di colonna)
  operatoriVisibili: string[];

  // Categorie servizi personalizzate
  categorie: CategoriaServizio[];

  // Mapping: servizio_id (string) → categoria_id (string)
  servizioCategoria: Record<string, string>;
  coloriTipi: {
    percorso: string;
    checkup_nuovo: string;
    seduta: string;
    generico: string;
  };
}

export const OPERATORI_DEFAULT: OperatoreConfig[] = [
  { id: 'op1', label: 'Operatore 1', ruolo: 'Titolare', colore: 'blue' },
  { id: 'op2', label: 'Operatore 2', ruolo: 'Collaboratore', colore: 'green' },
];

export const AGENDA_DEFAULT: ConfigAgenda = {
  oraApertura: '09:00',
  oraChiusura: '18:00',
  giorniLavorativi: [2, 3, 4, 5, 6],  // Mar, Mer, Gio, Ven, Sab
  orariGiorni: {
    0: { aperto: false, fasce: [] },
    1: { aperto: false, fasce: [] },
    2: { aperto: true, fasce: [{ inizio: '09:00', fine: '18:00' }] },
    3: { aperto: true, fasce: [{ inizio: '09:00', fine: '18:00' }] },
    4: { aperto: true, fasce: [{ inizio: '09:00', fine: '18:00' }] },
    5: { aperto: true, fasce: [{ inizio: '09:00', fine: '18:00' }] },
    6: { aperto: true, fasce: [{ inizio: '09:00', fine: '18:00' }] },
  },
  granularitaMinuti: 15,
  operatori: OPERATORI_DEFAULT,
  operatoriVisibili: ['luca', 'lorenzo'],
  categorie: [],
  servizioCategoria: {},
  coloriTipi: {
    percorso: 'yellow',
    checkup_nuovo: 'blue',
    seduta: 'green',
    generico: 'gray',
  },
};

/**
 * Ritorna gli orari del giorno per un operatore specifico.
 * Se l'operatore usa orari globali (o non ha custom), ritorna `config.orariGiorni[giorno]`.
 * Se l'operatore ha orari custom, ritorna `operatore.orariGiorni[giorno]`.
 */
export function getOrariOperatoreGiorno(
  config: ConfigAgenda,
  operatoreId: string,
  giornoSettimana: number
): OrarioGiorno {
  const op = config.operatori.find((o) => o.id === operatoreId);
  const fallbackGlobali: OrarioGiorno =
    config.orariGiorni?.[giornoSettimana] ||
    {
      aperto: false,
      fasce: [],
    };

  if (!op || op.usaOrariGlobali !== false) {
    return fallbackGlobali;
  }

  return op.orariGiorni?.[giornoSettimana] || fallbackGlobali;
}

/**
 * Ritorna true se l'operatore è disponibile all'orario specificato.
 * Utile per validazione drag&drop e slot disabilitati.
 */
export function isOperatoreDisponibile(
  config: ConfigAgenda,
  operatoreId: string,
  dataISO: string,   // "2026-10-15"
  oraHHMM: string    // "15:30"
): boolean {
  try {
    const giornoSettimana = new Date(dataISO + 'T00:00:00').getDay();
    const orario = getOrariOperatoreGiorno(config, operatoreId, giornoSettimana);

    if (!orario.aperto || orario.fasce.length === 0) return false;

    const [h, m] = oraHHMM.split(':').map(Number);
    const minuti = h * 60 + m;

    return orario.fasce.some((f) => {
      const [hi, mi] = f.inizio.split(':').map(Number);
      const [hf, mf] = f.fine.split(':').map(Number);
      const inizio = hi * 60 + mi;
      const fine = hf * 60 + mf;
      return minuti >= inizio && minuti < fine;
    });
  } catch (err) {
    console.warn('Errore isOperatoreDisponibile:', err);
    return true; // fail-safe: se errore, considera disponibile
  }
}

let cache: ConfigAgenda | null = null;
let promessaInCorso: Promise<ConfigAgenda> | null = null;

function adatta(raw: unknown): ConfigAgenda {
  if (!raw || typeof raw !== 'object') return AGENDA_DEFAULT;
  const r = raw as Record<string, any>;

  const granularita = [10, 15, 20, 30].includes(r.granularitaMinuti)
    ? r.granularitaMinuti
    : 15;

  const giorni = Array.isArray(r.giorniLavorativi)
    ? r.giorniLavorativi.filter((g: any) => typeof g === 'number' && g >= 0 && g <= 6)
    : AGENDA_DEFAULT.giorniLavorativi;

  // Carica gli operatori salvati o usa i default
  const operatori: OperatoreConfig[] = Array.isArray(r.operatori) && r.operatori.length > 0
    ? r.operatori.map((o: any) => {
        // Parsing orariGiorni dell'operatore (se presenti)
        let orariOp: Record<number, OrarioGiorno> | undefined = undefined;
        if (o.orariGiorni && typeof o.orariGiorni === 'object') {
          orariOp = {};
          for (let g = 0; g <= 6; g++) {
            const gg = o.orariGiorni[g];
            if (gg && typeof gg === 'object') {
              const fasce = Array.isArray(gg.fasce)
                ? gg.fasce
                    .filter((f: any) => f && typeof f.inizio === 'string' && typeof f.fine === 'string')
                    .map((f: any) => ({ inizio: f.inizio, fine: f.fine }))
                : [];
              orariOp[g] = { aperto: !!gg.aperto, fasce };
            }
          }
        }
        return {
          id: String(o.id || generaIdOperatore(o.label || 'operatore')),
          label: String(o.label || 'Operatore'),
          ruolo: String(o.ruolo || ''),
          colore: String(o.colore || 'blue'),
          // NEW — orari per operatore
          orariGiorni: orariOp,
          usaOrariGlobali: o.usaOrariGlobali !== false, // default true
        };
      })
    : OPERATORI_DEFAULT;

  const idsValidi = new Set(operatori.map((o) => o.id));

  // Filtra gli operatori visibili garantendo che esistano
  const operatoriVisibili = Array.isArray(r.operatoriVisibili)
    ? r.operatoriVisibili.map(String).filter((id) => idsValidi.has(id))
    : operatori.map((o) => o.id);

  const categorie = Array.isArray(r.categorie)
    ? r.categorie
        .filter((c: any) => c && typeof c.id === 'string' && typeof c.nome === 'string' && typeof c.colore === 'string')
        .map((c: any) => ({ id: c.id, nome: c.nome, colore: c.colore }))
    : [];

  const servizioCategoria =
    r.servizioCategoria && typeof r.servizioCategoria === 'object'
      ? r.servizioCategoria
      : {};

  const coloriTipi = {
    percorso: typeof r.coloriTipi?.percorso === 'string' ? r.coloriTipi.percorso : 'yellow',
    checkup_nuovo: typeof r.coloriTipi?.checkup_nuovo === 'string' ? r.coloriTipi.checkup_nuovo : 'blue',
    seduta: typeof r.coloriTipi?.seduta === 'string' ? r.coloriTipi.seduta : 'green',
    generico: typeof r.coloriTipi?.generico === 'string' ? r.coloriTipi.generico : 'gray',
  };

  const oraAperturaFinale = typeof r.oraApertura === 'string' && r.oraApertura.match(/^\d{2}:\d{2}$/)
    ? r.oraApertura
    : AGENDA_DEFAULT.oraApertura;
  const oraChiusuraFinale = typeof r.oraChiusura === 'string' && r.oraChiusura.match(/^\d{2}:\d{2}$/)
    ? r.oraChiusura
    : AGENDA_DEFAULT.oraChiusura;
  const giorniFinali = giorni.length > 0 ? giorni : AGENDA_DEFAULT.giorniLavorativi;

  // Parsing orariGiorni (se presente), altrimenti backward compat
  let orariGiorni: Record<number, OrarioGiorno> | undefined = undefined;
  if (r.orariGiorni && typeof r.orariGiorni === 'object') {
    orariGiorni = {};
    for (let g = 0; g <= 6; g++) {
      const entry = r.orariGiorni[g];
      if (!entry || typeof entry !== 'object') continue;
      const fasce: Fascia[] = Array.isArray(entry.fasce)
        ? entry.fasce
            .filter((f: any) =>
              f && typeof f.inizio === 'string' && typeof f.fine === 'string' &&
              f.inizio.match(/^\d{2}:\d{2}$/) && f.fine.match(/^\d{2}:\d{2}$/)
            )
            .map((f: any) => ({ inizio: f.inizio, fine: f.fine }))
        : [];
      orariGiorni[g] = {
        aperto: Boolean(entry.aperto) && fasce.length > 0,
        fasce,
      };
    }
  } else {
    // BACKWARD COMPAT: genera orariGiorni da dati legacy
    orariGiorni = {};
    for (let g = 0; g <= 6; g++) {
      const aperto = giorniFinali.includes(g);
      orariGiorni[g] = {
        aperto,
        fasce: aperto ? [{ inizio: oraAperturaFinale, fine: oraChiusuraFinale }] : [],
      };
    }
  }

  return {
    oraApertura: oraAperturaFinale,
    oraChiusura: oraChiusuraFinale,
    orariGiorni,
    giorniLavorativi: giorniFinali,
    granularitaMinuti: granularita,
    operatori,
    operatoriVisibili: operatoriVisibili.length > 0 ? operatoriVisibili : [operatori[0].id],
    categorie,
    servizioCategoria,
    coloriTipi,
  };
}

export async function caricaAgendaConfig(): Promise<ConfigAgenda> {
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
        .eq('chiave', 'agenda')
        .maybeSingle();
      if (error) throw error;
      cache = adatta(data?.valore);
    } catch (err) {
      console.error('⚠️ Impossibile leggere configurazione agenda:', err);
    } finally {
      promessaInCorso = null;
    }
    return cache ?? AGENDA_DEFAULT;
  })();

  return promessaInCorso;
}

export function getAgendaConfigSync(): ConfigAgenda {
  return cache ?? AGENDA_DEFAULT;
}

export function invalidaCacheAgendaConfig(): void {
  cache = null;
  promessaInCorso = null;
}

export async function salvaAgendaConfig(config: ConfigAgenda): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'agenda',
        valore: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );
  if (error) throw error;
  cache = config;
}

/**
 * Ritorna le fasce orarie di un giorno della settimana.
 * Fallback: se orariGiorni manca, usa oraApertura/oraChiusura e giorniLavorativi.
 */
export function getOrariGiorno(config: ConfigAgenda, giorno: number): OrarioGiorno {
  if (config.orariGiorni && config.orariGiorni[giorno]) {
    return config.orariGiorni[giorno];
  }
  const aperto = config.giorniLavorativi.includes(giorno);
  return {
    aperto,
    fasce: aperto ? [{ inizio: config.oraApertura, fine: config.oraChiusura }] : [],
  };
}

/**
 * Ritorna le fasce di un giorno da una data ISO (YYYY-MM-DD).
 * USA orariGiorni se presente, altrimenti fallback a oraApertura/oraChiusura/giorniLavorativi.
 */
export function getFasceDaDataISO(config: ConfigAgenda, dataISO: string): Fascia[] {
  const [y, m, d] = dataISO.split('-').map(Number);
  const giornoSett = new Date(y, m - 1, d).getDay();
  return getOrariGiorno(config, giornoSett).fasce;
}

/**
 * Verifica se un orario HH:MM (o HH:MM:SS) è dentro le fasce del giorno.
 * Ritorna anche il motivo se fuori.
 */
export function verificaOrarioInFasce(
  config: ConfigAgenda,
  dataISO: string,
  oraHHMM: string
): { dentro: boolean; motivo?: string } {
  const oraShort = oraHHMM.slice(0, 5);
  const fasce = getFasceDaDataISO(config, dataISO);
  if (fasce.length === 0) {
    return { dentro: false, motivo: 'Giorno chiuso' };
  }
  const dentro = fasce.some((f) => oraShort >= f.inizio && oraShort < f.fine);
  if (dentro) return { dentro: true };
  const range = fasce.map((f) => `${f.inizio}-${f.fine}`).join(' · ');
  return { dentro: false, motivo: `Fuori orario (${range})` };
}

/** Genera un ID univoco per una nuova categoria */
export function generaIdCategoria(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Genera un ID slug univoco per un nuovo operatore */
export function generaIdOperatore(nome: string): string {
  const slug = nome.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').slice(0, 15);
  return `${slug || 'op'}_${Math.random().toString(36).slice(2, 6)}`;
}
