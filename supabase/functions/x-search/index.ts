import { createClient } from 'npm:@supabase/supabase-js@2'
import { analyzePosts, getGeminiModels, type BrowserPost } from '../_shared/analyze-posts.ts'

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

type XUser = { id: string; name?: string; username?: string; description?: string; url?: string }
type XPost = { id: string; text: string; author_id?: string; created_at?: string; public_metrics?: Record<string, number> }
function splitTerms(raw: string) {
  return raw.split(/[,\n]/).map((part) => part.trim()).filter(Boolean).slice(0, 12)
}

function xTerm(value: string) {
  const clean = value.replace(/["\\]/g, ' ').trim()
  return /\s/.test(clean) ? `"${clean}"` : clean
}

function buildXQuery(keywords: string[], categories: string[], excluded: string[]) {
  const include = keywords.length ? keywords : categories
  if (!include.length) return ''
  const positive = include.map(xTerm).join(' OR ')
  const negative = excluded.map((term) => `-${xTerm(term)}`).join(' ')
  // Exclude reposts and replies to keep the queue focused on original requests.
  return [`(${positive})`, negative, '-is:retweet', '-is:reply'].filter(Boolean).join(' ').slice(0, 512)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Sign in before searching X.' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'Supabase function configuration is incomplete.' }, 500)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401)

  let workspaceId = ''
  try {
    const body = await request.json()
    workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  } catch { return json({ error: 'A workspace_id is required.' }, 400) }
  if (!workspaceId) return json({ error: 'A workspace_id is required.' }, 400)

  const { data: settings, error: settingsError } = await supabase.from('search_settings')
    .select('keywords, excluded_phrases, service_categories, source_preferences, minimum_budget, score_thresholds')
    .eq('workspace_id', workspaceId).maybeSingle()
  if (settingsError) {
    if (settingsError.message.toLowerCase().includes('score_thresholds') || settingsError.message.toLowerCase().includes('column')) {
      return json({ error: 'Apply migration 202611100004_opportunity_intelligence.sql in the Aiventra Supabase project before searching.' }, 409)
    }
    return json({ error: 'Could not load search settings for this workspace.' }, 400)
  }
  if (!settings) return json({ error: 'Save search rules before searching.' }, 400)
  if (!(settings.source_preferences || []).some((source: string) => source.toLowerCase() === 'x')) {
    return json({ error: 'Select X in Search setup and save the rules before searching.' }, 400)
  }

  const xToken = Deno.env.get('X_BEARER_TOKEN')
  const aiKey = Deno.env.get('GEMINI_API_KEY')
  if (!xToken) return json({ error: 'X is not configured. Add X_BEARER_TOKEN to the Supabase Edge Function secrets.' }, 503)
  if (!aiKey) return json({ error: 'AI qualification is not configured. Add GEMINI_API_KEY to Supabase Edge Function secrets.' }, 503)

  const query = buildXQuery(splitTerms(settings.keywords || ''), settings.service_categories || [], splitTerms(settings.excluded_phrases || ''))
  if (!query) return json({ error: 'Add at least one keyword or service category to Search setup.' }, 400)

  try {
    const searchUrl = new URL('https://api.x.com/2/tweets/search/recent')
    searchUrl.searchParams.set('query', query)
    searchUrl.searchParams.set('max_results', '100')
    searchUrl.searchParams.set('tweet.fields', 'author_id,created_at,public_metrics,lang')
    searchUrl.searchParams.set('expansions', 'author_id')
    searchUrl.searchParams.set('user.fields', 'name,username,description,url')
    const xResponse = await fetch(searchUrl, { headers: { Authorization: `Bearer ${xToken}`, Accept: 'application/json' } })
    if (!xResponse.ok) {
      if (xResponse.status === 401 || xResponse.status === 403) return json({ error: 'X rejected the token or this app is not entitled to recent post search. Check X developer access and billing.' }, 502)
      if (xResponse.status === 429) return json({ error: 'X search rate limit reached. Wait for the limit to reset, then try again.' }, 429)
      return json({ error: `X search failed with HTTP ${xResponse.status}.` }, 502)
    }
    const xData = await xResponse.json()
    const posts: XPost[] = Array.isArray(xData.data) ? xData.data : []
    const users: XUser[] = Array.isArray(xData.includes?.users) ? xData.includes.users : []
    if (!posts.length) return json({ searched: 0, added: 0, skipped: 0, message: 'X returned no posts matching these rules in its recent-search window.' })

    const usersById = new Map(users.map((user) => [user.id, user]))
    const analysisInput: BrowserPost[] = posts.flatMap((post) => {
      const user = usersById.get(post.author_id || '')
      if (!user?.username) return []
      return [{
        id: post.id, text: post.text,
        source_url: `https://x.com/${user.username}/status/${post.id}`,
        profile_url: `https://x.com/${user.username}`,
        author: user.name ? `${user.name} (@${user.username})` : `@${user.username}`,
        published_at: post.created_at || null,
        profile_text: user.description || '',
        visible_metrics: post.public_metrics || {},
      }]
    })
    const analyzed = await analyzePosts(analysisInput, {
      service_categories: settings.service_categories || [],
      minimum_budget: settings.minimum_budget || '',
      excluded_phrases: splitTerms(settings.excluded_phrases || ''),
    }, aiKey, getGeminiModels())
    const candidates = analyzed.filter((item) => item.relevant)
    const sourceUrls = candidates.map((item) => item.source_url)

    const { data: existingRows, error: existingError } = sourceUrls.length
      ? await supabase.from('opportunities').select('source_url').eq('workspace_id', workspaceId).in('source_url', sourceUrls)
      : { data: [], error: null }
    if (existingError) return json({ error: 'Could not check for previously captured X posts.' }, 400)
    const existingUrls = new Set((existingRows || []).map((row: { source_url: string | null }) => row.source_url))

    const rows = candidates.flatMap((result) => {
      if (existingUrls.has(result.source_url)) return []
      const detail = result.text.trim().slice(0, 5000)
      return [{
        workspace_id: workspaceId,
        created_by: auth.user.id,
        title: result.title,
        source: 'X',
        source_url: result.source_url,
        source_platform: 'X',
        profile_url: result.profile_url,
        qualification_reason: result.qualification_reason,
        contact: result.author,
        business_name: result.business_name,
        email: result.email,
        phone: result.phone,
        detail,
        pain_point: result.pain_point,
        service_needed: result.service_needed,
        budget: result.budget,
        buying_intent: result.buying_intent,
        published_at: result.published_at || null,
        discovered_at: new Date().toISOString(),
        field_evidence: {
          ...result.field_evidence,
          author: 'stated',
          profile_url: 'stated',
          qualification_reason: 'inferred',
        },
        status: 'New',
        match_score: result.match_score,
      }]
    })

    if (!rows.length) return json({ searched: posts.length, added: 0, skipped: candidates.length, message: 'X search completed. Matching posts were already in this workspace.' })
    const { data: inserted, error: insertError } = await supabase.from('opportunities').insert(rows).select('id')
    if (insertError) {
      if (['business_name', 'buying_intent', 'field_evidence', 'profile_url', 'qualification_reason', 'source_platform'].some((column) => insertError.message.toLowerCase().includes(column))) {
        return json({ error: 'Apply migrations 202611100004_opportunity_intelligence.sql, 202611100005_x_source_metadata.sql, and 202611110001_supervised_browser_agent.sql in the Aiventra Supabase project before searching.' }, 409)
      }
      return json({ error: 'X results were collected but could not be saved to this workspace. Check the opportunity table permissions.' }, 400)
    }
    return json({ searched: posts.length, added: inserted?.length || 0, skipped: posts.length - (inserted?.length || 0), message: `X search completed. AI qualified ${inserted?.length || 0} new opportunity(s).` })
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'X search could not be completed.' }, 502)
  }
})
