/**
 * PDF Analytics — Export A4
 * - Report singolo cliente
 * - Report aggregato periodo
 */
import { jsPDF } from 'jspdf';
import type { ReportCliente, ReportAggregato } from './analytics';
import { caricaDatiAziendali } from './datiAziendali';

// ============================================================
// HELPER
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

function formatEuro(importo: number): string {
  return normalizza(
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(importo)
  );
}

function formatDataIt(dataISO: string | null | undefined): string {
  if (!dataISO) return '—';
  try {
    return new Date(dataISO + 'T00:00:00').toLocaleDateString('it-IT');
  } catch {
    return dataISO;
  }
}

// ============================================================
// HEADER COMUNE
// ============================================================

async function disegnaHeader(doc: jsPDF, titolo: string, sottotitolo?: string) {
  const azienda = await caricaDatiAziendali();
  const larghezza = 210;
  const margine = 15;
  let y = 15;

  // Logo (se esiste)
  // Semplificato: solo testo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(normalizza(azienda.ragioneSociale || 'Studio'), margine, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (azienda.partitaIva) {
    doc.text(normalizza(`P.IVA ${azienda.partitaIva} - C.F. ${azienda.codiceFiscale || ''}`), margine, y);
    y += 4;
  }
  const sede = azienda.sedeOperativa?.indirizzo ? azienda.sedeOperativa : azienda.sedeLegale;
  if (sede?.indirizzo) {
    doc.text(normalizza(`${sede.indirizzo}, ${sede.cap} ${sede.citta} (${sede.provincia})`), margine, y);
    y += 6;
  }

  y += 4;

  // Banda titolo
  doc.setFillColor(0, 122, 255);
  doc.rect(margine, y, larghezza - 2 * margine, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(normalizza(titolo), larghezza / 2, y + 8, { align: 'center' });
  y += 18;

  doc.setTextColor(0, 0, 0);

  if (sottotitolo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(normalizza(sottotitolo), larghezza / 2, y, { align: 'center' });
    y += 8;
  }

  return y;
}

// ============================================================
// PDF SINGOLO CLIENTE
// ============================================================

export async function generaPdfReportCliente(
  report: ReportCliente,
  scarica = false
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const larghezza = 210;
  const margine = 15;
  const larghezzaUtile = larghezza - 2 * margine;

  let y = await disegnaHeader(doc, 'REPORT CLIENTE', report.nomeCliente);

  y += 2;

  // KPI GRID (2x2)
  const kpi = [
    { label: 'Totale Spesa', value: formatEuro(report.spesaTotale) },
    { label: 'Scontrino Medio', value: formatEuro(report.scontrinoMedio) },
    { label: 'Fiches Media', value: formatEuro(report.fichesMedia) },
    { label: 'Passaggi', value: String(report.numeroPassaggi) },
  ];

  const kpiW = (larghezzaUtile - 4) / 2;
  const kpiH = 22;

  for (let i = 0; i < kpi.length; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = margine + col * (kpiW + 4);
    const yy = y + row * (kpiH + 4);

    doc.setFillColor(245, 245, 248);
    doc.roundedRect(x, yy, kpiW, kpiH, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza(kpi[i].label.toUpperCase()), x + 5, yy + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(normalizza(kpi[i].value), x + 5, yy + 17);
  }

  y += kpiH * 2 + 4 + 8;

  // DATE
  if (report.primaSeduta) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 130);
    doc.text(
      normalizza(`Prima seduta: ${report.primaSeduta}   |   Ultima seduta: ${report.ultimaSeduta || '—'}`),
      margine,
      y
    );
    y += 8;
  }

  // DETTAGLIO SPESA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DETTAGLIO SPESA', margine, y);
  y += 5;

  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Voce', margine + 4, y + 5);
  doc.text('Importo', larghezza - margine - 4, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  const dettagli = [
    { label: 'Scontrini', importo: report.spesaScontrini },
    { label: 'Fatture', importo: report.spesaFatture },
  ];

  for (const d of dettagli) {
    doc.text(normalizza(d.label), margine + 4, y + 4);
    doc.text(formatEuro(d.importo), larghezza - margine - 4, y + 4, { align: 'right' });
    y += 5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTALE', margine + 4, y + 5);
  doc.text(formatEuro(report.spesaTotale), larghezza - margine - 4, y + 5, { align: 'right' });
  y += 12;

  // RIPARTIZIONE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RIPARTIZIONE SPESA', margine, y);
  y += 6;

  const percentuali = [
    { label: 'Servizi', perc: report.percentualeServizi },
    { label: 'Prodotti', perc: report.percentualeProdotti },
  ];

  for (const p of percentuali) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(normalizza(`${p.label}: ${p.perc.toFixed(1)}%`), margine, y);
    y += 4;

    const barW = larghezzaUtile;
    doc.setFillColor(230, 230, 235);
    doc.rect(margine, y, barW, 4, 'F');
    doc.setFillColor(0, 122, 255);
    doc.rect(margine, y, (barW * p.perc) / 100, 4, 'F');
    y += 7;
  }

  y += 3;

  // SERVIZI ACQUISTATI
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`SERVIZI ACQUISTATI (${report.serviziAcquistati.length})`, margine, y);
  y += 5;

  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFontSize(9);
  doc.text('Servizio', margine + 4, y + 5);
  doc.text('Qta', larghezza - 70, y + 5, { align: 'right' });
  doc.text('%', larghezza - 45, y + 5, { align: 'right' });
  doc.text('Spesa', larghezza - margine - 4, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const s of report.serviziAcquistati) {
    const nome = s.nome.length > 45 ? s.nome.slice(0, 42) + '...' : s.nome;
    doc.text(normalizza(nome), margine + 4, y + 4);
    doc.text(String(s.quantita), larghezza - 70, y + 4, { align: 'right' });
    doc.text(`${s.percentuale.toFixed(1)}%`, larghezza - 45, y + 4, { align: 'right' });
    doc.text(formatEuro(s.spesa), larghezza - margine - 4, y + 4, { align: 'right' });
    y += 5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  y += 5;

  // PRODOTTI ACQUISTATI
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`PRODOTTI ACQUISTATI (${report.prodottiAcquistati.length})`, margine, y);
  y += 5;

  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFontSize(9);
  doc.text('Prodotto', margine + 4, y + 5);
  doc.text('Qta', larghezza - 70, y + 5, { align: 'right' });
  doc.text('%', larghezza - 45, y + 5, { align: 'right' });
  doc.text('Spesa', larghezza - margine - 4, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const p of report.prodottiAcquistati) {
    const nome = p.nome.length > 45 ? p.nome.slice(0, 42) + '...' : p.nome;
    doc.text(normalizza(nome), margine + 4, y + 4);
    doc.text(String(p.quantita), larghezza - 70, y + 4, { align: 'right' });
    doc.text(`${p.percentuale.toFixed(1)}%`, larghezza - 45, y + 4, { align: 'right' });
    doc.text(formatEuro(p.spesa), larghezza - margine - 4, y + 4, { align: 'right' });
    y += 5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`Generato il ${new Date().toLocaleString('it-IT')}`),
    larghezza / 2,
    290,
    { align: 'center' }
  );

  if (scarica) {
    const nomeFile = `Report_Cliente_${report.nomeCliente.replace(/\s+/g, '_')}.pdf`;
    doc.save(nomeFile);
  }

  return doc;
}

// ============================================================
// PDF AGGREGATO
// ============================================================

export async function generaPdfReportAggregato(
  report: ReportAggregato,
  scarica = false
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const larghezza = 297;
  const altezza = 210;
  const margine = 10;
  const larghezzaUtile = larghezza - 2 * margine;

  let y = 12;

  const azienda = await caricaDatiAziendali();

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(normalizza(azienda.ragioneSociale || 'Studio'), margine, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (azienda.partitaIva) {
    doc.text(normalizza(`P.IVA ${azienda.partitaIva}`), larghezza - margine, y, { align: 'right' });
  }
  y += 5;

  // Banda titolo
  doc.setFillColor(0, 122, 255);
  doc.rect(margine, y, larghezzaUtile, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    normalizza(`REPORT AGGREGATO — ${report.dataInizio} / ${report.dataFine}`),
    larghezza / 2,
    y + 7,
    { align: 'center' }
  );
  y += 14;

  doc.setTextColor(0, 0, 0);

  // KPI grid (4x2)
  const kpi = [
    { label: 'Totale Incassato', value: formatEuro(report.spesaTotale) },
    { label: 'Clienti Passati', value: `${report.numeroClientiPassati}/${report.numeroClientiTotali}` },
    { label: 'Scontrino Medio', value: formatEuro(report.scontrinoMedio) },
    { label: 'Fiches Media', value: formatEuro(report.fichesMedia) },
    { label: 'Passaggi Totali', value: String(report.numeroPassaggi) },
    { label: 'Fiches Totali', value: String(report.totaleFiches) },
    { label: 'Passaggi/Cliente', value: String(report.passaggiPerCliente) },
    { label: 'Documenti', value: String(report.numeroScontrini + report.numeroFatture) },
  ];

  const kpiW = (larghezzaUtile - 6) / 4;
  const kpiH = 18;

  for (let i = 0; i < kpi.length; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = margine + col * (kpiW + 2);
    const yy = y + row * (kpiH + 2);

    doc.setFillColor(245, 245, 248);
    doc.roundedRect(x, yy, kpiW, kpiH, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza(kpi[i].label.toUpperCase()), x + 3, yy + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(normalizza(kpi[i].value), x + 3, yy + 14);
  }

  y += kpiH * 2 + 2 + 8;

  // RIPARTIZIONE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RIPARTIZIONE SPESA', margine, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(normalizza(`Servizi: ${report.percentualeServizi.toFixed(1)}%    Prodotti: ${report.percentualeProdotti.toFixed(1)}%`), margine, y);
  y += 8;

  // RANKING CLIENTI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`RANKING CLIENTI (${report.clientiTop.length})`, margine, y);
  y += 5;

  const colCliente = margine + 4;
  const colPassaggi = larghezza * 0.55;
  const colMedio = larghezza * 0.7;
  const colPerc = larghezza * 0.82;
  const colTotale = larghezza - margine - 4;

  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFontSize(8);
  doc.text('Cliente', colCliente, y + 5);
  doc.text('Passaggi', colPassaggi, y + 5, { align: 'right' });
  doc.text('Scontrino medio', colMedio, y + 5, { align: 'right' });
  doc.text('%', colPerc, y + 5, { align: 'right' });
  doc.text('Totale', colTotale, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (let i = 0; i < report.clientiTop.length; i++) {
    const c = report.clientiTop[i];
    const nome = c.nomeCliente.length > 40 ? c.nomeCliente.slice(0, 38) + '...' : c.nomeCliente;

    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margine, y, larghezzaUtile, 5.5, 'F');
    }

    doc.text(normalizza(nome), colCliente, y + 4);
    doc.text(String(c.numeroPassaggi), colPassaggi, y + 4, { align: 'right' });
    doc.text(formatEuro(c.scontrinoMedio), colMedio, y + 4, { align: 'right' });
    doc.text(`${c.percentuale.toFixed(1)}%`, colPerc, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuro(c.spesaTotale), colTotale, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 5.5;

    if (y > altezza - 15) {
      doc.addPage();
      y = 15;
    }
  }

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`Generato il ${new Date().toLocaleString('it-IT')}`),
    larghezza / 2,
    altezza - 5,
    { align: 'center' }
  );

  if (scarica) {
    const nomeFile = `Report_Aggregato_${report.dataInizio}_${report.dataFine}.pdf`;
    doc.save(nomeFile);
  }

  return doc;
}
