import { supabase } from './supabase';
import {
  getScontrino,
  getProssimoNumeroScontrino,
  IVA_DEFAULT,
  dataOggi,
  oraAdesso,
  type Scontrino,
  type RigaScontrino,
  type MetodoPagamento,
  type ModalitaCassa,
} from './scontrini';
import { creaMovimento } from './magazzino';

export interface RigaRiscatto {
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  prodotto_percorso_id?: number | null;
  nome: string;
  quantita: number;
  prezzo_unitario_lordo: number;
}

export interface NuovoScontrinoFiglio {
  madreId: number;
  clienteId: number;
  righeRiscattate: RigaRiscatto[];
  metodo_pagamento?: MetodoPagamento;
  modalita_cassa?: ModalitaCassa;
  note?: string | null;
}

export async function creaScontrinoFiglio(
  params: NuovoScontrinoFiglio
): Promise<Scontrino> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  if (params.righeRiscattate.length === 0) {
    throw new Error('Nessuna riga da riscattare');
  }

  const madre = await getScontrino(params.madreId);
  if (!madre) throw new Error('Scontrino madre non trovato');
  if (madre.tipo !== 'madre') throw new Error('Lo scontrino di riferimento non è un madre');

  const righeFiglio: RigaScontrino[] = [];
  let totaleLordo = 0;

  for (const r of params.righeRiscattate) {
    if (r.quantita <= 0) continue;

    const prezzoUnitarioLordo = Number(r.prezzo_unitario_lordo.toFixed(2));
    const importoTotale = Number((prezzoUnitarioLordo * r.quantita).toFixed(2));

    righeFiglio.push({
      tipo: r.tipo,
      prodotto_id: r.prodotto_id,
      servizio_id: r.servizio_id,
      nome: r.nome,
      quantita: r.quantita,
      prezzo_unitario_lordo: prezzoUnitarioLordo,
      iva_percentuale: IVA_DEFAULT,
    });

    totaleLordo += importoTotale;
  }

  totaleLordo = Number(totaleLordo.toFixed(2));

  if (totaleLordo > 0) {
    righeFiglio.push({
      tipo: 'servizio',
      prodotto_id: null,
      servizio_id: null,
      nome: `Storno percorso prepagato ${madre.numero_scontrino}`,
      quantita: 1,
      prezzo_unitario_lordo: -totaleLordo,
      iva_percentuale: IVA_DEFAULT,
    });
  }

  const totaleFinale = Number(
    righeFiglio.reduce((sum, r) => sum + r.quantita * r.prezzo_unitario_lordo, 0).toFixed(2)
  );
  const totaleNetto = Number((totaleFinale / (1 + IVA_DEFAULT / 100)).toFixed(2));
  const totaleIva = Number((totaleFinale - totaleNetto).toFixed(2));

  const data = dataOggi();
  const ora = oraAdesso();
  const anno = new Date(data).getFullYear();
  const prossimoNumero = await getProssimoNumeroScontrino(anno);
  const numero_scontrino = `SC-${String(prossimoNumero).padStart(5, '0')}/${anno}`;

  const dataMadreIt = new Date(madre.data_emissione).toLocaleDateString('it-IT');

  const { data: nuovo, error } = await supabase
    .from('scontrini')
    .insert({
      user_id: user.id,
      numero_progressivo: prossimoNumero,
      anno,
      numero_scontrino,
      data_emissione: data,
      ora_emissione: ora,
      cliente_id: params.clienteId,
      totale_lordo: totaleFinale,
      totale_netto: totaleNetto,
      iva_importo: totaleIva,
      metodo_pagamento: params.metodo_pagamento ?? 'Non richiesto',
      tipo: 'figlio',
      note: params.note ?? null,
      modalita_cassa: params.modalita_cassa ?? 'digitale',
      scontrino_madre_id: madre.id,
      scontrino_madre_numero: madre.numero_scontrino,
      scontrino_madre_data: dataMadreIt,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore creazione scontrino figlio:', error);
    throw error;
  }

  if (righeFiglio.length > 0) {
    const righeConId = righeFiglio.map((r) => ({
      scontrino_id: nuovo.id,
      tipo: r.tipo,
      prodotto_id: r.prodotto_id,
      servizio_id: r.servizio_id,
      nome: r.nome,
      quantita: r.quantita,
      prezzo_unitario_lordo: r.prezzo_unitario_lordo,
      iva_percentuale: r.iva_percentuale,
    }));

    const { error: errRighe } = await supabase
      .from('scontrini_righe')
      .insert(righeConId);

    if (errRighe) {
      console.error('❌ Errore inserimento righe figlio:', errRighe);
      throw errRighe;
    }
  }

  for (const r of params.righeRiscattate) {
    if (r.tipo !== 'prodotto' || !r.prodotto_id || r.quantita <= 0) continue;

    try {
      await creaMovimento({
        prodotto_id: r.prodotto_id,
        tipo: 'scarico',
        quantita: r.quantita,
        motivo: `Scontrino figlio ${numero_scontrino} • rif. madre ${madre.numero_scontrino}`,
        note: `Riscatto percorso: ${r.nome}`,
        data_movimento: data,
      });
    } catch (errMag) {
      console.error('⚠️ Errore aggiornamento magazzino:', errMag);
    }
  }

  return nuovo;
}

export async function getRigheRiscattateDaFigli(madreId: number): Promise<{
  tipo: 'servizio' | 'prodotto';
  servizio_id: number | null;
  prodotto_id: number | null;
  prodotto_percorso_id?: number | null;
  quantita: number;
  prezzo_scontato_lordo: number;
}[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data: figli, error } = await supabase
    .from('scontrini')
    .select('id, righe:scontrini_righe(*)')
    .eq('user_id', user.id)
    .eq('scontrino_madre_id', madreId)
    .eq('tipo', 'figlio')
    .eq('annullato', false);

  if (error) {
    console.error('❌ Errore recupero figli:', error);
    throw error;
  }

  const righe: {
    tipo: 'servizio' | 'prodotto';
    servizio_id: number | null;
    prodotto_id: number | null;
    prodotto_percorso_id?: number | null;
    quantita: number;
    prezzo_scontato_lordo: number;
  }[] = [];

  for (const figlio of figli || []) {
    const righeFiglio = (figlio.righe as RigaScontrino[]) || [];
    for (const r of righeFiglio) {
      if (r.quantita <= 0) continue;
      if (r.nome.startsWith('Storno percorso')) continue;

      righe.push({
        tipo: r.tipo,
        servizio_id: r.servizio_id,
        prodotto_id: r.prodotto_id,
        prodotto_percorso_id: r.prodotto_id,
        quantita: r.quantita,
        prezzo_scontato_lordo: r.prezzo_unitario_lordo,
      });
    }
  }

  return righe;
}
