/**
 * Motore Promemoria (invio manuale + batch)
 */
import { supabase } from './supabase';
import { inviaEmailConConfig } from './api';
import { getLogoUrl } from './logo';
import type { Appuntamento, AppuntamentoConCliente } from './appuntamenti';

// ============================================================
// TIPI
// ============================================================

export type CanalePromemoria = 'whatsapp' | 'email';

export interface ConfigPromemoria {
  attivo: boolean;
  canale: CanalePromemoria | 'entrambi';
  oreAnticipo: string;
  messaggioStandard: string;
  attivoCheckup: boolean;
  oreAnticipoCheckup: string;
  messaggioCheckup: string;
}

const DEFAULT_CONFIG: ConfigPromemoria = {
  attivo: true,
  canale: 'whatsapp',
  oreAnticipo: '24',
  messaggioStandard: `Ciao {nome}, ti ricordiamo il tuo appuntamento di {data} alle ore {ora}.
Grazie e a presto!

{azienda}`,
  attivoCheckup: true,
  oreAnticipoCheckup: '48',
  messaggioCheckup: `Ciao {nome}, ti ricordiamo la tua prima visita "Check-Up Gratuito" di {data} alle ore {ora}.
Ti aspettiamo!

{azienda}`,
};

// ============================================================
// CARICA CONFIG
// ============================================================

export async function caricaConfigPromemoria(): Promise<ConfigPromemoria> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', user.id)
    .eq('chiave', 'config_promemoria')
    .maybeSingle();

  if (error || !data?.valore) return DEFAULT_CONFIG;

  const val = typeof data.valore === 'string' ? JSON.parse(data.valore) : data.valore;
  return { ...DEFAULT_CONFIG, ...val };
}

// ============================================================
// HELPER
// ============================================================

function formatDataIt(dataISO: string): string {
  try {
    return new Date(dataISO + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dataISO;
  }
}

function formatOra(ora: string): string {
  return ora.slice(0, 5);
}

function estraiNome(nomeCognome: string | null | undefined): string {
  if (!nomeCognome) return 'Cliente';
  const parti = nomeCognome.trim().split(/\s+/);
  return parti[0] || 'Cliente';
}

function getNomeServizio(app: AppuntamentoConCliente | Appuntamento): string {
  const voci = app.voci_selezionate || [];
  if (voci.length === 0) return app.titolo || 'appuntamento';
  if (voci.length === 1) return voci[0].nome || 'servizio';
  return voci.map((v) => v.nome || 'servizio').join(' + ');
}

// ============================================================
// GENERA TESTO
// ============================================================

export function generaTestoPromemoria(
  app: AppuntamentoConCliente | Appuntamento,
  config: ConfigPromemoria,
  nomeAzienda?: string,
  testoOverride?: string
): string {
  const isCheckup =
    app.tipo === 'checkup_nuovo' ||
    (app.titolo || '').toLowerCase().includes('check-up') ||
    (app.titolo || '').toLowerCase().includes('checkup');

  const template = testoOverride && testoOverride.trim().length > 0
    ? testoOverride
    : (isCheckup && config.attivoCheckup
        ? config.messaggioCheckup
        : config.messaggioStandard);

  const nomeCliente = 'cliente' in app
    ? estraiNome(app.cliente?.nome_cognome)
    : 'Cliente';
  const nomeServizio = getNomeServizio(app);
  const dataIt = formatDataIt(app.data);
  const ora = formatOra(app.ora_inizio);
  const azienda = nomeAzienda || '';

  let testo = template
    .replace(/\{cliente\}/g, nomeCliente)
    .replace(/\{nome\}/g, nomeCliente)
    .replace(/\{data\}/g, dataIt)
    .replace(/\{ora\}/g, ora)
    .replace(/\{servizio\}/g, nomeServizio)
    .replace(/\{azienda\}/g, azienda);

  // Converte \n letterali in newline reali
  testo = testo.replace(/\\n/g, '\n');

  return testo.trim();
}

// ============================================================
// INVIO WHATSAPP
// ============================================================

function normalizzaCellulare(tel: string): string {
  const pulito = tel.replace(/\D/g, '');
  if (!pulito) return '';
  return pulito.startsWith('39') ? pulito : '39' + pulito;
}

export function apriWhatsAppPromemoria(
  cellulare: string,
  testo: string
): boolean {
  const numero = normalizzaCellulare(cellulare);
  if (!numero) return false;

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`;
  window.open(url, '_blank');
  return true;
}

// ============================================================
// INVIO EMAIL
// ============================================================


function estraiCognome(nomeCompleto?: string | null): string {
  if (!nomeCompleto) return '';
  const parti = nomeCompleto.trim().split(/\s+/);
  return parti.length > 1 ? parti.slice(1).join(' ') : '';
}

function formatDataEstesa(dataISO: string): string {
  try {
    const d = new Date(dataISO + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dataISO;
  }
}

function formatDataBreve(dataISO: string): string {
  try {
    const d = new Date(dataISO + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dataISO;
  }
}

export async function inviaEmailPromemoria(
  app: AppuntamentoConCliente | Appuntamento,
  config: ConfigPromemoria,
  nomeAzienda?: string,
  testoAggiuntivo?: string
): Promise<void> {
  const email = 'cliente' in app ? app.cliente?.email : null;
  if (!email || !email.trim()) {
    throw new Error('Email cliente non disponibile');
  }

  const nome = 'cliente' in app
    ? estraiNome(app.cliente?.nome_cognome)
    : 'Cliente';
  const cognome = 'cliente' in app
    ? estraiCognome(app.cliente?.nome_cognome)
    : '';
  const dataIt = formatDataIt(app.data);
  const dataEstesa = formatDataEstesa(app.data);
  const ora = formatOra(app.ora_inizio);
  const nomeAziendaFinale = nomeAzienda || '';
  const dataBR = formatDataBreve(app.data);

  // Determina se checkup
  const isCheckup =
    app.tipo === 'checkup_nuovo' ||
    (app.titolo || '').toLowerCase().includes('check-up') ||
    (app.titolo || '').toLowerCase().includes('checkup');

  // Leggi utente per logo
  const { data: { user: _u } } = await supabase.auth.getUser();
  const logoUrl = getLogoUrl(false, _u?.email || null);

  // Leggi WhatsApp dallo studio
  const { data: azData } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', _u?.id || '')
    .eq('chiave', 'dati_aziendali')
    .maybeSingle();
  const whatsappRaw = (azData?.valore as any)?.whatsapp || '';
  const whatsappNum = whatsappRaw.replace(/[^0-9]/g, '');

  // Leggi il template dal DB
  const chiaveTemplate = isCheckup ? 'email_promemoria_checkup' : 'email_promemoria';
  const { data: ttData } = await supabase
    .from('testi_template')
    .select('oggetto, corpo')
    .eq('user_id', _u?.id || '')
    .eq('chiave', chiaveTemplate)
    .maybeSingle();

  // Fallback: se non c'è il template, usa un default hardcoded
  const templateOggetto = ttData?.oggetto || 'Promemoria appuntamento — {data} ore {ora}';
  const templateCorpo = ttData?.corpo || `Ciao {nome},

Ti ricordiamo il tuo appuntamento di:

[[BOX]]

Per qualsiasi necessità contattaci:

[[WHATSAPP]]

A presto!`;

  // HTML del BOX data/ora
  const boxHtml = `
      <div style="background: #f5f5f7; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
        <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1c1c1e;">
          ${dataIt}
        </p>
        <p style="margin: 0; font-size: 15px; font-weight: 400; color: #1c1c1e;">
          alle ore <strong>${ora}</strong>
        </p>
      </div>
  `;

  // HTML del BOTTONE WhatsApp
  const whatsappHtml = whatsappNum
    ? `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 16px auto;">
        <tr>
          <td align="center" style="background-color: #25D366; border-radius: 12px;">
            <a href="https://wa.me/${whatsappNum}?text=${encodeURIComponent(
              `Ciao, avrei necessità di spostare il mio appuntamento di ${dataIt} alle ore ${ora}, se possibile.\n\nAttendo, grazie.\n${nome}`
            )}"
               style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; border-radius: 12px;">
              💬 Scrivici su WhatsApp
            </a>
          </td>
        </tr>
      </table>
    `
    : '';

  // Prepara corpo: usa override o template dal DB
  const corpoBase = testoAggiuntivo && testoAggiuntivo.trim()
    ? testoAggiuntivo.trim()
    : templateCorpo;

  // Sostituisci variabili
  let corpoElaborato = corpoBase
    .replace(/\{\{cliente\}\}/g, nome)
    .replace(/\{cliente\}/g, nome)
    .replace(/\{nome\}/g, nome)
    .replace(/\{cognome\}/g, cognome)
    .replace(/\{azienda\}/g, nomeAziendaFinale)
    .replace(/\{data\}/g, dataBR)
    .replace(/\{data_estesa\}/g, dataEstesa)
    .replace(/\{ora\}/g, ora)
    .replace(/\{servizio\}/g, '');

  // Sostituisci placeholder BOX e WHATSAPP
  corpoElaborato = corpoElaborato
    .replace(/\[\[BOX\]\]/g, boxHtml)
    .replace(/\[\[WHATSAPP\]\]/g, whatsappHtml)
    .trim();

  // Split su doppio newline: ogni blocco è un paragrafo
  // Se un blocco contiene HTML (box/whatsapp) → lascia intatto
  const blocchi = corpoElaborato.split(/\n\s*\n/);
  const corpoRighe = blocchi.map((blocco: string) => {
    const trimmed = blocco.trim();
    if (trimmed === '') return '';
    // Blocco HTML (contiene tag) → lascia intatto
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
    // Blocco testo → converti newline interni in <br> e avvolgi in <p>
    const righeInterno = trimmed.split('\n').map((r: string) =>
      r.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    ).join('<br>');
    return `<p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 400; line-height: 1.5; color: #1c1c1e;">${righeInterno}</p>`;
  }).join('\n');

  const corpoHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #ffffff; color: #1c1c1e;">
      ${logoUrl ? `
        <div style="text-align: center; margin-bottom: 32px;">
          <img src="${logoUrl}" alt="${nomeAziendaFinale}" style="max-height: 56px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto;" />
        </div>
      ` : ''}

      ${corpoRighe}

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5ea;">
        ${nomeAziendaFinale ? `
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #1c1c1e;">
            ${nomeAziendaFinale}
          </p>
        ` : ''}
        <p style="margin: 0; font-size: 11px; font-weight: 400; color: #8e8e93; line-height: 1.5;">
          Promemoria automatico. Ti preghiamo di non rispondere a questa email.
        </p>
      </div>
    </div>
  `;

  // Prepara oggetto
  const oggetto = templateOggetto
    .replace(/\{nome\}/g, nome)
    .replace(/\{data\}/g, dataBR)
    .replace(/\{ora\}/g, ora);

  await inviaEmailConConfig({
    destinatario: email.trim(),
    oggetto,
    corpo_html: corpoHtml,
  });
}

// ============================================================
// MARCA COME INVIATO
// ============================================================

export async function marcaPromemoriaInviato(
  appuntamentoId: number,
  canale: CanalePromemoria
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('appuntamenti')
    .update({
      promemoria_inviato_at: new Date().toISOString(),
      promemoria_canale: canale,
    })
    .eq('id', appuntamentoId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Errore marcatura promemoria:', error);
    throw error;
  }
}

// ============================================================
// HELPER: canali disponibili
// ============================================================

export function canaliDisponibili(
  app: AppuntamentoConCliente | Appuntamento
): { whatsapp: boolean; email: boolean } {
  const cli = 'cliente' in app ? app.cliente : null;
  return {
    whatsapp: !!(cli?.cellulare && cli.cellulare.trim()),
    email: !!(cli?.email && cli.email.trim()),
  };
}

export function isPromemoriaInviato(
  app: AppuntamentoConCliente | Appuntamento
): boolean {
  return !!(app as any).promemoria_inviato_at;
}

export function promemoriaInviatoLabel(
  app: AppuntamentoConCliente | Appuntamento
): string | null {
  const at = (app as any).promemoria_inviato_at;
  if (!at) return null;
  try {
    return new Date(at).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}
