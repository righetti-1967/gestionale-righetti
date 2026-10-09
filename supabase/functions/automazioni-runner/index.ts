// ============================================================
// Edge Function: automazioni-runner
// Esegue le automazioni in dry-run (simulazione) o reale.
// Body atteso: { chiave: string, force_dry_run?: boolean }
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AutomazioneRow {
  user_id: string;
  tipo: string;
  attivo: boolean;
  modalita: string;
  parametri: any;
}

interface Appuntamento {
  id: number;
  cliente_id: number;
  data: string;
  ora_inizio: string;
  stato: string;
  titolo: string | null;
  servizio_id: number | null;
  is_blocco: boolean | null;
  user_id: string;
}

interface Cliente {
  id: number;
  nome_cognome: string;
  email: string | null;
  cellulare: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { chiave, force_dry_run } = await req.json();
    if (!chiave) return json({ success: false, error: 'chiave mancante' }, 400);

    // Auth: prendi l'user dal token
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ success: false, error: 'no token' }, 401);

    // Client "utente" per letture con RLS
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    // Client "admin" per INSERT log (bypassa RLS)
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData.user) return json({ success: false, error: 'utente non valido' }, 401);
    const userId = userData.user.id;

    // Leggi l'automazione
    const { data: autom, error: automErr } = await supa
      .from('automazioni')
      .select('*')
      .eq('user_id', userId)
      .eq('tipo', chiave)
      .maybeSingle();
    if (automErr) return json({ success: false, error: automErr.message }, 500);
    if (!autom) return json({ success: false, error: `Automazione ${chiave} non trovata` }, 404);

    const a = autom as AutomazioneRow;
    const modalitaEffettiva = force_dry_run ? 'simulazione' : a.modalita;

    if (!a.attivo) {
      return json({ success: true, log_creati: 0, nota: 'Automazione disattiva' });
    }

    // Esegui in base al tipo
    let logCreati = 0;
    let errori: string[] = [];
    if (chiave === 'promemoria_appuntamento') {
      const r = await eseguiPromemoria({
        supa, supaAdmin, userId, autom: a,
        modalitaEffettiva,
        isCheckup: false,
      });
      logCreati = r.logCreati;
      errori = r.errori;
    } else if (chiave === 'promemoria_checkup') {
      const r = await eseguiPromemoria({
        supa, supaAdmin, userId, autom: a,
        modalitaEffettiva,
        isCheckup: true,
      });
      logCreati = r.logCreati;
      errori = r.errori;
    } else {
      return json({ success: false, error: `chiave ${chiave} non supportata in questa versione` }, 400);
    }

    return json({ success: true, log_creati: logCreati, modalita: modalitaEffettiva, errori });
  } catch (e: any) {
    return json({ success: false, error: e.message || String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function eseguiPromemoria({
  supa, supaAdmin, userId, autom, modalitaEffettiva, isCheckup,
}: {
  supa: any;
  supaAdmin: any;
  userId: string;
  autom: AutomazioneRow;
  modalitaEffettiva: string;
  isCheckup: boolean;
}): Promise<{ logCreati: number; errori: string[] }> {
  const errori: string[] = [];
  const oreAnticipo = Number(autom.parametri?.ore_anticipo ?? (isCheckup ? 72 : 24));
  const canale = autom.parametri?.canale ?? 'whatsapp';

  // Finestra temporale: adesso → adesso + oreAnticipo
  const ora = new Date();
  const limite = new Date(ora.getTime() + oreAnticipo * 3600 * 1000);
  const oggi = ora.toISOString().slice(0, 10);
  const limiteData = limite.toISOString().slice(0, 10);

  // Query appuntamenti target
  let q = supa
    .from('appuntamenti')
    .select('id, cliente_id, data, ora_inizio, stato, titolo, servizio_id, is_blocco, user_id')
    .eq('user_id', userId)
    .gte('data', oggi)
    .lte('data', limiteData)
    .in('stato', ['prenotato', 'confermato'])
    .order('data', { ascending: true });

  if (isCheckup) {
    q = q.eq('servizio_id', 2);
  }

  const { data: appuntamenti, error: appErr } = await q;
  if (appErr) throw new Error(appErr.message);

  const lista = (appuntamenti ?? []).filter((a: Appuntamento) => !a.is_blocco);
  let logCreati = 0;

  // Carica azienda per il nome (una volta sola)
  const { data: azData } = await supa
    .from('impostazioni')
    .select('valore')
    .eq('user_id', userId)
    .eq('chiave', 'dati_aziendali')
    .maybeSingle();
  const nomeAzienda = (azData?.valore as any)?.nome_studio || (azData?.valore as any)?.ragione_sociale || '';
  const whatsappStudio = ((azData?.valore as any)?.whatsapp || '').replace(/\D/g, '');

  // Carica template
  const chiaveEmail = isCheckup ? 'email_promemoria_checkup' : 'email_promemoria';
  const chiaveWhatsApp = isCheckup ? 'whatsapp_promemoria_checkup' : 'whatsapp_promemoria';

  const { data: tEmail } = await supa
    .from('testi_template')
    .select('oggetto, corpo')
    .eq('user_id', userId)
    .eq('chiave', chiaveEmail)
    .maybeSingle();

  const { data: tWA } = await supa
    .from('testi_template')
    .select('corpo')
    .eq('user_id', userId)
    .eq('chiave', chiaveWhatsApp)
    .maybeSingle();

  const DEFAULT_EMAIL_OGG = isCheckup
    ? 'Promemoria Check-Up — {data} ore {ora}'
    : 'Promemoria appuntamento — {data} ore {ora}';
  const DEFAULT_EMAIL_CORPO = isCheckup
    ? `Ciao {nome},\n\nTi ricordiamo la tua prima visita presso il nostro Studio per il tuo "Check-Up Gratuito" di:\n\n[[BOX]]\n\nPer qualsiasi necessità contattaci:\n\n[[WHATSAPP]]\n\nTi aspettiamo!`
    : `Ciao {nome},\n\nTi ricordiamo il tuo appuntamento di:\n\n[[BOX]]\n\nPer qualsiasi necessità contattaci:\n\n[[WHATSAPP]]\n\nA presto!`;
  const DEFAULT_WA = isCheckup
    ? `Ciao {nome}, ti ricordiamo la tua prima visita presso il nostro Studio per il tuo "Check-Up Gratuito" di {data_estesa} alle ore {ora}.\n\nPer qualsiasi necessità contattaci.\n\nTi aspettiamo!\n{azienda}`
    : `Ciao {nome}, ti ricordiamo il tuo appuntamento di {data_estesa} alle ore {ora}.\n\nGrazie e a presto!\n{azienda}`;

  const tplEmailOgg = tEmail?.oggetto || DEFAULT_EMAIL_OGG;
  const tplEmailCorpo = tEmail?.corpo || DEFAULT_EMAIL_CORPO;
  const tplWA = tWA?.corpo || DEFAULT_WA;

  for (const app of lista as Appuntamento[]) {
    // Carica cliente
    const { data: cli } = await supa
      .from('clienti')
      .select('id, nome_cognome, email, cellulare')
      .eq('id', app.cliente_id)
      .maybeSingle();

    const c = cli as Cliente | null;
    const nome = (c?.nome_cognome || '').trim().split(/\s+/)[0] || 'Cliente';
    const cognome = (c?.nome_cognome || '').trim().split(/\s+/).slice(1).join(' ') || '';
    const dataIt = formatDataEstesa(app.data);
    const dataBR = formatDataBreve(app.data);
    const oraStr = (app.ora_inizio || '').slice(0, 5);

    // Render email
    const oggettoEmail = renderVars(tplEmailOgg, { nome, cognome, azienda: nomeAzienda, data: dataBR, ora: oraStr });
    let corpoEmail = renderVars(tplEmailCorpo, { nome, cognome, azienda: nomeAzienda, data: dataBR, ora: oraStr, data_estesa: dataIt });
    corpoEmail = corpoEmail
      .replace(/\[\[BOX\]\]/g, `<div style="background:#f5f5f7;border-radius:12px;padding:18px 20px;margin:20px 0;"><p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:#1c1c1e;">${dataIt}</p><p style="margin:0;font-size:15px;color:#1c1c1e;">alle ore <strong>${oraStr}</strong></p></div>`)
      .replace(/\[\[WHATSAPP\]\]/g, whatsappStudio ? `<p style="margin:16px 0;"><a href="https://wa.me/${whatsappStudio}" style="color:#34C759;font-weight:600;">Scrivici su WhatsApp</a></p>` : '');

    // Render WhatsApp
    const testoWA = renderVars(tplWA, { nome, cognome, azienda: nomeAzienda, data: dataBR, ora: oraStr, data_estesa: dataIt });

    // Log per canale email
    if ((canale === 'email' || canale === 'entrambi')) {
      const esito = c?.email ? 'ok' : 'skip';
      const { error: errInsEmail } = await supaAdmin.from('automazioni_log').insert({
        user_id: userId,
        chiave: isCheckup ? 'promemoria_checkup' : 'promemoria_appuntamento',
        modalita: modalitaEffettiva === 'automatico' ? 'reale' : 'simulazione',
        esito,
        client_id: c?.id ?? null,
        client_nome: c?.nome_cognome ?? null,
        client_email: c?.email ?? null,
        canale: 'email',
        oggetto: oggettoEmail,
        corpo_html: corpoEmail,
        motivo_skip: esito === 'skip' ? 'Email cliente mancante' : null,
        metadata: { appuntamento_id: app.id, data: app.data, ora: oraStr },
      });
      if (errInsEmail) {
        errori.push(`INSERT email app ${app.id}: ${errInsEmail.message}`);
      } else {
        logCreati++;
      }
    }

    // Log per canale whatsapp
    if ((canale === 'whatsapp' || canale === 'entrambi')) {
      const cellNorm = (c?.cellulare || '').replace(/\D/g, '');
      const esito = cellNorm ? 'ok' : 'skip';
      const { error: errInsWA } = await supaAdmin.from('automazioni_log').insert({
        user_id: userId,
        chiave: isCheckup ? 'promemoria_checkup' : 'promemoria_appuntamento',
        modalita: modalitaEffettiva === 'automatico' ? 'reale' : 'simulazione',
        esito,
        client_id: c?.id ?? null,
        client_nome: c?.nome_cognome ?? null,
        client_cell: cellNorm || null,
        canale: 'whatsapp',
        corpo_testo: testoWA,
        motivo_skip: esito === 'skip' ? 'Cellulare cliente mancante' : null,
        metadata: { appuntamento_id: app.id, data: app.data, ora: oraStr },
      });
      if (errInsWA) {
        errori.push(`INSERT WhatsApp app ${app.id}: ${errInsWA.message}`);
      } else {
        logCreati++;
      }
    }
  }

  return { logCreati, errori };
}

function renderVars(testo: string, vars: Record<string, string>): string {
  let out = testo;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v || '');
  }
  return out.replace(/\\n/g, '\n');
}

function formatDataEstesa(dataISO: string): string {
  try {
    const d = new Date(dataISO + 'T00:00:00');
    const s = d.toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
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
