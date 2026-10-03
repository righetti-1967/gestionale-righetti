/**
 * Cassa Fiscale — Gestione scontrini (Madre + Figlio) e chiusure giornaliere.
 *
 * Regole fiscali:
 * - IVA 22% fissa (regime ordinario)
 * - Scontrino MADRE: incasso + IVA immediata
 * - Scontrino FIGLIO: 0€, riferimento al Madre (dicitura di legge)
 * - Annullamento: soft delete (flag `annullato`), tracciato
 * - Numerazione: progressiva per anno (per utente)
 */
import { supabase } from './supabase';

// ============================================================
// TIPI
// ============================================================

export type TipoScontrino = 'madre' | 'figlio';
export type ModalitaCassa = 'digitale' | 'fisico';
export type MetodoPagamento = 'Contanti' | 'Carta' | 'Bancomat' | 'Bonifico' | 'Altro' | 'Non richiesto';

export interface RigaScontrino {
  id?: number;
  scontrino_id?: number;
  tipo: 'prodotto' | 'servizio';
  prodotto_id: number | null;
  servizio_id: number | null;
  nome: string;
  quantita: number;
  prezzo_unitario_lordo: number;
  iva_percentuale: number;
  sconto_tipo?: 'percentuale' | 'importo' | null;
  sconto_valore?: number | null;
  created_at?: string;
}

export interface Scontrino {
  id: number;
  user_id: string;
  numero_progressivo: number;
  anno: number;
  numero_scontrino: string;
  data_emissione: string;
  ora_emissione: string;
  cliente_id: number | null;
  totale_lordo: number;
  totale_netto: number;
  iva_importo: number;
  metodo_pagamento: MetodoPagamento | null;
  scontrino_madre_id: number | null;
  tipo: TipoScontrino;
  note: string | null;
  annullato: boolean;
  modalita_cassa: ModalitaCassa;
  chiusura_id: number | null;
  scontrino_madre_numero: string | null;
  scontrino_madre_data: string | null;
  note_cliente: string | null;
  sconto_totale_tipo?: 'percentuale' | 'importo' | null;
  sconto_totale_valore?: number | null;
  annullato_at?: string | null;
  annullato_motivo?: string | null;
  annullato_da?: string | null;
  ripristino_magazzino?: boolean | null;
  created_at: string;
  righe?: RigaScontrino[];
  cliente?: {
    id: number;
    nome_cognome: string;
    codice_fiscale: string | null;
    email: string | null;
    cellulare: string | null;
  } | null;
}

export interface NuovoScontrino {
  data_emissione: string;
  ora_emissione: string;
  cliente_id: number | null;
  totale_lordo: number;
  totale_netto: number;
  iva_importo: number;
  metodo_pagamento: MetodoPagamento;
  tipo: TipoScontrino;
  note: string | null;
  modalita_cassa: ModalitaCassa;
  scontrino_madre_id?: number | null;
  sconto_totale_tipo?: 'percentuale' | 'importo' | null;
  sconto_totale_valore?: number | null;
  righe: RigaScontrino[];
}

export interface ChiusuraCassa {
  id: number;
  user_id: string;
  data_chiusura: string;
  totale_contanti: number;
  totale_carta: number;
  totale_altro: number;
  totale_generale: number;
  numero_scontrini: number;
  fondo_cassa_iniziale: number;
  contanti_attesi: number;
  note: string | null;
  aperta_at: string | null;
  chiusa_at: string | null;
  created_at: string;
}

// ============================================================
// COSTANTI
// ============================================================

export const IVA_DEFAULT = 22;
export const DICITURA_FIGLIO = 'Documento di cortesia - Riferimento scontrino madre n.';

// ============================================================
// CRUD SCONTRINI
// ============================================================

export async function getScontrini(filtri?: {
  dataInizio?: string;
  dataFine?: string;
  soloAttivi?: boolean;
}): Promise<Scontrino[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  let query = supabase
    .from('scontrini')
    .select('*, righe:scontrini_righe(*), cliente:clienti(id, nome_cognome, codice_fiscale, email, cellulare)')
    .eq('user_id', user.id)
    .order('data_emissione', { ascending: false })
    .order('ora_emissione', { ascending: false });

  if (filtri?.dataInizio) query = query.gte('data_emissione', filtri.dataInizio);
  if (filtri?.dataFine) query = query.lte('data_emissione', filtri.dataFine);
  if (filtri?.soloAttivi) query = query.eq('annullato', false);

  const { data, error } = await query;
  if (error) {
    console.error('❌ Errore nel recupero scontrini:', error);
    throw error;
  }
  return data || [];
}

export async function getScontrino(id: number): Promise<Scontrino | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scontrini')
    .select('*, righe:scontrini_righe(*), cliente:clienti(id, nome_cognome, codice_fiscale, email, cellulare)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data;
}

export async function getProssimoNumeroScontrino(anno?: number): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const annoCorrente = anno ?? new Date().getFullYear();

  const { data, error } = await supabase
    .from('scontrini')
    .select('numero_progressivo')
    .eq('user_id', user.id)
    .eq('anno', annoCorrente)
    .order('numero_progressivo', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 1;
  return (data.numero_progressivo || 0) + 1;
}

export async function creaScontrino(scontrino: NuovoScontrino): Promise<Scontrino> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const anno = new Date(scontrino.data_emissione).getFullYear();
  const prossimoNumero = await getProssimoNumeroScontrino(anno);
  const numero_scontrino = `SC-${String(prossimoNumero).padStart(5, '0')}/${anno}`;

  // 1. Crea scontrino
  const { data: nuovo, error } = await supabase
    .from('scontrini')
    .insert({
      user_id: user.id,
      numero_progressivo: prossimoNumero,
      anno,
      numero_scontrino,
      data_emissione: scontrino.data_emissione,
      ora_emissione: scontrino.ora_emissione,
      cliente_id: scontrino.cliente_id,
      totale_lordo: scontrino.totale_lordo,
      totale_netto: scontrino.totale_netto,
      iva_importo: scontrino.iva_importo,
      metodo_pagamento: scontrino.metodo_pagamento,
      tipo: scontrino.tipo,
      note: scontrino.note,
      modalita_cassa: scontrino.modalita_cassa,
      scontrino_madre_id: scontrino.scontrino_madre_id ?? null,
      sconto_totale_tipo: scontrino.sconto_totale_tipo ?? null,
      sconto_totale_valore: scontrino.sconto_totale_valore ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Errore creazione scontrino:', error);
    throw error;
  }

  // 2. Crea righe
  if (scontrino.righe.length > 0) {
    const righeConId = scontrino.righe.map((r) => ({
      scontrino_id: nuovo.id,
      tipo: r.tipo,
      prodotto_id: r.prodotto_id,
      servizio_id: r.servizio_id,
      nome: r.nome,
      quantita: r.quantita,
      prezzo_unitario_lordo: r.prezzo_unitario_lordo,
      iva_percentuale: r.iva_percentuale,
      sconto_tipo: r.sconto_tipo ?? null,
      sconto_valore: r.sconto_valore ?? null,
    }));

    const { error: errRighe } = await supabase
      .from('scontrini_righe')
      .insert(righeConId);

    if (errRighe) {
      console.error('❌ Errore inserimento righe scontrino:', errRighe);
      throw errRighe;
    }
  }

  return nuovo;
}

export interface AnnullaScontrinoParams {
  id: number;
  motivo: string;
  ripristinoMagazzino: boolean;
  annullatoDa: string; // email o nome utente
}

/**
 * Annulla uno scontrino (soft-delete tracciato).
 *
 * Regole:
 * - Non puoi annullare un MADRE se ha figli ATTIVI (non annullati)
 * - Se ripristinoMagazzino è true e ci sono prodotti → crea movimenti di carico
 * - Segna il cliente con la segnalazione
 * - Il campo `annullato` = true, più metadati
 */
export async function annullaScontrino(
  params: AnnullaScontrinoParams
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { id, motivo, ripristinoMagazzino, annullatoDa } = params;

  if (!motivo || motivo.trim().length < 10) {
    throw new Error('Il motivo deve avere almeno 10 caratteri');
  }

  // 1. Leggi lo scontrino
  const { data: sc, error: errLettura } = await supabase
    .from('scontrini')
    .select('*, righe:scontrini_righe(*), cliente:clienti(id, nome_cognome, segnalazioni_annulli)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (errLettura || !sc) {
    throw new Error('Scontrino non trovato');
  }

  if (sc.annullato) {
    throw new Error('Scontrino già annullato');
  }

  // 2. Se è un MADRE, verifica che non abbia figli attivi
  if (sc.tipo === 'madre') {
    const { data: figli, error: errFigli } = await supabase
      .from('scontrini')
      .select('id, numero_scontrino')
      .eq('user_id', user.id)
      .eq('scontrino_madre_id', id)
      .eq('annullato', false);

    if (errFigli) {
      console.error('❌ Errore verifica figli:', errFigli);
      throw errFigli;
    }

    if (figli && figli.length > 0) {
      const numeri = figli.map((f) => f.numero_scontrino).join(', ');
      throw new Error(
        `Impossibile annullare: ci sono ${figli.length} figli attivi collegati. Annullali prima: ${numeri}`
      );
    }
  }

  // 3. Se ripristinoMagazzino, crea movimenti di carico per i prodotti
  if (ripristinoMagazzino && sc.righe && sc.righe.length > 0) {
    const righeProdotto = sc.righe.filter(
      (r: RigaScontrino) => r.tipo === 'prodotto' && r.prodotto_id && r.quantita > 0
    );

    for (const r of righeProdotto) {
      try {
        const { error: errMag } = await supabase
          .from('movimenti_magazzino')
          .insert({
            user_id: user.id,
            prodotto_id: r.prodotto_id,
            tipo: 'carico',
            quantita: r.quantita,
            motivo: `Annullo scontrino ${sc.numero_scontrino}`,
            note: `Ripristino merce - motivo: ${motivo}`,
            data_movimento: new Date().toISOString().split('T')[0],
          });

        if (errMag) {
          console.error('⚠️ Errore ripristino magazzino riga:', errMag);
        }
      } catch (err) {
        console.error('⚠️ Errore ripristino magazzino:', err);
      }
    }
  }

  // 4. Segna lo scontrino come annullato
  const { error: errUpdate } = await supabase
    .from('scontrini')
    .update({
      annullato: true,
      annullato_at: new Date().toISOString(),
      annullato_motivo: motivo.trim(),
      annullato_da: annullatoDa,
      ripristino_magazzino: ripristinoMagazzino,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (errUpdate) {
    console.error('❌ Errore annullamento scontrino:', errUpdate);
    throw errUpdate;
  }

  // 5. Aggiungi segnalazione al cliente
  if (sc.cliente_id) {
    try {
      const dataIt = new Date().toLocaleDateString('it-IT');
      const nuovaSegnalazione = `[${dataIt}] Annullato ${sc.numero_scontrino} — Motivo: ${motivo.trim()}`;

      // Leggi segnalazioni esistenti
      const { data: cli } = await supabase
        .from('clienti')
        .select('segnalazioni_annulli')
        .eq('id', sc.cliente_id)
        .maybeSingle();

      const esistenti = cli?.segnalazioni_annulli || '';
      const aggiornate = esistenti
        ? esistenti + '\n' + nuovaSegnalazione
        : nuovaSegnalazione;

      await supabase
        .from('clienti')
        .update({ segnalazioni_annulli: aggiornate })
        .eq('id', sc.cliente_id);
    } catch (errCli) {
      console.error('⚠️ Errore segnalazione cliente:', errCli);
    }
  }

  // 6. Se è un FIGLIO, aggiorna il percorso (se esiste) per riportare il residuo
  // (non facciamo nulla: il residuo si calcola escludendo i figli annullati,
  //  grazie al filtro `.eq('annullato', false)` in getRigheRiscattateDaFigli)
}

/**
 * Ritorna i figli attivi (non annullati) di un madre.
 */
export async function getFigliDiMadre(madreId: number): Promise<Scontrino[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('scontrini')
    .select('*')
    .eq('user_id', user.id)
    .eq('scontrino_madre_id', madreId)
    .eq('annullato', false)
    .order('data_emissione', { ascending: false });

  if (error) {
    console.error('❌ Errore recupero figli:', error);
    throw error;
  }

  return data || [];
}

// ============================================================
// CHIUSURA CASSA
// ============================================================

export async function getChiusuraGiornaliera(data: string): Promise<ChiusuraCassa | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data: chiusura, error } = await supabase
    .from('chiusure_cassa')
    .select('*')
    .eq('user_id', user.id)
    .eq('data_chiusura', data)
    .maybeSingle();

  if (error) return null;
  return chiusura;
}

export async function calcolaTotaliGiorno(data: string): Promise<{
  contanti: number;
  carta: number;
  altro: number;
  totale: number;
  numeroScontrini: number;
}> {
  const scontrini = await getScontrini({
    dataInizio: data,
    dataFine: data,
    soloAttivi: true,
  });

  // Filtra solo scontrini "madre" (i figli sono 0€)
  const madri = scontrini.filter((s) => s.tipo === 'madre');

  let contanti = 0;
  let carta = 0;
  let altro = 0;

  for (const s of madri) {
    const importo = Number(s.totale_lordo || 0);
    switch (s.metodo_pagamento) {
      case 'Contanti':
        contanti += importo;
        break;
      case 'Carta':
      case 'Bancomat':
        carta += importo;
        break;
      default:
        altro += importo;
    }
  }

  return {
    contanti: Number(contanti.toFixed(2)),
    carta: Number(carta.toFixed(2)),
    altro: Number(altro.toFixed(2)),
    totale: Number((contanti + carta + altro).toFixed(2)),
    numeroScontrini: madri.length,
  };
}

export async function salvaChiusuraCassa(params: {
  data: string;
  fondoIniziale: number;
  note?: string | null;
}): Promise<ChiusuraCassa> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const totali = await calcolaTotaliGiorno(params.data);

  const { data, error } = await supabase
    .from('chiusure_cassa')
    .upsert(
      {
        user_id: user.id,
        data_chiusura: params.data,
        totale_contanti: totali.contanti,
        totale_carta: totali.carta,
        totale_altro: totali.altro,
        totale_generale: totali.totale,
        numero_scontrini: totali.numeroScontrini,
        fondo_cassa_iniziale: params.fondoIniziale,
        contanti_attesi: Number((totali.contanti + params.fondoIniziale).toFixed(2)),
        note: params.note ?? null,
        chiusa_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,data_chiusura' }
    )
    .select()
    .single();

  if (error) {
    console.error('❌ Errore salvataggio chiusura:', error);
    throw error;
  }
  return data;
}

// ============================================================
// HELPER
// ============================================================

/**
 * Calcola netto + IVA da un totale lordo (IVA 22%).
 */
export function calcolaTotaliDaListino(totaleLordo: number): {
  lordo: number;
  netto: number;
  iva: number;
} {
  const lordo = Number(totaleLordo.toFixed(2));
  const netto = Number((lordo / (1 + IVA_DEFAULT / 100)).toFixed(2));
  const iva = Number((lordo - netto).toFixed(2));
  return { lordo, netto, iva };
}

/**
 * Data odierna in formato YYYY-MM-DD.
 */
export function dataOggi(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Ora corrente in formato HH:MM.
 */
export function oraAdesso(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
