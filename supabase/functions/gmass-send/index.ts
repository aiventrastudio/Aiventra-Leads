import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Draft = {
  id: string
  workspace_id: string
  opportunity_id: string | null
  recipient_email: string
  recipient_name: string
  subject: string
  body: string
  status: string
}

function personalize(text: string, values: { name: string; project: string; pain_point: string; service: string; business: string; sender: string }) {
  const supported: Record<string, string> = {
    name: values.name || 'there',
    project: values.project || 'your project',
    pain_point: values.pain_point || values.project || 'your project',
    service: values.service || 'projects like this',
    business: values.business || 'your business',
    sender: values.sender || 'Aiventra Studios',
    next_step: 'review the brief and suggest a practical first step',
  }
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawTag: string) => {
    const tag = rawTag.trim().toLowerCase()
    // Treat unknown {{text}} as literal text so GMass cannot silently blank it
    // as an unresolved mail-merge field.
    return supported[tag] ?? rawTag.trim()
  })
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

  const authorization = request.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Sign in before sending.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const gmassApiKey = Deno.env.get('GMASS_API_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'Supabase function configuration is incomplete.' }, 500)
  if (!gmassApiKey) return json({ error: 'GMASS_API_KEY is not configured in Supabase Edge Function secrets.' }, 503)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401)

  let draftId: string
  try {
    const body = await request.json()
    if (typeof body?.draft_id !== 'string') return json({ error: 'draft_id is required.' }, 400)
    draftId = body.draft_id
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400)
  }

  const { data: foundDraft, error: readError } = await supabase
    .from('outreach_drafts')
    .select('id, workspace_id, opportunity_id, recipient_email, recipient_name, subject, body, status')
    .eq('id', draftId)
    .maybeSingle()

  if (readError || !foundDraft) return json({ error: 'Draft not found or you do not have access to it.' }, 404)
  const draft = foundDraft as Draft
  if (draft.status !== 'approved') return json({ error: 'Approve this draft before sending.' }, 409)
  if (!draft.recipient_email || !draft.subject.trim() || !draft.body.trim()) {
    return json({ error: 'The draft needs a recipient, subject, and message before sending.' }, 422)
  }

  const { data: suppression, error: suppressionError } = await supabase.from('email_suppressions')
    .select('reason')
    .eq('workspace_id', foundDraft.workspace_id)
    .ilike('recipient_email', draft.recipient_email.trim())
    .maybeSingle()
  if (suppressionError) return json({ error: 'Could not verify the workspace suppression list. Apply the GMass events migration before sending.' }, 503)
  if (suppression) return json({ error: `This address is suppressed (${suppression.reason}) and cannot be sent to.` }, 409)

  const { data: claimedRows, error: claimError } = await supabase.rpc('claim_gmass_email_draft', { p_draft_id: draftId })
  const claimed = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows
  if (claimError || !claimed) return json({ error: 'This draft is already being sent or is no longer approved.' }, 409)

  const gmassHeaders = { 'X-apikey': gmassApiKey, 'Content-Type': 'application/json' }
  let gmassDraftId: string | null = null
  try {
    let projectTitle = ''
    let opportunityContext: { pain_point?: string; service_needed?: string; business_name?: string; detail?: string } | null = null
    if (draft.opportunity_id) {
      const { data: opportunity, error: opportunityError } = await supabase.from('opportunities')
        .select('title, pain_point, service_needed, business_name, detail')
        .eq('id', draft.opportunity_id)
        .maybeSingle()
      if (opportunityError) throw new Error(`Could not load the opportunity for this draft: ${opportunityError.message}`)
      projectTitle = opportunity?.title || ''
      opportunityContext = opportunity
    }
    const mergeValues = {
      name: draft.recipient_name,
      project: projectTitle,
      pain_point: opportunityContext?.pain_point || opportunityContext?.detail || projectTitle,
      service: opportunityContext?.service_needed || projectTitle,
      business: opportunityContext?.business_name || '',
      sender: 'Aiventra Studios',
    }
    const message = personalize(draft.body, mergeValues)
    const subject = personalize(draft.subject, mergeValues)

    const { data: sequenceSettings, error: settingsError } = await supabase
      .from('sequence_settings')
      .select('enabled, follow_up_days')
      .eq('workspace_id', claimed.workspace_id)
      .maybeSingle()
    if (settingsError) throw new Error(`Could not load sequence settings: ${settingsError.message}`)

    const { data: sequenceSteps, error: stepsError } = await supabase
      .from('sequence_steps')
      .select('step_number, delay_days, body')
      .eq('workspace_id', claimed.workspace_id)
      .order('step_number', { ascending: true })
      .limit(8)
    if (stepsError) throw new Error(`Could not load follow-up steps: ${stepsError.message}`)

    const campaignSettings: Record<string, unknown> = {
      createDrafts: false,
      friendlyName: `Aiventra ${draftId}`,
      fromName: 'Aiventra Studios',
    }
    if (sequenceSettings?.enabled) {
      for (const step of sequenceSteps || []) {
        const number = Number(step.step_number)
        if (!Number.isInteger(number) || number < 1 || number > 8 || !step.body?.trim()) continue
        campaignSettings[`stage${['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][number - 1]}Days`] = Number(step.delay_days)
        campaignSettings[`stage${['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][number - 1]}Action`] = 'r'
        campaignSettings[`stage${['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][number - 1]}CampaignText`] = personalize(step.body, mergeValues)
      }
    }

    const createResponse = await fetch('https://api.gmass.co/api/campaigndrafts', {
      method: 'POST',
      headers: gmassHeaders,
      body: JSON.stringify({
        subject,
        message,
        messageType: 'plain',
        emailAddresses: draft.recipient_email,
      }),
    })
    const createPayload = await createResponse.json().catch(() => ({}))
    if (!createResponse.ok) {
      const detail = typeof createPayload?.message === 'string' ? createPayload.message : `GMass draft creation failed (${createResponse.status}).`
      throw new Error(detail)
    }
    gmassDraftId = String(createPayload?.campaignDraftId || '') || null
    if (!gmassDraftId) throw new Error('GMass created no campaign draft ID; the draft was not sent.')

    const { error: saveGmassDraftError } = await supabase.from('outreach_drafts')
      .update({ gmass_draft_id: gmassDraftId })
      .eq('id', draftId)
      .eq('status', 'queued')
    if (saveGmassDraftError) throw new Error('GMass created a Gmail draft, but Aiventra could not record its ID. It was not submitted to send; check Gmail Drafts before retrying.')

    const sendResponse = await fetch(`https://api.gmass.co/api/campaigns/${encodeURIComponent(gmassDraftId)}`, {
      method: 'POST',
      headers: gmassHeaders,
      body: JSON.stringify({ campaignSettings }),
    })
    const sendPayload = await sendResponse.json().catch(() => ({}))
    if (!sendResponse.ok) {
      const detail = typeof sendPayload?.message === 'string' ? sendPayload.message : `GMass campaign request failed (${sendResponse.status}).`
      throw new Error(detail)
    }

    const campaignId = Number(sendPayload?.campaignId)
    const campaignStatus = typeof sendPayload?.status === 'string' ? sendPayload.status : 'processing'
    if (campaignStatus === 'error') throw new Error('GMass reported that the campaign could not be started. Check GMass campaign history before retrying.')
    const submittedStatus = campaignStatus === 'sent' ? 'sent' : 'queued'
    const { error: updateError } = await supabase.from('outreach_drafts').update({
      status: submittedStatus,
      sent_at: submittedStatus === 'sent' ? new Date().toISOString() : null,
      gmass_campaign_id: Number.isFinite(campaignId) ? campaignId : null,
      gmass_campaign_status: campaignStatus,
      error_detail: null,
    }).eq('id', draftId).eq('status', 'queued')
    if (updateError) return json({ error: 'GMass accepted the campaign, but Aiventra could not save its status. Do not retry this draft; check GMass campaign history.', campaign_id: Number.isFinite(campaignId) ? campaignId : null }, 502)

    return json({ ok: true, draft_id: draftId, campaign_id: Number.isFinite(campaignId) ? campaignId : null, campaign_status: campaignStatus })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'GMass request failed.'
    await supabase.from('outreach_drafts').update({
      status: 'failed',
      gmass_draft_id: gmassDraftId,
      error_detail: detail.slice(0, 1000),
    }).eq('id', draftId).eq('status', 'queued')
    return json({ error: detail, gmass_draft_id: gmassDraftId }, 502)
  }
})
