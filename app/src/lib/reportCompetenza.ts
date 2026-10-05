/**
 * Report Competenza — Percorsi prepagati
 *
 * Per SRL in regime di competenza:
 * - Venduto nell'anno = scontrini madre emessi nell'anno
 * - Utilizzato nell'anno = scontrini figli (riscatti) nell'anno
 * - Risconto passivo = Venduto - Utilizzato (debito verso cliente al 31/12)
 *
 * Distingue:
 * - Percorsi venduti nell'anno di riferimento
 * - Percorsi venduti in anni precedenti ma ancora aperti
 */
import { supabase } from './supabase';
import { getScontrini, type Scontrino } from './scontrini';
import { getPercorsiCliente } from './percorsi';

// ============================================================
// TIPI
// ============================================================

export interface DettaglioPercorso {
  percorsoId: number;
  nomePercorso: string;
  clienteId: number;
  nomeCliente: string;
  dataVendita: string;
  anno: number;
  venduto: number;
  utilizzato: number;
  residuo: number;
}

export interface RigaCliente {
  clienteId: number;
  nomeCliente: string;
  venduto: number;
  utilizzato: number;
  residuo: number;
  numeroPercorsi: number;
}

export interface ReportCompetenza {
  anno: number;
  dataInizio: string;
  dataFine: string;

  // Totali
  totaleVenduto: number;
  totaleUtilizzato: number;
  totaleResiduo: number;

  // Clienti (raggruppati)
  righeCliente: RigaCliente[];

  // Dettaglio percorsi venduti nell'anno
  percorsiAnnoCorrente: DettaglioPercorso[];

  // Dettaglio percorsi aperti da anni precedenti
  percorsiPrecedenti: DettaglioPercorso[];

  // Totali anni precedenti
  totaleResiduoPrecedenti: number;
}

// ============================================================
// CALCOLO
// ============================================================

export async function calcolaReportCompetenza(
  anno: number
): Promise<ReportCompetenza> {
  const dataInizio = `${anno}-01-01`;
  const dataFine = `${anno}-12-31`;

  // 1. Carico scontrini madre + figli dell'anno (inclusi annullati, filtrati dopo)
  const tuttiScontrini = await getScontrini({
    dataInizio,
    dataFine,
  });

  const scontriniAttivi = tuttiScontrini.filter((s) => !s.annullato);

  const madri = scontriniAttivi.filter((s) => s.tipo === 'madre');
  const figli = scontriniAttivi.filter((s) => s.tipo === 'figlio');

  // 2. Carico tutti i percorsi
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data: percorsi } = await supabase
    .from('percorsi')
    .select('*')
    .eq('user_id', user.id);

  const tuttiPercorsi = percorsi || [];

  // 3. Carico tutti i clienti
  const { data: clienti } = await supabase
    .from('clienti')
    .select('id, nome_cognome')
    .eq('user_id', user.id);

  const clientiById = new Map<number, string>();
  for (const c of clienti || []) {
    clientiById.set(c.id, c.nome_cognome);
  }

  // 4. Mappa madre per ID (per lookup veloce)
  const madreById = new Map<number, Scontrino>();
  for (const m of madri) {
    madreById.set(m.id, m);
  }

  // 5. Per ogni percorso, calcolo venduto e utilizzato (dai figli collegati)
  const percorsiDettagli: DettaglioPercorso[] = [];

  for (const p of tuttiPercorsi) {
    // Solo percorsi legati a scontrini (regime scontrini)
    if (!p.scontrino_madre_id) continue;

    const madre = madreById.get(p.scontrino_madre_id);
    if (!madre) continue; // madre non nell'anno di riferimento (potrebbe essere precedente)

    // Venduto = totale madre
    const venduto = Number(madre.totale_lordo || 0);

    // Utilizzato = somma righe positive dei figli collegati al madre
    const figliDelPercorso = figli.filter((f) => f.scontrino_madre_id === madre.id);

    let utilizzato = 0;
    for (const f of figliDelPercorso) {
      for (const r of f.righe || []) {
        // Solo righe positive (riscatti), non righe storno
        if (r.quantita > 0 && !r.nome.startsWith('Storno percorso')) {
          utilizzato += r.quantita * r.prezzo_unitario_lordo;
        }
      }
    }

    utilizzato = Number(utilizzato.toFixed(2));
    const residuo = Number((venduto - utilizzato).toFixed(2));

    // Anno di vendita (dal madre)
    const dataVendita = madre.data_emissione;
    const annoVendita = new Date(dataVendita).getFullYear();

    percorsiDettagli.push({
      percorsoId: p.id,
      nomePercorso: p.nome,
      clienteId: p.cliente_id,
      nomeCliente: clientiById.get(p.cliente_id) || 'Cliente',
      dataVendita,
      anno: annoVendita,
      venduto,
      utilizzato,
      residuo: Math.max(0, residuo),
    });
  }

  // 6. Carico TUTTI gli scontrini (non solo anno corrente) per trovare i percorsi
  //    venduti in anni precedenti ma ancora aperti
  const tuttiMadriStorico = await getScontrini().catch(() => []);
  const madriStorico = tuttiMadriStorico.filter(
    (s) => s.tipo === 'madre' && !s.annullato
  );

  // Trovo madri di anni precedenti con percorsi ancora aperti
  const percorsiVecchi: DettaglioPercorso[] = [];

  for (const m of madriStorico) {
    const annoMadre = new Date(m.data_emissione).getFullYear();
    if (annoMadre >= anno) continue; // skip anno corrente o futuri

    // Trovo percorso collegato
    const percorsoColl = tuttiPercorsi.find((p) => p.scontrino_madre_id === m.id);
    if (!percorsoColl) continue;

    // Verifico se ha residuo
    const figliVecchi = tuttiMadriStorico.filter(
      (f) => f.tipo === 'figlio' && !f.annullato && f.scontrino_madre_id === m.id
    );

    let utilizzatoVecchio = 0;
    for (const f of figliVecchi) {
      for (const r of f.righe || []) {
        if (r.quantita > 0 && !r.nome.startsWith('Storno percorso')) {
          utilizzatoVecchio += r.quantita * r.prezzo_unitario_lordo;
        }
      }
    }

    const vendutoVecchio = Number(m.totale_lordo || 0);
    const residuoVecchio = Number((vendutoVecchio - utilizzatoVecchio).toFixed(2));

    if (residuoVecchio > 0.01) {
      percorsiVecchi.push({
        percorsoId: percorsoColl.id,
        nomePercorso: percorsoColl.nome,
        clienteId: m.cliente_id ?? 0,
        nomeCliente: clientiById.get(m.cliente_id ?? 0) || 'Cliente',
        dataVendita: m.data_emissione,
        anno: annoMadre,
        venduto: vendutoVecchio,
        utilizzato: Number(utilizzatoVecchio.toFixed(2)),
        residuo: residuoVecchio,
      });
    }
  }

  // 7. Totali
  const totaleVenduto = percorsiDettagli.reduce((s, p) => s + p.venduto, 0);
  const totaleUtilizzato = percorsiDettagli.reduce((s, p) => s + p.utilizzato, 0);
  const totaleResiduo = Number((totaleVenduto - totaleUtilizzato).toFixed(2));
  const totaleResiduoPrecedenti = percorsiVecchi.reduce((s, p) => s + p.residuo, 0);

  // 8. Raggruppa per cliente
  const clienteMap = new Map<number, RigaCliente>();

  for (const p of percorsiDettagli) {
    const esistente = clienteMap.get(p.clienteId);
    if (esistente) {
      esistente.venduto += p.venduto;
      esistente.utilizzato += p.utilizzato;
      esistente.residuo += p.residuo;
      esistente.numeroPercorsi += 1;
    } else {
      clienteMap.set(p.clienteId, {
        clienteId: p.clienteId,
        nomeCliente: p.nomeCliente,
        venduto: p.venduto,
        utilizzato: p.utilizzato,
        residuo: p.residuo,
        numeroPercorsi: 1,
      });
    }
  }

  const righeCliente: RigaCliente[] = Array.from(clienteMap.values())
    .map((r) => ({
      ...r,
      venduto: Number(r.venduto.toFixed(2)),
      utilizzato: Number(r.utilizzato.toFixed(2)),
      residuo: Number(r.residuo.toFixed(2)),
    }))
    .sort((a, b) => b.residuo - a.residuo);

  return {
    anno,
    dataInizio,
    dataFine,
    totaleVenduto: Number(totaleVenduto.toFixed(2)),
    totaleUtilizzato: Number(totaleUtilizzato.toFixed(2)),
    totaleResiduo,
    righeCliente,
    percorsiAnnoCorrente: percorsiDettagli.sort(
      (a, b) => new Date(b.dataVendita).getTime() - new Date(a.dataVendita).getTime()
    ),
    percorsiPrecedenti: percorsiVecchi.sort(
      (a, b) => new Date(b.dataVendita).getTime() - new Date(a.dataVendita).getTime()
    ),
    totaleResiduoPrecedenti: Number(totaleResiduoPrecedenti.toFixed(2)),
  };
}
