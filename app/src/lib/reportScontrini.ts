/**
 * Report Commercialista — Scontrini
 *
 * - calcolaRiepilogoPeriodo: IVA + imponibile + totale + numero scontrini
 * - generaCsvScontrini: CSV per Excel del commercialista
 * - generaPdfRiepilogo: PDF mensile professionale
 * - inviaReportCommercialistaEmail: invia via email al commercialista
 */
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import {
  getScontrini,
  type Scontrino,
  type MetodoPagamento,
} from './scontrini';
import { caricaDatiAziendali } from './datiAziendali';
import { caricaFatturazione } from './fatturazione';

// ============================================================
// TIPI
// ============================================================

export interface RiepilogoPeriodo {
  dataInizio: string;
  dataFine: string;
  numeroScontrini: number;
  totaleLordo: number;
  totaleNetto: number;
  totaleIva: number;
  /** IVA per aliquota (attualmente solo 22%) */
  ivaPerAliquota: Array<{
    aliquota: number;
    imponibile: number;
    iva: number;
    lordo: number;
    numeroScontrini: number;
  }>;
  /** Totali per metodo pagamento */
  perMetodo: Array<{
    metodo: MetodoPagamento | 'Non specificato';
    totale: number;
    numeroScontrini: number;
  }>;
  /** Scontrini annullati nel periodo (solo conteggio) */
  numeroAnnullati: number;
  totaleAnnullati: number;
}

// ============================================================
// CALCOLI
// ============================================================

export async function calcolaRiepilogoPeriodo(
  dataInizio: string,
  dataFine: string
): Promise<RiepilogoPeriodo> {
  // Carico tutti gli scontrini del periodo (inclusi annullati)
  const tutti = await getScontrini({
    dataInizio,
    dataFine,
  });

  // Solo madre non annullati → conteggiati fiscalmente
  const madreAttivi = tutti.filter(
    (s) => s.tipo === 'madre' && !s.annullato
  );

  // Madre annullati (per riepilogo trasparenza)
  const madreAnnullati = tutti.filter(
    (s) => s.tipo === 'madre' && s.annullato
  );

  let totaleLordo = 0;
  let totaleNetto = 0;
  let totaleIva = 0;

  // Raggruppa per aliquota IVA (attualmente 22%, ma predisposto per future)
  const ivaMap = new Map<number, {
    imponibile: number;
    iva: number;
    lordo: number;
    count: number;
  }>();

  // Raggruppa per metodo pagamento
  const metodoMap = new Map<MetodoPagamento | 'Non specificato', {
    totale: number;
    count: number;
  }>();

  for (const s of madreAttivi) {
    const lordo = Number(s.totale_lordo || 0);
    const netto = Number(s.totale_netto || 0);
    const iva = Number(s.iva_importo || 0);

    totaleLordo += lordo;
    totaleNetto += netto;
    totaleIva += iva;

    // Aliquota (default 22)
    const aliquota = 22;
    const esistente = ivaMap.get(aliquota) || { imponibile: 0, iva: 0, lordo: 0, count: 0 };
    esistente.imponibile += netto;
    esistente.iva += iva;
    esistente.lordo += lordo;
    esistente.count += 1;
    ivaMap.set(aliquota, esistente);

    // Metodo pagamento
    const metodo = (s.metodo_pagamento || 'Non specificato') as MetodoPagamento | 'Non specificato';
    const esistenteM = metodoMap.get(metodo) || { totale: 0, count: 0 };
    esistenteM.totale += lordo;
    esistenteM.count += 1;
    metodoMap.set(metodo, esistenteM);
  }

  return {
    dataInizio,
    dataFine,
    numeroScontrini: madreAttivi.length,
    totaleLordo: Number(totaleLordo.toFixed(2)),
    totaleNetto: Number(totaleNetto.toFixed(2)),
    totaleIva: Number(totaleIva.toFixed(2)),
    ivaPerAliquota: Array.from(ivaMap.entries()).map(([aliquota, v]) => ({
      aliquota,
      imponibile: Number(v.imponibile.toFixed(2)),
      iva: Number(v.iva.toFixed(2)),
      lordo: Number(v.lordo.toFixed(2)),
      numeroScontrini: v.count,
    })),
    perMetodo: Array.from(metodoMap.entries()).map(([metodo, v]) => ({
      metodo,
      totale: Number(v.totale.toFixed(2)),
      numeroScontrini: v.count,
    })).sort((a, b) => b.totale - a.totale),
    numeroAnnullati: madreAnnullati.length,
    totaleAnnullati: Number(
      madreAnnullati.reduce((sum, s) => sum + Number(s.totale_lordo || 0), 0).toFixed(2)
    ),
  };
}

// ============================================================
// EXPORT CSV
// ============================================================

/**
 * Genera CSV per il commercialista (formato Excel italiano).
 * Colonne: Numero, Data, Ora, Cliente, CF, Metodo, Lordo, Netto, IVA, Tipo, Note
 */
export async function generaCsvScontrini(
  dataInizio: string,
  dataFine: string
): Promise<{ blob: Blob; nomeFile: string }> {
  const scontrini = await getScontrini({
    dataInizio,
    dataFine,
  });

  // Filtra solo madre attivi (i figli sono 0€ e non vanno al commercialista)
  const madreAttivi = scontrini.filter(
    (s) => s.tipo === 'madre' && !s.annullato
  );

  const headers = [
    'Numero Scontrino',
    'Data',
    'Ora',
    'Cliente',
    'CF/P.IVA Cliente',
    'Metodo Pagamento',
    'Lordo (€)',
    'Imponibile (€)',
    'IVA 22% (€)',
    'Modalità',
    'Note',
  ];

  const rows = madreAttivi.map((s) => {
    const dataIt = new Date(s.data_emissione).toLocaleDateString('it-IT');
    return [
      s.numero_scontrino,
      dataIt,
      s.ora_emissione,
      s.cliente?.nome_cognome || '',
      s.cliente?.codice_fiscale || '',
      s.metodo_pagamento || '',
      Number(s.totale_lordo || 0).toFixed(2).replace('.', ','),
      Number(s.totale_netto || 0).toFixed(2).replace('.', ','),
      Number(s.iva_importo || 0).toFixed(2).replace('.', ','),
      s.modalita_cassa || '',
      s.note || '',
    ];
  });

  // Costruisci CSV con separatore ;
  const escapeCsv = (val: string): string => {
    if (val.includes(';') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escapeCsv).join(';'),
    ...rows.map((r) => r.map((c) => escapeCsv(String(c))).join(';')),
  ];

  const csv = '\ufeff' + lines.join('\n'); // BOM per Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  const dataInizioIt = dataInizio.split('-').reverse().join('-');
  const dataFineIt = dataFine.split('-').reverse().join('-');
  const nomeFile = `Scontrini_${dataInizioIt}_${dataFineIt}.csv`;

  return { blob, nomeFile };
}

/**
 * Scarica il CSV direttamente.
 */
export async function scaricaCsvScontrini(
  dataInizio: string,
  dataFine: string
): Promise<void> {
  const { blob, nomeFile } = await generaCsvScontrini(dataInizio, dataFine);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================
// PDF RIEPILOGO
// ============================================================

function normalizza(testo: string): string {
  const mappa: Record<string, string> = {
    à: 'a', á: 'a', è: 'e', é: 'e', ì: 'i', í: 'i',
    ò: 'o', ó: 'o', ù: 'u', ú: 'u',
    À: 'A', Á: 'A', È: 'E', É: 'E', Ì: 'I', Í: 'I',
    Ò: 'O', Ó: 'O', Ù: 'U', Ú: 'U',
    '€': 'EUR',
    '’': "'",
  };
  return testo.replace(/[àáèéìíòóùúÀÁÈÉÌÍÒÓÙÚ€’]/g, (c) => mappa[c] || c);
}

function formatEuroPdf(n: number): string {
  return normalizza(
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
  );
}

/**
 * Genera PDF riepilogo mensile per commercialista.
 */
export async function generaPdfRiepilogo(
  dataInizio: string,
  dataFine: string,
  scarica = false
): Promise<jsPDF> {
  const azienda = await caricaDatiAziendali();
  const fatturazione = await caricaFatturazione();
  const riepilogo = await calcolaRiepilogoPeriodo(dataInizio, dataFine);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const larghezza = 210;
  const altezza = 297;
  const margine = 15;
  const larghezzaUtile = larghezza - 2 * margine;

  let y = 15;

  // Header azienda
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(normalizza(azienda.ragioneSociale || 'Studio'), margine, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (azienda.partitaIva) {
    doc.text(normalizza(`P.IVA ${azienda.partitaIva} - C.F. ${azienda.codiceFiscale || ''}`), margine, y);
    y += 4;
  }
  const sede = azienda.sedeOperativa?.indirizzo ? azienda.sedeOperativa : azienda.sedeLegale;
  if (sede?.indirizzo) {
    doc.text(normalizza(`${sede.indirizzo}, ${sede.cap} ${sede.citta} (${sede.provincia})`), margine, y);
    y += 8;
  }

  // Titolo documento
  doc.setFillColor(0, 122, 255);
  doc.rect(margine, y, larghezzaUtile, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RIEPILOGO SCONTRINI - REPORT COMMERCIALISTA', larghezza / 2, y + 8, { align: 'center' });
  y += 18;

  doc.setTextColor(0, 0, 0);

  // Periodo
  const dataInizioIt = new Date(dataInizio).toLocaleDateString('it-IT');
  const dataFineIt = new Date(dataFine).toLocaleDateString('it-IT');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Periodo:', margine, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`dal ${dataInizioIt} al ${dataFineIt}`, margine + 20, y);
  y += 8;

  // Destinatario commercialista
  const nomeComm = fatturazione.nomeCommercialista || fatturazione.emailCommercialista || '';
  if (nomeComm) {
    doc.setFontSize(9);
    doc.text('Destinatario:', margine, y);
    doc.setFont('helvetica', 'bold');
    doc.text(normalizza(nomeComm), margine + 25, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
  }

  // Riepilogo generale
  doc.setFillColor(245, 245, 248);
  doc.rect(margine, y, larghezzaUtile, 30, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RIEPILOGO GENERALE', margine + 4, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const colSx = margine + 4;
  const colDx = larghezza / 2 + 10;

  doc.text(`Numero scontrini emessi:`, colSx, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${riepilogo.numeroScontrini}`, colSx + 50, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Totale lordo:`, colDx, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEuroPdf(riepilogo.totaleLordo), colDx + 30, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Totale imponibile:`, colSx, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEuroPdf(riepilogo.totaleNetto), colSx + 50, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Totale IVA:`, colDx, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEuroPdf(riepilogo.totaleIva), colDx + 30, y);
  y += 10;

  // Dettaglio IVA per aliquota
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETTAGLIO IVA', margine, y);
  y += 5;

  // Intestazione tabella
  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFontSize(9);
  doc.text('Aliquota', margine + 4, y + 5);
  doc.text('Imponibile', larghezza - 60, y + 5, { align: 'right' });
  doc.text('IVA', larghezza - 35, y + 5, { align: 'right' });
  doc.text('Lordo', larghezza - 5, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const r of riepilogo.ivaPerAliquota) {
    doc.text(`${r.aliquota}%`, margine + 4, y + 4);
    doc.text(formatEuroPdf(r.imponibile), larghezza - 60, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.iva), larghezza - 35, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.lordo), larghezza - 5, y + 4, { align: 'right' });
    y += 5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);
  }
  y += 6;

  // Dettaglio metodi pagamento
  if (riepilogo.perMetodo.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DETTAGLIO METODI PAGAMENTO', margine, y);
    y += 5;

    doc.setFillColor(230, 230, 235);
    doc.rect(margine, y, larghezzaUtile, 7, 'F');
    doc.setFontSize(9);
    doc.text('Metodo', margine + 4, y + 5);
    doc.text('N. scontrini', larghezza - 60, y + 5, { align: 'right' });
    doc.text('Totale', larghezza - 5, y + 5, { align: 'right' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    for (const m of riepilogo.perMetodo) {
      doc.text(m.metodo, margine + 4, y + 4);
      doc.text(`${m.numeroScontrini}`, larghezza - 60, y + 4, { align: 'right' });
      doc.text(formatEuroPdf(m.totale), larghezza - 5, y + 4, { align: 'right' });
      y += 5;
      doc.setDrawColor(240, 240, 245);
      doc.line(margine, y, larghezza - margine, y);
    }
    y += 6;
  }

  // Annullati (trasparenza)
  if (riepilogo.numeroAnnullati > 0) {
    doc.setFillColor(255, 245, 240);
    doc.rect(margine, y, larghezzaUtile, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 50, 0);
    doc.text('SCONTRINI ANNULLATI NEL PERIODO', margine + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(
      `N. ${riepilogo.numeroAnnullati} - Totale annullato: ${formatEuroPdf(riepilogo.totaleAnnullati)}`,
      margine + 4,
      y + 10
    );
    y += 15;
  }

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`${azienda.ragioneSociale} - P.IVA ${azienda.partitaIva}`),
    larghezza / 2,
    altezza - 8,
    { align: 'center' }
  );

  if (scarica) {
    const nomeFile = `Report_Scontrini_${dataInizioIt.replace(/\//g, '-')}_${dataFineIt.replace(/\//g, '-')}.pdf`;
    doc.save(nomeFile);
  }

  return doc;
}

// ============================================================
// EXPORT JSON + Email
// ============================================================

/**
 * Ritorna il PDF come base64 (per invio email).
 */
export async function generaPdfRiepilogoBase64(
  dataInizio: string,
  dataFine: string
): Promise<{ base64: string; nomeFile: string }> {
  const doc = await generaPdfRiepilogo(dataInizio, dataFine, false);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];

  const dataInizioIt = new Date(dataInizio).toLocaleDateString('it-IT').replace(/\//g, '-');
  const dataFineIt = new Date(dataFine).toLocaleDateString('it-IT').replace(/\//g, '-');
  const nomeFile = `Report_Scontrini_${dataInizioIt}_${dataFineIt}.pdf`;

  return { base64, nomeFile };
}

// ============================================================
// UTILITY DATE
// ============================================================

function dataToISO(d: Date): string {
  // Formato YYYY-MM-DD usando ora locale (non UTC)
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

export function primiGiorniMese(data?: Date): { inizio: string; fine: string } {
  const d = data || new Date();
  const anno = d.getFullYear();
  const mese = d.getMonth();

  const inizio = new Date(anno, mese, 1);
  const fine = new Date(anno, mese + 1, 0);

  return {
    inizio: dataToISO(inizio),
    fine: dataToISO(fine),
  };
}

export function annoCorrente(): { inizio: string; fine: string } {
  const anno = new Date().getFullYear();
  return {
    inizio: `${anno}-01-01`,
    fine: `${anno}-12-31`,
  };
}
