/**
 * Configurazione Economia per operatore + costi fissi azienda.
 * Salvata in `impostazioni` (tabella Supabase) come JSON.
 */
import { supabase } from './supabase';
import { getAppuntamenti, type AppuntamentoConCliente } from './appuntamenti';
import { getServizi } from './servizi';
import { getProdotti } from './prodotti';

// ============================================================
// TIPI
// ============================================================

export interface EconomiaOperatore {
  operatore_id: string;          // "luca", "lorenzo", ecc.
  tipo: 'dipendente' | 'titolare' | 'collaboratore';
  busta_paga_lorda: number;      // € mensili lordi (dipendente/collaboratore)
  busta_paga_netta: number;      // € mensili netti
  contributi_pct: number;        // % INPS (dipendente/collaboratore)
  contributi_fissi_mensili: number; // € contributi fissi mensili (titolare)
  tfr_pct: number;               // % TFR (es. 7)
  ore_settimanali: number;       // es. 40
  giorni_settimanali: number;    // es. 5
  note: string;
}

export interface ConfigCostiFissi {
  categorie_fisse: string[];     // es. ['Affitto', 'Utenze', 'Stipendi', 'Assicurazioni']
  aliquota_titolare_pct: number; // % contributi titolare (es. 26)
}

export interface KpiOperatore {
  operatore_id: string;
  operatore_label: string;
  ricavo: number;
  costo: number;
  margine: number;
  ore_lavorate: number;
  costo_orario: number;
  ricavo_orario: number;
  margine_orario: number;
  num_appuntamenti: number;
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
  const costoMensile = calcolaCostoMensile(op);
  return Math.round((costoMensile / oreMese) * 100) / 100;
}

export function calcolaCostoMensile(op: EconomiaOperatore): number {
  if (op.tipo === 'titolare') {
    // Titolare: se ha anche busta paga dipendente, somma entrambi
    const lordoDipendente = op.busta_paga_lorda || 0;
    const contributiDipendente = lordoDipendente * (op.contributi_pct || 0) / 100;
    const tfrDipendente = lordoDipendente * (op.tfr_pct || 0) / 100;
    const quotaTitolare = op.contributi_fissi_mensili || 0;
    
    // Se ha busta paga lorda > 0 → è anche dipendente
    if (lordoDipendente > 0) {
      return Math.round((lordoDipendente + contributiDipendente + tfrDipendente + quotaTitolare) * 100) / 100;
    }
    // Solo titolare (senza busta paga)
    return Math.round((op.busta_paga_netta + quotaTitolare) * 100) / 100;
  }
  // Dipendente/Collaboratore
  return Math.round(op.busta_paga_lorda * (1 + op.contributi_pct / 100 + op.tfr_pct / 100) * 100) / 100;
}


// ============================================================
// KPI OPERATORI (Ricavo / Costo / Margine)
// ============================================================

/**
 * Calcola ricavo, costo, margine per ogni operatore nel periodo.
 * - Ricavo: da voci_selezionate degli appuntamenti completati (lookup prezzo)
 * - Costo: da configurazione economia (costo mensile * mesi nel periodo)
 * - Ore lavorate: somma durata_minuti delle voci per operatore
 */
export async function calcolaKpiOperatori(
  config: ConfigEconomia,
  dataInizio: string,
  dataFine: string
): Promise<KpiOperatore[]> {
  // Calcola mesi nel periodo (per moltiplicare costo mensile)
  const dataI = new Date(dataInizio + 'T00:00:00');
  const dataF = new Date(dataFine + 'T00:00:00');
  const giorniPeriodo = Math.max(1, Math.ceil((dataF.getTime() - dataI.getTime()) / (1000 * 60 * 60 * 24)));
  const mesiPeriodo = giorniPeriodo / 30;

  // Carica catalogo servizi e prodotti per lookup prezzi
  const [servizi, prodotti] = await Promise.all([
    getServizi().catch(() => []),
    getProdotti().catch(() => []),
  ]);
  const prezzoServizi = new Map(servizi.map((s) => [s.id, Number(s.prezzo_lordo || 0)]));
  const prezzoProdotti = new Map(prodotti.map((p) => [p.id, Number(p.prezzo_lordo || 0)]));

  // Carica appuntamenti del periodo
  const appuntamenti = await getAppuntamenti(dataInizio, dataFine).catch(() => []);

  // Aggrega per operatore
  const aggregati: Record<string, { ricavo: number; minuti: number; numApp: number }> = {};

  for (const app of appuntamenti) {
    // Salta cancellati/blocchi
    if (app.stato === 'cancellato' || app.is_blocco) continue;

    const voci = app.voci_selezionate || [];
    if (voci.length === 0) continue;

    for (const v of voci) {
      const opId = v.operatore || app.operatore;
      if (!opId) continue;

      if (!aggregati[opId]) {
        aggregati[opId] = { ricavo: 0, minuti: 0, numApp: 0 };
      }

      // Calcola ricavo voce
      let prezzo = 0;
      if (v.tipo === 'servizio' && v.servizio_id) {
        prezzo = (prezzoServizi.get(v.servizio_id) || 0) * (v.quantita || 1);
      } else if (v.tipo === 'prodotto' && v.prodotto_id) {
        prezzo = (prezzoProdotti.get(v.prodotto_id) || 0) * (v.quantita || 1);
      }

      aggregati[opId].ricavo += prezzo;
      aggregati[opId].minuti += v.durata_minuti || 0;
    }

    // Conta 1 appuntamento (non per voce)
    const opMain = app.operatore;
    if (opMain && aggregati[opMain]) {
      aggregati[opMain].numApp += 1;
    }
  }

  // Costruisci KPI per ogni operatore configurato
  return config.operatori.map((op) => {
    const agg = aggregati[op.operatore_id] || { ricavo: 0, minuti: 0, numApp: 0 };
    const costoMensile = calcolaCostoMensile(op);
    const costoPeriodo = costoMensile * mesiPeriodo;
    const oreLavorate = Math.round((agg.minuti / 60) * 10) / 10;
    const margine = agg.ricavo - costoPeriodo;

    // Nome operatore (da agenda-config, ma qui non lo abbiamo → uso operatore_id)
    return {
      operatore_id: op.operatore_id,
      operatore_label: op.operatore_id.charAt(0).toUpperCase() + op.operatore_id.slice(1),
      ricavo: Math.round(agg.ricavo * 100) / 100,
      costo: Math.round(costoPeriodo * 100) / 100,
      margine: Math.round(margine * 100) / 100,
      ore_lavorate: oreLavorate,
      costo_orario: oreLavorate > 0 ? Math.round((costoPeriodo / oreLavorate) * 100) / 100 : 0,
      ricavo_orario: oreLavorate > 0 ? Math.round((agg.ricavo / oreLavorate) * 100) / 100 : 0,
      margine_orario: oreLavorate > 0 ? Math.round((margine / oreLavorate) * 100) / 100 : 0,
      num_appuntamenti: agg.numApp,
    };
  });
}
