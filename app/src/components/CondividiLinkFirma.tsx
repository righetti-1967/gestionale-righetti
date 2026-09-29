import { useState } from 'react';
import type { Cliente } from '../lib/clienti';

interface CondividiLinkFirmaProps {
  urlFirma: string;
  cliente: Cliente | null;
  tipoDocumento: string;
}

export function CondividiLinkFirma({
  urlFirma,
  cliente,
  tipoDocumento,
}: CondividiLinkFirmaProps) {
  const [copiato, setCopiato] = useState(false);

  function handleCopia() {
    navigator.clipboard.writeText(urlFirma);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2000);
  }

  function handleWhatsApp() {
    const nome = cliente?.nome_cognome || 'Gentile Cliente';
    const tel = cliente?.cellulare || (cliente as any)?.telefono || '';
    const numPulito = tel.replace(/\D/g, '');
    const prefisso = numPulito.startsWith('39') ? '' : '39';
    const numeroCompleto = numPulito ? `${prefisso}${numPulito}` : '';
    const testo = `Ciao ${nome}, per completare la procedura ti chiediamo cortesemente di apporre la tua firma digitale per ${tipoDocumento} cliccando su questo link sicuro:\n\n${urlFirma}`;
    const waUrl = numeroCompleto
      ? `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(testo)}`
      : `https://wa.me/?text=${encodeURIComponent(testo)}`;
    window.open(waUrl, '_blank');
  }

  function handleEmail() {
    const nome = cliente?.nome_cognome || 'Gentile Cliente';
    const email = cliente?.email || '';
    const oggetto = `Richiesta Firma Digitale - ${tipoDocumento}`;
    const corpo = `Gentile ${nome},\n\nper completare la procedura ti chiediamo cortesemente di apporre la tua firma digitale per ${tipoDocumento} cliccando sul link sicuro qui sotto:\n\n${urlFirma}\n\nGrazie,\nRighetti Since 1967`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200/60 text-center">
      <p className="text-xs text-apple-gray mb-1">
        Oppure apri o invia questo link di firma al cliente:
      </p>
      <a
        href={urlFirma}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-apple-blue hover:underline font-mono break-all inline-block mb-3.5"
        title="Clicca per aprire la firma"
      >
        {urlFirma}
      </a>

      {/* Pulsanti invio per cliente a distanza */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleWhatsApp}
          className="px-3.5 py-2 rounded-apple bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm flex items-center gap-1.5"
          title="Invia link firma su WhatsApp"
        >
          <span>💬</span> Invia WhatsApp
        </button>

        <button
          type="button"
          onClick={handleEmail}
          className="px-3.5 py-2 rounded-apple bg-apple-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5"
          title="Invia link firma via Email"
        >
          <span>✉️</span> Invia Email
        </button>

        <button
          type="button"
          onClick={handleCopia}
          className="px-3.5 py-2 rounded-apple bg-gray-100 text-apple-darkgray text-xs font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          title="Copia link negli appunti"
        >
          <span>{copiato ? '✓' : '📋'}</span>
          <span>{copiato ? 'Copiato!' : 'Copia Link'}</span>
        </button>
      </div>
    </div>
  );
}
