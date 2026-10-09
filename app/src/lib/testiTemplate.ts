/**
 * Testi & Template — Sistema centralizzato di messaggi personalizzabili
 *
 * Chiavi disponibili (raggruppate):
 *   Email:
 *     - email_privacy                → Invio Privacy GDPR cliente
 *     - email_scontrino              → Invio scontrino cliente
 *     - email_reset_password         → Reset password gestionale
 *     - email_report_commercialista  → Report scontrini al commercialista
 *     - email_firma_documento        → Link firma fattura/DDT/privacy
 *
 *   WhatsApp:
 *     - whatsapp_scontrino           → Invio scontrino cliente
 *     - whatsapp_promemoria          → Promemoria appuntamento
 *
 *   PDF:
 *     - pdf_scontrino_firma          → Dicitura in fondo allo scontrino
 *     - pdf_fattura_dicitura         → Dicitura legale fattura
 *     - pdf_ddt_intestazione_cliente → Intestazione DDT cliente
 *     - pdf_ddt_intestazione_comm    → Intestazione DDT commercialista
 */
import { supabase } from './supabase';

// ============================================================
// TIPI
// ============================================================

export type ChiaveTesto =
  | 'email_privacy'
  | 'email_scontrino'
  | 'email_reset_password'
  | 'email_report_commercialista'
  | 'email_firma_documento'
  | 'email_fattura'
  | 'email_promemoria'
  | 'email_promemoria_checkup'
  | 'email_post_seduta'
  | 'email_compleanno'
  | 'email_riattivazione'
  | 'whatsapp_scontrino'
  | 'whatsapp_fattura'
  | 'whatsapp_promemoria'
  | 'whatsapp_promemoria_checkup'
  | 'whatsapp_post_seduta'
  | 'whatsapp_compleanno'
  | 'whatsapp_riattivazione';

export interface TestoTemplate {
  id?: number;
  user_id?: string;
  chiave: ChiaveTesto;
  oggetto: string | null;
  corpo: string;
  updated_at?: string;
}

export interface VariabiliDisponibili {
  [key: string]: string;
}

// ============================================================
// DEFAULT — Testi di base (fallback se l'utente non ha personalizzato)
// ============================================================


/**
 * Ritorna "Lunedì 5 Ottobre 2026" da "2026-10-05" o "2026-10-05T..."
 */
export function dataEstesaIT(dataISO: string): string {
  try {
    const soloData = dataISO.slice(0, 10);
    const d = new Date(soloData + 'T00:00:00');
    const s = d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return dataISO;
  }
}

/** Data di oggi in formato esteso (Lunedì 5 Ottobre 2026) */
export function oggiEstesoIT(): string {
  return dataEstesaIT(new Date().toISOString().split('T')[0]);
}

export const DEFAULT_TESTI: Record<ChiaveTesto, TestoTemplate> = {
  email_privacy: {
    chiave: 'email_privacy',
    oggetto: 'Informativa Privacy GDPR — {azienda}',
    corpo: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
  <div style="text-align: center; margin-bottom: 24px;">
    <p style="color: #8e8e93; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
      Conferma Informativa Privacy GDPR
    </p>
  </div>
  <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">
      Gentile {cliente},
    </p>
    <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
      le confermiamo la ricezione e la corretta registrazione del consenso al trattamento dei dati personali (Regolamento UE 2016/679 - GDPR) presso la nostra sede.
    </p>
  </div>
  <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #8e8e93; text-align: center;">
    Documento generato automaticamente da {azienda}.
  </div>
</div>`,
  },

  email_scontrino: {
    chiave: 'email_scontrino',
    oggetto: 'Scontrino {numero_documento}',
    corpo: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
  <div style="text-align: center; margin-bottom: 20px;">
    <p style="color: #8e8e93; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
      Documento Commerciale
    </p>
  </div>
  <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">
      Ciao {nome},
    </p>
    <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
      in allegato trovi il documento commerciale relativo alla tua operazione del {data}.
    </p>
  </div>
  <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #8e8e93; text-align: center;">
    Documento generato automaticamente da {azienda}.
  </div>
</div>`,
  },

  email_reset_password: {
    chiave: 'email_reset_password',
    oggetto: 'Codice reset password gestionale: {codice}',
    corpo: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
  <div style="text-align: center; margin-bottom: 24px;">
    <p style="color: #8e8e93; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
      🔐 Reset Password Gestionale
    </p>
  </div>
  <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">
      Ciao,
    </p>
    <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
      hai richiesto il reset della password gestionale per l'account {email}.
    </p>
  </div>
  <div style="background: #007AFF; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
    <p style="margin: 0; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; opacity: 0.9;">
      Codice di verifica
    </p>
    <p style="margin: 12px 0 0 0; color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
      {codice}
    </p>
    <p style="margin: 12px 0 0 0; color: #ffffff; font-size: 12px; opacity: 0.9;">
      Valido per 10 minuti
    </p>
  </div>
  <div style="background: #fff3e0; border-radius: 8px; padding: 12px; border-left: 4px solid #ff9800;">
    <p style="margin: 0; color: #e65100; font-size: 12px;">
      ⚠️ Se non hai richiesto tu questo reset, ignora questa email.
    </p>
  </div>
</div>`,
  },

  email_report_commercialista: {
    chiave: 'email_report_commercialista',
    oggetto: 'Report Scontrini {data_inizio} - {data_fine}',
    corpo: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
  <div style="text-align: center; margin-bottom: 20px;">
    <p style="color: #8e8e93; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
      Report Scontrini Fiscali
    </p>
  </div>
  <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">
      Gentile {commercialista},
    </p>
    <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
      in allegato il report scontrini del periodo <strong>{data_inizio}</strong> - <strong>{data_fine}</strong> emessi da <strong>{azienda}</strong>.
    </p>
  </div>
  <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #8e8e93; text-align: center;">
    Documento generato automaticamente da {azienda}.
  </div>
</div>`,
  },

  email_firma_documento: {
    chiave: 'email_firma_documento',
    oggetto: 'Firma documento — {tipo_documento} {numero_documento}',
    corpo: `Gentile {nome} {cognome},

per completare la procedura ti chiediamo cortesemente di apporre la tua firma digitale per {tipo_documento} cliccando sul link sicuro qui sotto.

Grazie,
{azienda}`,
  },

  email_fattura: {
    chiave: 'email_fattura',
    oggetto: 'Fattura {numero_documento} — {azienda}',
    corpo: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5ea;">
  <div style="text-align: center; margin-bottom: 20px;">
    <p style="color: #8e8e93; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
      Documento Contabile
    </p>
  </div>
  <div style="background: #f2f2f7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; color: #1c1c1e; font-size: 14px; font-weight: 600;">
      Gentile {nome},
    </p>
    <p style="margin: 8px 0 0 0; color: #3a3a3c; font-size: 13px; line-height: 1.5;">
      in allegato le trasmettiamo il documento contabile <strong>{numero_documento}</strong> del {data}.
    </p>
  </div>
  <div style="border-top: 1px solid #e5e5ea; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #8e8e93; text-align: center;">
    Documento generato automaticamente da {azienda}.
  </div>
</div>`,
  },

  email_promemoria: {
    chiave: 'email_promemoria',
    oggetto: 'Promemoria appuntamento — {data} ore {ora}',
    corpo: `Ciao {nome},

Ti ricordiamo il tuo appuntamento di:

[[BOX]]

Per qualsiasi necessità contattaci:

[[WHATSAPP]]

A presto!`,
  },

  email_promemoria_checkup: {
    chiave: 'email_promemoria_checkup',
    oggetto: 'Promemoria Check-Up — {data} ore {ora}',
    corpo: `Ciao {nome},

Ti ricordiamo la tua prima visita presso il nostro Studio per il tuo "Check-Up Gratuito" di:

[[BOX]]

Per qualsiasi necessità contattaci:

[[WHATSAPP]]

Ti aspettiamo!`,
  },

  email_post_seduta: {
    chiave: 'email_post_seduta',
    oggetto: 'Come stai dopo la seduta?',
    corpo: `Ciao {nome},

come stai dopo la seduta di {data_estesa}?

Se hai bisogno di chiarimenti o vuoi prenotare il prossimo appuntamento, contattaci pure.

A presto,
{azienda}`,
  },

  email_compleanno: {
    chiave: 'email_compleanno',
    oggetto: 'Tanti auguri {nome}!',
    corpo: `Tanti auguri {nome}!

Che sia un anno speciale, pieno di cose belle.

Un caro saluto,
{azienda}`,
  },

  email_riattivazione: {
    chiave: 'email_riattivazione',
    oggetto: 'È da un po\' che non ti vediamo',
    corpo: `Ciao {nome},

è da un po' che non ti vediamo!

Hai voglia di un Check-Up di controllo? Ti aspettiamo nel nostro Studio.

A presto,
{azienda}`,
  },

  whatsapp_scontrino: {
    chiave: 'whatsapp_scontrino',
    oggetto: null,
    corpo: `Ciao {nome}, ecco il tuo scontrino {numero_documento}.

{link}

{azienda}`,
  },

  whatsapp_fattura: {
    chiave: 'whatsapp_fattura',
    oggetto: null,
    corpo: `Gentile {nome}, le trasmettiamo il documento {numero_documento} del {data}.

{link}

{azienda}`,
  },

  whatsapp_promemoria: {
    chiave: 'whatsapp_promemoria',
    oggetto: null,
    corpo: `Ciao {nome}, ti ricordiamo il tuo appuntamento di {data_estesa} alle ore {ora}.

Grazie e a presto!
{azienda}`,
  },

  whatsapp_promemoria_checkup: {
    chiave: 'whatsapp_promemoria_checkup',
    oggetto: null,
    corpo: `Ciao {nome}, ti ricordiamo la tua prima visita presso il nostro Studio per il tuo "Check-Up Gratuito" di {data_estesa} alle ore {ora}.

Per qualsiasi necessità contattaci.

Ti aspettiamo!
{azienda}`,
  },

  whatsapp_post_seduta: {
    chiave: 'whatsapp_post_seduta',
    oggetto: null,
    corpo: `Ciao {nome}, come stai dopo la seduta di {data_estesa}?

Se hai bisogno di chiarimenti o vuoi prenotare il prossimo appuntamento, contattaci pure.

A presto!
{azienda}`,
  },

  whatsapp_compleanno: {
    chiave: 'whatsapp_compleanno',
    oggetto: null,
    corpo: `Tanti auguri {nome}!

Che sia un anno speciale, pieno di cose belle.

Un caro saluto,
{azienda}`,
  },

  whatsapp_riattivazione: {
    chiave: 'whatsapp_riattivazione',
    oggetto: null,
    corpo: `Ciao {nome}, è da un po' che non ti vediamo!

Hai voglia di un Check-Up di controllo? Ti aspettiamo nel nostro Studio.

A presto!
{azienda}`,
  },
};

// ============================================================
// VARIABILI DISPONIBILI PER OGNI CHIAVE
// ============================================================

export const VARIABILI_PER_CHIAVE: Record<ChiaveTesto, string[]> = {
  email_privacy: ['cliente', 'nome', 'cognome', 'azienda', 'data'],
  email_scontrino: ['cliente', 'nome', 'cognome', 'azienda', 'data', 'numero_documento', 'importo'],
  email_reset_password: ['email', 'codice', 'azienda'],
  email_report_commercialista: ['commercialista', 'azienda', 'data_inizio', 'data_fine', 'totale', 'iva'],
  email_firma_documento: ['nome', 'cognome', 'azienda', 'tipo_documento', 'numero_documento', 'link'],
  email_fattura: ['nome', 'cognome', 'azienda', 'numero_documento', 'data'],
  email_promemoria: ['nome', 'cognome', 'azienda', 'data', 'ora', 'servizio'],
  email_promemoria_checkup: ['nome', 'cognome', 'azienda', 'data', 'ora'],
  email_post_seduta: ['nome', 'cognome', 'azienda', 'data', 'servizio'],
  email_compleanno: ['nome', 'cognome', 'azienda'],
  email_riattivazione: ['nome', 'cognome', 'azienda'],
  whatsapp_scontrino: ['nome', 'cognome', 'azienda', 'numero_documento', 'link', 'importo'],
  whatsapp_fattura: ['nome', 'cognome', 'azienda', 'numero_documento', 'data', 'link'],
  whatsapp_promemoria: ['nome', 'cognome', 'azienda', 'data', 'ora', 'servizio'],
  whatsapp_promemoria_checkup: ['nome', 'cognome', 'azienda', 'data', 'ora'],
  whatsapp_post_seduta: ['nome', 'cognome', 'azienda', 'data', 'servizio'],
  whatsapp_compleanno: ['nome', 'cognome', 'azienda'],
  whatsapp_riattivazione: ['nome', 'cognome', 'azienda'],
};

// ============================================================
// ETICHETTE PER UI
// ============================================================

export const ETICHETTE_CHIAVI: Record<ChiaveTesto, { label: string; gruppo: 'email' | 'whatsapp'; icona: string }> = {
  email_privacy: { label: 'Informativa Privacy GDPR', gruppo: 'email', icona: '📧' },
  email_scontrino: { label: 'Invio Scontrino', gruppo: 'email', icona: '📧' },
  email_reset_password: { label: 'Reset Password Gestionale', gruppo: 'email', icona: '🔐' },
  email_report_commercialista: { label: 'Report Commercialista', gruppo: 'email', icona: '📊' },
  email_firma_documento: { label: 'Link Firma Documento', gruppo: 'email', icona: '✍️' },
  email_fattura: { label: 'Invio Fattura', gruppo: 'email', icona: '📄' },
  email_promemoria: { label: 'Promemoria Appuntamento', gruppo: 'email', icona: '⏰' },
  email_promemoria_checkup: { label: 'Promemoria Check-Up', gruppo: 'email', icona: '🆕' },
  email_post_seduta: { label: 'Post-Seduta', gruppo: 'email', icona: '📸' },
  email_compleanno: { label: 'Auguri Compleanno', gruppo: 'email', icona: '🎂' },
  email_riattivazione: { label: 'Riattivazione Cliente', gruppo: 'email', icona: '💤' },
  whatsapp_scontrino: { label: 'Invio Scontrino', gruppo: 'whatsapp', icona: '💬' },
  whatsapp_fattura: { label: 'Invio Fattura', gruppo: 'whatsapp', icona: '📄' },
  whatsapp_promemoria: { label: 'Promemoria Appuntamento', gruppo: 'whatsapp', icona: '💬' },
  whatsapp_promemoria_checkup: { label: 'Promemoria Check-Up', gruppo: 'whatsapp', icona: '🆕' },
  whatsapp_post_seduta: { label: 'Post-Seduta', gruppo: 'whatsapp', icona: '📸' },
  whatsapp_compleanno: { label: 'Auguri Compleanno', gruppo: 'whatsapp', icona: '🎂' },
  whatsapp_riattivazione: { label: 'Riattivazione Cliente', gruppo: 'whatsapp', icona: '💤' },
};

// ============================================================
// CRUD
// ============================================================

export async function getTestoTemplate(chiave: ChiaveTesto): Promise<TestoTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_TESTI[chiave];

  const { data, error } = await supabase
    .from('testi_template')
    .select('*')
    .eq('user_id', user.id)
    .eq('chiave', chiave)
    .maybeSingle();

  if (error || !data) return DEFAULT_TESTI[chiave];
  return data as TestoTemplate;
}

export async function getTuttiTestiTemplate(): Promise<Record<ChiaveTesto, TestoTemplate>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_TESTI;

  const { data, error } = await supabase
    .from('testi_template')
    .select('*')
    .eq('user_id', user.id);

  const risultato: Record<ChiaveTesto, TestoTemplate> = { ...DEFAULT_TESTI };
  if (!error && data) {
    for (const row of data) {
      if (row.chiave in DEFAULT_TESTI) {
        risultato[row.chiave as ChiaveTesto] = row as TestoTemplate;
      }
    }
  }
  return risultato;
}

export async function salvaTestoTemplate(
  chiave: ChiaveTesto,
  oggetto: string | null,
  corpo: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('testi_template')
    .upsert(
      {
        user_id: user.id,
        chiave,
        oggetto,
        corpo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );

  if (error) throw error;
}

export async function ripristinaTestoTemplate(chiave: ChiaveTesto): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { error } = await supabase
    .from('testi_template')
    .delete()
    .eq('user_id', user.id)
    .eq('chiave', chiave);

  if (error) throw error;
}

// ============================================================
// RENDER — Sostituisce le variabili {xxx} con i valori
// ============================================================

export function renderTemplate(
  testo: string,
  variabili: VariabiliDisponibili
): string {
  let risultato = testo;
  for (const [chiave, valore] of Object.entries(variabili)) {
    const regex = new RegExp(`\\{${chiave}\\}`, 'g');
    risultato = risultato.replace(regex, valore || '');
  }
  // Converte \n letterali in newline reali
  // (utile se l'utente scrive \n nell'editor o se il template vecchio li ha)
  risultato = risultato.replace(/\\n/g, '\n');
  return risultato;
}

/**
 * Estrae il nome dal "nome cognome".
 */
export function estraiNome(nomeCognome: string | null | undefined): string {
  if (!nomeCognome) return '';
  const parti = nomeCognome.trim().split(/\s+/);
  return parti[0] || '';
}

/**
 * Estrae il cognome dal "nome cognome".
 */
export function estraiCognome(nomeCognome: string | null | undefined): string {
  if (!nomeCognome) return '';
  const parti = nomeCognome.trim().split(/\s+/);
  return parti.slice(1).join(' ') || '';
}

/**
 * Formatta una data in italiano.
 */
export function formatDataIt(data: string | null | undefined): string {
  if (!data) return '';
  try {
    return new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return data;
  }
}

/**
 * Formatta un importo in euro.
 */
export function formatEuroIt(importo: number | null | undefined): string {
  if (importo == null) return '';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(importo);
}
