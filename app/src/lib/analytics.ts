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

  // KPI Clienti (nuovi)
  nuoviClienti: number;              // clienti creati nel periodo
  frequenzaRitornoMedia: number | null;  // giorni medi tra visite (per clienti con ≥2 passaggi)
  clientiDormienti: number;          // clienti senza passaggi da 90gg
  clientiPersi: number;              // clienti senza passaggi da 180gg

  // KPI Agenda (nuovi)
  minutiDisponibili: number;         // slot totali disponibili nel periodo
  minutiOccupati: number;            // minuti effettivi di appuntamenti
  tassoOccupazione: number;          // % occupazione (0-100)
  minutiLiberi: number;              // slot ancora disponibili

  // KPI Economia (nuovi)
  totaleSpese: number;
  margineLordo: number;
  margineLordoPct: number;
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
  dataFine: string,
  opzioni?: {
    sogliaDormienti?: number;
    sogliaPersi?: number;
    operatore?: string;
  }
): Promise<ReportAggregato> {
  const sogliaDormienti = opzioni?.sogliaDormienti ?? 90;
  const sogliaPersi = opzioni?.sogliaPersi ?? 180;
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

  // PASSAGGI: raggruppa per (cliente_id, data) → 1 cliente in 1 giorno = 1 passaggio
  // (indipendentemente da quante fiche/documenti emette)
  const passaggiSet = new Set<string>();
  const chiavePassaggio = (clienteId: number | null | undefined, data: string | null | undefined): string | null => {
    if (!clienteId || !data) return null;
    // Normalizza la data a YYYY-MM-DD (alcuni record potrebbero avere timestamp)
    const soloData = String(data).split('T')[0].split(' ')[0];
    return `${clienteId}_${soloData}`;
  };

  for (const s of scontriniPeriodo) {
    const k = chiavePassaggio(s.cliente_id, (s as any).data_emissione || (s as any).data);
    if (k) passaggiSet.add(k);
  }
  for (const f of fatturePeriodo) {
    const k = chiavePassaggio(f.cliente_id, f.data_inizio);
    if (k) passaggiSet.add(k);
  }

  const numeroPassaggi = passaggiSet.size;
  const numeroScontrini = scontriniPeriodo.length;
  const numeroFatture = fatturePeriodo.length;

  // ============================================================
  // KPI CLIENTI (nuovi clienti, frequenza, dormienti, persi)
  // ============================================================

  // 1. Nuovi clienti nel periodo (per created_at)
  const resNuovi = await supabase
    .from('clienti')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', dataInizio)
    .lte('created_at', dataFine + 'T23:59:59');
  const nuoviClienti = resNuovi.count || 0;

  // 2. Frequenza di ritorno: giorni medi tra visite (per clienti con ≥2 passaggi nel periodo)
  const datePerCliente = new Map<number, string[]>();
  for (const s of scontriniPeriodo) {
    if (!s.cliente_id) continue;
    const data = ((s as any).data_emissione || (s as any).data || '').split('T')[0];
    if (!data) continue;
    if (!datePerCliente.has(s.cliente_id)) datePerCliente.set(s.cliente_id, []);
    datePerCliente.get(s.cliente_id)!.push(data);
  }
  for (const f of fatturePeriodo) {
    if (!f.cliente_id) continue;
    const data = (f.data_inizio || '').split('T')[0];
    if (!data) continue;
    if (!datePerCliente.has(f.cliente_id)) datePerCliente.set(f.cliente_id, []);
    datePerCliente.get(f.cliente_id)!.push(data);
  }

  // Calcola differenze tra date consecutive per ogni cliente
  let sommaGiorni = 0;
  let numIntervalli = 0;
  for (const [_cliId, dateList] of datePerCliente.entries()) {
    const dateUniche = Array.from(new Set(dateList)).sort();
    if (dateUniche.length < 2) continue;
    for (let i = 1; i < dateUniche.length; i++) {
      const d1 = new Date(dateUniche[i - 1] + 'T00:00:00').getTime();
      const d2 = new Date(dateUniche[i] + 'T00:00:00').getTime();
      sommaGiorni += (d2 - d1) / (1000 * 60 * 60 * 24);
      numIntervalli++;
    }
  }
  const frequenzaRitornoMedia = numIntervalli > 0
    ? Math.round((sommaGiorni / numIntervalli) * 10) / 10
    : null;

  // 3. Clienti dormienti (90gg) e persi (180gg)
  // Strategia: per ogni cliente in archivio, prendi ultimo passaggio (scontrino o fattura).
  // Se non c'è passaggio da 90gg (ma ce n'è stato uno), è dormiente. Se >180gg, è perso.
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const soglia90 = new Date(oggi.getTime() - sogliaDormienti * 24 * 60 * 60 * 1000);
  const soglia180 = new Date(oggi.getTime() - sogliaPersi * 24 * 60 * 60 * 1000);

  // Carica tutti gli scontrini (madre) + fatture dell'utente per trovare ultimo passaggio
  const [resTuttiScontrini, resTutteFatture] = await Promise.all([
    supabase.from('scontrini').select('cliente_id, data_emissione').eq('tipo', 'madre').not('annullato', 'is', true),
    supabase.from('fatture').select('cliente_id, data_inizio'),
  ]);

  const ultimoPassaggioPerCliente = new Map<number, string>();
  const aggiornaUltimo = (clienteId: number | null, data: string | null) => {
    if (!clienteId || !data) return;
    const soloData = data.split('T')[0].split(' ')[0];
    const attuale = ultimoPassaggioPerCliente.get(clienteId);
    if (!attuale || soloData > attuale) {
      ultimoPassaggioPerCliente.set(clienteId, soloData);
    }
  };
  for (const s of (resTuttiScontrini.data || []) as any[]) {
    aggiornaUltimo(s.cliente_id, s.data_emissione);
  }
  for (const f of (resTutteFatture.data || []) as any[]) {
    aggiornaUltimo(f.cliente_id, f.data_inizio);
  }

  const resTuttiClienti = await supabase.from('clienti').select('id');
  let clientiDormienti = 0;
  let clientiPersi = 0;
  for (const c of (resTuttiClienti.data || []) as any[]) {
    const ultimo = ultimoPassaggioPerCliente.get(c.id);
    if (!ultimo) continue; // cliente mai passato → non è "dormiente" né "perso" (è nuovo)
    const dUltimo = new Date(ultimo + 'T00:00:00');
    if (dUltimo < soglia180) clientiPersi++;
    else if (dUltimo < soglia90) clientiDormienti++;
  }

  // ============================================================
  // KPI OCCUPAZIONE AGENDA
  // ============================================================
  const { getAgendaConfigSync } = await import('./agenda-config');
  const agendaConfig = getAgendaConfigSync();

  // Calcola minuti disponibili nel periodo (giorni lavorativi × ore/giorno × 60)
  const [oraAperturaH, oraAperturaM] = (agendaConfig.oraApertura || '09:00').split(':').map(Number);
  const [oraChiusuraH, oraChiusuraM] = (agendaConfig.oraChiusura || '18:00').split(':').map(Number);
  const minutiAlGiorno = (oraChiusuraH * 60 + oraChiusuraM) - (oraAperturaH * 60 + oraAperturaM);
  const giorniLavorativi = agendaConfig.giorniLavorativi || [2, 3, 4, 5, 6];

  // Conta giorni lavorativi nel periodo
  let giorniLavorativiNelPeriodo = 0;
  const dataInizioDate = new Date(dataInizio + 'T00:00:00');
  const dataFineDate = new Date(dataFine + 'T00:00:00');
  const dataCorrente = new Date(dataInizioDate);
  while (dataCorrente <= dataFineDate) {
    if (giorniLavorativi.includes(dataCorrente.getDay())) {
      giorniLavorativiNelPeriodo++;
    }
    dataCorrente.setDate(dataCorrente.getDate() + 1);
  }

  const minutiDisponibili = giorniLavorativiNelPeriodo * minutiAlGiorno;

  // Carica appuntamenti del periodo (esclusi blocchi)
  let queryAppuntamenti = supabase
    .from('appuntamenti')
    .select('durata_minuti, is_blocco, stato, operatore')
    .gte('data', dataInizio)
    .lte('data', dataFine)
    .neq('stato', 'cancellato')
    .neq('is_blocco', true);

  if (opzioni?.operatore) {
    queryAppuntamenti = queryAppuntamenti.eq('operatore', opzioni.operatore);
  }

  const resAppuntamenti = await queryAppuntamenti;

  const minutiOccupati = (resAppuntamenti.data || []).reduce(
    (sum: number, a: any) => sum + Number(a.durata_minuti || 0),
    0
  );

  const tassoOccupazione = minutiDisponibili > 0
    ? Math.round((minutiOccupati / minutiDisponibili) * 1000) / 10
    : 0;

  const minutiLiberi = Math.max(0, minutiDisponibili - minutiOccupati);

  // ============================================================
  // KPI ECONOMIA (Margine Lordo)
  // ============================================================
  let totaleSpese = 0;
  try {
    const { getTotaleSpesePeriodo } = await import('./spese');
    const user = await supabase.auth.getUser();
    if (user.data.user) {
      totaleSpese = await getTotaleSpesePeriodo(user.data.user.id, dataInizio, dataFine);
    }
  } catch (e) {
    console.error('Errore caricamento spese per margine:', e);
  }

  const margineLordo = spesaTotale - totaleSpese;
  const margineLordoPct = spesaTotale > 0 ? Math.round((margineLordo / spesaTotale) * 1000) / 10 : 0;

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

    // KPI Clienti
    nuoviClienti,
    frequenzaRitornoMedia,
    clientiDormienti,
    clientiPersi,
    minutiDisponibili,
    minutiOccupati,
    tassoOccupazione,
    minutiLiberi,
    totaleSpese,
    margineLordo,
    margineLordoPct,
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
