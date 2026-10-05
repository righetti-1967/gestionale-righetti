/**
 * Analytics Clienti — Report statistiche
 *
 * Calcola:
 * - Report singolo cliente (spesa totale, passaggi, prodotti, servizi, %)
 * - Report aggregato periodo (clienti, passaggi, ranking, %)
 *
 * Fonti dati:
 * - scontrini (madre + figli)
 * - fatture (fatture)
 * - scarichi_seduta (DDT — esclusi dai totali fiscali, inclusi per passaggi)
 */
import { supabase } from './supabase';
import { getScontrini, type Scontrino, type RigaScontrino } from './scontrini';
import type { FatturaConCliente } from './fatture';

// ============================================================
// TIPI
// ============================================================

export interface ItemAggregato {
  nome: string;
  tipo: 'servizio' | 'prodotto';
  quantita: number;
  spesa: number;        // totale lordo speso per questo item
  percentuale: number;  // % sul totale del cliente
}

export interface ReportCliente {
  clienteId: number;
  nomeCliente: string;

  // Metriche base
  numeroScontrini: number;
  numeroFatture: number;
  numeroPassaggi: number;    // documenti distinti (scontrini+figli+fatture, esclusi DDT)

  // Totali
  spesaScontrini: number;
  spesaFatture: number;
  spesaTotale: number;

  // Medie
  scontrinoMedio: number;    // spesaTotale / numeroDocumenti
  fichesMedia: number;       // spesaTotale / totaleFiches
  totaleFiches: number;

  // Dettaglio items
  serviziAcquistati: ItemAggregato[];
  prodottiAcquistati: ItemAggregato[];

  // Percentuali
  percentualeServizi: number;
  percentualeProdotti: number;

  // Date
  primaSeduta: string | null;
  ultimaSeduta: string | null;
}

export interface ClienteRanking {
  clienteId: number;
  nomeCliente: string;
  spesaTotale: number;
  numeroPassaggi: number;
  scontrinoMedio: number;
  percentuale: number;  // % sul totale generale del periodo
}

export interface ReportAggregato {
  dataInizio: string;
  dataFine: string;

  // Metriche base
  numeroClientiTotali: number;
  numeroClientiPassati: number;
  numeroScontrini: number;
  numeroFatture: number;
  numeroPassaggi: number;

  // Totali
  spesaScontrini: number;
  spesaFatture: number;
  spesaTotale: number;

  // Medie
  scontrinoMedio: number;
  fichesMedia: number;
  totaleFiches: number;
  passaggiPerCliente: number;

  // Ranking
  clientiTop: ClienteRanking[];

  // Dettaglio items
  serviziAcquistati: ItemAggregato[];
  prodottiAcquistati: ItemAggregato[];

  // Percentuali
  percentualeServizi: number;
  percentualeProdotti: number;
}

// ============================================================
// HELPER
// ============================================================

function dataIt(dataISO: string): string {
  if (!dataISO) return '';
  try {
    return new Date(dataISO + 'T00:00:00').toLocaleDateString('it-IT');
  } catch {
    return dataISO;
  }
}

/** Arrotonda a 2 decimali */
function r2(n: number): number {
  return Number(n.toFixed(2));
}

// ============================================================
// REPORT SINGOLO CLIENTE
// ============================================================

export async function calcolaReportCliente(
  clienteId: number
): Promise<ReportCliente | null> {
  // 1. Carica cliente
  const { data: cliente } = await supabase
    .from('clienti')
    .select('id, nome_cognome')
    .eq('id', clienteId)
    .maybeSingle();

  if (!cliente) return null;

  // 2. Carica scontrini + fatture (in parallelo)
  const [tuttiScontrini, resFatture] = await Promise.all([
    getScontrini().catch(() => []),
    supabase
      .from('fatture')
      .select('*')
      .eq('cliente_id', clienteId),
  ]);
  const tutteFatture: any[] = resFatture.data || [];

  // 3. Filtra scontrini del cliente (madre + figli non annullati)
  const scontriniCliente = tuttiScontrini.filter(
    (s) => s.cliente_id === clienteId && !s.annullato
  );

  // Madre = fiscalmente rilevante
  const scontriniMadre = scontriniCliente.filter((s) => s.tipo === 'madre');

  // 4. Filtra fatture cliente
  const fattureCliente = tutteFatture.filter(
    (f: any) => f.cliente_id === clienteId
  );

  // 5. Calcola spesa totale
  const spesaScontrini = scontriniMadre.reduce(
    (sum, s) => sum + Number(s.totale_lordo || 0),
    0
  );
  const spesaFatture = fattureCliente.reduce(
    (sum: number, f: any) => sum + Number(f.lordo_ivato || 0),
    0
  );
  const spesaTotale = spesaScontrini + spesaFatture;

  // 6. Calcola passaggi (scontrini madre + figli + fatture)
  const numeroScontrini = scontriniCliente.length;
  const numeroFatture = fattureCliente.length;
  const numeroPassaggi = numeroScontrini + numeroFatture;

  // 7. Aggrega items (servizi + prodotti)
  const serviziMap = new Map<string, ItemAggregato>();
  const prodottiMap = new Map<string, ItemAggregato>();

  let totaleFiches = 0;

  // Da scontrini madre
  for (const s of scontriniMadre) {
    for (const r of s.righe || []) {
      if (r.quantita <= 0) continue;
      const tipo = r.tipo;
      const nome = r.nome;
      const qta = Number(r.quantita);
      const spesa = qta * Number(r.prezzo_unitario_lordo || 0);

      totaleFiches += qta;

      const map = tipo === 'servizio' ? serviziMap : prodottiMap;
      const esistente = map.get(nome);
      if (esistente) {
        esistente.quantita += qta;
        esistente.spesa += spesa;
      } else {
        map.set(nome, {
          nome,
          tipo,
          quantita: qta,
          spesa: r2(spesa),
          percentuale: 0, // calcolata dopo
        });
      }
    }
  }

  // Da fatture (righe JSON)
  for (const f of fattureCliente) {
    const righe = (f.righe || []) as any[];
    for (const r of righe) {
      if (r.tipo === 'percorso' || r.tipo === 'libera') continue; // skip righe generiche
      const tipo = r.tipo === 'servizio' ? 'servizio' : 'prodotto';
      const nome = r.nome || 'Voce';
      const qta = Number(r.quantita || 1);
      const spesa = qta * Number(r.prezzo_unitario_lordo || 0);

      totaleFiches += qta;

      const map = tipo === 'servizio' ? serviziMap : prodottiMap;
      const esistente = map.get(nome);
      if (esistente) {
        esistente.quantita += qta;
        esistente.spesa += spesa;
      } else {
        map.set(nome, {
          nome,
          tipo,
          quantita: qta,
          spesa: r2(spesa),
          percentuale: 0,
        });
      }
    }
  }

  // 8. Converti in array + ordina per spesa
  const serviziAcquistati = Array.from(serviziMap.values())
    .map((s) => ({
      ...s,
      spesa: r2(s.spesa),
      percentuale: spesaTotale > 0 ? r2((s.spesa / spesaTotale) * 100) : 0,
    }))
    .sort((a, b) => b.spesa - a.spesa);

  const prodottiAcquistati = Array.from(prodottiMap.values())
    .map((p) => ({
      ...p,
      spesa: r2(p.spesa),
      percentuale: spesaTotale > 0 ? r2((p.spesa / spesaTotale) * 100) : 0,
    }))
    .sort((a, b) => b.spesa - a.spesa);

  // 9. Percentuali servizi vs prodotti
  const totServizi = serviziAcquistati.reduce((sum, s) => sum + s.spesa, 0);
  const totProdotti = prodottiAcquistati.reduce((sum, p) => sum + p.spesa, 0);
  const percentualeServizi = spesaTotale > 0 ? r2((totServizi / spesaTotale) * 100) : 0;
  const percentualeProdotti = spesaTotale > 0 ? r2((totProdotti / spesaTotale) * 100) : 0;

  // 10. Date
  const dateScontrini = scontriniCliente.map((s) => s.data_emissione);
  const dateFatture = fattureCliente.map((f: any) => f.data_inizio || f.created_at);
  const tutteDate = [...dateScontrini, ...dateFatture].filter(Boolean).sort();

  const primaSeduta = tutteDate.length > 0 ? tutteDate[0] : null;
  const ultimaSeduta = tutteDate.length > 0 ? tutteDate[tutteDate.length - 1] : null;

  // 11. Medie
  const numeroDocumenti = scontriniMadre.length + fattureCliente.length;
  const scontrinoMedio = numeroDocumenti > 0 ? r2(spesaTotale / numeroDocumenti) : 0;
  const fichesMedia = totaleFiches > 0 ? r2(spesaTotale / totaleFiches) : 0;

  return {
    clienteId,
    nomeCliente: cliente.nome_cognome,
    numeroScontrini,
    numeroFatture,
    numeroPassaggi,
    spesaScontrini: r2(spesaScontrini),
    spesaFatture: r2(spesaFatture),
    spesaTotale: r2(spesaTotale),
    scontrinoMedio,
    fichesMedia,
    totaleFiches,
    serviziAcquistati,
    prodottiAcquistati,
    percentualeServizi,
    percentualeProdotti,
    primaSeduta,
    ultimaSeduta,
  };
}

// ============================================================
// REPORT AGGREGATO PERIODO
// ============================================================

export async function calcolaReportAggregato(
  dataInizio: string,
  dataFine: string
): Promise<ReportAggregato> {
  // 1. Carica scontrini + fatture del periodo
  const [tuttiScontrini, resFatture] = await Promise.all([
    getScontrini({ dataInizio, dataFine }).catch(() => []),
    supabase
      .from('fatture')
      .select('*')
      .gte('data_inizio', dataInizio)
      .lte('data_inizio', dataFine),
  ]);
  const tutteFattureRaw: any[] = resFatture.data || [];

  // 2. Filtra madre non annullati + figli
  const scontriniPeriodo = tuttiScontrini.filter((s) => !s.annullato);
  const scontriniMadre = scontriniPeriodo.filter((s) => s.tipo === 'madre');

  const fatturePeriodo = tutteFattureRaw;

  // 3. Spese
  const spesaScontrini = scontriniMadre.reduce(
    (sum, s) => sum + Number(s.totale_lordo || 0),
    0
  );
  const spesaFatture = fatturePeriodo.reduce(
    (sum: number, f: any) => sum + Number(f.lordo_ivato || 0),
    0
  );
  const spesaTotale = spesaScontrini + spesaFatture;

  // 4. Clienti e passaggi
  const clientiSet = new Set<number>();
  for (const s of scontriniPeriodo) {
    if (s.cliente_id) clientiSet.add(s.cliente_id);
  }
  for (const f of fatturePeriodo) {
    if (f.cliente_id) clientiSet.add(f.cliente_id);
  }
  const numeroClientiPassati = clientiSet.size;

  // Totale clienti in archivio
  const resClientiCount = await supabase
    .from('clienti')
    .select('id', { count: 'exact', head: true });
  const numeroClientiTotali = resClientiCount.count || 0;

  const numeroPassaggi = scontriniPeriodo.length + fatturePeriodo.length;
  const numeroScontrini = scontriniPeriodo.length;
  const numeroFatture = fatturePeriodo.length;

  // 5. Aggrega items
  const serviziMap = new Map<string, ItemAggregato>();
  const prodottiMap = new Map<string, ItemAggregato>();
  let totaleFiches = 0;

  // Da scontrini madre
  for (const s of scontriniMadre) {
    for (const r of s.righe || []) {
      if (r.quantita <= 0) continue;
      const tipo = r.tipo;
      const nome = r.nome;
      const qta = Number(r.quantita);
      const spesa = qta * Number(r.prezzo_unitario_lordo || 0);

      totaleFiches += qta;

      const map = tipo === 'servizio' ? serviziMap : prodottiMap;
      const esistente = map.get(nome);
      if (esistente) {
        esistente.quantita += qta;
        esistente.spesa += spesa;
      } else {
        map.set(nome, {
          nome,
          tipo,
          quantita: qta,
          spesa: r2(spesa),
          percentuale: 0,
        });
      }
    }
  }

  // Da fatture
  for (const f of fatturePeriodo) {
    const righe = (f.righe || []) as any[];
    for (const r of righe) {
      if (r.tipo === 'percorso' || r.tipo === 'libera') continue;
      const tipo = r.tipo === 'servizio' ? 'servizio' : 'prodotto';
      const nome = r.nome || 'Voce';
      const qta = Number(r.quantita || 1);
      const spesa = qta * Number(r.prezzo_unitario_lordo || 0);

      totaleFiches += qta;

      const map = tipo === 'servizio' ? serviziMap : prodottiMap;
      const esistente = map.get(nome);
      if (esistente) {
        esistente.quantita += qta;
        esistente.spesa += spesa;
      } else {
        map.set(nome, {
          nome,
          tipo,
          quantita: qta,
          spesa: r2(spesa),
          percentuale: 0,
        });
      }
    }
  }

  const serviziAcquistati = Array.from(serviziMap.values())
    .map((s) => ({
      ...s,
      spesa: r2(s.spesa),
      percentuale: spesaTotale > 0 ? r2((s.spesa / spesaTotale) * 100) : 0,
    }))
    .sort((a, b) => b.spesa - a.spesa);

  const prodottiAcquistati = Array.from(prodottiMap.values())
    .map((p) => ({
      ...p,
      spesa: r2(p.spesa),
      percentuale: spesaTotale > 0 ? r2((p.spesa / spesaTotale) * 100) : 0,
    }))
    .sort((a, b) => b.spesa - a.spesa);

  const totServizi = serviziAcquistati.reduce((sum, s) => sum + s.spesa, 0);
  const totProdotti = prodottiAcquistati.reduce((sum, p) => sum + p.spesa, 0);
  const percentualeServizi = spesaTotale > 0 ? r2((totServizi / spesaTotale) * 100) : 0;
  const percentualeProdotti = spesaTotale > 0 ? r2((totProdotti / spesaTotale) * 100) : 0;

  // 6. Ranking clienti
  const spesaPerCliente = new Map<number, { spesa: number; passaggi: number }>();

  for (const s of scontriniMadre) {
    if (!s.cliente_id) continue;
    const attuale = spesaPerCliente.get(s.cliente_id) || { spesa: 0, passaggi: 0 };
    attuale.spesa += Number(s.totale_lordo || 0);
    attuale.passaggi += 1;
    spesaPerCliente.set(s.cliente_id, attuale);
  }
  for (const f of fatturePeriodo) {
    if (!f.cliente_id) continue;
    const attuale = spesaPerCliente.get(f.cliente_id) || { spesa: 0, passaggi: 0 };
    attuale.spesa += Number(f.lordo_ivato || 0);
    attuale.passaggi += 1;
    spesaPerCliente.set(f.cliente_id, attuale);
  }

  // Carica nomi clienti
  const clientiIds = Array.from(spesaPerCliente.keys());
  let nomiClienti = new Map<number, string>();
  if (clientiIds.length > 0) {
    const { data: clientiData } = await supabase
      .from('clienti')
      .select('id, nome_cognome')
      .in('id', clientiIds);
    for (const c of clientiData || []) {
      nomiClienti.set(c.id, c.nome_cognome);
    }
  }

  const clientiTop: ClienteRanking[] = Array.from(spesaPerCliente.entries())
    .map(([id, v]) => ({
      clienteId: id,
      nomeCliente: nomiClienti.get(id) || 'Cliente',
      spesaTotale: r2(v.spesa),
      numeroPassaggi: v.passaggi,
      scontrinoMedio: v.passaggi > 0 ? r2(v.spesa / v.passaggi) : 0,
      percentuale: spesaTotale > 0 ? r2((v.spesa / spesaTotale) * 100) : 0,
    }))
    .sort((a, b) => b.spesaTotale - a.spesaTotale);

  // 7. Medie
  const numeroDocumenti = scontriniMadre.length + fatturePeriodo.length;
  const scontrinoMedio = numeroDocumenti > 0 ? r2(spesaTotale / numeroDocumenti) : 0;
  const fichesMedia = totaleFiches > 0 ? r2(spesaTotale / totaleFiches) : 0;
  const passaggiPerCliente = numeroClientiPassati > 0 ? r2(numeroPassaggi / numeroClientiPassati) : 0;

  return {
    dataInizio,
    dataFine,
    numeroClientiTotali: numeroClientiTotali || 0,
    numeroClientiPassati,
    numeroScontrini,
    numeroFatture,
    numeroPassaggi,
    spesaScontrini: r2(spesaScontrini),
    spesaFatture: r2(spesaFatture),
    spesaTotale: r2(spesaTotale),
    scontrinoMedio,
    fichesMedia,
    totaleFiches,
    passaggiPerCliente,
    clientiTop,
    serviziAcquistati,
    prodottiAcquistati,
    percentualeServizi,
    percentualeProdotti,
  };
}

// ============================================================
// HELPER PERIODI
// ============================================================

export function settimanaCorrente(): { inizio: string; fine: string } {
  const oggi = new Date();
  const giornoSettimana = oggi.getDay(); // 0=Dom
  const diff = giornoSettimana === 0 ? 6 : giornoSettimana - 1; // Lunedì = inizio
  const lunedi = new Date(oggi);
  lunedi.setDate(oggi.getDate() - diff);
  const domenica = new Date(lunedi);
  domenica.setDate(lunedi.getDate() + 6);

  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const g = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${g}`;
  };

  return { inizio: toISO(lunedi), fine: toISO(domenica) };
}

export function meseCorrente(): { inizio: string; fine: string } {
  const oggi = new Date();
  const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  const fine = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const g = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${g}`;
  };
  return { inizio: toISO(inizio), fine: toISO(fine) };
}

export function annoCorrente(): { inizio: string; fine: string } {
  const anno = new Date().getFullYear();
  return {
    inizio: `${anno}-01-01`,
    fine: `${anno}-12-31`,
  };
}


// ============================================================
// HELPER: KPI rapidi cliente (per card in scheda cliente)
// ============================================================

export interface KpiCliente {
  spesaScontrini: number;
  spesaFatture: number;
  spesaTotale: number;
  numeroDocumenti: number;
  totaleFiches: number;
  fichesMedia: number;
  scontrinoMedio: number;
}

export async function getKpiCliente(clienteId: number): Promise<KpiCliente> {
  const [tuttiScontrini, resFatture] = await Promise.all([
    getScontrini().catch(() => []),
    supabase
      .from('fatture')
      .select('*')
      .eq('cliente_id', clienteId),
  ]);

  const fattureCliente: any[] = resFatture.data || [];

  const scontriniCliente = tuttiScontrini.filter(
    (s) => s.cliente_id === clienteId && !s.annullato
  );
  const scontriniMadre = scontriniCliente.filter((s) => s.tipo === 'madre');

  const spesaScontrini = scontriniMadre.reduce(
    (sum, s) => sum + Number(s.totale_lordo || 0),
    0
  );
  const spesaFatture = fattureCliente.reduce(
    (sum: number, f: any) => sum + Number(f.lordo_ivato || 0),
    0
  );
  const spesaTotale = spesaScontrini + spesaFatture;

  let totaleFiches = 0;

  for (const s of scontriniMadre) {
    for (const r of s.righe || []) {
      totaleFiches += Number(r.quantita || 0);
    }
  }

  for (const f of fattureCliente) {
    const righe = (f.righe || []) as any[];
    for (const r of righe) {
      totaleFiches += Number(r.quantita || 0);
    }
  }

  const numeroDocumenti = scontriniMadre.length + fattureCliente.length;
  const scontrinoMedio = numeroDocumenti > 0 ? Number((spesaTotale / numeroDocumenti).toFixed(2)) : 0;
  const fichesMedia = totaleFiches > 0 ? Number((spesaTotale / totaleFiches).toFixed(2)) : 0;

  return {
    spesaScontrini: Number(spesaScontrini.toFixed(2)),
    spesaFatture: Number(spesaFatture.toFixed(2)),
    spesaTotale: Number(spesaTotale.toFixed(2)),
    numeroDocumenti,
    totaleFiches,
    fichesMedia,
    scontrinoMedio,
  };
}
