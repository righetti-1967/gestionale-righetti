import { jsPDF } from 'jspdf';
import type { ScaricoSeduta } from './scarichi';
import type { Percorso } from './percorsi';
import type { Cliente } from './clienti';
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

interface ParametriPdf {
  scarico: ScaricoSeduta;
  percorso: Percorso | null;
  cliente: Cliente | null;
  mostraPrezzi: boolean;
  mostraFirma: boolean;
}

async function generaPdfDdt({
  scarico,
  percorso,
  cliente,
  mostraPrezzi,
  mostraFirma,
}: ParametriPdf): Promise<void> {
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
      console.error('Errore inserimento logo nel PDF DDT:', err);
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

  const numeroFormattato = formatNumeroDdt(scarico.numero_ddt, scarico.data_seduta);
  const annoSeduta = new Date(scarico.data_seduta).getFullYear();

  doc.setFillColor(0, 122, 255);
  doc.rect(margineSinistro, y, larghezzaUtile, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);

  const titoloDocumento = mostraPrezzi
    ? `DOCUMENTO DI COMPETENZA | ${numeroFormattato}`
    : `SEDUTA IN STUDIO | ${numeroFormattato}`;

  doc.text(
    normalizza(titoloDocumento),
    margineSinistro + 4,
    y + 8
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(normalizza(`Anno ${annoSeduta}`), paginaLarghezza - margineDestro - 4, y + 8, {
    align: 'right',
  });

  y += 18;

  const colonnaSx = margineSinistro;
  const colonnaDx = margineSinistro + larghezzaUtile / 2 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('DATI DDT'), colonnaSx, y);
  doc.text(normalizza('CLIENTE'), colonnaDx, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  let ySx = y;
  doc.text(normalizza(`Data seduta: ${formatDataPdf(scarico.data_seduta)}`), colonnaSx, ySx);
  ySx += 5;

  const rifFattura = percorso?.fattura_id
    ? `Rif. Fattura madre ID ${percorso.fattura_id}`
    : '';
  if (rifFattura) {
    doc.text(normalizza(rifFattura), colonnaSx, ySx);
    ySx += 5;
  }

  let yDx = y;
  doc.setFont('helvetica', 'bold');
  doc.text(normalizza(cliente?.nome_cognome || '—'), colonnaDx, yDx);
  yDx += 5;

  doc.setFont('helvetica', 'normal');

  const indirizzo = [
    cliente?.indirizzo_residenza,
    cliente?.cap_residenza,
    cliente?.citta_residenza,
    cliente?.provincia_residenza ? `(${cliente.provincia_residenza})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (indirizzo) {
    doc.text(normalizza(indirizzo), colonnaDx, yDx);
    yDx += 5;
  }

  if (cliente?.codice_fiscale) {
    doc.text(normalizza(`C.F.: ${cliente.codice_fiscale.toUpperCase()}`), colonnaDx, yDx);
    yDx += 5;
  }

  if (cliente?.partita_iva) {
    doc.text(normalizza(`P.IVA: ${cliente.partita_iva}`), colonnaDx, yDx);
    yDx += 5;
  }

  y = Math.max(ySx, yDx) + 6;

  const righeDaStampare = mostraPrezzi
    ? (scarico.righe || []).filter((r) => !r.nome.includes('(EXTRA Percorso)'))
    : (scarico.righe || []);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(normalizza('VOCI'), margineSinistro, y);
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
  if (mostraPrezzi) {
    doc.text(normalizza('Netto IVA'), colPrezzo, y + 5, { align: 'right' });
    doc.text(normalizza('Totale'), colTotale, y + 5, { align: 'right' });
  }
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 30);

  if (righeDaStampare.length > 0) {
    for (const riga of righeDaStampare) {
      const totale = riga.quantita * riga.netto_iva_scontato;
      const desc = riga.nome.length > 55 ? riga.nome.slice(0, 52) + '...' : riga.nome;

      doc.text(normalizza(desc), colDesc + 2, y + 4);
      doc.text(String(riga.quantita), colQta, y + 4, { align: 'center' });

      if (mostraPrezzi) {
        doc.text(formatEuroPdf(riga.netto_iva_scontato), colPrezzo, y + 4, { align: 'right' });
        doc.text(formatEuroPdf(totale), colTotale, y + 4, { align: 'right' });
      }

      y += 6;
      doc.setDrawColor(240, 240, 245);
      doc.line(margineSinistro, y, paginaLarghezza - margineDestro, y);
    }
  } else {
    doc.setTextColor(120, 120, 130);
    doc.text(normalizza('(nessuna voce)'), colDesc + 2, y + 4);
    y += 6;
  }

  y += 6;

  if (mostraPrezzi) {
    const totaleImponibileEffettivo = righeDaStampare.reduce(
      (sum, r) => sum + r.quantita * r.netto_iva_scontato,
      0
    );

    const totaleLabelX = paginaLarghezza - margineDestro - 60;
    const totaleValoreX = paginaLarghezza - margineDestro;

    doc.setDrawColor(200, 200, 210);
    doc.line(totaleLabelX, y - 3, totaleValoreX, y - 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 30);
    doc.text(normalizza('Tot. Imponibile'), totaleLabelX, y + 2);
    doc.text(formatEuroPdf(Number(totaleImponibileEffettivo)), totaleValoreX, y + 2, {
      align: 'right',
    });
    y += 12;
  }

  if (scarico.note) {
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
    const righeNote = doc.splitTextToSize(normalizza(scarico.note), larghezzaUtile);
    doc.text(righeNote, margineSinistro, y);
    y += righeNote.length * 4 + 6;
  }

  if (mostraFirma) {
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
    doc.text(normalizza('Firma del cliente per ricevuta'), margineSinistro, y);
    y += 8;

    if (scarico.firma_immagine) {
      try {
        doc.addImage(scarico.firma_immagine, 'PNG', margineSinistro, y, 70, 25);
        y += 28;
      } catch (err) {
        console.error('Errore inserimento firma nel PDF DDT:', err);
      }
    } else {
      doc.setDrawColor(200, 200, 210);
      doc.rect(margineSinistro, y, 80, 25);
      y += 28;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(
      normalizza(
        'Il/La sottoscritto/a dichiara di aver ricevuto quanto sopra specificato.'
      ),
      margineSinistro,
      y
    );
    y += 4;

    if (scarico.data_firma) {
      doc.text(
        normalizza(`Firmato digitalmente il ${formatDataPdf(scarico.data_firma)}`),
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

  const tipoDoc = mostraPrezzi ? 'Commercialista' : 'Cliente';
  const nomeFile = `DDT-${String(scarico.numero_ddt).padStart(3, '0')}-${annoSeduta}_${tipoDoc}_${(cliente?.nome_cognome || 'cliente').replace(/\s+/g, '_')}.pdf`;
  doc.save(nomeFile);
}

export async function generaPdfDdtCliente(
  scarico: ScaricoSeduta,
  percorso: Percorso | null,
  cliente: Cliente | null
): Promise<void> {
  return generaPdfDdt({
    scarico,
    percorso,
    cliente,
    mostraPrezzi: false,
    mostraFirma: true,
  });
}

export async function generaPdfDdtCommercialista(
  scarico: ScaricoSeduta,
  percorso: Percorso | null,
  cliente: Cliente | null
): Promise<void> {
  return generaPdfDdt({
    scarico,
    percorso,
    cliente,
    mostraPrezzi: true,
    mostraFirma: false,
  });
}
