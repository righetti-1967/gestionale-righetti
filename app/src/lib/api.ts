import { supabase } from './supabase';

/**
 * Client API per il backend FastAPI su Railway.
 * Usato per operazioni admin (licenze, popola DEMO) e future (email, WhatsApp, sync).
 */

const FASTAPI_URL =
  import.meta.env.VITE_FASTAPI_URL ?? 'http://localhost:8000';

// ============================================================
// TIPI
// ============================================================

export interface AdminUtenteLicenza {
  id: string;
  email: string;
  azienda: string;
  full_name: string;
  created_at: string;
  ruolo: 'admin' | 'reale' | 'demo';
  demo_scadenza: string | null;
  giorni_rimasti: number;
  is_scaduto: boolean;
  is_admin: boolean;
}

export interface PopolaDemoResponse {
  success: boolean;
  user_id: string;
  riepilogo: {
    logo: boolean;
    clienti: number;
    servizi: number;
    prodotti: number;
    percorsi: number;
    appuntamenti: number;
    impostazioni: number;
    errori: string[];
  };
}

// ============================================================
// HEALTH CHECK
// ============================================================

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${FASTAPI_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================
// LICENZE (admin only)
// ============================================================

export async function getAdminUtenti(
  adminEmail: string
): Promise<AdminUtenteLicenza[]> {
  const res = await fetch(
    `${FASTAPI_URL}/api/licenze/utenti?admin_email=${encodeURIComponent(adminEmail)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Errore lettura utenti' }));
    throw new Error(err.detail || 'Errore lettura utenti');
  }
  const data = await res.json();
  return data.utenti || [];
}

export async function prorogaDemoUtente(
  adminEmail: string,
  params: { userId: string; giorni?: number; dataScadenzaIso?: string }
): Promise<void> {
  const res = await fetch(
    `${FASTAPI_URL}/api/licenze/proroga?admin_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: params.userId,
        giorni: params.giorni,
        data_scadenza_iso: params.dataScadenzaIso,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Errore proroga' }));
    throw new Error(err.detail || 'Errore proroga');
  }
}

export async function sbloccaUtenteReale(
  adminEmail: string,
  params: { userId: string; azzeraDatiDemo?: boolean }
): Promise<void> {
  const res = await fetch(
    `${FASTAPI_URL}/api/licenze/sblocca-reale?admin_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: params.userId,
        azzera_dati_demo: params.azzeraDatiDemo ?? true,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Errore attivazione licenza' }));
    throw new Error(err.detail || 'Errore attivazione licenza');
  }
}

export async function popolaDemoUtente(
  adminEmail: string,
  userId: string
): Promise<PopolaDemoResponse> {
  const res = await fetch(
    `${FASTAPI_URL}/api/licenze/popola-demo?admin_email=${encodeURIComponent(adminEmail)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Errore popolamento demo' }));
    throw new Error(err.detail || 'Errore popolamento demo');
  }
  return await res.json();
}

// ============================================================
// SINCRONIZZAZIONE GOOGLE SHEETS
// ============================================================
export interface SheetsSyncResponse {
  success: boolean;
  nuovi: number;
  aggiornati: number;
  saltati: number;
  totale: number;
  messaggio: string;
}

export async function syncGoogleSheets(sheetUrl: string, userId?: string): Promise<SheetsSyncResponse> {
  const res = await fetch(`${FASTAPI_URL}/api/sheets/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet_url: sheetUrl, user_id: userId }),
  });

  if (!res.ok) {
    let dettaglio = '';
    try {
      const j = await res.json();
      dettaglio = j.detail ?? JSON.stringify(j);
    } catch {
      dettaglio = await res.text();
    }
    throw new Error(`Errore ${res.status}: ${dettaglio.slice(0, 400)}`);
  }
  return res.json();
}

// ============================================================
// TEST INVIO EMAIL
// ============================================================
export interface TestEmailPayload {
  google_script_url?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  from_name?: string;
  from_email?: string;
  destinatario: string;
}

export async function inviaEmailTest(payload: TestEmailPayload): Promise<{ success: boolean; messaggio: string }> {
  const res = await fetch(`${FASTAPI_URL}/api/email/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let dettaglio = '';
    try {
      const j = await res.json();
      dettaglio = j.detail ?? JSON.stringify(j);
    } catch {
      dettaglio = await res.text();
    }
    throw new Error(dettaglio || `Errore ${res.status}`);
  }
  return res.json();
}


export interface InviaEmailPayload {
  destinatario: string;
  oggetto: string;
  corpo_html: string;
  corpo_testo?: string;
  from_name?: string;
  google_script_url?: string;
  allegato_base64?: string;
  allegato_nome?: string;
}

export async function inviaEmail(payload: InviaEmailPayload): Promise<{ success: boolean; messaggio: string }> {
  const res = await fetch(`${FASTAPI_URL}/api/email/invia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let dettaglio = '';
    try {
      const j = await res.json();
      dettaglio = j.detail ?? JSON.stringify(j);
    } catch {
      dettaglio = await res.text();
    }
    throw new Error(dettaglio || `Errore ${res.status}`);
  }
  return res.json();
}

// ============================================================
// HELPER: INVIO EMAIL CON CONFIG AUTOMATICA
// Carica la config dal DB dell'utente loggato e invia.
// ============================================================

export async function inviaEmailConConfig(payload: {
  destinatario: string;
  oggetto: string;
  corpo_html: string;
  corpo_testo?: string;
  from_name?: string;
  allegato_base64?: string;
  allegato_nome?: string;
}): Promise<{ success: boolean; messaggio: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Utente non autenticato');
  }

  const { data } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', user.id)
    .eq('chiave', 'config_email')
    .maybeSingle();

  const config = data?.valore as Record<string, any> | null;

  if (!config) {
    throw new Error('Configurazione email non trovata. Vai in Impostazioni → Comunicazioni.');
  }

  const googleScriptUrl = config.googleScriptUrl || config.google_script_url || '';
  const host = config.host || '';

  if (!googleScriptUrl && !host) {
    throw new Error('Nessun provider email configurato. Vai in Impostazioni → Comunicazioni.');
  }

  return inviaEmail({
    destinatario: payload.destinatario,
    oggetto: payload.oggetto,
    corpo_html: payload.corpo_html,
    corpo_testo: payload.corpo_testo,
    from_name: payload.from_name,
    google_script_url: googleScriptUrl || undefined,
    allegato_base64: payload.allegato_base64,
    allegato_nome: payload.allegato_nome,
  });
}
