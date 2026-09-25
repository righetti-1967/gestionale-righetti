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
}

export interface ConfigAgenda {
  // Orari
  oraApertura: string;           // "08:30"
  oraChiusura: string;           // "19:00"

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
  { id: 'luca', label: 'Luca Righetti', ruolo: 'Consulente Tricologo', colore: 'blue' },
  { id: 'lorenzo', label: 'Lorenzo Righetti', ruolo: 'Tecnico Tricologo', colore: 'green' },
];

export const AGENDA_DEFAULT: ConfigAgenda = {
  oraApertura: '08:30',
  oraChiusura: '19:00',
  giorniLavorativi: [4, 5, 6],       // Gio, Ven, Sab (attuale)
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
    ? r.operatori.map((o: any) => ({
        id: String(o.id || generaIdOperatore(o.label || 'operatore')),
        label: String(o.label || 'Operatore'),
        ruolo: String(o.ruolo || ''),
        colore: String(o.colore || 'blue'),
      }))
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

  return {
    oraApertura: typeof r.oraApertura === 'string' && r.oraApertura.match(/^\d{2}:\d{2}$/)
      ? r.oraApertura
      : AGENDA_DEFAULT.oraApertura,
    oraChiusura: typeof r.oraChiusura === 'string' && r.oraChiusura.match(/^\d{2}:\d{2}$/)
      ? r.oraChiusura
      : AGENDA_DEFAULT.oraChiusura,
    giorniLavorativi: giorni.length > 0 ? giorni : AGENDA_DEFAULT.giorniLavorativi,
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

/** Genera un ID univoco per una nuova categoria */
export function generaIdCategoria(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Genera un ID slug univoco per un nuovo operatore */
export function generaIdOperatore(nome: string): string {
  const slug = nome.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').slice(0, 15);
  return `${slug || 'op'}_${Math.random().toString(36).slice(2, 6)}`;
}
