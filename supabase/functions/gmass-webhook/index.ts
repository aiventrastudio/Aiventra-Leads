import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const supportedEvents = new Set(['Sends', 'Opens', 'Clicks', 'Replies', 'Unsubscribes', 'Bounces'])
function normalizeEvent(value: string) {
  return [...supportedEvents].find((event) => event.toLowerCase() === value.trim().toLowerCase()) || ''
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function flatten(value: unknown, result: Record<string, unknown> = {}) {
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, result)
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (!(key in result)) result[key.toLowerCase()] = item
      if (item && typeof item === 'object') flatten(item, result)
    }
  }
  return result
}

function stringValue(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'email' in value) return stringValue((value as { email: unknown }).email)
  return ''
}

function extractEmail(fields: Record<string, unknown>) {
  for (const key of ['emailaddress', 'recipientemail', 'recipient_email', 'email_address', 'email']) {
    const found = stringValue(fields[key])
    if (found.includes('@')) return found.toLowerCase()
  }
  const to = fields.to
  if (Array.isArray(to)) {
    const found = to.map(stringValue).find((item) => item.includes('@'))
    if (found) return found.toLowerCase()
  }
  const found = stringValue(to)
  return found.includes('@') ? found.toLowerCase() : ''
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  let difference = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0)
  return difference === 0
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const expectedToken = Deno.env.get('GMASS_WEBHOOK_TOKEN')
  const providedToken = new URL(request.url).searchParams.get('token') || ''
  if (!expectedToken || !constantTimeEqual(expectedToken, providedToken)) return json({ error: 'Unauthorized webhook.' }, 401)

  const eventParameter = new URL(request.url).searchParams.get('event') || ''
  const eventFromUrl = normalizeEvent(eventParameter)
  if (eventParameter && !eventFromUrl) return json({ error: 'Unsupported event type. Use Sends, Opens, Clicks, Replies, Unsubscribes, or Bounces.' }, 400)

  let payload: unknown
  let rawBody: string
  try {
    rawBody = await request.text()
    if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      payload = Object.fromEntries(new URLSearchParams(rawBody).entries())
    } else {
      payload = JSON.parse(rawBody)
    }
  } catch {
    return json({ error: 'Webhook body must be valid JSON.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase function configuration is incomplete.' }, 500)
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const events = Array.isArray(payload) ? payload : [payload]
  const normalizedEvents = events.map((item) => {
    const fields = flatten(item)
    return { item, fields, eventType: eventFromUrl || normalizeEvent(stringValue(fields.eventtype) || stringValue(fields.platformsource) || stringValue(fields.type)) }
  })
  if (normalizedEvents.some(({ eventType }) => !eventType)) {
    return json({ error: 'Could not identify this GMass event. Add an event parameter to the webhook URL, for example event=Replies.' }, 400)
  }
  let recorded = 0

  for (const { item, fields, eventType } of normalizedEvents) {

    const campaignId = Number(fields.campaignid || fields.campaign_id || fields.gmasscampaignid)
    const normalizedCampaignId = Number.isSafeInteger(campaignId) ? campaignId : null
    const recipientEmail = extractEmail(fields)
    const stableEventId = stringValue(fields.eventid || fields.id || fields.messageid || fields.message_id)
    const eventKey = await sha256(stableEventId || `${eventType}\n${normalizedCampaignId || ''}\n${recipientEmail}\n${rawBody}`)
    const eventAtRaw = stringValue(fields.eventtime || fields.event_at || fields.timestamp || fields.date)
    const eventAt = eventAtRaw && Number.isNaN(Date.parse(eventAtRaw)) === false ? new Date(eventAtRaw).toISOString() : null

    let draft: { id: string; workspace_id: string; opportunity_id: string | null } | null = null
    if (normalizedCampaignId && recipientEmail) {
      const { data } = await supabase.from('outreach_drafts')
        .select('id, workspace_id, opportunity_id')
        .eq('gmass_campaign_id', normalizedCampaignId)
        .ilike('recipient_email', recipientEmail)
        .maybeSingle()
      draft = data
    } else if (normalizedCampaignId) {
      const { data } = await supabase.from('outreach_drafts')
        .select('id, workspace_id, opportunity_id')
        .eq('gmass_campaign_id', normalizedCampaignId)
        .maybeSingle()
      draft = data
    }

    const { data: savedEvents, error: insertError } = await supabase.from('gmass_events').upsert({
      event_key: eventKey,
      workspace_id: draft?.workspace_id || null,
      draft_id: draft?.id || null,
      campaign_id: normalizedCampaignId,
      recipient_email: recipientEmail,
      event_type: eventType,
      event_at: eventAt,
      payload: item,
    }, { onConflict: 'event_key', ignoreDuplicates: true }).select('event_key')
    if (insertError) return json({ error: 'Could not save the GMass event.' }, 500)
    // Event insertion is idempotent; repeat events still run idempotent status
    // updates so a prior partial database failure can recover on GMass retry.
    recorded += 1
    if (!draft) continue

    if (eventType === 'Sends') {
      const { error } = await supabase.from('outreach_drafts').update({ status: 'sent', sent_at: eventAt || new Date().toISOString(), gmass_campaign_status: 'sent' }).eq('id', draft.id)
      if (error) return json({ error: 'Could not record send status.' }, 500)
    } else if (eventType === 'Replies') {
      const { error: draftError } = await supabase.from('outreach_drafts').update({ gmass_campaign_status: 'replied' }).eq('id', draft.id)
      if (draftError) return json({ error: 'Could not record reply status.' }, 500)
      if (draft.opportunity_id) {
        const { error: opportunityError } = await supabase.from('opportunities').update({ status: 'Replied', replied: true }).eq('id', draft.opportunity_id)
        if (opportunityError) return json({ error: 'Could not update the replied opportunity.' }, 500)
        const body = stringValue(fields.body || fields.message || fields.reply || fields.text)
        const normalizedReplyBody = body.trim().toLowerCase().replace(/\s+/g, ' ') || '(no reply body provided)'
        const replyDay = (eventAt || new Date().toISOString()).slice(0, 10)
        // The configured GMass Replies webhook may omit the reply body and
        // provide a new event ID/timestamp on every retry. Key the stored reply
        // by draft, normalized content (or empty-body marker), and UTC day.
        const replyMessageId = `gmass-reply:${draft.id}:${await sha256(`${normalizedReplyBody}\n${replyDay}`)}`
        const { error: replyError } = await supabase.from('replies').upsert({
          workspace_id: draft.workspace_id,
          opportunity_id: draft.opportunity_id,
          draft_id: draft.id,
          channel: 'email',
          external_message_id: replyMessageId,
          body,
          received_at: eventAt || new Date().toISOString(),
        }, { onConflict: 'external_message_id', ignoreDuplicates: true })
        if (replyError) return json({ error: 'Could not save the reply.' }, 500)
      }
    } else if ((eventType === 'Unsubscribes' || eventType === 'Bounces') && recipientEmail) {
      const reason = eventType === 'Unsubscribes' ? 'unsubscribe' : 'bounce'
      const { error: suppressionError } = await supabase.from('email_suppressions').upsert({ workspace_id: draft.workspace_id, recipient_email: recipientEmail, reason }, { onConflict: 'workspace_id,recipient_email' })
      if (suppressionError) return json({ error: 'Could not save the email suppression.' }, 500)
      const { error: draftError } = await supabase.from('outreach_drafts').update({ gmass_campaign_status: reason }).eq('id', draft.id)
      if (draftError) return json({ error: 'Could not record bounce or unsubscribe status.' }, 500)
    } else {
      const { error } = await supabase.from('outreach_drafts').update({ gmass_campaign_status: eventType.toLowerCase() }).eq('id', draft.id)
      if (error) return json({ error: 'Could not record campaign event status.' }, 500)
    }
  }

  return json({ ok: true, received: events.length, recorded })
})
