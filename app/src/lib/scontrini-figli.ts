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
import { generaPdfScontrinoBase64 } from './pdfScontrino';
import { inviaEmailConConfig } from './api';

// ============================================================
// TIPI
// ============================================================

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

// ============================================================
// CREAZIONE SCONTRINO FIGLIO
// ============================================================

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

// ============================================================
// HELPER: calcolo residuo di un percorso dai figli
// ============================================================

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

// ============================================================
// UPLOAD PDF SU SUPABASE STORAGE
// ============================================================

/**
 * Genera PDF dello scontrino, lo carica su Supabase Storage e ritorna l'URL pubblico.
 */
export async function caricaPdfScontrinoStorage(
  scontrino: Scontrino
): Promise<{ url: string; nomeFile: string }> {
  const { base64, nomeFile } = await generaPdfScontrinoBase64(scontrino);

  // Nome file univoco: scontrini/{userId}/{numero}-{timestamp}.pdf
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const numeroSicuro = scontrino.numero_scontrino.replace(/\//g, '-');
  const timestamp = Date.now();
  const path = `${user.id}/${numeroSicuro}-${timestamp}.pdf`;

  // Converti base64 in Blob
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });

  const { error: errUpload } = await supabase.storage
    .from('scontrini-pdf')
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (errUpload) {
    console.error('❌ Errore upload PDF:', errUpload);
    throw errUpload;
  }

  const { data: publicUrl } = supabase.storage
    .from('scontrini-pdf')
    .getPublicUrl(path);

  return { url: publicUrl.publicUrl, nomeFile };
}

// ============================================================
// INVIO EMAIL
// ============================================================

/**
 * Invia lo scontrino via Email al cliente, con PDF in allegato.
 * Usa il provider configurato (Google Workspace / SMTP).
 */
export async function inviaScontrinoEmail(
  scontrino: Scontrino,
  emailDestinatario: string
): Promise<void> {
  if (!emailDestinatario || !emailDestinatario.trim()) {
    throw new Error('Email cliente non disponibile');
  }

  const { base64, nomeFile } = await generaPdfScontrinoBase64(scontrino);

  const isFiglio = scontrino.tipo === 'figlio';
  const tipoLabel = isFiglio
    ? `Scontrino scarico ${scontrino.numero_scontrino}`
    : `Scontrino ${scontrino.numero_scontrino}`;

  const corpoHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
      <div style="text-align: center; margin-bottom: 20px;">
        <p style="color: #8e8e93; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
          Documento Commerciale
        </p>
      </div>
      <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">
          Gentile ${scontrino.cliente?.nome_cognome || 'Cliente'},
        </p>
        <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
          In allegato trovi il documento commerciale relativo alla tua operazione del
          ${new Date(scontrino.data_emissione).toLocaleDateString('it-IT')}.
        </p>
        ${isFiglio && scontrino.scontrino_madre_numero ? `
          <p style="margin: 8px 0 0 0; color: #8e8e93; font-size: 12px;">
            Riferimento scontrino madre: <strong>${scontrino.scontrino_madre_numero}</strong>
          </p>
        ` : ''}
      </div>
      <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #8e8e93; text-align: center;">
        Documento generato automaticamente dal Gestionale.
      </div>
    </div>
  `;

  await inviaEmailConConfig({
    destinatario: emailDestinatario.trim(),
    oggetto: tipoLabel,
    corpo_html: corpoHtml,
    allegato_base64: base64,
    allegato_nome: nomeFile,
  });
}

// ============================================================
// INVIO WHATSAPP (link PDF)
// ============================================================

/**
 * Genera PDF, lo carica su Storage e apre WhatsApp con link al PDF.
 */
export async function inviaScontrinoWhatsApp(
  scontrino: Scontrino,
  cellulare: string
): Promise<void> {
  if (!cellulare || !cellulare.trim()) {
    throw new Error('Cellulare cliente non disponibile');
  }

  const { url } = await caricaPdfScontrinoStorage(scontrino);

  const isFiglio = scontrino.tipo === 'figlio';
  const testo = isFiglio
    ? `Gentile ${scontrino.cliente?.nome_cognome || 'Cliente'}, ecco il documento di scarico percorso ${scontrino.numero_scontrino} (rif. scontrino madre ${scontrino.scontrino_madre_numero || ''}).\n\n${url}`
    : `Gentile ${scontrino.cliente?.nome_cognome || 'Cliente'}, ecco il tuo scontrino ${scontrino.numero_scontrino}.\n\n${url}`;

  // Normalizza numero (aggiunge 39 se manca)
  const numPulito = cellulare.replace(/\D/g, '');
  const prefisso = numPulito.startsWith('39') ? '' : '39';
  const numeroFinale = numPulito ? `${prefisso}${numPulito}` : '';

  const waUrl = numeroFinale
    ? `https://wa.me/${numeroFinale}?text=${encodeURIComponent(testo)}`
    : `https://wa.me/?text=${encodeURIComponent(testo)}`;

  window.open(waUrl, '_blank');
}
