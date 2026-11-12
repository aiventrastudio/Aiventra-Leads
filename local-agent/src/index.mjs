import { createServer } from 'node:http'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const root = path.dirname(fileURLToPath(import.meta.url))
const cloudMode = process.env.AIVENTRA_CLOUD_MODE === 'true'
const profileDir = path.resolve(process.env.AIVENTRA_PROFILE_DIR || path.resolve(root, '..', '.browser-profile'))
const port = Number(process.env.AIVENTRA_AGENT_PORT || 3210)
const pairCode = randomBytes(18).toString('base64url')
const viewerSecret = process.env.AIVENTRA_VIEWER_SECRET || randomBytes(32).toString('base64url')
let client = null
let workspaceId = null
let polling = false
let activeSessionId = null
let activeContext = null
let activeBrowser = null
let pollTimer = null
let lastQueueHeartbeatAt = 0

function json(response, status, body, origin = '*') {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  })
  response.end(JSON.stringify(body))
}
function sameSecret(value) {
  const left = Buffer.from(String(value || ''))
  const right = Buffer.from(pairCode)
  return left.length === right.length && timingSafeEqual(left, right)
}
async function bodyOf(request) {
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > 32_000) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {})
  const origin = request.headers.origin || '*'
  if (request.method === 'GET' && request.url === '/health') return json(response, 200, { ok: true, paired: Boolean(client && workspaceId), version: '0.1.2' }, origin)
  if (request.method === 'GET' && request.url?.startsWith('/viewer-token?')) {
    try {
      if (!client || !workspaceId || !activeSessionId || !activeContext) return json(response, 409, { error: 'There is no active browser session to view.' }, origin)
      const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
      if (!accessToken) return json(response, 401, { error: 'Sign in to Aiventra to view the browser.' }, origin)
      const { data: auth, error: authError } = await client.auth.getUser(accessToken)
      if (authError || !auth.user) return json(response, 401, { error: 'Your Aiventra session is invalid or expired.' }, origin)
      const sessionId = new URL(request.url, 'http://127.0.0.1').searchParams.get('session_id')
      if (sessionId !== activeSessionId) return json(response, 404, { error: 'This session does not have an active browser.' }, origin)
      const { data: member, error: memberError } = await client.from('workspace_members')
        .select('workspace_id').eq('workspace_id', workspaceId).eq('user_id', auth.user.id).limit(1).maybeSingle()
      if (memberError || !member) return json(response, 403, { error: 'You are not a member of this research workspace.' }, origin)
      const expiresAt = Date.now() + 5 * 60_000
      const payload = Buffer.from(JSON.stringify({ session_id: sessionId, workspace_id: workspaceId, expires_at: expiresAt })).toString('base64url')
      const signature = createHmac('sha256', viewerSecret).update(payload).digest('base64url')
      return json(response, 200, { token: `${payload}.${signature}`, expires_at: expiresAt }, origin)
    } catch (error) {
      return json(response, 500, { error: error instanceof Error ? error.message : 'Could not prepare the browser viewer.' }, origin)
    }
  }
  if (request.method === 'GET' && request.url?.startsWith('/authorize-view?')) {
    const token = new URL(request.url, 'http://127.0.0.1').searchParams.get('token') || ''
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return json(response, 401, { error: 'Viewer token is missing.' }, origin)
    const expected = createHmac('sha256', viewerSecret).update(payload).digest()
    let supplied
    try { supplied = Buffer.from(signature, 'base64url') } catch { supplied = Buffer.alloc(0) }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json(response, 401, { error: 'Viewer token is invalid.' }, origin)
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      if (claims.session_id !== activeSessionId || claims.workspace_id !== workspaceId || claims.expires_at < Date.now() || !activeContext) {
        return json(response, 401, { error: 'Viewer token expired or session stopped.' }, origin)
      }
      response.writeHead(204)
      return response.end()
    } catch { return json(response, 401, { error: 'Viewer token is invalid.' }, origin) }
  }
  if (request.method === 'POST' && request.url === '/pair') {
    try {
      const body = await bodyOf(request)
      if (!sameSecret(request.headers.authorization?.replace(/^Bearer\s+/i, ''))) return json(response, 401, { error: 'Pairing code is incorrect or expired.' }, origin)
      const { supabase_url, anon_key, access_token, refresh_token, workspace_id } = body
      if (![supabase_url, anon_key, access_token, refresh_token, workspace_id].every((value) => typeof value === 'string' && value)) {
        return json(response, 400, { error: 'A signed-in workspace session is required.' }, origin)
      }
      const nextClient = createClient(supabase_url, anon_key, { auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: false } })
      const { data, error } = await nextClient.auth.setSession({ access_token, refresh_token })
      if (error || !data.session) return json(response, 401, { error: 'Could not verify the Aiventra sign-in. Refresh the dashboard and pair again.' }, origin)
      const { data: member, error: memberError } = await nextClient.from('workspace_members')
        .select('workspace_id').eq('workspace_id', workspace_id).limit(1).maybeSingle()
      if (memberError || !member) return json(response, 403, { error: 'This signed-in user is not a member of the selected workspace.' }, origin)
      client = nextClient
      workspaceId = workspace_id
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = setInterval(() => void pollQueue(), 3000)
      pollTimer.unref?.()
      console.log(`Paired with Aiventra workspace ${workspaceId}. Session refresh token is memory-only.`)
      void pollQueue()
      return json(response, 200, { ok: true, paired: true }, origin)
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : 'Pairing failed.' }, origin)
    }
  }
  return json(response, 404, { error: 'Not found.' }, origin)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Aiventra local agent listening at http://127.0.0.1:${port}`)
  console.log(`One-time dashboard pairing code: ${pairCode}`)
  console.log('Keep this visible terminal open while research sessions run. The browser is headed and user-controlled.')
})

async function logEvent(sessionId, type, message, metadata = {}) {
  if (!client) return
  const { error } = await client.from('agent_events').insert({ session_id: sessionId, type, message: String(message).slice(0, 1000), metadata })
  if (error) console.error(`Could not save agent event: ${error.message}`)
}
async function updateSession(sessionId, values) {
  const { error } = await client.from('agent_sessions').update(values).eq('id', sessionId).eq('workspace_id', workspaceId)
  if (error) throw new Error(`Could not update research session: ${error.message}`)
}
async function getSession(sessionId) {
  const { data, error } = await client.from('agent_sessions')
    .select('id, workspace_id, platform, queries, max_posts, max_minutes, minimum_score, voice_instructions, status, control_mode, started_at, posts_seen, opportunities_added')
    .eq('id', sessionId).eq('workspace_id', workspaceId).maybeSingle()
  if (error) throw error
  return data
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForAgentControl(sessionId, page) {
  while (true) {
    if (activeSessionId === sessionId && activeContext) {
      let openPages = 0
      try { openPages = activeContext.pages().length } catch {}
      if (!openPages) {
        await updateSession(sessionId, { status: 'stopped', control_mode: 'user', ended_at: new Date().toISOString() }).catch(() => {})
        await logEvent(sessionId, 'status', 'The research browser was closed. This session stopped; you can start another one.')
        return 'stopped'
      }
    }
    const session = await getSession(sessionId)
    if (!session || session.status === 'stopped' || session.status === 'completed') return 'stopped'
    if (session.status === 'paused' || session.control_mode === 'user' || session.status === 'needs_user') {
      await sleep(1200)
      continue
    }
    if (session.status === 'running') return 'running'
    await sleep(1000)
  }
}

function platformHome(platform) {
  return ({ Reddit: 'https://www.reddit.com/', X: 'https://x.com/home', Facebook: 'https://www.facebook.com/', LinkedIn: 'https://www.linkedin.com/feed/', Instagram: 'https://www.instagram.com/', TikTok: 'https://www.tiktok.com/', YouTube: 'https://www.youtube.com/' })[platform]
}
function searchUrl(platform, query) {
  const encoded = encodeURIComponent(query)
  return ({
    Reddit: `https://www.reddit.com/search/?q=${encoded}&type=posts`,
    X: `https://x.com/search?q=${encoded}&src=typed_query&f=live`,
    Facebook: `https://www.facebook.com/search/posts/?q=${encoded}`,
    LinkedIn: `https://www.linkedin.com/search/results/content/?keywords=${encoded}`,
    Instagram: `https://www.instagram.com/explore/search/keyword/?q=${encoded}`,
    TikTok: `https://www.tiktok.com/search?q=${encoded}`,
    YouTube: `https://www.youtube.com/results?search_query=${encoded}`,
  })[platform]
}
async function pageText(page) {
  return (await page.locator('body').innerText({ timeout: 2500 }).catch(() => '')).slice(0, 9000)
}
function watchBrowserPage(page, platform) {
  page.on('pageerror', (error) => {
    const summary = error.message.split('\n')[0]
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/https?:\/\/\S+/gi, '[url]')
      .slice(0, 240)
    console.error(`[${platform} browser] Page script error: ${summary}`)
  })
  page.on('requestfailed', (request) => {
    let host = 'unknown host'
    try { host = new URL(request.url()).hostname } catch {}
    const failure = request.failure()?.errorText || 'request failed'
    console.error(`[${platform} browser] Network request failed (${request.resourceType()}, ${host}): ${failure.slice(0, 180)}`)
  })
}
async function hasSignedInMarker(platform, page) {
  const selectors = ({
    Reddit: ['button[aria-label*="user menu" i]', 'button[id*="USER_DROPDOWN"]', 'a[href*="/user/"]'],
    X: ['a[data-testid="AppTabBar_Profile_Link"]', 'a[aria-label="Profile"]'],
    Facebook: ['div[aria-label="Account"]', 'div[aria-label*="Your profile" i]', 'a[aria-label*="profile" i]'],
    LinkedIn: ['.global-nav__me', 'button.global-nav__primary-link-me-menu-trigger', 'a[href*="/in/"]'],
    Instagram: ['a[href*="/accounts/edit/"]', 'span[aria-label*="Profile" i]', 'img[alt*="profile picture" i]'],
    TikTok: ['a[data-e2e="top-menu-profile"]', '[data-e2e="user-avatar"]'],
    YouTube: ['ytd-topbar-menu-button-renderer #avatar-btn', 'button#avatar-btn'],
  })[platform] || []
  for (const selector of selectors) if (await page.locator(selector).first().isVisible().catch(() => false)) return true
  return false
}
async function challengeOnPage(page) {
  const text = `${page.url()}\n${await pageText(page)}`.toLowerCase()
  const signals = ['captcha', 'verify you are human', 'security verification', 'unusual activity', 'unusual sign-in', 'temporarily blocked', 'rate limit', 'too many requests', 'confirm your identity', 'identity verification', 'security challenge']
  return signals.find((signal) => text.includes(signal)) || null
}
function loginRequired(platform, text, url) {
  const lower = `${url}\n${text}`.toLowerCase()
  if (platform === 'LinkedIn') return lower.includes('/login') || lower.includes('name="session_key"') || lower.includes('sign in to see who you know')
  if (platform === 'X') return lower.includes('/login') || lower.includes('log in to x') || lower.includes('sign in to x')
  if (platform === 'Facebook') return lower.includes('/login') || lower.includes('log into facebook')
  if (platform === 'Instagram') return lower.includes('/accounts/login') || lower.includes('log in to instagram')
  if (platform === 'TikTok') return lower.includes('/login') || lower.includes('log in to tiktok')
  if (platform === 'YouTube') return lower.includes('/servicelogin') || lower.includes('/signin')
  return lower.includes('/login') || lower.includes('log in to reddit')
}
async function handleNeedsUser(sessionId, page, message) {
  while (true) {
    await updateSession(sessionId, { status: 'needs_user' })
    await logEvent(sessionId, 'paused', message)
    console.log(`[${sessionId}] Needs your attention: ${message}`)
    const state = await waitForAgentControl(sessionId, page)
    if (state === 'stopped') return false
    const challenge = await challengeOnPage(page)
    const platform = (await getSession(sessionId)).platform
    const current = await pageText(page)
    if (!challenge && !loginRequired(platform, current, page.url()) && await hasSignedInMarker(platform, page)) return true
    message = challenge
      ? `The platform still shows a challenge (${challenge}). Resolve it yourself before resuming.`
      : `Sign-in is not confirmed on ${platform}. Complete it in the visible browser before resuming.`
  }
}

async function extractCards(page, platform, limit) {
  if (platform === 'Reddit') {
    const posts = await page.locator('shreddit-post, article[data-testid="post-container"]').evaluateAll((cards, max) => cards.slice(0, max).map((card, index) => {
      const title = card.getAttribute('post-title') || card.getAttribute('title') || ''
      const visibleText = card.innerText || card.textContent || ''
      const text = [title, visibleText].filter((part, partIndex, all) => part.trim() && all.indexOf(part) === partIndex).join('\n').trim()
      const postLink = card.querySelector('a[slot="full-post-link"], a[href*="/comments/"], a[data-testid="post-title"]')
      const permalink = card.getAttribute('permalink') || card.getAttribute('content-href') || ''
      let sourceUrl = postLink?.href || ''
      if (!sourceUrl && permalink) { try { sourceUrl = new URL(permalink, location.origin).href } catch {} }
      const authorLink = card.querySelector('a[href*="/user/"], a[href*="/u/"]')
      const author = authorLink?.innerText?.trim() || card.getAttribute('author') || ''
      let profileUrl = authorLink?.href || ''
      if (!profileUrl && author && !/^\[deleted\]$/i.test(author)) {
        const username = author.replace(/^u\//i, '').replace(/^\//, '')
        profileUrl = `https://www.reddit.com/user/${encodeURIComponent(username)}/`
      }
      const time = card.querySelector('time')
      const timestamp = time?.dateTime || card.getAttribute('created-timestamp') || null
      const score = card.getAttribute('score')
      return { id: card.getAttribute('id') || card.getAttribute('post-id') || sourceUrl || `reddit-${index}`, text: text.slice(0, 5000), source_url: sourceUrl, profile_url: profileUrl, author, published_at: timestamp, visible_metrics: score ? { score } : {} }
    }).filter((post) => post.text && post.source_url), limit)
    if (posts.length) return posts
    // Fallback for Reddit layouts where result links exist outside recognized card elements.
    return page.locator('a[href*="/comments/"]').evaluateAll((links, max) => links.map((link, index) => {
      const url = new URL(link.href)
      if (!/\/r\/[^/]+\/comments\//i.test(url.pathname)) return null
      const card = link.closest('shreddit-post, article, search-telemetry-tracker, [data-testid="post-container"]')
      const title = link.innerText?.trim() || link.getAttribute('aria-label') || ''
      const text = (card?.innerText || card?.textContent || title).trim()
      const authorLink = card?.querySelector('a[href*="/user/"], a[href*="/u/"]')
      const author = authorLink?.innerText?.trim() || card?.getAttribute('author') || ''
      const time = card?.querySelector('time')
      return { id: url.pathname, text: text.slice(0, 5000), source_url: url.href, profile_url: authorLink?.href || '', author, published_at: time?.dateTime || card?.getAttribute('created-timestamp') || null, visible_metrics: {} }
    }).filter((post) => post?.text && post.source_url).slice(0, max), limit)
  }
  if (platform === 'X') {
    return page.locator('article[data-testid="tweet"]').evaluateAll((cards, max) => cards.slice(0, max).map((card, index) => {
      const text = card.querySelector('[data-testid="tweetText"]')?.innerText || ''
      const statusLink = [...card.querySelectorAll('a[href*="/status/"]')].find((a) => a.querySelector('time'))
      const profile = [...card.querySelectorAll('a[href^="/"]')].find((a) => /^\/[A-Za-z0-9_]+\/?$/.test(new URL(a.href).pathname))
      const time = card.querySelector('time')
      return { id: statusLink?.href || `x-${index}`, text, source_url: statusLink?.href || '', profile_url: profile?.href || '', author: profile?.innerText || '', published_at: time?.dateTime || null, visible_metrics: {} }
    }).filter((post) => post.text && post.source_url), limit)
  }
  if (platform === 'Facebook') {
    return page.locator('div[role="article"]').evaluateAll((cards, max) => cards.slice(0, max).map((card, index) => {
      const text = card.innerText || ''
      const links = [...card.querySelectorAll('a[href]')]
      const postLink = links.find((a) => /posts\/|permalink\/|story_fbid=|\/groups\//i.test(a.href))
      const profile = links.find((a) => /facebook\.com\/(?:profile\.php|[A-Za-z0-9.]+\/?$)/i.test(a.href) && !/groups|posts|permalink/i.test(a.href))
      const time = card.querySelector('abbr[title], time')
      return { id: postLink?.href || `facebook-${index}`, text: text.slice(0, 5000), source_url: postLink?.href || '', profile_url: profile?.href || '', author: profile?.innerText || '', published_at: time?.getAttribute('title') || time?.getAttribute('datetime') || null, visible_metrics: {} }
    }).filter((post) => post.text && post.source_url), limit)
  }
  if (platform === 'Instagram') {
    return page.locator('main a[href*="/p/"], main a[href*="/reel/"], main a[href*="/tv/"]').evaluateAll((links, max) => {
      const seen = new Set()
      return links.flatMap((link, index) => {
        const url = new URL(link.href)
        url.search = ''
        const sourceUrl = url.href.replace(/\/$/, '') + '/'
        if (seen.has(sourceUrl)) return []
        seen.add(sourceUrl)
        const card = link.closest('article') || link.parentElement?.parentElement || link
        const text = card.innerText || link.getAttribute('aria-label') || link.querySelector('img')?.alt || ''
        const authorLink = card.querySelector('a[href^="/"]:not([href*="/p/"]):not([href*="/reel/"])')
        const author = authorLink?.innerText?.trim() || ''
        return text.trim() ? [{ id: sourceUrl || `instagram-${index}`, text: text.trim().slice(0, 5000), source_url: sourceUrl, profile_url: authorLink ? new URL(authorLink.href).href : '', author, published_at: null, visible_metrics: {} }] : []
      }).slice(0, max)
    }, limit)
  }
  if (platform === 'TikTok') {
    return page.locator('a[href*="/video/"]').evaluateAll((links, max) => {
      const seen = new Set()
      return links.flatMap((link, index) => {
        const url = new URL(link.href)
        url.search = ''
        const sourceUrl = url.href
        if (seen.has(sourceUrl)) return []
        seen.add(sourceUrl)
        const card = link.closest('[data-e2e*="search"]') || link.parentElement?.parentElement?.parentElement || link
        const text = card.innerText || link.getAttribute('aria-label') || ''
        const profileLink = card.querySelector('a[href*="/@"]')
        const author = profileLink?.innerText?.trim() || ''
        return text.trim() ? [{ id: sourceUrl || `tiktok-${index}`, text: text.trim().slice(0, 5000), source_url: sourceUrl, profile_url: profileLink ? new URL(profileLink.href).href : '', author, published_at: null, visible_metrics: {} }] : []
      }).slice(0, max)
    }, limit)
  }
  if (platform === 'YouTube') {
    return page.locator('ytd-video-renderer, ytd-rich-item-renderer').evaluateAll((cards, max) => {
      const seen = new Set()
      return cards.flatMap((card, index) => {
      const titleLink = card.querySelector('a#video-title, a#video-title-link')
      if (!titleLink?.href) return []
      const sourceUrl = new URL(titleLink.href)
      sourceUrl.search = ''
      if (seen.has(sourceUrl.href)) return []
      seen.add(sourceUrl.href)
      const channelLink = card.querySelector('ytd-channel-name a, #channel-name a')
      const time = card.querySelector('ytd-thumbnail-overlay-time-status-renderer')
      const title = titleLink.innerText?.trim() || titleLink.getAttribute('title') || ''
      const text = `${title}\n${card.innerText || ''}`.trim()
      return text ? [{ id: sourceUrl.href || `youtube-${index}`, text: text.slice(0, 5000), source_url: sourceUrl.href, profile_url: channelLink?.href || '', author: channelLink?.innerText?.trim() || '', published_at: null, visible_metrics: time?.textContent?.trim() ? { duration: time.textContent.trim() } : {} }] : []
      }).slice(0, max)
    }, limit)
  }
  return page.locator('div.feed-shared-update-v2, div[data-urn*="activity"], div[data-view-name="feed-full-update"]').evaluateAll((cards, max) => cards.slice(0, max).map((card, index) => {
    const description = card.querySelector('.feed-shared-update-v2__description, [data-test-id="main-feed-activity-card"]')
    const text = description?.innerText || card.innerText || ''
    const links = [...card.querySelectorAll('a[href]')]
    const postLink = links.find((a) => /\/feed\/update\/urn:li:activity:|\/posts\/|activity:/i.test(a.href))
    const profile = links.find((a) => /linkedin\.com\/in\//i.test(a.href))
    const time = card.querySelector('time')
    return { id: postLink?.href || `linkedin-${index}`, text: text.slice(0, 5000), source_url: postLink?.href || '', profile_url: profile?.href || '', author: profile?.innerText || '', published_at: time?.dateTime || time?.getAttribute('title') || null, visible_metrics: {} }
  }).filter((post) => post.text && post.source_url), limit)
}

async function inspectProfile(context, platform, post, sessionId, deadline) {
  if (!post.profile_url || Date.now() >= deadline) return ''
  await logEvent(sessionId, 'open_post', `Checking the public author profile for ${post.author || 'the post author'}.`)
  const profilePage = await context.newPage()
  try {
    await profilePage.goto(post.profile_url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await sleep(900)
    const challenge = await challengeOnPage(profilePage)
    while (challenge) {
      await updateSession(sessionId, { status: 'needs_user' })
      await logEvent(sessionId, 'paused', `Stopped on a public profile challenge (${challenge}); resolve it yourself, then resume.`)
      if (await waitForAgentControl(sessionId, profilePage) === 'stopped') return '__STOP__'
      challenge = await challengeOnPage(profilePage)
    }
    const text = await pageText(profilePage)
    if (loginRequired(platform, text, profilePage.url())) return '__LOGIN_REQUIRED__'
    return text.slice(0, 1800)
  } catch (error) {
    return `__PROFILE_ERROR__:${error instanceof Error ? error.message : 'could not open profile'}`
  } finally {
    await profilePage.close().catch(() => {})
  }
}

async function readPostAuthorProfile(page, platform) {
  const selectors = {
    Instagram: 'main article header a[href^="/"], main a[href^="/"][href$="/"]',
    TikTok: 'a[href*="/@"]',
    YouTube: 'ytd-watch-metadata ytd-channel-name a, #owner #channel-name a',
  }
  const selector = selectors[platform]
  if (!selector) return null
  const link = page.locator(selector).first()
  if (!await link.isVisible().catch(() => false)) return null
  const href = await link.getAttribute('href').catch(() => null)
  if (!href) return null
  return {
    profile_url: new URL(href, page.url()).href,
    author: (await link.innerText().catch(() => '')).trim(),
  }
}

async function saveAnalyzedBatch(session, rawPosts, counters) {
  if (!rawPosts.length) return
  if (await waitForAgentControl(session.id, null) === 'stopped') return
  const { data, error } = await client.functions.invoke('analyze-posts', { body: { session_id: session.id, posts: rawPosts } })
  if (error) {
    let message = error.message
    const response = error.context
    if (response instanceof Response) {
      const payload = await response.clone().json().catch(() => null)
      if (payload?.error) message = payload.error
    }
    throw new Error(message)
  }
  const qualified = data?.qualified || []
  for (const lead of qualified) {
    const { data: exists, error: existsError } = await client.from('opportunities').select('id')
      .eq('workspace_id', workspaceId).eq('source_url', lead.source_url).limit(1)
    if (existsError) throw existsError
    if (exists?.length) continue
    const { data: opportunity, error: insertError } = await client.from('opportunities').insert({
      workspace_id: workspaceId, created_by: (await client.auth.getUser()).data.user?.id,
      title: lead.title, source: session.platform, source_platform: session.platform,
      source_url: lead.source_url, profile_url: lead.profile_url || '',
      contact: lead.author || '', email: lead.email || '', phone: lead.phone || '',
      business_name: lead.business_name || '', detail: lead.text.slice(0, 5000),
      pain_point: lead.pain_point || '', service_needed: lead.service_needed || '',
      budget: lead.budget || '', buying_intent: lead.buying_intent || 'unknown',
      qualification_reason: lead.qualification_reason || '',
      published_at: lead.published_at || null, discovered_at: new Date().toISOString(),
      field_evidence: { ...lead.field_evidence, author: 'stated', profile_url: lead.profile_url ? 'stated' : 'unknown', qualification_reason: 'inferred' },
      match_score: lead.match_score, agent_session_id: session.id, status: 'New', replied: false,
    }).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') continue
      throw insertError
    }
    if (lead.suggested_reply?.trim()) {
      const { error: draftError } = await client.from('outreach_drafts').insert({
        workspace_id: workspaceId, opportunity_id: opportunity.id, channel: 'social',
        recipient_name: lead.author || '', recipient_handle: lead.author || '',
        subject: '', body: lead.suggested_reply, status: 'pending_review',
        requires_approval: true, created_by: (await client.auth.getUser()).data.user?.id,
      })
      if (draftError) console.error(`Opportunity saved but its social draft failed: ${draftError.message}`)
    }
    counters.added += 1
    await logEvent(session.id, 'extracted', `Qualified opportunity saved: ${lead.title}`, { score: lead.match_score, source_url: lead.source_url, profile_url: lead.profile_url })
  }
  const { error: countError } = await client.from('agent_sessions').update({ posts_seen: counters.seen, opportunities_added: counters.added }).eq('id', session.id)
  if (countError) throw countError
}

async function runSession(initialSession) {
  const session = await getSession(initialSession.id)
  if (!session) return
  const maxPosts = Number(session.max_posts) > 0 ? Number(session.max_posts) : Infinity
  const maxMinutes = Number(session.max_minutes) > 0 ? Number(session.max_minutes) : Infinity
  const deadline = Number.isFinite(maxMinutes) ? Date.now() + maxMinutes * 60_000 : Infinity
  const counters = { seen: 0, added: 0 }
  let context = null
  try {
    if (cloudMode) {
      const browser = await chromium.launch({ headless: false, chromiumSandbox: true, args: ['--start-maximized'] })
      activeBrowser = browser
      context = await browser.newContext({ viewport: null })
    } else {
      await mkdir(profileDir, { recursive: true })
      context = await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless: false, chromiumSandbox: true, viewport: null, args: ['--start-maximized'] })
    }
    activeContext = context
    let page = context.pages()[0] || await context.newPage()
    watchBrowserPage(page, session.platform)
    await page.goto(platformHome(session.platform), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await updateSession(session.id, { status: 'running', started_at: new Date().toISOString() })
    await logEvent(session.id, 'status', `Visible ${session.platform} browser opened. Confirming sign-in.`)

    let challenge = await challengeOnPage(page)
    if (challenge) {
      if (!await handleNeedsUser(session.id, page, `Platform security or rate-limit challenge detected (${challenge}). Resolve it yourself, then resume.`)) return
    }
    let text = await pageText(page)
    if (loginRequired(session.platform, text, page.url()) || !await hasSignedInMarker(session.platform, page)) {
      if (!await handleNeedsUser(session.id, page, `Sign in to ${session.platform} in the visible browser, then resume the session.`)) return
    }
    await updateSession(session.id, { sign_in_confirmed: true })

    const queries = Array.isArray(session.queries) ? session.queries.filter((query) => typeof query === 'string' && query.trim()) : []
    if (!queries.length) throw new Error('This session has no search queries.')
    const batch = []
    const seenUrls = new Set()
    for (const query of queries) {
      if (await waitForAgentControl(session.id, page) === 'stopped') return
      if (Date.now() >= deadline || counters.seen >= maxPosts) break
      await logEvent(session.id, 'search', `Searching ${session.platform} for “${query.slice(0, 120)}”.`)
      await page.goto(searchUrl(session.platform, query), { waitUntil: 'domcontentloaded', timeout: 30000 })
      await sleep(1300)
      if (session.platform === 'Reddit') {
        const resultCards = page.locator('shreddit-post, article[data-testid="post-container"]')
        await resultCards.first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {})
        const resultCount = await resultCards.count().catch(() => 0)
        const postLinkCount = await page.locator('a[href*="/comments/"]').count().catch(() => 0)
        await logEvent(session.id, 'status', resultCount || postLinkCount
          ? `Reddit search results loaded; ${resultCount} post card(s) and ${postLinkCount} post link(s) are visible.`
          : 'Reddit search page loaded, but no post cards or post links appeared. Check the visible browser for empty results, a prompt, or a page-load problem.', { query: query.slice(0, 120), result_cards: resultCount, post_links: postLinkCount, page_title: (await page.title().catch(() => '')).slice(0, 160) })
      }
      challenge = await challengeOnPage(page)
      if (challenge) {
        if (!await handleNeedsUser(session.id, page, `Stopped at a platform challenge or limit (${challenge}). No workaround was attempted.`)) return
      }
      text = await pageText(page)
      if (loginRequired(session.platform, text, page.url())) {
        if (!await handleNeedsUser(session.id, page, `The ${session.platform} search needs sign-in. Sign in yourself and resume.`)) return
      }
      let emptyScrolls = 0
      let resultStatusLogged = false
      while (counters.seen < maxPosts && Date.now() < deadline && emptyScrolls < 5) {
        if (await waitForAgentControl(session.id, page) === 'stopped') return
        const extracted = await extractCards(page, session.platform, Math.min(15, maxPosts - counters.seen))
        if (!resultStatusLogged) {
          await logEvent(session.id, 'status', `${session.platform} search results show ${extracted.length} readable post card(s).`, { query: query.slice(0, 120), readable_posts: extracted.length })
          resultStatusLogged = true
        }
        let addedThisPass = 0
        for (const post of extracted) {
          if (seenUrls.has(post.source_url)) continue
          seenUrls.add(post.source_url)
          if (await waitForAgentControl(session.id, page) === 'stopped') return
          await logEvent(session.id, 'open_post', `Opening visible post: ${post.author || 'author not shown'}.`, { source_url: post.source_url })
          try {
            const postPage = await context.newPage()
            await postPage.goto(post.source_url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
            if (await waitForAgentControl(session.id, page) === 'stopped') { await postPage.close().catch(() => {}); return }
            challenge = await challengeOnPage(postPage)
            if (challenge) {
              await postPage.close().catch(() => {})
              if (!await handleNeedsUser(session.id, page, `Stopped at a platform challenge or limit (${challenge}). No workaround was attempted.`)) return
            }
            const fullText = await pageText(postPage)
            if (fullText.length > post.text.length) post.text = fullText.slice(0, 5000)
            if (!post.profile_url) {
              const authorProfile = await readPostAuthorProfile(postPage, session.platform).catch(() => null)
              if (authorProfile) {
                post.profile_url = authorProfile.profile_url
                if (!post.author) post.author = authorProfile.author
              }
            }
            await postPage.close().catch(() => {})
          } catch {}
          if (await waitForAgentControl(session.id, page) === 'stopped') return
          const profileText = await inspectProfile(context, session.platform, post, session.id, deadline)
          if (profileText.startsWith('__CHALLENGE__:')) {
            if (!await handleNeedsUser(session.id, page, `Stopped while viewing a public profile because a challenge appeared (${profileText.split(':')[1]}).`)) return
          }
          if (profileText === '__CHALLENGE__' || profileText === '__STOP__') return
          if (profileText === '__LOGIN_REQUIRED__') {
            if (!await handleNeedsUser(session.id, page, `The public profile requires sign-in. Sign in yourself, then resume.`)) return
          }
          post.profile_text = profileText.startsWith('__') ? '' : profileText
          batch.push(post)
          counters.seen += 1
          addedThisPass += 1
          await updateSession(session.id, { posts_seen: counters.seen })
          await logEvent(session.id, 'extracted', `Read post by ${post.author || 'unknown author'}.`, { source_url: post.source_url, profile_url: post.profile_url, published_at: post.published_at, visible_metrics: post.visible_metrics })
          if (batch.length >= 10) {
            if (await waitForAgentControl(session.id, page) === 'stopped') return
            await saveAnalyzedBatch(session, batch.splice(0, 10), counters)
          }
          if (counters.seen >= maxPosts || Date.now() >= deadline) break
        }
        if (!addedThisPass) emptyScrolls += 1
        else emptyScrolls = 0
        if (counters.seen < maxPosts && Date.now() < deadline && emptyScrolls < 5) {
          await logEvent(session.id, 'scroll', `Scrolled ${session.platform} results.`)
          await page.mouse.wheel(0, 650)
          await sleep(900)
        }
      }
    }
    if (batch.length) await saveAnalyzedBatch(session, batch, counters)
    const latest = await getSession(session.id)
    if (latest?.status !== 'stopped') {
      await updateSession(session.id, { status: 'completed', ended_at: new Date().toISOString(), posts_seen: counters.seen, opportunities_added: counters.added })
      await logEvent(session.id, 'status', `Research complete. Reviewed ${counters.seen} post(s) and saved ${counters.added} opportunity(s).`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Research session failed.'
    console.error(`[${session.id}] ${message}`)
    await logEvent(session.id, 'error', message)
    await updateSession(session.id, { status: 'stopped', ended_at: new Date().toISOString() }).catch(() => {})
  } finally {
    if (context) await context.close().catch(() => {})
    if (activeBrowser) await activeBrowser.close().catch(() => {})
    activeBrowser = null
    activeContext = null
    activeSessionId = null
  }
}

async function pollQueue() {
  if (!client || !workspaceId || polling || activeSessionId) return
  polling = true
  try {
    const { data, error } = await client.from('agent_sessions').select('*')
      .eq('workspace_id', workspaceId).eq('status', 'queued').order('created_at', { ascending: true }).limit(1)
    if (error) throw error
    if (data?.[0]) {
      console.log(`Queue poll found queued session ${data[0].id} for workspace ${workspaceId}.`)
      const { data: claimed, error: claimError } = await client.from('agent_sessions').update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', data[0].id).eq('workspace_id', workspaceId).eq('status', 'queued').select('*').maybeSingle()
      if (claimError) throw claimError
      if (claimed) {
        console.log(`Claimed research session ${claimed.id}; starting browser.`)
        activeSessionId = claimed.id
        await runSession(claimed)
      } else console.warn(`Queued session ${data[0].id} was visible but could not be claimed. It may have changed status during polling.`)
    } else if (Date.now() - lastQueueHeartbeatAt >= 30_000) {
      lastQueueHeartbeatAt = Date.now()
      console.log(`Queue poll found no queued sessions for workspace ${workspaceId}.`)
    }
  } catch (error) {
    console.error(`Queue polling failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  } finally {
    polling = false
  }
}

async function shutdown() {
  if (pollTimer) clearInterval(pollTimer)
  if (activeSessionId && client) {
    await client.from('agent_sessions').update({ status: 'stopped', control_mode: 'user', ended_at: new Date().toISOString() }).eq('id', activeSessionId).eq('workspace_id', workspaceId)
    await logEvent(activeSessionId, 'status', 'Local companion is shutting down; the browser session stopped.')
  }
  if (activeContext) await activeContext.close().catch(() => {})
  if (activeBrowser) await activeBrowser.close().catch(() => {})
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500).unref()
}
process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
