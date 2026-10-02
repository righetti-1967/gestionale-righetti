import { useState } from 'react';
import type { Cliente } from '../lib/clienti';
import { inviaEmailConConfig } from '../lib/api';

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
  const [inviandoEmail, setInviandoEmail] = useState(false);
  const [esitoEmail, setEsitoEmail] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

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
    const testo = `Ciao ${nome}, per completare la procedura ti chiediamo cortesemente di apporre la tua firma digitale per ${tipoDocumento} cliccando su questo link:\n\n${urlFirma}`;
    const waUrl = numeroCompleto
      ? `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(testo)}`
      : `https://wa.me/?text=${encodeURIComponent(testo)}`;
    window.open(waUrl, '_blank');
  }

  async function handleEmail() {
    if (!cliente?.email) {
      setEsitoEmail({ tipo: 'errore', testo: 'Email cliente non disponibile' });
      setTimeout(() => setEsitoEmail(null), 4000);
      return;
    }

    const nome = cliente?.nome_cognome || 'Gentile Cliente';

    try {
      setInviandoEmail(true);
      setEsitoEmail(null);

      const corpoHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
          <p style="font-size: 14px; color: #1c1c1e;">Gentile <strong>${nome}</strong>,</p>
          <p style="font-size: 13px; color: #3a3a3c; line-height: 1.5;">
            per completare la procedura ti chiediamo cortesemente di apporre la tua <strong>firma digitale</strong> per <strong>${tipoDocumento}</strong> cliccando sul link sicuro qui sotto:
          </p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${urlFirma}" style="display: inline-block; padding: 12px 24px; background: #007AFF; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              ✍️ Firma il documento
            </a>
          </p>
          <p style="font-size: 11px; color: #8e8e93; text-align: center; word-break: break-all;">
            Oppure copia e incolla questo link nel browser:<br>
            <span style="font-family: monospace;">${urlFirma}</span>
          </p>
          <p style="font-size: 11px; color: #8e8e93; border-top: 1px solid #e5e5ea; padding-top: 12px; margin-top: 20px;">
            Documento generato automaticamente dal Gestionale.
          </p>
        </div>
      `;

      await inviaEmailConConfig({
        destinatario: cliente.email,
        oggetto: `Richiesta Firma Digitale — ${tipoDocumento}`,
        corpo_html: corpoHtml,
      });

      setEsitoEmail({ tipo: 'ok', testo: `✅ Email inviata a ${cliente.email}` });
      setTimeout(() => setEsitoEmail(null), 5000);
    } catch (err: any) {
      setEsitoEmail({ tipo: 'errore', testo: `Errore: ${err.message || 'Invio fallito'}` });
      setTimeout(() => setEsitoEmail(null), 5000);
    } finally {
      setInviandoEmail(false);
    }
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
          disabled={inviandoEmail}
          className="px-3.5 py-2 rounded-apple bg-apple-blue text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Invia link firma via Email"
        >
          {inviandoEmail ? (
            <>
              <span>⏳</span> Invio...
            </>
          ) : (
            <>
              <span>✉️</span> Invia Email
            </>
          )}
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

      {/* Banner esito invio */}
      {esitoEmail && (
        <div
          className={`mt-3 px-3 py-2 rounded-apple text-xs font-medium flex items-center justify-center gap-2 ${
            esitoEmail.tipo === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {esitoEmail.testo}
        </div>
      )}
    </div>
  );
}
