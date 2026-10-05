/**
 * PDF + CSV Report Competenza Percorsi
 */
import { jsPDF } from 'jspdf';
import type { ReportCompetenza } from './reportCompetenza';
import { caricaDatiAziendali } from './datiAziendali';

function normalizza(testo: string): string {
  const mappa: Record<string, string> = {
    à: 'a', á: 'a', è: 'e', é: 'e', ì: 'i', í: 'i',
    ò: 'o', ó: 'o', ù: 'u', ú: 'u',
    À: 'A', Á: 'A', È: 'E', É: 'E', Ì: 'I', Í: 'I',
    Ò: 'O', Ó: 'O', Ù: 'U', Ú: 'U',
    '€': 'EUR', '’': "'",
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

function formatDataIt(dataISO: string): string {
  try {
    return new Date(dataISO + 'T00:00:00').toLocaleDateString('it-IT');
  } catch {
    return dataISO;
  }
}

// ============================================================
// PDF A4
// ============================================================

export async function generaPdfCompetenza(
  report: ReportCompetenza,
  scarica = false
): Promise<jsPDF> {
  const azienda = await caricaDatiAziendali();

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const larghezza = 210;
  const altezza = 297;
  const margine = 15;
  const larghezzaUtile = larghezza - 2 * margine;

  let y = 15;

  // Header
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

  // Titolo
  doc.setFillColor(0, 122, 255);
  doc.rect(margine, y, larghezzaUtile, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(
    normalizza(`REPORT COMPETENZA PERCORSI — ANNO ${report.anno}`),
    larghezza / 2,
    y + 8,
    { align: 'center' }
  );
  y += 18;

  doc.setTextColor(0, 0, 0);

  // === KPI BOX ===
  const boxH = 36;
  doc.setFillColor(240, 248, 240);
  doc.rect(margine, y, larghezzaUtile, boxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RIEPILOGO COMPETENZA', margine + 6, y + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const row1 = y + 15;
  doc.text('Percorsi venduti nell\'anno:', margine + 6, row1);
  doc.setFont('helvetica', 'bold');
  doc.text(formatEuroPdf(report.totaleVenduto), larghezza - margine - 6, row1, { align: 'right' });

  const row2 = y + 22;
  doc.setFont('helvetica', 'normal');
  doc.text('Consumato nell\'anno:', margine + 6, row2);
  doc.setFont('helvetica', 'bold');
  doc.text('-' + formatEuroPdf(report.totaleUtilizzato), larghezza - margine - 6, row2, { align: 'right' });

  const row3 = y + 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 100, 0);
  doc.text('RISCONTO PASSIVO 31/12:', margine + 6, row3);
  doc.text(formatEuroPdf(report.totaleResiduo), larghezza - margine - 6, row3, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  y += boxH + 8;

  // === DETTAGLIO PER CLIENTE ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`DETTAGLIO PER CLIENTE (${report.righeCliente.length})`, margine, y);
  y += 5;

  const colCliente = margine + 4;
  const colVenduto = margine + larghezzaUtile * 0.55;
  const colUtilizzato = margine + larghezzaUtile * 0.72;
  const colResiduo = larghezza - margine - 4;

  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Cliente', colCliente, y + 5);
  doc.text('Venduto', colVenduto, y + 5, { align: 'right' });
  doc.text('Utilizzato', colUtilizzato, y + 5, { align: 'right' });
  doc.text('Residuo', colResiduo, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const c of report.righeCliente) {
    if (y > altezza - 20) {
      doc.addPage();
      y = 20;
    }
    const nome = c.nomeCliente.length > 35 ? c.nomeCliente.slice(0, 32) + '...' : c.nomeCliente;
    doc.text(normalizza(nome), colCliente, y + 4);
    doc.text(formatEuroPdf(c.venduto), colVenduto, y + 4, { align: 'right' });
    doc.text(formatEuroPdf(c.utilizzato), colUtilizzato, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuroPdf(c.residuo), colResiduo, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);
  }

  y += 8;

  // === DETTAGLIO PERCORSI ANNO CORRENTE ===
  if (y > altezza - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`PERCORSI VENDUTI NEL ${report.anno} (${report.percorsiAnnoCorrente.length})`, margine, y);
  y += 5;

  const colNomePerc = margine + 4;
  const colClientePerc = margine + larghezzaUtile * 0.38;
  const colDataPerc = margine + larghezzaUtile * 0.55;
  const colVendutoPerc = margine + larghezzaUtile * 0.72;
  const colResiduoPerc = larghezza - margine - 4;

  doc.setFillColor(230, 230, 235);
  doc.rect(margine, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Percorso', colNomePerc, y + 5);
  doc.text('Cliente', colClientePerc, y + 5);
  doc.text('Vendita', colDataPerc, y + 5);
  doc.text('Venduto', colVendutoPerc, y + 5, { align: 'right' });
  doc.text('Residuo', colResiduoPerc, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  for (const p of report.percorsiAnnoCorrente) {
    if (y > altezza - 20) {
      doc.addPage();
      y = 20;
    }
    const nomeP = p.nomePercorso.length > 22 ? p.nomePercorso.slice(0, 20) + '...' : p.nomePercorso;
    const nomeC = p.nomeCliente.length > 18 ? p.nomeCliente.slice(0, 16) + '...' : p.nomeCliente;
    doc.text(normalizza(nomeP), colNomePerc, y + 4);
    doc.text(normalizza(nomeC), colClientePerc, y + 4);
    doc.text(formatDataIt(p.dataVendita), colDataPerc, y + 4);
    doc.text(formatEuroPdf(p.venduto), colVendutoPerc, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuroPdf(p.residuo), colResiduoPerc, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 5;
    doc.setDrawColor(240, 240, 245);
    doc.line(margine, y, larghezza - margine, y);
  }

  y += 8;

  // === PERCORSI ANNI PRECEDENTI ===
  if (report.percorsiPrecedenti.length > 0) {
    if (y > altezza - 40) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(255, 245, 230);
    doc.rect(margine, y, larghezzaUtile, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(150, 80, 0);
    doc.text(
      `PERCORSI ANNI PRECEDENTI ANCORA APERTI (${report.percorsiPrecedenti.length})`,
      margine + 4,
      y + 7
    );
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFillColor(230, 230, 235);
    doc.rect(margine, y, larghezzaUtile, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Percorso', colNomePerc, y + 5);
    doc.text('Cliente', colClientePerc, y + 5);
    doc.text('Anno', colDataPerc, y + 5);
    doc.text('Venduto', colVendutoPerc, y + 5, { align: 'right' });
    doc.text('Residuo', colResiduoPerc, y + 5, { align: 'right' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const p of report.percorsiPrecedenti) {
      if (y > altezza - 20) {
        doc.addPage();
        y = 20;
      }
      const nomeP = p.nomePercorso.length > 22 ? p.nomePercorso.slice(0, 20) + '...' : p.nomePercorso;
      const nomeC = p.nomeCliente.length > 18 ? p.nomeCliente.slice(0, 16) + '...' : p.nomeCliente;
      doc.text(normalizza(nomeP), colNomePerc, y + 4);
      doc.text(normalizza(nomeC), colClientePerc, y + 4);
      doc.text(String(p.anno), colDataPerc, y + 4);
      doc.text(formatEuroPdf(p.venduto), colVendutoPerc, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatEuroPdf(p.residuo), colResiduoPerc, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 5;
      doc.setDrawColor(240, 240, 245);
      doc.line(margine, y, larghezza - margine, y);
    }

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(150, 80, 0);
    doc.text(
      `TOTALE RESIDUO ANNI PRECEDENTI: ${formatEuroPdf(report.totaleResiduoPrecedenti)}`,
      margine,
      y
    );
    doc.setTextColor(0, 0, 0);
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
    const nomeFile = `Report_Competenza_${report.anno}.pdf`;
    doc.save(nomeFile);
  }

  return doc;
}

// ============================================================
// CSV
// ============================================================

export function generaCsvCompetenza(report: ReportCompetenza): { blob: Blob; nomeFile: string } {
  const escapeCsv = (val: string): string => {
    if (val.includes(';') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const formatEuroCsv = (n: number) => n.toFixed(2).replace('.', ',');

  const lines: string[] = [];

  // Sezione 1: Riepilogo
  lines.push('RIEPILOGO COMPETENZA');
  lines.push(`Anno;${report.anno}`);
  lines.push(`Percorsi venduti nell'anno;${formatEuroCsv(report.totaleVenduto)}`);
  lines.push(`Consumato nell'anno;${formatEuroCsv(report.totaleUtilizzato)}`);
  lines.push(`Risconto passivo 31/12;${formatEuroCsv(report.totaleResiduo)}`);
  lines.push('');

  // Sezione 2: Dettaglio cliente
  lines.push('DETTAGLIO PER CLIENTE');
  lines.push('Cliente;Venduto;Utilizzato;Residuo;N. Percorsi');
  for (const c of report.righeCliente) {
    lines.push([
      escapeCsv(c.nomeCliente),
      formatEuroCsv(c.venduto),
      formatEuroCsv(c.utilizzato),
      formatEuroCsv(c.residuo),
      String(c.numeroPercorsi),
    ].join(';'));
  }
  lines.push('');

  // Sezione 3: Percorsi anno corrente
  lines.push(`PERCORSI VENDUTI NEL ${report.anno}`);
  lines.push('Percorso;Cliente;Data Vendita;Venduto;Utilizzato;Residuo');
  for (const p of report.percorsiAnnoCorrente) {
    lines.push([
      escapeCsv(p.nomePercorso),
      escapeCsv(p.nomeCliente),
      formatDataIt(p.dataVendita),
      formatEuroCsv(p.venduto),
      formatEuroCsv(p.utilizzato),
      formatEuroCsv(p.residuo),
    ].join(';'));
  }
  lines.push('');

  // Sezione 4: Percorsi anni precedenti
  if (report.percorsiPrecedenti.length > 0) {
    lines.push('PERCORSI ANNI PRECEDENTI ANCORA APERTI');
    lines.push('Percorso;Cliente;Anno;Venduto;Utilizzato;Residuo');
    for (const p of report.percorsiPrecedenti) {
      lines.push([
        escapeCsv(p.nomePercorso),
        escapeCsv(p.nomeCliente),
        String(p.anno),
        formatEuroCsv(p.venduto),
        formatEuroCsv(p.utilizzato),
        formatEuroCsv(p.residuo),
      ].join(';'));
    }
    lines.push('');
    lines.push(`Totale residuo anni precedenti;${formatEuroCsv(report.totaleResiduoPrecedenti)}`);
  }

  const csv = '\ufeff' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const nomeFile = `Report_Competenza_${report.anno}.csv`;

  return { blob, nomeFile };
}

export function scaricaCsvCompetenza(report: ReportCompetenza): void {
  const { blob, nomeFile } = generaCsvCompetenza(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
