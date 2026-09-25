import { jsPDF } from 'jspdf';
import type { ScaricoConCliente } from './scarichi';
import { caricaDatiAziendali } from './datiAziendali';
import { formatSede, type DatiAziendali } from './studio';
import { caricaLogoBase64 } from './logo';

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

function formatNumeroDdt(numeroDdt: number, dataSeduta: string): string {
  const anno = new Date(dataSeduta).getFullYear();
  const progressivo = String(numeroDdt).padStart(3, '0');
  return `DDT-${progressivo}-${anno}`;
}

function nomeMese(mese: string): string {
  const [anno, m] = mese.split('-');
  const data = new Date(Number(anno), Number(m) - 1, 1);
  return data.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

/**
 * Genera e scarica il report PDF mensile del DDT Commercialista.
 */
export async function generaPdfReportDdtCommercialista(
  scarichi: ScaricoConCliente[],
  mese: string
): Promise<void> {
  const azienda: DatiAziendali = await caricaDatiAziendali();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const paginaLarghezza = 210;
  const paginaAltezza = 297;
  const margineSinistro = 15;
  const margineDestro = 15;
  const larghezzaUtile = paginaLarghezza - margineSinistro - margineDestro;

  let y = 15;

  const logo = await caricaLogoBase64();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margineSinistro, y, 35, 0);
    } catch (err) {
      console.error('Errore logo:', err);
    }
  }

  const colonnaDatiX = paginaLarghezza - margineDestro;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 30);
  doc.text(normalizza(azienda.ragioneSociale), colonnaDatiX, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 90);

  let yDati = y + 9;
  doc.text(normalizza(`Sede operativa: ${formatSede(azienda.sedeOperativa)}`), colonnaDatiX, yDati, { align: 'right' });
  yDati += 4;
  doc.text(normalizza(`Sede legale: ${formatSede(azienda.sedeLegale)}`), colonnaDatiX, yDati, { align: 'right' });
  yDati += 4;
  doc.text(
    normalizza(`P.IVA ${azienda.partitaIva}  |  SDI ${azienda.codiceSdi}  |  Tel. ${azienda.telefono}`),
    colonnaDatiX,
    yDati,
    { align: 'right' }
  );

  y = Math.max(y + 30, yDati + 6);

  doc.setFillColor(0, 122, 255);
  doc.rect(margineSinistro, y, larghezzaUtile, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(
    normalizza(`REPORT DDT COMMERCIALISTA - ${nomeMese(mese).toUpperCase()}`),
    margineSinistro + 4,
    y + 8
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const oggi = new Date().toLocaleDateString('it-IT');
  doc.text(normalizza(`Generato il ${oggi}`), paginaLarghezza - margineDestro - 4, y + 8, {
    align: 'right',
  });

  y += 18;

  const totaleNetto = scarichi.reduce(
    (sum, s) => sum + Number(s.totale_netto_iva || 0),
    0
  );
  const totaleLordo = scarichi.reduce(
    (sum, s) => sum + Number(s.totale_lordo_scontato || 0),
    0
  );
  const firmatiCount = scarichi.filter((s) => s.firmato).length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('RIEPILOGO'), margineSinistro, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 30);

  doc.text(normalizza(`Numero DDT: ${scarichi.length}`), margineSinistro, y);
  y += 5;
  doc.text(normalizza(`DDT firmati: ${firmatiCount} / ${scarichi.length}`), margineSinistro, y);
  y += 5;
  doc.text(normalizza(`Totale lordo (riferimento): ${formatEuroPdf(totaleLordo)}`), margineSinistro, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('ELENCO DDT'), margineSinistro, y);
  y += 4;

  const colNumero = margineSinistro;
  const colData = margineSinistro + larghezzaUtile * 0.28;
  const colCliente = margineSinistro + larghezzaUtile * 0.45;
  const colTotale = paginaLarghezza - margineDestro;

  doc.setFillColor(245, 245, 248);
  doc.rect(margineSinistro, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 70);
  doc.text(normalizza('Numero'), colNumero + 2, y + 5);
  doc.text(normalizza('Data'), colData, y + 5);
  doc.text(normalizza('Cliente'), colCliente, y + 5);
  doc.text(normalizza('Tot. Imponibile'), colTotale, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  if (scarichi.length === 0) {
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza('(nessun DDT nel mese)'), colNumero + 2, y + 4);
    y += 6;
  } else {
    for (const s of scarichi) {
      if (y > 250) {
        doc.addPage();
        y = 20;

        doc.setFillColor(245, 245, 248);
        doc.rect(margineSinistro, y, larghezzaUtile, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 70);
        doc.text(normalizza('Numero'), colNumero + 2, y + 5);
        doc.text(normalizza('Data'), colData, y + 5);
        doc.text(normalizza('Cliente'), colCliente, y + 5);
        doc.text(normalizza('Tot. Imponibile'), colTotale, y + 5, { align: 'right' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 30);
      }

      const numFormattato = formatNumeroDdt(s.numero_ddt, s.data_seduta);
      const clienteNome = s.cliente?.nome_cognome || '—';
      const desc = clienteNome.length > 40 ? clienteNome.slice(0, 37) + '...' : clienteNome;

      doc.text(normalizza(numFormattato), colNumero + 2, y + 4);
      doc.text(formatDataPdf(s.data_seduta), colData, y + 4);
      doc.text(normalizza(desc), colCliente, y + 4);
      doc.text(formatEuroPdf(Number(s.totale_netto_iva)), colTotale, y + 4, { align: 'right' });

      y += 6;
      doc.setDrawColor(240, 240, 245);
      doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    }
  }

  y += 8;

  const totaleLabelX = paginaLarghezza - margineDestro - 60;
  const totaleValoreX = paginaLarghezza - margineDestro;

  doc.setDrawColor(200, 200, 210);
  doc.line(totaleLabelX, y - 3, totaleValoreX, y - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 30);
  doc.text(normalizza('Totale netto IVA'), totaleLabelX, y + 2);
  doc.text(formatEuroPdf(totaleNetto), totaleValoreX, y + 2, { align: 'right' });
  y += 14;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`${azienda.ragioneSociale} - P.IVA ${azienda.partitaIva} - SDI ${azienda.codiceSdi}`),
    paginaLarghezza / 2,
    paginaAltezza - 8,
    { align: 'center' }
  );

  const nomeFile = `Report_DDT_Commercialista_${mese}.pdf`;
  doc.save(nomeFile);
}
