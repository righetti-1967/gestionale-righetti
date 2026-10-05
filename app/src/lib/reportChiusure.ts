/**
 * Report Chiusure Cassa Mensile — stile gestionale A4
 *
 * Genera:
 * - Dati tabellari (una riga per giorno del mese)
 * - PDF A4 professionale
 * - CSV per Excel
 */
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { getScontrini, type Scontrino } from './scontrini';
import { caricaDatiAziendali } from './datiAziendali';

// ============================================================
// TIPI
// ============================================================

export interface RigaGiornaliera {
  giorno: number;
  giornoSettimana: string;
  numeroScontrini: number;
  serviziLordo: number;
  serviziImponibile: number;
  prodottiLordo: number;
  prodottiImponibile: number;
  sconto: number; // negativo (importo sconti)
  contanti: number;
  carta: number;
  bancomat: number;
  prepagate: number;
  bonifico: number;
  altro: number;
  totaleLordo: number;
  totaleIva: number;
  differenzaCassa: number | null;
  chiusuraEsistente: boolean;
}

export interface ReportChiusureMese {
  anno: number;
  mese: number;
  nomeMese: string;
  righe: RigaGiornaliera[];
  totaliMese: {
    numeroScontrini: number;
    serviziLordo: number;
    serviziImponibile: number;
    prodottiLordo: number;
    prodottiImponibile: number;
    sconto: number;
    contanti: number;
    carta: number;
    bancomat: number;
    prepagate: number;
    bonifico: number;
    altro: number;
    totaleLordo: number;
    totaleIva: number;
    differenzaCassa: number;
  };
}

// ============================================================
// UTILITY
// ============================================================

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function dataToISO(d: Date): string {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

function ultimoGiornoMese(anno: number, mese: number): number {
  return new Date(anno, mese, 0).getDate();
}

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
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(n)
  );
}

function formatEuroCsv(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

// ============================================================
// CALCOLO DATI
// ============================================================

export async function calcolaReportChiusureMese(
  anno: number,
  mese: number // 1-12
): Promise<ReportChiusureMese> {
  const giorniNelMese = ultimoGiornoMese(anno, mese);

  // Periodo: dal 1° all'ultimo giorno del mese
  const dataInizio = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const dataFine = `${anno}-${String(mese).padStart(2, '0')}-${String(giorniNelMese).padStart(2, '0')}`;

  // Carico scontrini madre (attivi) del mese
  const scontrini = await getScontrini({
    dataInizio,
    dataFine,
    soloAttivi: true,
  });

  // Carico chiusure del mese
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data: chiusure } = await supabase
    .from('chiusure_cassa')
    .select('*')
    .eq('user_id', user.id)
    .gte('data_chiusura', dataInizio)
    .lte('data_chiusura', dataFine);

  const chiusureMap = new Map<string, any>();
  for (const c of chiusure || []) {
    chiusureMap.set(c.data_chiusura, c);
  }

  // Filtro solo madre
  const madri = scontrini.filter((s) => s.tipo === 'madre');

  // Raggruppo scontrini per giorno
  const perGiorno = new Map<number, Scontrino[]>();
  for (const s of madri) {
    const d = new Date(s.data_emissione);
    const giorno = d.getDate();
    const lista = perGiorno.get(giorno) || [];
    lista.push(s);
    perGiorno.set(giorno, lista);
  }

  // Genero righe giornaliere
  const righe: RigaGiornaliera[] = [];
  const totaliMese = {
    numeroScontrini: 0,
    serviziLordo: 0,
    serviziImponibile: 0,
    prodottiLordo: 0,
    prodottiImponibile: 0,
    sconto: 0,
    contanti: 0,
    carta: 0,
    bancomat: 0,
    prepagate: 0,
    bonifico: 0,
    altro: 0,
    totaleLordo: 0,
    totaleIva: 0,
    differenzaCassa: 0,
  };

  for (let giorno = 1; giorno <= giorniNelMese; giorno++) {
    const dataISO = `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
    const dataObj = new Date(anno, mese - 1, giorno);
    const giornoSettimana = GIORNI[dataObj.getDay()];

    const scontriniGiorno = perGiorno.get(giorno) || [];
    const chiusura = chiusureMap.get(dataISO);

    let serviziLordo = 0;
    let serviziImponibile = 0;
    let prodottiLordo = 0;
    let prodottiImponibile = 0;
    let scontoGiorno = 0;

    let contanti = 0;
    let carta = 0;
    let bancomat = 0;
    let prepagate = 0;
    let bonifico = 0;
    let altro = 0;
    let totaleLordo = 0;
    let totaleIva = 0;

    for (const s of scontriniGiorno) {
      const lordo = Number(s.totale_lordo || 0);
      const netto = Number(s.totale_netto || 0);
      const iva = Number(s.iva_importo || 0);

      totaleLordo += lordo;
      totaleIva += iva;

      // Sconto totale (se presente)
      if (s.sconto_totale_valore && s.sconto_totale_valore > 0) {
        const subtotale = (s.righe || []).reduce(
          (sum, r) => sum + r.quantita * r.prezzo_unitario_lordo,
          0
        );
        const scontoImporto =
          s.sconto_totale_tipo === 'percentuale'
            ? (subtotale * s.sconto_totale_valore) / 100
            : s.sconto_totale_valore;
        scontoGiorno -= scontoImporto;
      }

      // Sconti riga
      for (const r of s.righe || []) {
        if (r.sconto_valore && r.sconto_valore > 0) {
          const importoRiga = r.quantita * r.prezzo_unitario_lordo;
          if (r.sconto_tipo === 'percentuale') {
            scontoGiorno -= (importoRiga * r.sconto_valore) / 100;
          } else {
            scontoGiorno -= r.sconto_valore * r.quantita;
          }
        }
      }

      // Categorizzazione servizi vs prodotti
      for (const r of s.righe || []) {
        if (r.quantita <= 0) continue;
        const importoRigaLordo = r.quantita * r.prezzo_unitario_lordo;
        const importoRigaImponibile = importoRigaLordo / 1.22;

        if (r.tipo === 'servizio') {
          serviziLordo += importoRigaLordo;
          serviziImponibile += importoRigaImponibile;
        } else {
          prodottiLordo += importoRigaLordo;
          prodottiImponibile += importoRigaImponibile;
        }
      }

      // Metodo pagamento
      switch (s.metodo_pagamento) {
        case 'Contanti':
          contanti += lordo;
          break;
        case 'Carta':
          carta += lordo;
          break;
        case 'Bancomat':
          bancomat += lordo;
          break;
        case 'Prepagate':
          prepagate += lordo;
          break;
        case 'Bonifico':
          bonifico += lordo;
          break;
        default:
          altro += lordo;
      }
    }

    const differenzaCassa = chiusura?.differenza_cassa != null
      ? Number(chiusura.differenza_cassa)
      : null;

    righe.push({
      giorno,
      giornoSettimana,
      numeroScontrini: scontriniGiorno.length,
      serviziLordo: Number(serviziLordo.toFixed(2)),
      serviziImponibile: Number(serviziImponibile.toFixed(2)),
      prodottiLordo: Number(prodottiLordo.toFixed(2)),
      prodottiImponibile: Number(prodottiImponibile.toFixed(2)),
      sconto: Number(scontoGiorno.toFixed(2)),
      contanti: Number(contanti.toFixed(2)),
      carta: Number(carta.toFixed(2)),
      bancomat: Number(bancomat.toFixed(2)),
      prepagate: Number(prepagate.toFixed(2)),
      bonifico: Number(bonifico.toFixed(2)),
      altro: Number(altro.toFixed(2)),
      totaleLordo: Number(totaleLordo.toFixed(2)),
      totaleIva: Number(totaleIva.toFixed(2)),
      differenzaCassa,
      chiusuraEsistente: !!chiusura,
    });

    totaliMese.numeroScontrini += scontriniGiorno.length;
    totaliMese.serviziLordo += serviziLordo;
    totaliMese.serviziImponibile += serviziImponibile;
    totaliMese.prodottiLordo += prodottiLordo;
    totaliMese.prodottiImponibile += prodottiImponibile;
    totaliMese.sconto += scontoGiorno;
    totaliMese.contanti += contanti;
    totaliMese.carta += carta;
    totaliMese.bancomat += bancomat;
    totaliMese.prepagate += prepagate;
    totaliMese.bonifico += bonifico;
    totaliMese.altro += altro;
    totaliMese.totaleLordo += totaleLordo;
    totaliMese.totaleIva += totaleIva;
    if (differenzaCassa != null) {
      totaliMese.differenzaCassa += differenzaCassa;
    }
  }

  // Arrotonda totali
  Object.keys(totaliMese).forEach((k) => {
    const key = k as keyof typeof totaliMese;
    totaliMese[key] = Number((totaliMese[key] as number).toFixed(2));
  });

  return {
    anno,
    mese,
    nomeMese: MESI[mese - 1],
    righe,
    totaliMese,
  };
}

// ============================================================
// PDF A4
// ============================================================

export async function generaPdfReportChiusureA4(
  anno: number,
  mese: number,
  scarica = false
): Promise<jsPDF> {
  const azienda = await caricaDatiAziendali();
  const report = await calcolaReportChiusureMese(anno, mese);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const larghezza = 297;
  const altezza = 210;
  const margine = 10;
  const larghezzaUtile = larghezza - 2 * margine;

  let y = 12;

  // === HEADER ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(normalizza(azienda.ragioneSociale || 'Studio'), margine, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (azienda.partitaIva) {
    doc.text(
      normalizza(`P.IVA ${azienda.partitaIva} - C.F. ${azienda.codiceFiscale || ''}`),
      larghezza - margine,
      y,
      { align: 'right' }
    );
  }
  y += 5;

  const sede = azienda.sedeOperativa?.indirizzo ? azienda.sedeOperativa : azienda.sedeLegale;
  if (sede?.indirizzo) {
    doc.text(
      normalizza(`${sede.indirizzo}, ${sede.cap} ${sede.citta} (${sede.provincia})`),
      larghezza - margine,
      y,
      { align: 'right' }
    );
    y += 5;
  }

  y += 3;

  // === TITOLO ===
  doc.setFillColor(0, 122, 255);
  doc.rect(margine, y, larghezzaUtile, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    normalizza(`REPORT CHIUSURE CASSA — ${report.nomeMese.toUpperCase()} ${anno}`),
    larghezza / 2,
    y + 7,
    { align: 'center' }
  );
  y += 14;

  doc.setTextColor(0, 0, 0);

  // === COLONNE (layout calibrato su 297mm con 10mm margini) ===
  // Totale disponibile: 277mm
  // Larghezze: 24 + 10 + 24 + 24 + 22 + 22 + 20 + 22 + 22 + 18 + 26 + 22 + 21 = 277
  const colWidths = {
    giorno: 24,      // "Giorno"
    n: 10,           // "N°"
    servizi: 24,
    prodotti: 24,
    sconto: 22,
    contanti: 22,
    carta: 20,
    prepagate: 22,
    bonifico: 22,
    altro: 18,
    totale: 26,
    iva: 22,
    diff: 21,        // "Diff."
  };

  // Posizioni X (allineamento a destra per importi, sinistra per giorno)
  const colX = {
    giorno: margine,
    n: margine + colWidths.giorno + colWidths.n,
    servizi: margine + colWidths.giorno + colWidths.n + colWidths.servizi,
    prodotti: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti,
    sconto: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto,
    contanti: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti,
    carta: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti + colWidths.carta,
    prepagate: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti + colWidths.carta + colWidths.prepagate,
    bonifico: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti + colWidths.carta + colWidths.prepagate + colWidths.bonifico,
    altro: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti + colWidths.carta + colWidths.prepagate + colWidths.bonifico + colWidths.altro,
    totale: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti + colWidths.carta + colWidths.prepagate + colWidths.bonifico + colWidths.altro + colWidths.totale,
    iva: margine + colWidths.giorno + colWidths.n + colWidths.servizi + colWidths.prodotti + colWidths.sconto + colWidths.contanti + colWidths.carta + colWidths.prepagate + colWidths.bonifico + colWidths.altro + colWidths.totale + colWidths.iva,
    diff: larghezza - margine,
  };

  // === INTESTAZIONI COLONNE ===
  doc.setFillColor(240, 240, 245);
  doc.rect(margine, y, larghezzaUtile, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);

  doc.text('Giorno', colX.giorno + 2, y + 5);
  doc.text('N°', colX.n, y + 5, { align: 'right' });
  doc.text('Servizi', colX.servizi, y + 5, { align: 'right' });
  doc.text('Prodotti', colX.prodotti, y + 5, { align: 'right' });
  doc.text('Sconto', colX.sconto, y + 5, { align: 'right' });
  doc.text('Contanti', colX.contanti, y + 5, { align: 'right' });
  doc.text('Carta', colX.carta, y + 5, { align: 'right' });
  doc.text('Prepagate', colX.prepagate, y + 5, { align: 'right' });
  doc.text('Bonifico', colX.bonifico, y + 5, { align: 'right' });
  doc.text('Altro', colX.altro, y + 5, { align: 'right' });
  doc.text('Totale', colX.totale, y + 5, { align: 'right' });
  doc.text('IVA', colX.iva, y + 5, { align: 'right' });
  doc.text('Diff.', colX.diff, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);

  // === RIGHE GIORNALIERE ===
  for (const r of report.righe) {
    const isWeekend = r.giornoSettimana === 'Sab' || r.giornoSettimana === 'Dom';
    if (isWeekend) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margine, y, larghezzaUtile, 4.5, 'F');
    }

    const giornoLabel = `${r.giorno} ${r.giornoSettimana}`;
    doc.text(normalizza(giornoLabel), colX.giorno + 2, y + 4);
    doc.text(String(r.numeroScontrini), colX.n, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.serviziLordo), colX.servizi, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.prodottiLordo), colX.prodotti, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.sconto), colX.sconto, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.contanti), colX.contanti, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.carta), colX.carta, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.prepagate), colX.prepagate, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.bonifico), colX.bonifico, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(r.altro), colX.altro, y + 4, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(formatEuroPdf(r.totaleLordo), colX.totale, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(formatEuroPdf(r.totaleIva), colX.iva, y + 4, { align: 'right' });

    // Diff. cassa — SOLO se esiste chiusura E differenza != 0
    if (r.differenzaCassa != null && Math.abs(r.differenzaCassa) >= 0.01) {
      const diff = r.differenzaCassa;
      if (Math.abs(diff) <= 5) {
        doc.setTextColor(200, 120, 0);
      } else {
        doc.setTextColor(200, 0, 0);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(
        (diff >= 0 ? '+' : '') + formatEuroPdf(diff),
        colX.diff,
        y + 4,
        { align: 'right' }
      );
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(180, 180, 180);
      doc.text('—', colX.diff, y + 4, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }

    y += 4.5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);
  }

  // === RIGA TOTALI ===
  y += 2;
  doc.setFillColor(230, 240, 255);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.text('TOTALE', colX.giorno + 2, y + 5);
  doc.text(String(report.totaliMese.numeroScontrini), colX.n, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.serviziLordo), colX.servizi, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.prodottiLordo), colX.prodotti, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.sconto), colX.sconto, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.contanti), colX.contanti, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.carta), colX.carta, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.prepagate), colX.prepagate, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.bonifico), colX.bonifico, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.altro), colX.altro, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.totaleLordo), colX.totale, y + 5, { align: 'right' });
  doc.text(formatEuroPdf(report.totaliMese.totaleIva), colX.iva, y + 5, { align: 'right' });

  const diffTotale = report.totaliMese.differenzaCassa;
  if (Math.abs(diffTotale) < 0.01) {
    doc.setTextColor(0, 150, 0);
  } else if (Math.abs(diffTotale) <= 5) {
    doc.setTextColor(200, 120, 0);
  } else {
    doc.setTextColor(200, 0, 0);
  }
  doc.text(
    (diffTotale >= 0 ? '+' : '') + formatEuroPdf(diffTotale),
    colX.diff,
    y + 5,
    { align: 'right' }
  );
  doc.setTextColor(0, 0, 0);

  // === FOOTER (sotto la riga totali, in fondo) ===
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`${azienda.ragioneSociale} - P.IVA ${azienda.partitaIva} - Generato il ${new Date().toLocaleString('it-IT')}`),
    larghezza / 2,
    y + 12,
    { align: 'center' }
  );

  if (scarica) {
    const nomeFile = `Report_Chiusure_${report.nomeMese}_${anno}.pdf`;
    doc.save(nomeFile);
  }

  return doc;
}

// ============================================================
// CSV
// ============================================================

export async function generaCsvReportChiusure(
  anno: number,
  mese: number
): Promise<{ blob: Blob; nomeFile: string }> {
  const report = await calcolaReportChiusureMese(anno, mese);

  const headers = [
    'Giorno',
    'Sett.',
    'N. Scontrini',
    'Servizi (Lordo)',
    'Servizi (Imponibile)',
    'Prodotti (Lordo)',
    'Prodotti (Imponibile)',
    'Sconto',
    'Contanti',
    'Carta',
    'Bancomat',
    'Prepagate',
    'Bonifico',
    'Altro',
    'Totale Lordo',
    'IVA',
    'Diff. Cassa',
  ];

  const escapeCsv = (val: string): string => {
    if (val.includes(';') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = report.righe.map((r) => [
    String(r.giorno),
    r.giornoSettimana,
    String(r.numeroScontrini),
    formatEuroCsv(r.serviziLordo),
    formatEuroCsv(r.serviziImponibile),
    formatEuroCsv(r.prodottiLordo),
    formatEuroCsv(r.prodottiImponibile),
    formatEuroCsv(r.sconto),
    formatEuroCsv(r.contanti),
    formatEuroCsv(r.carta),
    formatEuroCsv(r.bancomat),
    formatEuroCsv(r.prepagate),
    formatEuroCsv(r.bonifico),
    formatEuroCsv(r.altro),
    formatEuroCsv(r.totaleLordo),
    formatEuroCsv(r.totaleIva),
    r.differenzaCassa != null ? formatEuroCsv(r.differenzaCassa) : '',
  ]);

  // Riga totali
  rows.push([
    'TOTALE',
    '',
    String(report.totaliMese.numeroScontrini),
    formatEuroCsv(report.totaliMese.serviziLordo),
    formatEuroCsv(report.totaliMese.serviziImponibile),
    formatEuroCsv(report.totaliMese.prodottiLordo),
    formatEuroCsv(report.totaliMese.prodottiImponibile),
    formatEuroCsv(report.totaliMese.sconto),
    formatEuroCsv(report.totaliMese.contanti),
    formatEuroCsv(report.totaliMese.carta),
    formatEuroCsv(report.totaliMese.bancomat),
    formatEuroCsv(report.totaliMese.prepagate),
    formatEuroCsv(report.totaliMese.bonifico),
    formatEuroCsv(report.totaliMese.altro),
    formatEuroCsv(report.totaliMese.totaleLordo),
    formatEuroCsv(report.totaliMese.totaleIva),
    formatEuroCsv(report.totaliMese.differenzaCassa),
  ]);

  const lines = [
    headers.map(escapeCsv).join(';'),
    ...rows.map((r) => r.map((c) => escapeCsv(String(c))).join(';')),
  ];

  const csv = '\ufeff' + lines.join('\n'); // BOM per Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  const nomeFile = `Report_Chiusure_${report.nomeMese}_${anno}.csv`;

  return { blob, nomeFile };
}

export async function scaricaCsvReportChiusure(
  anno: number,
  mese: number
): Promise<void> {
  const { blob, nomeFile } = await generaCsvReportChiusure(anno, mese);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
