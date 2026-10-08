/**
 * emailWrapper.ts — Wrappa il corpo di un'email in un template HTML professionale
 * con logo aziendale in alto e firma aziendale in basso.
 *
 * Uso: wrapEmailHtml("Ciao Mario,\n\ncome stai?", datiAzienda) → HTML completo
 */
import type { DatiAziendali } from './studio';

/**
 * Trasforma testo con \n\n in paragrafi HTML e \n singolo in <br>.
 * Supporta anche il testo già HTML (se contiene tag, li mantiene).
 */
function testoAParagrafiHtml(testo: string): string {
  // Se contiene già tag HTML, assumiamo che sia già formattato
  if (/<(p|div|br|h[1-6]|ul|ol|li|table|strong|em)\b/i.test(testo)) {
    return testo;
  }

  // Split per righe vuote → paragrafi
  const paragrafi = testo
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragrafi
    .map((p) => {
      // \n singolo → <br>
      const conBr = p.replace(/\n/g, '<br>');
      return `<p style="margin: 0 0 14px; line-height: 1.55; color: #1C1C1E; font-size: 14px;">${conBr}</p>`;
    })
    .join('');
}

/**
 * Ritorna l'HTML completo dell'email con header logo + corpo + firma aziendale.
 */
export function wrapEmailHtml(corpoGrezzo: string, azienda: DatiAziendali): string {
  const corpoHtml = testoAParagrafiHtml(corpoGrezzo);

  const logoUrl = azienda.logo_url || '';
  const nomeStudio = azienda.ragioneSociale || 'Studio';
  // Usa la sede operativa effettiva (già gestita in datiAziendali.adatta() come fallback alla legale)
  const sedeEffettiva = azienda.sedeOperativa || azienda.sedeLegale;
  const indirizzo = sedeEffettiva?.indirizzo || '';
  const cap = sedeEffettiva?.cap || '';
  const citta = sedeEffettiva?.citta || '';
  const provincia = sedeEffettiva?.provincia || '';
  const piva = azienda.partitaIva || '';
  const telefono = azienda.telefono || '';
  const email = azienda.email || '';
  const sito = azienda.sitoWeb || '';

  // Riga sede composta
  const rigaSede = [indirizzo, `${cap} ${citta}`.trim(), provincia ? `(${provincia})` : '']
    .filter(Boolean)
    .join(' · ');

  // Riga contatti composta (senza emoji per compatibilità email)
  const rigaContatti = [
    telefono ? `Tel. ${telefono}` : '',
    email ? email : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(nomeStudio)}</title>
</head>
<body style="margin:0; padding:0; background:#F2F2F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F2F2F7; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">

          ${logoUrl ? `
          <!-- HEADER LOGO -->
          <tr>
            <td align="center" style="padding: 28px 32px 12px;">
              <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(nomeStudio)}" style="max-height: 60px; max-width: 180px; height: auto; display: block; object-fit: contain;">
            </td>
          </tr>
          ` : ''}

          <!-- CORPO -->
          <tr>
            <td style="padding: ${logoUrl ? '12px 32px 32px' : '32px 32px 32px'};">
              ${corpoHtml}
            </td>
          </tr>

          <!-- FIRMA AZIENDALE -->
          <tr>
            <td style="background: #F2F2F7; padding: 20px 32px; text-align: center; border-top: 1px solid #E5E5EA;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #1C1C1E; letter-spacing: 0.2px;">
                ${escapeHtml(nomeStudio)}
              </p>
              ${rigaSede ? `<p style="margin: 0 0 4px; font-size: 11px; color: #666;">${escapeHtml(rigaSede)}</p>` : ''}
              ${piva ? `<p style="margin: 0 0 8px; font-size: 11px; color: #666;">P.IVA ${escapeHtml(piva)}</p>` : ''}
              ${rigaContatti ? `<p style="margin: 0 0 4px; font-size: 11px; color: #666;">${escapeHtml(rigaContatti)}</p>` : ''}
              ${sito ? `<p style="margin: 8px 0 0; font-size: 11px;"><a href="${escapeHtml(sito.startsWith('http') ? sito : 'https://' + sito)}" style="color: #007AFF; text-decoration: none;">${escapeHtml(sito)}</a></p>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Escape HTML per evitare injection */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
