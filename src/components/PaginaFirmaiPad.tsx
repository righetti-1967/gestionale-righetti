import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import jsPDF from 'jspdf';
import {
  getSessioneFirma,
  getCliente,
  salvaFirmaPrivacy,
  completaSessioneFirma,
  type Cliente,
} from '../lib/clienti';
import { getPaese, scomponiNumero } from '../lib/validazioni';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { formatSede, type DatiAziendali } from '../lib/studio';
import { usePrivacy } from '../lib/usePrivacy';
import { caricaLogoBase64 } from '../lib/logo';

interface PaginaFirmaiPadProps {
  token: string;
}

export function PaginaFirmaiPad({ token }: PaginaFirmaiPadProps) {
  const { dati: azienda } = useDatiAziendali();
  const { config: privacy } = usePrivacy();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [firmaPresente, setFirmaPresente] = useState(false);
  const [completato, setCompletato] = useState(false);

  useEffect(() => {
    async function carica() {
      try {
        const sessione = await getSessioneFirma(token);
        if (!sessione) {
          setErrore('Sessione non valida o scaduta');
          setLoading(false);
          return;
        }
        const c = await getCliente(sessione.cliente_id);
        if (!c) {
          setErrore('Cliente non trovato');
          setLoading(false);
          return;
        }
        setCliente(c);
      } catch (err: any) {
        setErrore(err.message || 'Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, [token]);

  useEffect(() => {
    if (!cliente || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(20, 20, 20)',
      minWidth: 1.5,
      maxWidth: 4,
    });
    signaturePadRef.current = pad;
    canvas.style.touchAction = 'none';

    pad.addEventListener('endStroke', () => {
      setFirmaPresente(!pad.isEmpty());
    });

    return () => {
      pad.off();
    };
  }, [cliente]);

  function pulisciFirma() {
    signaturePadRef.current?.clear();
    setFirmaPresente(false);
  }

  async function generaPDF(
    firmaBase64: string,
    c: Cliente,
    az: DatiAziendali,
    testoPrivacy: string
  ): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const paginaLarghezza = 210;
    const paginaAltezza = 297;
    const margin = 18;
    const larghezzaTesto = paginaLarghezza - margin * 2;
    let y = 0;

    // HEADER BLU
    doc.setFillColor(0, 122, 255);
    doc.rect(0, 0, paginaLarghezza, 32, 'F');

    // Logo (se disponibile) nell'header
    const logo = await caricaLogoBase64();
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', margin, 4, 22, 0);
      } catch (err) {
        console.error('Errore inserimento logo nel PDF privacy:', err);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(az.ragioneSociale, paginaLarghezza / 2, 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Sede Operativa: ${formatSede(az.sedeOperativa)}`, paginaLarghezza / 2, 21, { align: 'center' });
    doc.text(`Sede Legale: ${formatSede(az.sedeLegale)}`, paginaLarghezza / 2, 26, { align: 'center' });

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
      const { codicePaese, numero } = scomponiNumero(c.cellulare);
      const paese = getPaese(codicePaese);
      scriviCampo('Telefono', `${paese.prefisso} ${numero}`, colonnaDestra, y);
    }
    y += altezzaRiga;

    const indirizzo = [
      c.indirizzo_residenza,
      c.cap_residenza,
      c.citta_residenza,
      c.provincia_residenza ? `(${c.provincia_residenza})` : '',
    ]
      .filter(Boolean)
      .join(' ');
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
    doc.text(`Luogo: ${formatSede(az.sedeLegale).split(',').pop()?.trim() || '—'}`, margin, y);
    doc.text(`Data: ${dataOra}`, margin + larghezzaTesto / 2, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Firma per presa visione:', margin, y);
    y += 2;

    try {
      doc.addImage(firmaBase64, 'PNG', margin, y, 70, 25);
    } catch (err) {
      console.error('Errore firma 1:', err);
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
    doc.text(`Luogo: ${formatSede(az.sedeLegale).split(',').pop()?.trim() || '—'}`, margin, y);
    doc.text(`Data: ${dataOra}`, margin + larghezzaTesto / 2, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Firma per consenso:', margin, y);
    y += 2;

    try {
      doc.addImage(firmaBase64, 'PNG', margin, y, 70, 25);
    } catch (err) {
      console.error('Errore firma 2:', err);
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

  async function handleConferma() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty() || !cliente) {
      setErrore('Devi firmare prima di confermare');
      return;
    }

    try {
      setSalvando(true);
      setErrore(null);

      const firmaBase64 = signaturePadRef.current.toDataURL('image/png');
      await salvaFirmaPrivacy(cliente.id, firmaBase64);
      await completaSessioneFirma(token);

      const pdf = await generaPDF(firmaBase64, cliente, azienda, privacy.testoInformativa);
      const nomeFile = `Consenso_Privacy_${cliente.nome_cognome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(nomeFile);

      setCompletato(true);
    } catch (err: any) {
      setErrore(err.message || 'Errore nel salvataggio della firma');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray">
        <div className="text-apple-gray">Caricamento...</div>
      </div>
    );
  }

  if (errore && !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray p-4">
        <div className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-apple-darkgray mb-2">Sessione non valida</h1>
          <p className="text-sm text-apple-gray">{errore}</p>
        </div>
      </div>
    );
  }

  if (completato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-apple-lightgray p-4">
        <div className="bg-white rounded-apple shadow-apple-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center text-4xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-apple-darkgray mb-2">Grazie!</h1>
          <p className="text-sm text-apple-gray mb-6">
            La firma della Privacy è stata completata. Consegna l'iPad allo Studio Righetti.
          </p>
          <p className="text-xs text-apple-gray">
            Puoi chiudere questa pagina.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-apple-lightgray flex flex-col">
      <header className="bg-apple-blue text-white px-4 py-4 shadow-apple">
        <h1 className="text-lg font-bold text-center">{azienda.ragioneSociale}</h1>
        <p className="text-xs text-center opacity-80 mt-0.5">Firma Consenso Privacy</p>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto">
        <div className="bg-white rounded-apple shadow-apple p-4 mb-4">
          <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
            Dati del cliente
          </p>
          <p className="text-lg font-bold text-apple-darkgray">{cliente?.nome_cognome}</p>
          <div className="text-xs text-apple-gray mt-1 space-y-0.5">
            {cliente?.codice_fiscale && <p>CF: {cliente.codice_fiscale.toUpperCase()}</p>}
            {cliente?.email && <p>Email: {cliente.email}</p>}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-apple p-4 mb-4 text-center">
          <p className="text-sm text-apple-darkgray">
            ✍️ <strong>Firma con il dito o con Apple Pencil</strong> nello spazio qui sotto
          </p>
        </div>

        <div className="bg-white rounded-apple shadow-apple p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
              Firma qui sotto 👇
            </p>
            <button
              type="button"
              onClick={pulisciFirma}
              disabled={!firmaPresente || salvando}
              className="text-xs text-apple-blue hover:text-blue-700 font-medium disabled:opacity-40"
            >
              🧹 Pulisci
            </button>
          </div>
          <div className="relative border-2 border-dashed border-gray-300 rounded-apple overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: '300px', touchAction: 'none' }}
            />
            {!firmaPresente && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-apple-gray/60 text-base select-none">
                  ✍️ Firma qui con il dito
                </p>
              </div>
            )}
          </div>
        </div>

        {errore && (
          <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm mb-4">
            ❌ {errore}
          </div>
        )}

        <button
          type="button"
          onClick={handleConferma}
          disabled={!firmaPresente || salvando}
          className="w-full px-6 py-4 bg-apple-blue text-white rounded-apple font-semibold text-base hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-apple"
        >
          {salvando ? 'Salvataggio...' : '✓ Conferma Firma'}
        </button>
      </main>

      <footer className="py-4 text-center text-xs text-apple-gray">
        Powered by Righetti 1967 Gestionale
      </footer>
    </div>
  );
}
