import { jsPDF } from 'jspdf';
import type { OrdineConFornitore } from './ordini';
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

export async function generaPdfOrdine(ordine: OrdineConFornitore): Promise<void> {
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
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(
    normalizza(`ORDINE N. ${ordine.numero_ordine}`),
    margineSinistro + 4,
    y + 8
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    normalizza(`Data: ${formatDataPdf(ordine.data_ordine)}`),
    paginaLarghezza - margineDestro - 4,
    y + 8,
    { align: 'right' }
  );

  y += 18;

  const colonnaSx = margineSinistro;
  const colonnaDx = margineSinistro + larghezzaUtile / 2 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('DESTINATARIO'), colonnaSx, y);
  doc.text(normalizza('RIFERIMENTI'), colonnaDx, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  let ySx = y;
  doc.setFont('helvetica', 'bold');
  doc.text(
    normalizza(ordine.fornitore?.ragione_sociale || '—'),
    colonnaSx,
    ySx
  );
  ySx += 5;

  doc.setFont('helvetica', 'normal');

  if (ordine.fornitore?.indirizzo) {
    let indirizzoLine = ordine.fornitore.indirizzo;
    if (ordine.fornitore.cap || ordine.fornitore.citta) {
      indirizzoLine += `, ${ordine.fornitore.cap || ''} ${ordine.fornitore.citta || ''}`.trim();
    }
    if (ordine.fornitore.provincia) {
      indirizzoLine += ` (${ordine.fornitore.provincia})`;
    }
    doc.text(normalizza(indirizzoLine), colonnaSx, ySx);
    ySx += 5;
  }

  if (ordine.fornitore?.partita_iva) {
    doc.text(normalizza(`P.IVA: ${ordine.fornitore.partita_iva}`), colonnaSx, ySx);
    ySx += 5;
  }
  if (ordine.fornitore?.codice_fiscale) {
    doc.text(normalizza(`C.F.: ${ordine.fornitore.codice_fiscale}`), colonnaSx, ySx);
    ySx += 5;
  }
  if (ordine.fornitore?.telefono) {
    doc.text(normalizza(`Tel: ${ordine.fornitore.telefono}`), colonnaSx, ySx);
    ySx += 5;
  }
  if (ordine.fornitore?.email) {
    doc.text(normalizza(`Email: ${ordine.fornitore.email}`), colonnaSx, ySx);
    ySx += 5;
  }

  let yDx = y;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 30);
  doc.text(normalizza(`Data ordine: ${formatDataPdf(ordine.data_ordine)}`), colonnaDx, yDx);
  yDx += 5;

  if (ordine.data_consegna_prevista) {
    doc.text(
      normalizza(`Consegna prevista: ${formatDataPdf(ordine.data_consegna_prevista)}`),
      colonnaDx,
      yDx
    );
    yDx += 5;
  }

  if (ordine.fornitore?.giorni_consegna) {
    doc.setFont('helvetica', 'bold');
    doc.text(
      normalizza(`Consegna solo di: ${ordine.fornitore.giorni_consegna}`),
      colonnaDx,
      yDx
    );
    yDx += 5;
    doc.setFont('helvetica', 'normal');
  }

  doc.setFont('helvetica', 'bold');
  doc.text(normalizza('Indirizzo di consegna:'), colonnaDx, yDx);
  yDx += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(normalizza(formatSede(azienda.sedeOperativa)), colonnaDx, yDx);
  yDx += 5;

  y = Math.max(ySx, yDx) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('PRODOTTI ORDINATI'), margineSinistro, y);
  y += 4;

  const colDesc = margineSinistro;
  const colQta = margineSinistro + larghezzaUtile * 0.52;
  const colPrezzo = margineSinistro + larghezzaUtile * 0.68;
  const colSconto = margineSinistro + larghezzaUtile * 0.82;
  const colTotale = paginaLarghezza - margineDestro;

  doc.setFillColor(245, 245, 248);
  doc.rect(margineSinistro, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 70);
  doc.text(normalizza('Descrizione'), colDesc + 2, y + 5);
  doc.text(normalizza('Qta'), colQta, y + 5, { align: 'center' });
  doc.text(normalizza('Prezzo'), colPrezzo, y + 5, { align: 'right' });
  doc.text(normalizza('Sc.'), colSconto, y + 5, { align: 'right' });
  doc.text(normalizza('Totale'), colTotale, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  if (ordine.righe && ordine.righe.length > 0) {
    for (const riga of ordine.righe) {
      if (y > 250) {
        doc.addPage();
        y = 20;

        doc.setFillColor(245, 245, 248);
        doc.rect(margineSinistro, y, larghezzaUtile, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 70);
        doc.text(normalizza('Descrizione'), colDesc + 2, y + 5);
        doc.text(normalizza('Qta'), colQta, y + 5, { align: 'center' });
        doc.text(normalizza('Prezzo'), colPrezzo, y + 5, { align: 'right' });
        doc.text(normalizza('Sc.'), colSconto, y + 5, { align: 'right' });
        doc.text(normalizza('Totale'), colTotale, y + 5, { align: 'right' });
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 30);
      }

      const totale = riga.quantita * riga.prezzo_scontato_lordo;
      const desc = riga.nome_prodotto.length > 50
        ? riga.nome_prodotto.slice(0, 47) + '...'
        : riga.nome_prodotto;

      doc.text(normalizza(desc), colDesc + 2, y + 4);

      if (riga.nome_originale_fornitore) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 130);
        const nomeOrig = riga.nome_originale_fornitore.length > 55
          ? riga.nome_originale_fornitore.slice(0, 52) + '...'
          : riga.nome_originale_fornitore;
        doc.text(normalizza(nomeOrig), colDesc + 2, y + 7.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 30);
        doc.text(String(riga.quantita), colQta, y + 4, { align: 'center' });
        doc.text(formatEuroPdf(riga.prezzo_acquisto_lordo), colPrezzo, y + 4, { align: 'right' });
        doc.text(
          riga.sconto_percentuale > 0 ? `${riga.sconto_percentuale}%` : '—',
          colSconto,
          y + 4,
          { align: 'right' }
        );
        doc.text(formatEuroPdf(totale), colTotale, y + 4, { align: 'right' });

        y += 9;
      } else {
        doc.text(String(riga.quantita), colQta, y + 4, { align: 'center' });
        doc.text(formatEuroPdf(riga.prezzo_acquisto_lordo), colPrezzo, y + 4, { align: 'right' });
        doc.text(
          riga.sconto_percentuale > 0 ? `${riga.sconto_percentuale}%` : '—',
          colSconto,
          y + 4,
          { align: 'right' }
        );
        doc.text(formatEuroPdf(totale), colTotale, y + 4, { align: 'right' });

        y += 6;
      }

      doc.setDrawColor(240, 240, 245);
      doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    }
  } else {
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza('(nessun prodotto)'), colDesc + 2, y + 4);
    y += 6;
  }

  y += 6;

  const totaleLabelX = paginaLarghezza - margineDestro - 55;
  const totaleValoreX = paginaLarghezza - margineDestro;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 70);

  doc.text(normalizza('Netto imponibile'), totaleLabelX, y);
  doc.text(formatEuroPdf(Number(ordine.totale_netto)), totaleValoreX, y, { align: 'right' });
  y += 5;

  doc.text(normalizza('IVA 22%'), totaleLabelX, y);
  doc.text(formatEuroPdf(Number(ordine.totale_iva)), totaleValoreX, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(200, 200, 210);
  doc.line(totaleLabelX, y - 3, totaleValoreX, y - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 30);
  doc.text(normalizza('Totale'), totaleLabelX, y + 2);
  doc.text(formatEuroPdf(Number(ordine.totale_lordo)), totaleValoreX, y + 2, { align: 'right' });
  y += 12;

  if (ordine.note) {
    doc.setDrawColor(220, 220, 225);
    doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza('NOTE'), margineSinistro, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 70);
    const righeNote = doc.splitTextToSize(normalizza(ordine.note), larghezzaUtile);
    doc.text(righeNote, margineSinistro, y);
  }

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  y += 4;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 146, 60);
  doc.setLineWidth(0.4);
  doc.rect(margineSinistro, y, larghezzaUtile, 28, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(194, 65, 12);
  doc.text(
    normalizza(
      `CONSEGNA SOLO DI: ${ordine.fornitore?.giorni_consegna || 'Giovedì e Venerdì'}`
    ),
    margineSinistro + 4,
    y + 7
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 80, 50);
  doc.text(
    normalizza('Indirizzo di consegna:'),
    margineSinistro + 4,
    y + 14
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    normalizza(azienda.ragioneSociale),
    margineSinistro + 4,
    y + 19
  );

  doc.text(
    normalizza(formatSede(azienda.sedeOperativa)),
    margineSinistro + 4,
    y + 24
  );

  y += 34;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`${azienda.ragioneSociale} - P.IVA ${azienda.partitaIva} - SDI ${azienda.codiceSdi}`),
    paginaLarghezza / 2,
    paginaAltezza - 8,
    { align: 'center' }
  );

  const numeroSafe = ordine.numero_ordine.replace(/\//g, '-');
  const fornitoreSafe = (ordine.fornitore?.ragione_sociale || 'fornitore').replace(/\s+/g, '_');
  const nomeFile = `Ordine_${numeroSafe}_${fornitoreSafe}.pdf`;
  doc.save(nomeFile);
}
