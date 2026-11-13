import { createClient } from 'npm:@supabase/supabase-js@2'
import { analyzePosts, getGeminiModels, type BrowserPost } from '../_shared/analyze-posts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Sign in before analyzing posts.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!url || !anonKey) return json({ error: 'Supabase function configuration is incomplete.' }, 500)
  if (!apiKey) return json({ error: 'AI qualification is not configured. Add GEMINI_API_KEY to Supabase Edge Function secrets.' }, 503)
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401)
  let body: { session_id?: string; posts?: BrowserPost[] }
  try { body = await request.json() } catch { return json({ error: 'Request body must be valid JSON.' }, 400) }
  if (!body.session_id || !Array.isArray(body.posts) || body.posts.length < 1 || body.posts.length > 30) {
    return json({ error: 'Provide a session_id and between 1 and 30 posts.' }, 400)
  }
  const { data: session, error: sessionError } = await supabase.from('agent_sessions')
    .select('id, workspace_id, minimum_score, voice_instructions, status')
    .eq('id', body.session_id).maybeSingle()
  if (sessionError || !session) return json({ error: 'Session not found or not accessible.' }, 404)
  if (session.status !== 'running' && session.status !== 'paused') return json({ error: 'This research session is no longer active.' }, 409)
  const { data: settings, error: settingsError } = await supabase.from('search_settings')
    .select('service_categories, minimum_budget, excluded_phrases')
    .eq('workspace_id', session.workspace_id).maybeSingle()
  if (settingsError) {
    console.error(`search_settings lookup failed (${settingsError.code || 'unknown'}): ${settingsError.message}`)
    return json({ error: 'Could not query the saved search settings. Check that the search_settings columns exist and that the signed-in user can read this workspace.' }, 400)
  }
  if (!settings) return json({ error: 'No saved search settings were found for this workspace. Open Search setup and save your rules, then start a new research session.' }, 400)
  const posts = body.posts.map((post, index) => ({
    id: String(post.id || `${index}`),
    text: String(post.text || '').slice(0, 6000),
    source_url: String(post.source_url || '').slice(0, 2000),
    profile_url: String(post.profile_url || '').slice(0, 2000),
    author: String(post.author || '').slice(0, 240),
    published_at: post.published_at || null,
    profile_text: String(post.profile_text || '').slice(0, 1800),
    visible_metrics: post.visible_metrics || {},
  }))
  if (posts.some((post) => !post.text || !/^https?:\/\//i.test(post.source_url))) return json({ error: 'Each post needs text and a valid source URL.' }, 422)
  try {
    const analyzed = await analyzePosts(posts, {
      service_categories: settings.service_categories || [],
      minimum_budget: settings.minimum_budget || '',
      excluded_phrases: String(settings.excluded_phrases || '').split(/[\n,]/).map((value) => value.trim()).filter(Boolean).slice(0, 20),
      voice_instructions: session.voice_instructions || '',
    }, apiKey, getGeminiModels())
    const qualified = analyzed.filter((post) => post.relevant && post.match_score >= session.minimum_score)
    return json({ analyzed: analyzed.length, qualified })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Post analysis failed.'
    console.error(`Gemini post analysis failed: ${message.slice(0, 1000)}`)
    return json({ error: message }, 502)
  }
})
