import { supabase } from './supabase';

/**
 * Verifica se l'utente corrente ha configurato Whatsender
 * (token presente in impostazioni.config_whatsapp).
 */
export async function haWhatsenderConfigurato(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', user.id)
    .eq('chiave', 'config_whatsapp')
    .maybeSingle();

  const token = (data?.valore as any)?.token;
  return !!(token && String(token).trim());
}

/**
 * Normalizza numero cellulare: solo cifre, prefisso 39 se manca.
 * Ritorna '' se il numero è vuoto.
 */
export function normalizzaCellulare(cellulare: string): string {
  const numPulito = (cellulare || '').replace(/\D/g, '');
  if (!numPulito) return '';
  return numPulito.startsWith('39') ? numPulito : '39' + numPulito;
}

export interface InviaWhatsAppParams {
  /** Numero cellulare del destinatario (qualsiasi formato). */
  cellulare: string;
  /** Testo del messaggio (già renderizzato). Se contiene `{link}` viene sostituito col link PDF nel fallback. */
  messaggio: string;
  /** PDF in base64 (senza datauri prefix). Usato SOLO se Whatsender è configurato. */
  pdf_base64?: string;
  /** Nome file PDF (es. "Fattura_001.pdf"). Usato SOLO se Whatsender è configurato. */
  pdf_filename?: string;
  /** Callback che ritorna l'URL pubblico del PDF. Usato SOLO nel fallback wa.me. */
  getPdfUrlPerFallback?: () => Promise<string>;
}

export interface InviaWhatsAppResult {
  metodo: 'whatsender' | 'wa_me';
  sent_to: string;
  has_pdf: boolean;
  whatsapp_url?: string;
}

/**
 * Invia un messaggio WhatsApp con la strategia migliore:
 * - Se Whatsender è configurato → chiama Edge Function `send-whatsapp` (testo + PDF opzionale)
 * - Altrimenti → apre `wa.me` con link al PDF pubblico (fallback)
 *
 * Il PDF è opzionale: se assente, viene inviato solo il testo.
 *
 * Ritorna info su cosa è stato fatto.
 */
export async function inviaWhatsAppSmart(
  params: InviaWhatsAppParams
): Promise<InviaWhatsAppResult> {
  const numeroFinale = normalizzaCellulare(params.cellulare);
  if (!numeroFinale) {
    throw new Error('Numero cellulare mancante o non valido');
  }

  const hasWhatsender = await haWhatsenderConfigurato();

  // === STRATEGIA 1: Whatsender API (testo + PDF opzionale) ===
  if (hasWhatsender) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessione scaduta');
    }

    // Rimuovi il placeholder {link} (il PDF è allegato, non serve link)
    // e normalizza eventuali righe vuote consecutive lasciate dalla rimozione
    const messaggioPulito = params.messaggio
      .replace(/\{link\}/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver: numeroFinale,
          message: messaggioPulito,
          pdf_base64: params.pdf_base64,
          pdf_filename: params.pdf_filename,
        }),
      }
    );

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Errore invio WhatsApp via Whatsender');
    }

    return {
      metodo: 'whatsender',
      sent_to: numeroFinale,
      has_pdf: !!json.has_pdf,
    };
  }

  // === STRATEGIA 2: fallback wa.me (link PDF) ===
  let messaggioFinale = params.messaggio;
  if (params.getPdfUrlPerFallback) {
    try {
      const url = await params.getPdfUrlPerFallback();
      if (url) {
        messaggioFinale = messaggioFinale.replace(/\{link\}/g, url);
      } else {
        messaggioFinale = messaggioFinale.replace(/\{link\}/g, '');
      }
    } catch (e) {
      console.warn('⚠️ Fallback PDF URL non disponibile:', e);
      messaggioFinale = messaggioFinale.replace(/\{link\}/g, '');
    }
  } else {
    messaggioFinale = messaggioFinale.replace(/\{link\}/g, '');
  }

  const waUrl = `https://wa.me/${numeroFinale}?text=${encodeURIComponent(messaggioFinale)}`;
  window.open(waUrl, '_blank');

  return {
    metodo: 'wa_me',
    sent_to: numeroFinale,
    has_pdf: false,
    whatsapp_url: waUrl,
  };
}
