export interface RigaPercorso {
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  nome: string;
  quantita: number;
  prezzo_listino_lordo: number;
  prezzo_scontato_lordo: number;
  netto_iva_scontato: number;
}

export interface PercorsoCalcolato {
  righe: RigaPercorso[];
  totale_listino: number;
  totale_finale: number;
  sconto_percentuale: number;
}

const IVA = 0.22;

export function calcolaPercorso(
  righeBase: Omit<RigaPercorso, 'prezzo_scontato_lordo' | 'netto_iva_scontato'>[],
  totaleFinale: number
): PercorsoCalcolato {
  const totaleListino = righeBase.reduce(
    (sum, r) => sum + r.quantita * r.prezzo_listino_lordo,
    0
  );

  const scontoPercentuale =
    totaleListino > 0
      ? ((totaleListino - totaleFinale) / totaleListino) * 100
      : 0;

  const fattoreSconto = totaleListino > 0 ? totaleFinale / totaleListino : 1;

  const righe: RigaPercorso[] = righeBase.map((r) => {
    const prezzoScontatoLordo = Number(
      (r.prezzo_listino_lordo * fattoreSconto).toFixed(2)
    );
    const nettoIvaScontato = Number((prezzoScontatoLordo / (1 + IVA)).toFixed(2));

    return {
      ...r,
      prezzo_scontato_lordo: prezzoScontatoLordo,
      netto_iva_scontato: nettoIvaScontato,
    };
  });

  const sommaRighe = righe.reduce(
    (sum, r) => sum + r.quantita * r.prezzo_scontato_lordo,
    0
  );

  const differenza = Number((totaleFinale - sommaRighe).toFixed(2));

  if (Math.abs(differenza) > 0.001 && righe.length > 0) {
    const ultimaRiga = righe[righe.length - 1];
    const correzionePerUnita = differenza / ultimaRiga.quantita;
    ultimaRiga.prezzo_scontato_lordo = Number(
      (ultimaRiga.prezzo_scontato_lordo + correzionePerUnita).toFixed(2)
    );
    ultimaRiga.netto_iva_scontato = Number(
      (ultimaRiga.prezzo_scontato_lordo / (1 + IVA)).toFixed(2)
    );
  }

  return {
    righe,
    totale_listino: Number(totaleListino.toFixed(2)),
    totale_finale: Number(totaleFinale.toFixed(2)),
    sconto_percentuale: Number(scontoPercentuale.toFixed(2)),
  };
}

export interface ResiduoPercorso {
  valore_residuo_lordo: number;
  valore_totale_lordo: number;
  percentuale_consumata: number;
  righe_residue: {
    tipo: 'servizio' | 'prodotto';
    servizio_id: number | null;
    prodotto_id: number | null;
    nome: string;
    quantita_totale: number;
    quantita_scaricata: number;
    quantita_residua: number;
  }[];
}

export function calcolaResiduo(
  righePercorso: RigaPercorso[],
  righeScaricate: {
    tipo: 'servizio' | 'prodotto';
    servizio_id: number | null;
    prodotto_id: number | null;
    prodotto_percorso_id?: number | null;
    quantita: number;
    prezzo_scontato_lordo: number;
  }[]
): ResiduoPercorso {
  // 1. Raggruppa le righe scaricate per chiave
  // NOTA: Se la riga scaricata ha prodotto_percorso_id, usiamo quello per imputare lo scarico
  // alla riga generica contrattuale del percorso (es. Prodotto Cute)
  const scaricatoPerChiave = new Map<string, number>();
  for (const r of righeScaricate) {
    const pId = r.prodotto_percorso_id || r.prodotto_id;
    const chiave = r.tipo === 'servizio' ? `S-${r.servizio_id}` : `P-${pId}`;
    scaricatoPerChiave.set(chiave, (scaricatoPerChiave.get(chiave) || 0) + r.quantita);
  }

  // 2. Calcola il residuo per ogni riga
  const righeResidue = righePercorso.map((r) => {
    const chiave = r.tipo === 'servizio' ? `S-${r.servizio_id}` : `P-${r.prodotto_id}`;
    const quantitaScaricata = scaricatoPerChiave.get(chiave) || 0;
    const quantitaResidua = Math.max(0, r.quantita - quantitaScaricata);

    return {
      tipo: r.tipo,
      servizio_id: r.servizio_id,
      prodotto_id: r.prodotto_id,
      nome: r.nome,
      quantita_totale: r.quantita,
      quantita_scaricata: quantitaScaricata,
      quantita_residua: quantitaResidua,
    };
  });

  // 3. Calcola il valore residuo in € (lordo)
  const valoreResiduoLordo = righeResidue.reduce((sum, r) => {
    const rigaPercorso = righePercorso.find(
      (rp) =>
        rp.tipo === r.tipo &&
        rp.servizio_id === r.servizio_id &&
        rp.prodotto_id === r.prodotto_id
    );
    const prezzoUnitario = rigaPercorso?.prezzo_scontato_lordo || 0;
    return sum + r.quantita_residua * prezzoUnitario;
  }, 0);

  const valoreTotaleLordo = righePercorso.reduce(
    (sum, r) => sum + r.quantita * r.prezzo_scontato_lordo,
    0
  );

  return {
    valore_residuo_lordo: Number(valoreResiduoLordo.toFixed(2)),
    valore_totale_lordo: Number(valoreTotaleLordo.toFixed(2)),
    percentuale_consumata:
      valoreTotaleLordo > 0
        ? Number(
            (
              ((valoreTotaleLordo - valoreResiduoLordo) / valoreTotaleLordo) *
              100
            ).toFixed(1)
          )
        : 0,
    righe_residue: righeResidue,
  };
}

export function formatEuro(importo: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(importo);
}
