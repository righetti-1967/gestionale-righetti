import { jsPDF } from 'jspdf';
import type { FatturaConCliente } from './fatture';
import { formatData } from './fatture';
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

export async function generaPdfFattura(fattura: FatturaConCliente): Promise<void> {
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
      const logoLarghezza = 35;
      doc.addImage(logo, 'PNG', margineSinistro, y, logoLarghezza, 0);
    } catch (err) {
      console.error('Errore inserimento logo nel PDF:', err);
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

  if (!fattura.data_incasso) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(234, 88, 12);
    doc.text('PROFORMA', paginaLarghezza - margineDestro, y - 3, { align: 'right' });
  }

  doc.setFillColor(0, 122, 255);
  doc.rect(margineSinistro, y, larghezzaUtile, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(normalizza(`FATTURA N. ${fattura.numero_fattura}`), margineSinistro + 4, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(normalizza(`Anno ${fattura.anno || new Date().getFullYear()}`), paginaLarghezza - margineDestro - 4, y + 8, { align: 'right' });

  y += 18;

  const colonnaSx = margineSinistro;
  const colonnaDx = margineSinistro + larghezzaUtile / 2 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('DATI FATTURA'), colonnaSx, y);
  doc.text(normalizza('CLIENTE'), colonnaDx, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  let ySx = y;
  doc.text(normalizza(`Data fattura: ${formatData(fattura.data_inizio)}`), colonnaSx, ySx);
  ySx += 5;
  doc.text(normalizza(`Data incasso: ${formatData(fattura.data_incasso)}`), colonnaSx, ySx);

  if (fattura.metodo_pagamento) {
    ySx += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(normalizza(`Pagamento: ${String(fattura.metodo_pagamento).toUpperCase()}`), colonnaSx, ySx);
    doc.setFont('helvetica', 'normal');
  }

  let yDx = y;
  doc.setFont('helvetica', 'bold');
  doc.text(normalizza(fattura.cliente?.nome_cognome || '—'), colonnaDx, yDx);
  yDx += 5;

  doc.setFont('helvetica', 'normal');

  const indirizzo = [
    fattura.cliente?.indirizzo_residenza,
    fattura.cliente?.cap_residenza,
    fattura.cliente?.citta_residenza,
    fattura.cliente?.provincia_residenza ? `(${fattura.cliente.provincia_residenza})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (indirizzo) {
    doc.text(normalizza(indirizzo), colonnaDx, yDx);
    yDx += 5;
  }

  if (fattura.cliente?.codice_fiscale) {
    doc.text(normalizza(`C.F.: ${fattura.cliente.codice_fiscale.toUpperCase()}`), colonnaDx, yDx);
    yDx += 5;
  }

  if (fattura.cliente?.partita_iva) {
    doc.text(normalizza(`P.IVA: ${fattura.cliente.partita_iva}`), colonnaDx, yDx);
    yDx += 5;
  }
  if (fattura.cliente?.codice_sdi) {
    doc.text(normalizza(`SDI: ${fattura.cliente.codice_sdi}`), colonnaDx, yDx);
    yDx += 5;
  }

  if (fattura.cliente?.email) {
    doc.text(normalizza(fattura.cliente.email), colonnaDx, yDx);
    yDx += 5;
  }

  y = Math.max(ySx, yDx) + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('RIGHE FATTURA'), margineSinistro, y);
  y += 4;

  const colDesc = margineSinistro;
  const colQta = margineSinistro + larghezzaUtile * 0.6;
  const colPrezzo = margineSinistro + larghezzaUtile * 0.78;
  const colTotale = paginaLarghezza - margineDestro;

  doc.setFillColor(245, 245, 248);
  doc.rect(margineSinistro, y, larghezzaUtile, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 70);
  doc.text(normalizza('Descrizione'), colDesc + 2, y + 5);
  doc.text(normalizza('Qta'), colQta, y + 5, { align: 'center' });
  doc.text(normalizza('Prezzo'), colPrezzo, y + 5, { align: 'right' });
  doc.text(normalizza('Totale'), colTotale, y + 5, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  if (fattura.righe && fattura.righe.length > 0) {
    for (const riga of fattura.righe) {
      const totale = riga.quantita * riga.prezzo_unitario_lordo;
      const descrizione = riga.nome || (riga.tipo === 'percorso' ? 'Percorso' : 'Voce fattura');
      const desc = descrizione.length > 55 ? descrizione.slice(0, 52) + '...' : descrizione;

      doc.text(normalizza(desc), colDesc + 2, y + 4);
      doc.text(String(riga.quantita), colQta, y + 4, { align: 'center' });
      doc.text(formatEuroPdf(riga.prezzo_unitario_lordo), colPrezzo, y + 4, { align: 'right' });
      doc.text(formatEuroPdf(totale), colTotale, y + 4, { align: 'right' });

      let altezzaRiga = 6;

      if (riga.data_inizio && riga.data_fine) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 130);
        doc.text(
          normalizza(`Attivazione: ${formatData(riga.data_inizio)} | Scadenza: ${formatData(riga.data_fine)}`),
          colDesc + 2,
          y + 8
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 30);
        altezzaRiga = 11;
      }
      else if (
        riga.nome.toLowerCase().includes('gratuito') ||
        (riga.nome.toLowerCase().includes('check') && riga.prezzo_unitario_lordo === 0)
      ) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 60);
        doc.text(
          normalizza('Valore di listino: 225,00 EUR  |  Sconto 100%  |  Righetti Check-Up Gratuito'),
          colDesc + 2,
          y + 8
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 30);
        altezzaRiga = 11;
      }

      y += altezzaRiga;
      doc.setDrawColor(240, 240, 245);
      doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    }
  } else {
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza('(nessuna riga)'), colDesc + 2, y + 4);
    y += 6;
  }

  y += 6;

  const totaleLabelX = paginaLarghezza - margineDestro - 55;
  const totaleValoreX = paginaLarghezza - margineDestro;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 70);

  doc.text(normalizza('Netto imponibile'), totaleLabelX, y);
  doc.text(formatEuroPdf(Number(fattura.netto_imponibile)), totaleValoreX, y, { align: 'right' });
  y += 5;

  doc.text(normalizza('IVA 22%'), totaleLabelX, y);
  doc.text(formatEuroPdf(Number(fattura.iva_importo)), totaleValoreX, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(200, 200, 210);
  doc.line(totaleLabelX, y - 3, totaleValoreX, y - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 30);
  doc.text(normalizza('Totale'), totaleLabelX, y + 2);
  doc.text(formatEuroPdf(Number(fattura.lordo_ivato)), totaleValoreX, y + 2, { align: 'right' });
  y += 12;

  if (fattura.dicitura_legale) {
    doc.setDrawColor(220, 220, 225);
    doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza('DICITURA LEGALE'), margineSinistro, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 70);
    const righeDicitura = doc.splitTextToSize(normalizza(fattura.dicitura_legale), larghezzaUtile);
    doc.text(righeDicitura, margineSinistro, y);
  }

  if (fattura.firmato && fattura.firma_immagine) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(220, 220, 225);
    doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 30);
    doc.text(normalizza('FIRMA DEL CLIENTE PER ACCETTAZIONE'), margineSinistro, y);
    y += 8;

    try {
      doc.addImage(fattura.firma_immagine, 'PNG', margineSinistro, y, 70, 25);
      y += 28;
    } catch (err) {
      console.error('Errore inserimento firma nel PDF fattura:', err);
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(
      normalizza("Il/La sottoscritto/a dichiara di aver ricevuto e accettato la presente proforma."),
      margineSinistro,
      y
    );
    y += 4;

    if (fattura.data_firma) {
      doc.text(
        normalizza(`Firmato digitalmente il ${formatData(fattura.data_firma)}`),
        margineSinistro,
        y
      );
    }
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    normalizza(`${azienda.ragioneSociale} - P.IVA ${azienda.partitaIva} - SDI ${azienda.codiceSdi}`),
    paginaLarghezza / 2,
    paginaAltezza - 8,
    { align: 'center' }
  );

  const nomeFile = `Fattura_${fattura.numero_fattura.replace('/', '-')}_${(fattura.cliente?.nome_cognome || 'cliente').replace(/\s+/g, '_')}.pdf`;
  doc.save(nomeFile);
}
