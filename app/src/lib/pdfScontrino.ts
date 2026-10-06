/**
 * Generatore PDF scontrino formato carta termica 80mm.
 * Usa jsPDF. Output come base64 (per upload Storage) o salva file.
 */
import { jsPDF } from 'jspdf';
import type { Scontrino, RigaScontrino } from './scontrini';
import { caricaDatiAziendali } from './datiAziendali';
import type { DatiAziendali } from './studio';
import { uploadJsPdfToStorage } from './uploadPdf';

// --- Utils ---

function normalizza(testo: string): string {
  const mappa: Record<string, string> = {
    à: 'a', á: 'a', è: 'e', é: 'e', ì: 'i', í: 'i',
    ò: 'o', ó: 'o', ù: 'u', ú: 'u',
    À: 'A', Á: 'A', È: 'E', É: 'E', Ì: 'I', Í: 'I',
    Ò: 'O', Ó: 'O', Ù: 'U', Ú: 'U',
    '€': 'EUR',
    '’': "'",
    '“': '"', '”': '"',
  };
  return testo.replace(/[àáèéìíòóùúÀÁÈÉÌÍÒÓÙÚ€’“”]/g, (c) => mappa[c] || c);
}

function formatEuroPdf(importo: number): string {
  return normalizza(
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(importo)
  );
}

function formatDataPdf(data: string | null): string {
  if (!data) return '—';
  try {
    return new Date(data).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// --- Generatore PDF ---

interface ParametriPdf {
  scontrino: Scontrino;
  scarica?: boolean;
}

/**
 * Genera il PDF dello scontrino formato 80mm.
 * Ritorna il jsPDF doc.
 */
export async function generaPdfScontrino({
  scontrino,
  scarica = false,
}: ParametriPdf): Promise<jsPDF> {
  const azienda: DatiAziendali = await caricaDatiAziendali();

  // Formato 80mm larghezza, altezza dinamica (usiamo 297mm come A4 ma la larghezza è 80mm)
  const larghezza = 80;
  const altezza = 297;
  const margine = 4;
  const centro = larghezza / 2;

  const doc = new jsPDF({
    unit: 'mm',
    format: [larghezza, altezza],
  });

  let y = 8;

  const isFiglio = scontrino.tipo === 'figlio';

  // --- Intestazione azienda ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(normalizza(azienda.ragioneSociale || 'Studio'), centro, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (azienda.partitaIva) {
    doc.text(normalizza(`P.Iva ${azienda.partitaIva}`), centro, y, { align: 'center' });
    y += 3;
  }
  const sede = azienda.sedeOperativa?.indirizzo ? azienda.sedeOperativa : azienda.sedeLegale;
  if (sede?.indirizzo) {
    doc.text(normalizza(sede.indirizzo), centro, y, { align: 'center' });
    y += 3;
  }
  if (sede?.cap && sede?.citta) {
    const cittaRiga = `${sede.cap} ${sede.citta}${sede.provincia ? ` (${sede.provincia})` : ''}`;
    doc.text(normalizza(cittaRiga), centro, y, { align: 'center' });
    y += 3;
  }
  if (azienda.telefono) {
    doc.text(normalizza(`Tel.${azienda.telefono}`), centro, y, { align: 'center' });
    y += 3;
  }

  y += 2;
  doc.text('****************', centro, y, { align: 'center' });
  y += 4;

  // --- Titolo ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DOCUMENTO COMMERCIALE', centro, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('di vendita o prestazione', centro, y, { align: 'center' });
  y += 4;

  doc.text('----------------', centro, y, { align: 'center' });
  y += 4;

  // --- Riferimento madre (per figli) ---
  if (isFiglio && scontrino.scontrino_madre_numero) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.text(
      normalizza(`Rif. scontrino madre: ${scontrino.scontrino_madre_numero}`),
      centro,
      y,
      { align: 'center' }
    );
    y += 3;
    if (scontrino.scontrino_madre_data) {
      doc.text(
        normalizza(`del ${scontrino.scontrino_madre_data}`),
        centro,
        y,
        { align: 'center' }
      );
      y += 4;
    }
    doc.setFont('helvetica', 'normal');
  }

  // --- Header colonne ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DESCRIZIONE', margine, y);
  doc.text('IVA', larghezza - 20, y, { align: 'right' });
  doc.text('EURO', larghezza - margine, y, { align: 'right' });
  y += 1;
  doc.setLineWidth(0.1);
  doc.line(margine, y, larghezza - margine, y);
  y += 3.5;

  // --- Righe ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);

  const righe = scontrino.righe || [];
  for (const r of righe) {
    const importo = r.quantita * r.prezzo_unitario_lordo;
    const isStorno = r.quantita < 0 || r.nome.toUpperCase().startsWith('STORNO');
    const isExtra = r.nome.includes('(EXTRA Percorso)');
    const nomePulito = r.nome.replace(' (EXTRA Percorso)', '').trim();
    const nomeBase = isExtra ? `${nomePulito} [EXTRA]` : nomePulito;
    const nome = nomeBase.length > 40 ? nomeBase.slice(0, 38) + '...' : nomeBase;

    doc.setFont('helvetica', isStorno ? 'bold' : 'normal');

    // Nome riga (può andare a capo)
    const nomeCompleto = r.quantita !== 1 && !isStorno
      ? `NR.${r.quantita} ${nome}`
      : nome;

    const righeNome = doc.splitTextToSize(normalizza(nomeCompleto), 45);
    for (const rigaNome of righeNome) {
      doc.text(rigaNome, margine, y);
      y += 3;
    }

    // Prezzo allineato a destra
    const ivaStr = `${r.iva_percentuale || 22}%`;
    const importoStr = formatEuroPdf(importo);

    // Riga con IVA + importo (sulla stessa riga dell'ultimo pezzo del nome, in colonna)
    y -= 3;
    doc.text(ivaStr, larghezza - 20, y, { align: 'right' });
    doc.text(importoStr, larghezza - margine, y, { align: 'right' });
    y += 3;

    // Sotto-riga sconto (se presente)
    if (r.sconto_valore && r.sconto_valore > 0 && !isStorno) {
      let importoScontoRiga = 0;
      if (r.sconto_tipo === 'percentuale') {
        importoScontoRiga = Number((importo * (r.sconto_valore / 100)).toFixed(2));
      } else {
        importoScontoRiga = Number((r.sconto_valore * r.quantita).toFixed(2));
      }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.text(
        normalizza(
          `  Sconto ${r.sconto_tipo === 'percentuale' ? `${r.sconto_valore}%` : `${formatEuroPdf(r.sconto_valore)}/pz`}`
        ),
        margine,
        y
      );
      doc.text(`-${formatEuroPdf(importoScontoRiga)}`, larghezza - margine, y, { align: 'right' });
      y += 3;
      doc.setFontSize(6.5);
    }
  }

  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.text('----------------', centro, y, { align: 'center' });
  y += 4;

  // --- Totali ---
  const subtotaleRighe = righe.reduce((s, r) => s + r.quantita * r.prezzo_unitario_lordo, 0);
  const scontoTotale =
    scontrino.sconto_totale_valore && scontrino.sconto_totale_valore > 0
      ? scontrino.sconto_totale_tipo === 'percentuale'
        ? Number((subtotaleRighe * (scontrino.sconto_totale_valore / 100)).toFixed(2))
        : scontrino.sconto_totale_valore
      : 0;

  if (scontoTotale > 0) {
    doc.setFontSize(6.5);
    doc.text('Subtotale', margine, y);
    doc.text(formatEuroPdf(subtotaleRighe), larghezza - margine, y, { align: 'right' });
    y += 3;
    doc.setFont('helvetica', 'italic');
    doc.text(
      normalizza(
        `Sconto totale ${scontrino.sconto_totale_tipo === 'percentuale' ? `${scontrino.sconto_totale_valore}%` : ''}`
      ),
      margine,
      y
    );
    doc.text(`-${formatEuroPdf(scontoTotale)}`, larghezza - margine, y, { align: 'right' });
    y += 4;
    doc.setFont('helvetica', 'normal');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('TOTALE COMPLESSIVO', margine, y);
  doc.text(formatEuroPdf(scontrino.totale_lordo), larghezza - margine, y, { align: 'right' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('di cui IVA', margine, y);
  doc.text(formatEuroPdf(scontrino.iva_importo), larghezza - margine, y, { align: 'right' });
  y += 4;

  doc.text('----------------', centro, y, { align: 'center' });
  y += 4;

  // --- Pagamento ---
  if (scontrino.metodo_pagamento && scontrino.metodo_pagamento !== 'Non richiesto') {
    doc.text(normalizza(scontrino.metodo_pagamento), margine, y);
    doc.text(formatEuroPdf(scontrino.totale_lordo), larghezza - margine, y, { align: 'right' });
    y += 3;
    doc.text('Importo pagato', margine, y);
    doc.text(formatEuroPdf(scontrino.totale_lordo), larghezza - margine, y, { align: 'right' });
    y += 4;
  }

  if (isFiglio) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.text('Documento di cortesia - nessun pagamento', centro, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
  }

  // --- Riferimento madre (footer, se figlio) ---
  if (isFiglio && scontrino.scontrino_madre_numero) {
    doc.text('----------------', centro, y, { align: 'center' });
    y += 3.5;
    doc.setFontSize(6);
    const cartaL1 = `CARTA ${scontrino.scontrino_madre_numero}`;
    const cartaL2 = `DOC.N.${scontrino.scontrino_madre_numero} DEL ${scontrino.scontrino_madre_data}`;
    doc.text(normalizza(cartaL1), margine, y);
    y += 3;
    doc.text(normalizza(cartaL2), margine, y);
    y += 4;
  }

  // --- Note ---
  if (scontrino.note) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    const righeNote = doc.splitTextToSize(normalizza(scontrino.note), larghezza - 2 * margine);
    for (const riga of righeNote) {
      doc.text(riga, centro, y, { align: 'center' });
      y += 3;
    }
    y += 1;
    doc.setFont('helvetica', 'normal');
  }

  // --- Annullato ---
  if (scontrino.annullato) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 0, 0);
    doc.text('*** ANNULLATO ***', centro, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont('helvetica', 'normal');
  }

  // --- Data/Ora + ID documento ---
  y += 2;
  doc.setFontSize(7);
  const dataIt = formatDataPdf(scontrino.data_emissione);
  doc.text(`${dataIt} ${scontrino.ora_emissione}`, centro, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.text(`${scontrino.numero_scontrino}-${scontrino.id}`, centro, y, { align: 'center' });
  y += 5;

  // --- Firma "Grazie" ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('GRAZIE E ARRIVEDERCI', centro, y, { align: 'center' });

  // --- Salva file ---
  if (scarica) {
    const nomeFile = generaNomeFilePdf(scontrino);
    // Upload su Storage (best effort)
    try {
      const clienteId = (scontrino as any).cliente_id;
      const anno = (scontrino as any).anno || new Date().getFullYear();
      if (clienteId) {
        uploadJsPdfToStorage('scontrini-pdf', clienteId, nomeFile, doc, anno)
          .then((url) => { if (url) console.log('✅ PDF scontrino salvato:', url); })
          .catch((e) => console.warn('⚠️ Upload PDF scontrino fallito:', e));
      }
    } catch (e) {
      console.warn('⚠️ Upload PDF scontrino errore:', e);
    }
    doc.save(nomeFile);
  }

  return doc;
}

/**
 * Genera il nome file PDF:
 * - SC-00001/2026 (madre) → SC-00001-2026_NomeCliente.pdf
 * - SC-00002/2026 (figlio) → SC-00002-2026_NomeCliente_Scarico.pdf
 */
export function generaNomeFilePdf(scontrino: Scontrino): string {
  const numeroSicuro = scontrino.numero_scontrino.replace(/\//g, '-');
  const nomeCliente = scontrino.cliente?.nome_cognome?.replace(/\s+/g, '_') || 'Cliente';
  const suffisso = scontrino.tipo === 'figlio' ? '_Scarico' : '';
  return `Scontrino_${numeroSicuro}_${nomeCliente}${suffisso}.pdf`;
}

/**
 * Ritorna il PDF come Base64 (senza prefisso data:).
 * Usato per upload su Supabase Storage o invio email.
 */
export async function generaPdfScontrinoBase64(
  scontrino: Scontrino
): Promise<{ base64: string; nomeFile: string }> {
  const doc = await generaPdfScontrino({ scontrino, scarica: false });
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  const nomeFile = generaNomeFilePdf(scontrino);
  return { base64, nomeFile };
}
