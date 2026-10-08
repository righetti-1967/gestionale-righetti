import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PushPayload {
  notifica_id?: string
  client_id?: number
  titolo: string
  messaggio: string
  priorita?: 'alta' | 'media' | 'bassa'
  url?: string
  tipo?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Auth: accetta sia service_role (cron/trigger) sia staff autenticato
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:righetti@righetti.club'

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys mancanti' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Setup web-push
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // 3. Service role client (bypassa RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 4. Leggi payload
    const body: PushPayload = await req.json()

    if (!body.titolo || !body.messaggio) {
      return new Response(
        JSON.stringify({ error: 'titolo e messaggio obbligatori' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let notificaId = body.notifica_id
    let clientId = body.client_id

    // 5. Se ho notifica_id, leggo dettagli dalla tabella
    if (notificaId && !clientId) {
      const { data: n, error } = await supabase
        .from('notifiche')
        .select('id, client_id, titolo, messaggio, priorita, url, tipo')
        .eq('id', notificaId)
        .maybeSingle()

      if (error || !n) {
        return new Response(
          JSON.stringify({ error: 'Notifica non trovata' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      clientId = n.client_id
      body.titolo = n.titolo
      body.messaggio = n.messaggio
      body.priorita = n.priorita || 'media'
      body.url = n.url || undefined
      body.tipo = n.tipo
    }

    // 6. Se non ho notifica_id, creo record in notifiche
    if (!notificaId && clientId) {
      const { data: newN, error: insErr } = await supabase
        .from('notifiche')
        .insert({
          client_id: clientId,
          tipo: body.tipo || 'custom',
          titolo: body.titolo,
          messaggio: body.messaggio,
          priorita: body.priorita || 'media',
          url: body.url || null,
        })
        .select('id')
        .single()

      if (insErr || !newN) {
        return new Response(
          JSON.stringify({ error: 'Errore creazione notifica', details: insErr?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      notificaId = newN.id
    }

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'client_id mancante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Recupera subscriptions
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('client_id', clientId)

    if (subsErr) {
      return new Response(
        JSON.stringify({ error: 'Errore lettura subscriptions', details: subsErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!subs || subs.length === 0) {
      // Nessuna subscription: notifica creata ma non push
      if (notificaId) {
        await supabase
          .from('notifiche')
          .update({ push_inviata: true, push_errore: 'Nessuna subscription' })
          .eq('id', notificaId)
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nessuna subscription attiva',
          notifica_id: notificaId,
          sent: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Invia push a tutte le subscription
    const pushPayload = JSON.stringify({
      title: body.titolo,
      body: body.messaggio,
      url: body.url || '/notifiche',
      priority: body.priorita || 'media',
      tag: notificaId ? `notifica-${notificaId}` : undefined,
    })

    let sent = 0
    let failed = 0
    const errori: string[] = []

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
          {
            TTL: body.priorita === 'alta' ? 86400 : 3600,
            urgency: body.priorita === 'alta' ? 'high' : 'normal',
          }
        )
        sent++
        // Aggiorna last_used_at
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
      } catch (err: any) {
        failed++
        const statusCode = err?.statusCode
        const msg = `${statusCode ?? 'unknown'}: ${err?.message ?? 'errore sconosciuto'}`
        errori.push(msg)

        // Subscription scaduta/invalida → elimina
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
          console.log(`Subscription ${sub.id} rimossa (scaduta)`)
        }
      }
    }

    // 9. Aggiorna notifica con esito
    if (notificaId) {
      await supabase
        .from('notifiche')
        .update({
          push_inviata: sent > 0,
          push_inviata_at: new Date().toISOString(),
          push_errore: errori.length > 0 ? errori.join(' | ') : null,
        })
        .eq('id', notificaId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifica_id: notificaId,
        sent,
        failed,
        errori,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('send-push error:', err)
    return new Response(
      JSON.stringify({ error: 'Errore server', details: err?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
