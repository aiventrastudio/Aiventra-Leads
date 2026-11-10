import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Sign in before checking GMass.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return json({ status: 'error', detail: 'Supabase function configuration is incomplete.' })

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401)

  const apiKey = Deno.env.get('GMASS_API_KEY')
  if (!apiKey) return json({ status: 'needs_setup', detail: 'GMASS_API_KEY has not been added to Supabase Edge Function secrets.' })

  try {
    const response = await fetch('https://api.gmass.co/api/campaigns?limit=1&offset=0', {
      headers: { 'X-apikey': apiKey, Accept: 'application/json' },
    })
    if (response.ok) return json({ status: 'connected', detail: 'GMass API key verified.' })
    if (response.status === 401 || response.status === 403) {
      return json({ status: 'error', detail: 'GMass rejected the API key. Check that the key is valid and API access is enabled for the GMass plan.' })
    }
    return json({ status: 'error', detail: `GMass connection check failed with HTTP ${response.status}. Try again shortly.` })
  } catch {
    return json({ status: 'error', detail: 'Could not reach GMass. Check the provider status and try again.' })
  }
})
