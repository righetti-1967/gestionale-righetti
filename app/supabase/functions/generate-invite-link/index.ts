import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utente non autenticato' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { client_id } = body

    if (!client_id) {
      return new Response(JSON.stringify({ error: 'client_id mancante' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: cliente, error: clienteError } = await supabaseClient
      .from('clienti')
      .select('id, email, nome_cognome, user_id')
      .eq('id', client_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (clienteError || !cliente) {
      return new Response(JSON.stringify({ error: 'Cliente non trovato o non tuo' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!cliente.email) {
      return new Response(JSON.stringify({ error: 'Il cliente non ha un indirizzo email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    await supabaseAdmin
      .from('client_invites')
      .delete()
      .eq('client_id', client_id)
      .is('used_at', null)

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: cliente.email,
      options: {
        redirectTo: 'https://cliente.righetti.club/auth/callback',
      },
    })

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: 'Errore generazione link', details: linkError?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const actionLink = linkData.properties?.action_link || ''

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('client_invites')
      .insert({
        client_id,
        token: crypto.randomUUID(),
        created_by: user.id,
        action_link: actionLink,
      })
      .select('id, token, expires_at')
      .single()

    if (inviteError) {
      return new Response(JSON.stringify({ error: 'Errore inserimento invito', details: inviteError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      action_link: actionLink,
      invite_id: invite.id,
      expires_at: invite.expires_at,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Errore server', details: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
