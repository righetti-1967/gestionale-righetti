// ============================================================
// Edge Function: send-whatsapp
// Invia un messaggio WhatsApp via Whatsender API (con eventuale PDF)
// Body atteso: { receiver, message, pdf_base64?, pdf_filename? }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    const { receiver, message, pdf_base64, pdf_filename } = body;

    if (!receiver || !message) {
      return json({ success: false, error: 'receiver e message obbligatori' }, 400);
    }

    // Auth
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ success: false, error: 'no token' }, 401);

    const supa = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData.user) return json({ success: false, error: 'utente non valido' }, 401);

    // Admin client per letture/scritture DB
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Leggi config_whatsapp
    const { data: cfgRow } = await supaAdmin
      .from('impostazioni')
      .select('valore')
      .eq('user_id', userData.user.id)
      .eq('chiave', 'config_whatsapp')
      .maybeSingle();

    const cfg = (cfgRow?.valore as any) || {};
    const whatsenderToken = (cfg.token || '').trim();
    if (!whatsenderToken) {
      return json({ success: false, error: 'Whatsender non configurato (token mancante)' }, 400);
    }

    // Normalizza receiver (solo cifre, prefisso 39)
    const cleanReceiver = receiver.replace(/\D/g, '');
    const finalReceiver = cleanReceiver.startsWith('39') ? cleanReceiver : '39' + cleanReceiver;

    // Upload PDF se presente
    let mediaUrl = '';
    if (pdf_base64 && pdf_filename) {
      try {
        // Decodifica base64
        const binary = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
        const fileName = `wa-fatture/${userData.user.id}/${Date.now()}_${pdf_filename}`;

        const { error: upErr } = await supaAdmin.storage
          .from('fatture-pdf')
          .upload(fileName, binary, { contentType: 'application/pdf', upsert: true });

        if (upErr) {
          console.error('Upload error:', upErr);
          return json({ success: false, error: `Upload PDF: ${upErr.message}` }, 500);
        }

        const { data: urlData } = supaAdmin.storage
          .from('fatture-pdf')
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
      } catch (pdfErr: any) {
        console.error('Errore upload PDF:', pdfErr);
        return json({ success: false, error: `Errore upload PDF: ${pdfErr.message}` }, 500);
      }
    }

    // Chiama API Whatsender
    const payload = {
      receiver: finalReceiver,
      msgtext: message,
      token: whatsenderToken,
      mediaurl: mediaUrl || '',
    };

    const res = await fetch('https://api.whatsender.it/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const resJson = await res.json().catch(() => ({}));

    if (!res.ok || resJson.success === false) {
      return json({
        success: false,
        error: resJson.message || `Whatsender errore (${res.status})`,
        whatsender_response: resJson,
      }, 500);
    }

    return json({
      success: true,
      sent_to: finalReceiver,
      has_pdf: !!mediaUrl,
      media_url: mediaUrl,
    });
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
