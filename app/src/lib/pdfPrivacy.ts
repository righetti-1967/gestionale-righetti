import jsPDF from 'jspdf';
import type { Cliente } from './clienti';
import { caricaDatiAziendali } from './datiAziendali';
import { formatSede, type DatiAziendali } from './studio';
import { caricaPrivacy } from './privacy';
import { caricaLogoBase64 } from './logo';

export async function generaPdfPrivacyCompleto(
  c: Cliente,
  firmaBase64?: string | null
): Promise<jsPDF> {
  const az: DatiAziendali = await caricaDatiAziendali();
  const privacy = await caricaPrivacy();
  const testoPrivacy = privacy.testoInformativa;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const paginaLarghezza = 210;
  const paginaAltezza = 297;
  const margin = 18;
  const larghezzaTesto = paginaLarghezza - margin * 2;
  let y = 0;

  // HEADER (sfondo bianco, testo nero)
  const logo = await caricaLogoBase64();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, 10, 22, 0);
    } catch (err) {
      console.error('Errore logo:', err);
    }
  }

  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(az.ragioneSociale, paginaLarghezza - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Sede Operativa: ${formatSede(az.sedeOperativa)}`, paginaLarghezza - margin, 19, { align: 'right' });
  doc.text(`Sede Legale: ${formatSede(az.sedeLegale)}`, paginaLarghezza - margin, 23, { align: 'right' });

  y = 42;
  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI', paginaLarghezza / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('ai sensi del Regolamento UE 2016/679 (GDPR)', paginaLarghezza / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, paginaLarghezza - margin, y);
  y += 8;

  doc.setTextColor(0, 122, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("DATI DELL'INTERESSATO", margin, y);
  y += 6;

  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  function scriviCampo(etichetta: string, valore: string, x: number, yPos: number) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${etichetta}:`, x, yPos);
    doc.setFont('helvetica', 'normal');
    const etichettaLarghezza = doc.getTextWidth(`${etichetta}: `);
    doc.text(valore, x + etichettaLarghezza, yPos);
  }

  const colonnaSinistra = margin;
  const colonnaDestra = margin + larghezzaTesto / 2 + 5;
  const altezzaRiga = 5.5;

  scriviCampo('Nome e Cognome', c.nome_cognome, colonnaSinistra, y);
  y += altezzaRiga;
  scriviCampo('Codice Fiscale', c.codice_fiscale?.toUpperCase() || '—', colonnaSinistra, y);
  if (c.partita_iva) {
    scriviCampo('Partita IVA', c.partita_iva, colonnaDestra, y);
  }
  y += altezzaRiga;
  if (c.email) {
    scriviCampo('Email', c.email, colonnaSinistra, y);
  }
  if (c.cellulare) {
    scriviCampo('Telefono', c.cellulare, colonnaDestra, y);
  }
  y += altezzaRiga;

  const indirizzo = [
    c.indirizzo_residenza,
    c.cap_residenza,
    c.citta_residenza,
    c.provincia_residenza ? `(${c.provincia_residenza})` : '',
  ].filter(Boolean).join(' ');
  if (indirizzo) {
    scriviCampo('Indirizzo', indirizzo, colonnaSinistra, y);
    y += altezzaRiga;
  }

  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, paginaLarghezza - margin, y);
  y += 8;

  doc.setTextColor(0, 122, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INFORMATIVA', margin, y);
  y += 6;

  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const placeholder = '[Verrà compilato automaticamente con la ragione sociale e la sede legale dell\'azienda]';
  const datiTitolare = `${az.ragioneSociale}, Sede Legale: ${formatSede(az.sedeLegale)}, nella persona del suo legale rappresentante.`;
  const testoFinale = testoPrivacy.includes(placeholder)
    ? testoPrivacy.replace(placeholder, datiTitolare)
    : testoPrivacy;

  const righeInformativa = doc.splitTextToSize(testoFinale, larghezzaTesto);
  for (const riga of righeInformativa) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(riga, margin, y);
    y += 4;
  }

  y += 6;
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, paginaLarghezza - margin, y);
  y += 8;

  doc.setTextColor(0, 122, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("PRESA VISIONE DELL'INFORMATIVA", margin, y);
  y += 6;

  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const presaVisione = "Il/La sottoscritto/a dichiara di aver ricevuto e letto la presente informativa sul trattamento dei dati personali ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR).";
  const presaVisioneLines = doc.splitTextToSize(presaVisione, larghezzaTesto);
  doc.text(presaVisioneLines, margin, y);
  y += presaVisioneLines.length * 4 + 4;

  doc.setFontSize(9);
  const dataOra = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.text(`Luogo: ${az.sedeOperativa?.citta || az.sedeLegale?.citta || 'Milano'}`, margin, y);
  doc.text(`Data: ${dataOra}`, margin + larghezzaTesto / 2, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Firma per presa visione:', margin, y);
  y += 2;

  const firmaEffettiva = firmaBase64 || c.privacy_firma_immagine;
  if (firmaEffettiva) {
    try {
      doc.addImage(firmaEffettiva, 'PNG', margin, y, 70, 25);
    } catch (err) {
      console.error('Errore firma 1:', err);
    }
  }
  y += 28;

  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, paginaLarghezza - margin, y);
  y += 8;

  doc.setTextColor(0, 122, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CONSENSO AL TRATTAMENTO DEI DATI PERSONALI', margin, y);
  y += 6;

  doc.setTextColor(28, 28, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const consenso = "Il/La sottoscritto/a, essendo stato/a informato/a dell'identità del Titolare del trattamento, delle modalità e delle finalità del trattamento, del diritto di revoca del consenso, così come indicato nell'informativa sottoscritta ai sensi dell'art. 13 del GDPR, con la sottoscrizione del presente modulo ACCONSENTE al trattamento dei propri dati personali, anche particolari (dati sanitari), secondo le modalità descritte nella presente informativa.";
  const consensoLines = doc.splitTextToSize(consenso, larghezzaTesto);
  doc.text(consensoLines, margin, y);
  y += consensoLines.length * 4 + 4;

  doc.setFontSize(9);
  doc.text(`Luogo: ${az.sedeOperativa?.citta || az.sedeLegale?.citta || 'Milano'}`, margin, y);
  doc.text(`Data: ${dataOra}`, margin + larghezzaTesto / 2, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Firma per consenso:', margin, y);
  y += 2;

  if (firmaEffettiva) {
    try {
      doc.addImage(firmaEffettiva, 'PNG', margin, y, 70, 25);
    } catch (err) {
      console.error('Errore firma 2:', err);
    }
  }

  const totalePagine = doc.getNumberOfPages();
  for (let i = 1; i <= totalePagine; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento generato automaticamente dal Gestionale Righetti 1967 - Cliente ID ${c.id}`, paginaLarghezza / 2, paginaAltezza - 8, { align: 'center' });
    doc.text(`Pagina ${i} di ${totalePagine}`, paginaLarghezza - margin, paginaAltezza - 8, { align: 'right' });
  }

  return doc;
}
