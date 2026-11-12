import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, ChevronDown, Lock, LogOut, Mail, Palette, ShieldCheck, X } from 'lucide-react'
import LandingPage from './LandingPage'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useAiventraWorkspace } from './lib/useAiventraWorkspace'
import { AiventraLogo } from './newfolder-ui/components/AiventraLogo'
import { useThemeStyle } from './newfolder-ui/context/ThemeStyleContext'
import { GmassDraftQueue } from './components/GmassDraftQueue'
import { SocialDraftQueue } from './components/SocialDraftQueue'
import { AgentConnectionCards, ResearchSessions } from './components/ResearchSessions'
import './auth.css'

type View = 'Overview' | 'Research Sessions' | 'Opportunities' | 'Outreach' | 'Social outreach' | 'Email' | 'Replies' | 'Sequences' | 'Activity' | 'Connections'
type BuyingIntent = 'high' | 'medium' | 'low' | 'unknown'
type FieldEvidence = Record<string, 'stated' | 'inferred' | 'unknown'>
type Opportunity = { id: string; title: string; source: string; source_platform?: string; source_url: string; profile_url?: string; qualification_reason?: string; contact: string; business_name: string; email: string; phone: string; detail: string; pain_point: string; service_needed: string; budget: string; buying_intent: BuyingIntent; published_at: string | null; discovered_at: string; field_evidence: FieldEvidence; status: 'New' | 'Review' | 'Draft ready' | 'Contacted' | 'Replied'; created: string; createdAt?: string; replied?: boolean }
type LogItem = { id: string; title: string; detail: string; at: string; kind: 'setup' | 'capture' | 'message' | 'system' }
type ReplyItem = { id: string; opportunity_id: string | null; draft_id: string | null; body: string; received_at: string; reviewed_at: string | null }
type GmassConnectionState = 'checking' | 'connected' | 'needs_setup' | 'error'

const nav: { view: View; icon: string }[] = [
  { view: 'Overview', icon: 'dashboard' }, { view: 'Research Sessions', icon: 'activity' }, { view: 'Opportunities', icon: 'briefcase' },
  { view: 'Social outreach', icon: 'send' }, { view: 'Email', icon: 'mail' }, { view: 'Replies', icon: 'activity' }, { view: 'Sequences', icon: 'clock' }, { view: 'Activity', icon: 'activity' }, { view: 'Connections', icon: 'plug' },
]
const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'Reddit', 'TikTok', 'YouTube', 'Upwork', 'Other source']
const templates = {
  first: 'Hi {{name}}, I saw your post about {{pain_point}}. We help with {{service}} and can share a relevant example. Is this still something you need help with?\n\nBest,\n{{sender}}',
  day1: 'Hi {{name}}, just checking whether you are still looking for help with {{project}}. Happy to share a few ideas if useful.\n\n{{sender}}',
  day3: 'Hi {{name}}, I wanted to follow up with one thought about {{project}}: we could start by {{next_step}}. Would that be helpful?\n\n{{sender}}',
  day7: 'Hi {{name}}, one last note in case {{project}} is still on your list. If priorities have changed, no problem.\n\n{{sender}}',
}

function parseBudgetAmount(value: string) {
  const match = value.toLowerCase().replace(/,/g, '').match(/\d+(?:\.\d+)?\s*k?/)
  if (!match) return null
  const amount = Number.parseFloat(match[0])
  return Number.isFinite(amount) ? amount * (match[0].endsWith('k') ? 1000 : 1) : null
}

function qualificationFor(item: Opportunity, categories: string[], minimumBudget: string) {
  const serviceText = `${item.service_needed} ${item.title} ${item.detail}`.toLowerCase()
  const exactService = categories.some((category) => item.service_needed.trim().toLowerCase() === category.toLowerCase())
  const serviceMatch = categories.some((category) => serviceText.includes(category.split(' ')[0].toLowerCase()))
  const service = exactService ? 25 : serviceMatch ? 16 : 0
  const serviceReason = exactService ? 'Exact service category selected' : serviceMatch ? 'Keyword overlap in the source details' : 'No service keyword match recorded'
  const intent = ({ high: 25, medium: 18, low: 8, unknown: 0 } as const)[item.buying_intent]
  const intentReason = item.field_evidence.buying_intent === 'inferred'
    ? `${item.buying_intent[0].toUpperCase()}${item.buying_intent.slice(1)} intent assessed by AI from the source post`
    : item.field_evidence.buying_intent === 'stated'
      ? `${item.buying_intent[0].toUpperCase()}${item.buying_intent.slice(1)} intent stated in the source post`
      : `${item.buying_intent[0].toUpperCase()}${item.buying_intent.slice(1)} intent entered by reviewer`
  const clarity = item.pain_point.trim() && item.detail.trim().length >= 40 ? 20 : item.pain_point.trim() ? 15 : item.detail.trim().length >= 40 ? 12 : item.detail.trim() ? 7 : 0
  const clarityReason = item.pain_point.trim() ? 'Pain point recorded from/inferred from the post' : item.detail.trim() ? 'Source excerpt only; pain point not separated' : 'No source text or pain point recorded'
  const leadBudget = parseBudgetAmount(item.budget)
  const minimum = parseBudgetAmount(minimumBudget)
  const budget = leadBudget === null ? 0 : minimum === null ? 15 : leadBudget >= minimum ? 15 : 5
  const budgetReason = leadBudget === null ? 'No numeric budget recorded' : minimum === null ? 'Budget amount recorded; no workspace minimum set' : leadBudget >= minimum ? 'Recorded budget meets the workspace minimum' : 'Recorded budget is below the workspace minimum'
  const contact = item.email || item.phone ? 15 : item.contact ? 8 : 0
  const contactReason = item.email || item.phone ? 'Public email or phone is available' : item.contact ? 'Public name/handle only' : 'No contact details recorded'
  return { service, intent, clarity, budget, contact, reasons: { service: serviceReason, intent: intentReason, clarity: clarityReason, budget: budgetReason, contact: contactReason }, total: service + intent + clarity + budget + contact }
}

function scoreBand(score: number, thresholds: number[]) {
  if (score >= thresholds[0]) return 'Excellent match'
  if (score >= thresholds[1]) return 'Strong match'
  if (score >= thresholds[2]) return 'Potential match'
  if (score >= thresholds[3]) return 'Needs further research'
  return 'Low priority'
}

function personalizeOpportunityMessage(text: string, item: Opportunity) {
  const fields: Record<string, string> = {
    name: item.contact || 'there',
    project: item.title || 'your project',
    pain_point: item.pain_point || item.detail || item.title || 'your project',
    service: item.service_needed || 'projects like this',
    business: item.business_name || 'your business',
    sender: 'Aiventra Studios',
    next_step: 'review the brief and suggest a practical first step',
  }
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, raw: string) => fields[raw.trim().toLowerCase()] ?? match)
}

function timeNow() { return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date()) }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function App() {
  const [dashboardTheme, setDashboardTheme] = useState<'theme-nebula' | 'theme-aura-cyan'>(() => {
    try { return localStorage.getItem('aiventra:saas-style') === 'aura-cyan' ? 'theme-aura-cyan' : 'theme-nebula' }
    catch { return 'theme-nebula' }
  })
  const [styleMenuOpen, setStyleMenuOpen] = useState(false)
  const workspace = useAiventraWorkspace()
  const { session, authReady, workspaceId, workspaceLoading, error: workspaceError, signIn, signUp, signOut } = workspace
  const user = session?.user
  const [view, setView] = useState<View>('Overview')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [activity, setActivity] = useState<LogItem[]>([])
  const [query, setQuery] = useState('website development, app development, CRM, automation')
  const [excluded, setExcluded] = useState('internship, unpaid, course')
  const [services, setServices] = useState<string[]>(['Website development', 'App development', 'CRM', 'Automation'])
  const [budget, setBudget] = useState('')
  const [voiceInstructions, setVoiceInstructions] = useState('')
  const [scoreThresholds, setScoreThresholds] = useState<number[]>([90, 75, 60, 40])
  const [sourcePrefs, setSourcePrefs] = useState<string[]>(platforms)
  const [dataLoading, setDataLoading] = useState(false)
  const [loadedDataWorkspace, setLoadedDataWorkspace] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingOpportunityRef = useRef(false)
  const queueingDraftsRef = useRef(false)
  const recordingReplyRef = useRef(false)
  const [draftRefresh, setDraftRefresh] = useState(0)
  const [replies, setReplies] = useState<ReplyItem[]>([])
  const [replyRefresh, setReplyRefresh] = useState(0)
  const [replyCampaigns, setReplyCampaigns] = useState<Record<string, number>>({})
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null)
  const [activityTargetOpportunityId, setActivityTargetOpportunityId] = useState<string | null>(null)
  const [gmassConnection, setGmassConnection] = useState<GmassConnectionState>('checking')
  const [gmassConnectionDetail, setGmassConnectionDetail] = useState('Checking the GMass API key…')
  const [gmassWebhookState, setGmassWebhookState] = useState<'checking' | 'receiving' | 'waiting' | 'error'>('checking')
  const [gmassWebhookDetail, setGmassWebhookDetail] = useState('Checking for received events…')
  const [connectionRefresh, setConnectionRefresh] = useState(0)
  const [authFormError, setAuthFormError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [subject, setSubject] = useState('A few ideas for your project')
  const [message, setMessage] = useState(templates.first)
  const [socialMessage, setSocialMessage] = useState('Hi {{name}} — I saw your post about {{pain_point}}. I have a couple of ideas that may help. Would you be open to a quick conversation?')
  const [followups, setFollowups] = useState(false)
  const [approval, setApproval] = useState(true)
  const [toast, setToast] = useState('')
  const [sequenceDays, setSequenceDays] = useState([1, 3, 7])
  const [filter, setFilter] = useState('Needs action')
  const [newLead, setNewLead] = useState({ title: '', source: 'Manual entry', source_url: '', contact: '', business_name: '', email: '', phone: '', detail: '', pain_point: '', service_needed: '', budget: '', buying_intent: 'unknown' as BuyingIntent, published_at: '', field_evidence: { pain_point: 'stated', service_needed: 'inferred', buying_intent: 'stated', budget: 'stated' } as FieldEvidence })

  useEffect(() => {
    if (!workspaceId || !user) {
      setOpportunities([]); setActivity([]); setLoadedDataWorkspace(null)
      return
    }
    let active = true
    setLoadedDataWorkspace(null)
    setDataLoading(true)
    void (async () => {
      const [opportunityResult, activityResult, searchResult, sequenceResult] = await Promise.all([
        supabase.from('opportunities').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
        supabase.from('activity_events').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100),
        supabase.from('search_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
        supabase.from('sequence_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
      ])
      const failed = [opportunityResult, activityResult, searchResult, sequenceResult].find((result) => result.error)
      if (failed?.error) throw failed.error
      if (!active) return
      setOpportunities((opportunityResult.data || []).map((row) => ({
        id: row.id, title: row.title, source: row.source, source_platform: row.source_platform || '', source_url: row.source_url || '', profile_url: row.profile_url || '', qualification_reason: row.qualification_reason || '', contact: row.contact, business_name: row.business_name || '', email: row.email, phone: row.phone || '',
        detail: row.detail, pain_point: row.pain_point || '', service_needed: row.service_needed || '', budget: row.budget, buying_intent: row.buying_intent || 'unknown', published_at: row.published_at || null,
        discovered_at: row.discovered_at || row.created_at, field_evidence: row.field_evidence || {}, status: row.status, created: formatDateTime(row.created_at), createdAt: row.created_at, replied: row.replied,
      })))
      setActivity((activityResult.data || []).map((row) => ({
        id: row.id, title: row.title, detail: row.detail, at: formatDateTime(row.created_at), kind: row.kind,
      })))
      const search = searchResult.data
      if (search) {
        setServices(search.service_categories || [])
        setQuery(search.keywords || '')
        setExcluded(search.excluded_phrases || '')
        setBudget(search.minimum_budget || '')
        setVoiceInstructions(search.voice_instructions || '')
        setSourcePrefs(search.source_preferences || [])
        setScoreThresholds(search.score_thresholds || [90, 75, 60, 40])
      }
      if (sequenceResult.data) {
        setSequenceDays(sequenceResult.data.follow_up_days || [1, 3, 7])
        setFollowups(Boolean(sequenceResult.data.enabled))
      } else setFollowups(false)
      setLoadedDataWorkspace(workspaceId)
    })().catch((cause: unknown) => {
      if (active) {
        setLoadedDataWorkspace(workspaceId)
        notify(cause instanceof Error ? `Could not load workspace data: ${cause.message}` : 'Could not load workspace data.')
      }
    }).finally(() => { if (active) setDataLoading(false) })
    return () => { active = false }
  }, [workspaceId, user?.id])

  useEffect(() => {
    if (view !== 'Replies' || !workspaceId) return
    let active = true
    void Promise.all([
      supabase.from('replies').select('id, opportunity_id, draft_id, body, received_at, reviewed_at')
        .eq('workspace_id', workspaceId).order('received_at', { ascending: false }).limit(100),
      supabase.from('gmass_events').select('draft_id, campaign_id')
        .eq('workspace_id', workspaceId).eq('event_type', 'Replies').not('draft_id', 'is', null)
        .order('received_at', { ascending: false }).limit(100),
    ]).then(([replyResult, eventResult]) => {
        if (!active) return
        if (replyResult.error) notify(`Replies could not be loaded: ${replyResult.error.message}`)
        else setReplies((replyResult.data || []) as ReplyItem[])
        const campaigns: Record<string, number> = {}
        for (const event of eventResult.data || []) if (event.draft_id && event.campaign_id) campaigns[event.draft_id] = event.campaign_id
        setReplyCampaigns(campaigns)
      })
    return () => { active = false }
  }, [view, workspaceId, replyRefresh])

  useEffect(() => {
    if (view !== 'Connections' || !workspaceId || !session) return
    let active = true
    setGmassConnection('checking')
    setGmassConnectionDetail('Checking the GMass API key…')
    setGmassWebhookState('checking')
    setGmassWebhookDetail('Checking for received events…')
    void Promise.all([
      supabase.functions.invoke<{ status?: GmassConnectionState; detail?: string }>('gmass-status'),
      supabase.from('gmass_events').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    ]).then(([apiResult, eventResult]) => {
      if (!active) return
      if (apiResult.error) {
        setGmassConnection('error')
        setGmassConnectionDetail(apiResult.error.message || 'Could not check GMass API status.')
      } else {
        const status = apiResult.data?.status
        setGmassConnection(status === 'connected' || status === 'needs_setup' ? status : 'error')
        setGmassConnectionDetail(apiResult.data?.detail || 'GMass status check returned no details.')
      }
      if (eventResult.error) {
        setGmassWebhookState('error')
        setGmassWebhookDetail('Could not read GMass event history for this workspace.')
      } else if ((eventResult.count || 0) > 0) {
        setGmassWebhookState('receiving')
        setGmassWebhookDetail(`${eventResult.count} GMass event record(s) received by this workspace.`)
      } else {
        setGmassWebhookState('waiting')
        setGmassWebhookDetail('No events received yet. The webhook becomes confirmed after GMass sends an event.')
      }
    })
    return () => { active = false }
  }, [view, workspaceId, session?.access_token, connectionRefresh])

  const log = (title: string, detail: string, kind: LogItem['kind'] = 'system') => {
    const id = crypto.randomUUID()
    setActivity((current) => [{ id, title, detail, at: timeNow(), kind }, ...current])
    if (!workspaceId || !user) return
    void supabase.from('activity_events').insert({ id, workspace_id: workspaceId, title, detail, kind, created_by: user.id })
      .then(({ error }) => { if (error) notify(`Activity could not be saved: ${error.message}`) })
  }
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast((current) => current === text ? '' : current), 2800) }
  const uniqueOpportunities = useMemo(() => {
    const rank: Record<Opportunity['status'], number> = { New: 0, Review: 1, 'Draft ready': 2, Contacted: 3, Replied: 4 }
    const groups = new Map<string, Opportunity>()
    for (const item of opportunities) {
      const signature = [item.title, item.source, item.contact, item.email, item.detail, item.budget]
        .map((part) => part.trim().toLowerCase()).join('|')
      const existing = groups.get(signature)
      const closeInTime = existing?.createdAt && item.createdAt
        ? Math.abs(Date.parse(existing.createdAt) - Date.parse(item.createdAt)) < 120_000
        : false
      if (!existing || !closeInTime) groups.set(existing ? `${signature}|${item.id}` : signature, item)
      else if (rank[item.status] > rank[existing.status]) groups.set(signature, item)
    }
    return [...groups.values()]
  }, [opportunities])
  const emailContacts = useMemo(() => uniqueOpportunities.filter((item) => item.email && (item.status === 'New' || item.status === 'Review')), [uniqueOpportunities])
  const socialContacts = useMemo(() => uniqueOpportunities.filter((item) => item.source !== 'Manual entry' && item.contact && (item.status === 'New' || item.status === 'Review')), [uniqueOpportunities])
  const visibleReplies = useMemo(() => {
    const groups = new Map<string, ReplyItem>()
    for (const reply of replies) {
      const normalizedBody = reply.body.trim().toLowerCase().replace(/\s+/g, ' ') || '(no message body provided)'
      // GMass's configured Replies hook sends no message body. In that case
      // repeated callbacks for one draft are indistinguishable, so show one
      // conversation row for that draft. If GMass supplies bodies, preserve
      // distinct messages from the same draft.
      const identity = reply.draft_id || reply.opportunity_id || reply.id
      const key = reply.draft_id && !reply.body.trim()
        ? `draft:${reply.draft_id}:reply-without-body`
        : `${identity}|${normalizedBody}`
      const current = groups.get(key)
      if (!current || (!reply.reviewed_at && current.reviewed_at) || Date.parse(reply.received_at) > Date.parse(current.received_at)) groups.set(key, reply)
    }
    return [...groups.values()].sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at))
  }, [replies])
  useEffect(() => {
    if (view !== 'Replies' || !activityTargetOpportunityId) return
    const relatedReply = visibleReplies.find((reply) => reply.opportunity_id === activityTargetOpportunityId)
    if (relatedReply) setExpandedReplyId(relatedReply.id)
  }, [view, activityTargetOpportunityId, visibleReplies])
  useEffect(() => {
    if (view !== 'Opportunities' || !activityTargetOpportunityId) return
    document.getElementById(`aso-opportunity-${activityTargetOpportunityId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [view, activityTargetOpportunityId, filter])
  const filtered = uniqueOpportunities.filter((item) => filter === 'Needs action'
    ? item.status === 'New' || item.status === 'Review'
    : filter === 'All' || item.status === filter)
  const scores = (item: Opportunity) => qualificationFor(item, services, budget).total

  async function recordReply(item: Opportunity) {
    if (!workspaceId || !user || recordingReplyRef.current) return
    recordingReplyRef.current = true
    setSaving(true)
    try {
      const update = await supabase.from('opportunities').update({ status: 'Replied', replied: true }).eq('id', item.id).eq('workspace_id', workspaceId)
      if (update.error) throw update.error
      const reply = await supabase.from('replies').insert({ workspace_id: workspaceId, opportunity_id: item.id, channel: item.email ? 'email' : 'social', body: '', received_at: new Date().toISOString() })
      if (reply.error) throw reply.error
      setOpportunities((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Replied', replied: true } : entry))
      log('Reply recorded manually', `${item.title} · follow-ups paused pending review`, 'message')
      notify('Reply recorded. Follow-ups remain paused for review.')
    } catch (cause) {
      notify(`Reply could not be recorded: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally { recordingReplyRef.current = false; setSaving(false) }
  }

  async function returnReplyToReview(item: Opportunity) {
    if (!workspaceId) return
    setSaving(true)
    try {
      // Keep the opportunity in Replied so it cannot accidentally be outreached again.
      const update = await supabase.from('opportunities').update({ status: 'Replied', replied: true }).eq('id', item.id).eq('workspace_id', workspaceId)
      if (update.error) throw update.error
      const review = await supabase.from('replies').update({ reviewed_at: new Date().toISOString() }).eq('opportunity_id', item.id).eq('workspace_id', workspaceId).is('reviewed_at', null)
      if (review.error) throw review.error
      setOpportunities((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Replied', replied: true } : entry))
      setReplies((current) => current.map((entry) => entry.opportunity_id === item.id && !entry.reviewed_at ? { ...entry, reviewed_at: new Date().toISOString() } : entry))
      setFilter('Replied')
      setActivityTargetOpportunityId(item.id)
      setView('Opportunities')
      log('Reply marked reviewed', item.title, 'message')
      notify('Reply marked reviewed. The opportunity is open in the Replied queue; follow-ups remain paused.')
    } catch (cause) {
      notify(`Could not update reply status: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally { setSaving(false) }
  }

  async function saveSequenceSettings() {
    if (!workspaceId || !user) return
    if (sequenceDays.some((day, index) => !Number.isInteger(day) || day < 1 || day > 30 || (index > 0 && day <= sequenceDays[index - 1]))) {
      notify('Choose follow-up days in increasing order from day 1 to day 30.')
      return
    }
    setSaving(true)
    try {
      const settings = await supabase.from('sequence_settings').upsert({
        workspace_id: workspaceId, enabled: followups, follow_up_days: sequenceDays, updated_by: user.id,
      }, { onConflict: 'workspace_id' })
      if (settings.error) throw settings.error
      const bodies = [templates.day1, templates.day3, templates.day7]
      const steps = sequenceDays.map((delay_days, index) => ({
        workspace_id: workspaceId, step_number: index + 1, delay_days, subject: subject, body: bodies[index] || templates.day7,
      }))
      const savedSteps = await supabase.from('sequence_steps').upsert(steps, { onConflict: 'workspace_id,step_number' })
      if (savedSteps.error) throw savedSteps.error
      log('Follow-up sequence updated', `Day ${sequenceDays.join(', Day ')}`, 'setup')
      notify('Sequence settings saved. GMass will apply them to future campaigns submitted after this change; existing campaigns are unchanged.')
    } catch (cause) {
      notify(`Sequence settings were not saved: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally { setSaving(false) }
  }

  async function saveSearch(): Promise<boolean> {
    if (!workspaceId || !user) return false
    if (scoreThresholds.length !== 4 || scoreThresholds.some((threshold) => !Number.isInteger(threshold) || threshold < 1 || threshold > 100) || scoreThresholds.some((threshold, index) => index > 0 && threshold >= scoreThresholds[index - 1])) {
      notify('Score bands must be descending whole numbers from 1 to 100.')
      return false
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('search_settings').upsert({
        workspace_id: workspaceId,
        service_categories: services,
        keywords: query,
        excluded_phrases: excluded,
        minimum_budget: budget,
        voice_instructions: voiceInstructions,
        source_preferences: sourcePrefs,
        score_thresholds: scoreThresholds,
        monitoring_enabled: false,
        created_by: user.id,
      }, { onConflict: 'workspace_id' })
      if (error) throw error
      log('Search criteria saved', `${services.length} service categories / ${sourcePrefs.length} selected sources`, 'setup')
      notify('Search rules saved to Supabase.')
      return true
    } catch (cause) {
      notify(`Search rules were not saved: ${cause instanceof Error ? cause.message : 'unknown error'}`)
      return false
    } finally { setSaving(false) }
  }
  async function saveOpportunity(event: FormEvent) {
    event.preventDefault()
    if (!workspaceId || !user || savingOpportunityRef.current) return
    savingOpportunityRef.current = true
    setSaving(true)
    try {
      const payload = { ...newLead, published_at: newLead.published_at ? `${newLead.published_at}T12:00:00.000Z` : null }
      const { data, error } = await supabase.from('opportunities').insert({ ...payload, workspace_id: workspaceId, created_by: user.id, status: 'New' }).select('*').single()
      if (error) throw error
      const item: Opportunity = { id: data.id, title: data.title, source: data.source, source_platform: data.source_platform || '', source_url: data.source_url || '', contact: data.contact, business_name: data.business_name || '', email: data.email, phone: data.phone || '', detail: data.detail, pain_point: data.pain_point || '', service_needed: data.service_needed || '', budget: data.budget, buying_intent: data.buying_intent || 'unknown', published_at: data.published_at || null, discovered_at: data.discovered_at || data.created_at, field_evidence: data.field_evidence || {}, status: data.status, created: formatDateTime(data.created_at), createdAt: data.created_at, replied: data.replied }
      setOpportunities((current) => [item, ...current])
      setNewLead({ title: '', source: 'Manual entry', source_url: '', contact: '', business_name: '', email: '', phone: '', detail: '', pain_point: '', service_needed: '', budget: '', buying_intent: 'unknown', published_at: '', field_evidence: { pain_point: 'stated', service_needed: 'inferred', buying_intent: 'stated', budget: 'stated' } })
      setShowLeadForm(false)
      log('Opportunity added', `${item.title} / ${item.source}`, 'capture')
      notify('Opportunity saved to Supabase.')
    } catch (cause) {
      notify(`Opportunity was not saved: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally {
      savingOpportunityRef.current = false
      setSaving(false)
    }
  }
  async function queueOutreach() {
    if (!selected.length) { notify('Select at least one contact'); return }
    if (!workspaceId || !user || queueingDraftsRef.current) return
    queueingDraftsRef.current = true
    const socialOnly = view === 'Social outreach'
    const selectedTargets = uniqueOpportunities.filter((item) => selected.includes(item.id) && (item.status === 'New' || item.status === 'Review') && (socialOnly ? item.source !== 'Manual entry' && item.contact : Boolean(item.email)))
    if (!selectedTargets.length) { queueingDraftsRef.current = false; notify(socialOnly ? 'Select a new or reviewed social contact first.' : 'Select a new or reviewed opportunity with a contact email.'); return }
    setSaving(true)
    try {
      // Protect against stale status, retries, and an insert that succeeded before
      // an earlier opportunity status update failed.
      const existing = await supabase.from('outreach_drafts').select('opportunity_id')
        .eq('workspace_id', workspaceId).eq('channel', socialOnly ? 'social' : 'email')
        .in('opportunity_id', selectedTargets.map((item) => item.id))
        .in('status', ['draft', 'pending_review', 'approved', 'queued', 'sent', 'failed'])
      if (existing.error) throw existing.error
      const alreadyDrafted = new Set((existing.data || []).map((row) => row.opportunity_id).filter(Boolean))
      const duplicateIds = selectedTargets.filter((item) => alreadyDrafted.has(item.id)).map((item) => item.id)
      if (duplicateIds.length) {
        const sync = await supabase.from('opportunities').update({ status: 'Draft ready' }).in('id', duplicateIds).eq('workspace_id', workspaceId)
        if (sync.error) throw sync.error
        setOpportunities((current) => current.map((item) => duplicateIds.includes(item.id) ? { ...item, status: 'Draft ready' } : item))
      }
      const targets = selectedTargets.filter((item) => !alreadyDrafted.has(item.id))
      if (!targets.length) {
        setSelected((current) => current.filter((id) => !duplicateIds.includes(id)))
        setDraftRefresh((value) => value + 1)
        notify('These opportunities already have drafts. Open the saved draft queue to review or delete them.')
        return
      }
      const drafts = targets.map((item) => ({
        workspace_id: workspaceId,
        opportunity_id: item.id,
        channel: socialOnly ? 'social' : 'email',
        recipient_name: item.contact,
        recipient_email: socialOnly ? '' : item.email,
        recipient_handle: socialOnly ? item.contact : '',
        subject: socialOnly ? '' : personalizeOpportunityMessage(subject, item),
        body: personalizeOpportunityMessage(socialOnly ? socialMessage : message, item),
        status: approval ? 'pending_review' : 'draft',
        requires_approval: approval,
        created_by: user.id,
      }))
      const { error } = await supabase.from('outreach_drafts').insert(drafts)
      if (error) throw error
      const selectedIds = targets.map((item) => item.id)
      const update = await supabase.from('opportunities').update({ status: 'Draft ready' }).in('id', selectedIds).eq('workspace_id', workspaceId)
      if (update.error) notify(`Drafts were saved, but opportunity status sync failed. Existing-draft checks will still prevent a duplicate: ${update.error.message}`)
      setOpportunities((current) => current.map((item) => selectedIds.includes(item.id) ? { ...item, status: 'Draft ready' } : item))
      setSelected([])
      setDraftRefresh((value) => value + 1)
      log('Outreach drafts prepared', `${socialOnly ? 'Social outreach' : 'Email outreach'} · ${targets.map((item) => item.title).join(' · ')} · ${targets.length} draft(s) saved for review. Nothing was sent.`, 'message')
      notify(duplicateIds.length ? `${targets.length} draft(s) saved. ${duplicateIds.length} existing draft(s) skipped. Nothing was sent.` : 'Drafts saved to Supabase. Nothing was sent.')
    } catch (cause) {
      notify(`Drafts were not saved: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally {
      queueingDraftsRef.current = false
      setSaving(false)
    }
  }
  function addTemplate(key: keyof typeof templates) { setMessage(templates[key]); notify(`${key === 'first' ? 'First message' : `Day ${key.slice(3)}`} template loaded`) }
  async function deleteOpportunity(item: Opportunity) {
    if (!workspaceId || !window.confirm(`Delete “${item.title}” from opportunities? Unsent drafts will be deleted. Submitted campaign and reply history will be retained but detached.`)) return
    try {
      const drafts = await supabase.from('outreach_drafts').select('id, status')
        .eq('workspace_id', workspaceId).eq('opportunity_id', item.id)
      if (drafts.error) throw drafts.error
      const { data: deletedOpportunity, error } = await supabase.from('opportunities').delete().eq('id', item.id).eq('workspace_id', workspaceId).select('id').maybeSingle()
      if (error) throw error
      if (!deletedOpportunity) throw new Error('No row was deleted. Confirm your workspace role allows opportunity deletion.')
      setOpportunities((current) => current.filter((entry) => entry.id !== item.id))
      setSelected((current) => current.filter((id) => id !== item.id))
      log('Opportunity deleted', item.title, 'capture')
      const unsentDraftIds = (drafts.data || []).filter((draft) => ['draft', 'pending_review', 'approved', 'failed'].includes(draft.status)).map((draft) => draft.id)
      if (unsentDraftIds.length) {
        const cleanup = await supabase.from('outreach_drafts').delete().eq('workspace_id', workspaceId).in('id', unsentDraftIds)
        if (cleanup.error) {
          notify(`Opportunity deleted, but unsent drafts could not be removed: ${cleanup.error.message}`)
          return
        }
      }
      notify('Opportunity and its unsent drafts were deleted. Submitted campaign and reply history was retained.')
    } catch (cause) {
      notify(`Opportunity could not be deleted: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    }
  }

  function openActivity(item: LogItem) {
    const text = `${item.title} ${item.detail}`.toLowerCase()
    const matched = uniqueOpportunities.find((opportunity) => text.includes(opportunity.id.toLowerCase()) || (opportunity.title && text.includes(opportunity.title.toLowerCase())))
    setActivityTargetOpportunityId(matched?.id || null)
    if (text.includes('reply')) {
      setView('Replies')
      setReplyRefresh((value) => value + 1)
    } else if (text.includes('draft') || text.includes('outreach') || text.includes('gmass') || text.includes('email')) {
      setView(text.includes('social') ? 'Social outreach' : 'Email')
    } else if (text.includes('search') || text.includes('criteria')) {
      setView('Research Sessions')
    } else if (text.includes('sequence') || text.includes('follow-up')) {
      setView('Sequences')
    } else if (text.includes('connection') || text.includes('monitor')) {
      setView('Connections')
    } else {
      setFilter(matched?.status || 'All')
      setView('Opportunities')
    }
  }

  if (!authReady) return <AuthLoading theme={dashboardTheme} message="Checking your secure session…" />
  if (!session) return <LandingPage onGetStarted={() => { setAuthMode('signup'); setAuthFormError(''); setShowAuth(true) }} onSignIn={() => { setAuthMode('signin'); setAuthFormError(''); setShowAuth(true) }} authOverlay={showAuth ? <AuthScreen initialMode={authMode} configReady={supabaseConfigured} onBack={() => setShowAuth(false)} onSignIn={signIn} onSignUp={signUp} error={authFormError || workspaceError} onError={setAuthFormError} /> : null} />
  if (workspaceError && !workspaceId) return <AuthLoading theme={dashboardTheme} message={workspaceError} action={<button className="button secondary" onClick={() => void signOut()}>Sign out</button>} />
  if (workspaceLoading || !workspaceId || dataLoading || loadedDataWorkspace !== workspaceId) return <AuthLoading theme={dashboardTheme} message="Loading your Aiventra Smart Outsourcing workspace…" />

  return <div className={`shell ${dashboardTheme}`}>
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setView('Overview') }}><AiventraLogo iconOnly className="brand-symbol"/><span className="brand-copy"><b>Aiventra Smart Outsourcing</b><small>OUTSOURCING MANAGEMENT SYSTEM</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="navigation">{nav.map((item) => <button key={item.view} className={view === item.view ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.view)}><span className="nav-icon"><Icon name={item.icon}/></span>{item.view}{item.view === 'Opportunities' && uniqueOpportunities.length > 0 && <span className="nav-count">{uniqueOpportunities.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-box"><div className="user-avatar">{(user?.email || 'A').slice(0, 1).toUpperCase()}</div><div><b>{user?.user_metadata?.full_name || 'Workspace member'}</b><small>{user?.email || 'Authenticated account'}</small></div><button aria-label="Sign out" title="Sign out" onClick={() => void signOut().catch((error: Error) => notify(error.message))}><LogOut aria-hidden="true"/><span>Sign out</span></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb">Aiventra Smart Outsourcing <span>/</span> <b>{view}</b></div><div className="top-actions"><div className="workspace-style-picker"><button type="button" className="workspace-style-trigger" aria-haspopup="menu" aria-expanded={styleMenuOpen} onClick={() => setStyleMenuOpen((open) => !open)}><Palette aria-hidden="true"/><span>Style</span><b>{dashboardTheme === 'theme-nebula' ? 'Sunset Nebula' : 'Aura Cyan'}</b><ChevronDown aria-hidden="true"/></button>{styleMenuOpen && <div className="workspace-style-menu" role="menu" aria-label="Choose workspace color style">{([{ id: 'theme-nebula', label: 'Sunset Nebula' }, { id: 'theme-aura-cyan', label: 'Aura Cyan' }] as const).map((option) => <button type="button" role="menuitemradio" aria-checked={dashboardTheme === option.id} key={option.id} onClick={() => { setDashboardTheme(option.id); try { localStorage.setItem('aiventra:saas-style', option.id === 'theme-nebula' ? 'sunset-nebula' : 'aura-cyan') } catch {} setStyleMenuOpen(false) }}><span>{option.label}</span>{dashboardTheme === option.id && <Check aria-hidden="true"/>}</button>)}</div>}</div><button className="help-button" onClick={() => notify('Records are stored in your authenticated Supabase workspace. Source and delivery integrations remain in preview mode.')}><Icon name="help"/> Help</button></div></header>
      <section className="page-heading"><div><div className="eyebrow">OUTSOURCING MANAGEMENT SYSTEM</div><h1>{view === 'Overview' ? 'Opportunity operations' : view}</h1><p>{description(view)}</p></div>{view === 'Overview' && <button className="button primary" onClick={() => setShowLeadForm(true)}><span>＋</span> Add opportunity</button>}</section>

      {view === 'Overview' && <Overview opportunities={uniqueOpportunities} activity={activity} onGo={setView} onActivitySelect={openActivity} onRun={() => setView('Research Sessions')} />}

      {view === 'Research Sessions' && <ResearchSessions workspaceId={workspaceId} userId={user?.id || ''} searchRules={{ services, setServices, query, setQuery, excluded, setExcluded, budget, setBudget, voice: voiceInstructions, setVoice: setVoiceInstructions, scoreThresholds, setScoreThresholds, save: saveSearch }} onNotify={notify}/>}
      {view === 'Opportunities' && <section className="content-card"><CardHeading title="Opportunity review queue" sub="New and reviewed leads appear here. Prepared drafts and replies move into their own status queues." action={<div className="heading-actions"><select className="select-control" value={filter} onChange={(event) => setFilter(event.target.value)}><option>Needs action</option><option>All</option><option>New</option><option>Review</option><option>Draft ready</option><option>Contacted</option><option>Replied</option></select><button className="button primary" onClick={() => setShowLeadForm(true)}><Icon name="plus"/> Add opportunity</button></div>}/>{filtered.length ? <div className="opportunity-list">{filtered.map((item) => <OpportunityCard key={item.id} item={item} score={scores(item)} band={scoreBand(scores(item), scoreThresholds)} breakdown={qualificationFor(item, services, budget)} activityTarget={activityTargetOpportunityId === item.id} onOutreach={() => { setSelected((current) => current.includes(item.id) ? current : [...current, item.id]); setView(item.email ? 'Email' : 'Social outreach') }} onReply={() => item.status === 'Contacted' ? void recordReply(item) : (setActivityTargetOpportunityId(item.id), setView('Replies'), setReplyRefresh((value) => value + 1))} onViewDraft={() => setView(item.email ? 'Email' : 'Social outreach')} onDelete={() => void deleteOpportunity(item)} />)}</div> : <Empty icon="briefcase" title="No opportunities in this view" text="Change the status filter or add an opportunity to continue." action={<button className="button secondary" onClick={() => setFilter('All')}>Show all opportunities</button>}/>}</section>}
      {view === 'Outreach' && <section className="outreach-grid"><div className="content-card"><CardHeading title="Recipients" sub="Only opportunities with a collected email are available."/><div className="recipient-rows">{emailContacts.map((item) => <label className="recipient-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}/><span className="recipient-avatar">{item.contact ? item.contact[0].toUpperCase() : '?'}</span><span className="recipient-info"><b>{item.contact || 'Name not provided'}</b><small>{item.email}</small><small>{item.title}</small></span><span className="score-mini">{scores(item)}</span></label>)}</div></div><div className="content-card composer"><CardHeading title="Message composer" sub="Personalize each draft with the source post and lead profile."/><div className="template-pills saved-templates"><span>Templates:</span><button onClick={() => addTemplate('first')}>First message</button><button onClick={() => addTemplate('day1')}>Day 1</button><button onClick={() => addTemplate('day3')}>Day 3</button><button onClick={() => addTemplate('day7')}>Day 7</button></div><label className="field-label">Email subject<input value={subject} onChange={(event) => setSubject(event.target.value)}/></label><label className="field-label">Message<textarea rows={8} value={message} onChange={(event) => setMessage(event.target.value)}/><small>Fields: {'{{name}}'}, {'{{project}}'}, {'{{pain_point}}'}, {'{{service}}'}, {'{{business}}'}, {'{{sender}}'}.</small></label><div className="template-pills"><span>Insert field:</span>{['{{name}}', '{{project}}', '{{pain_point}}', '{{service}}', '{{business}}', '{{sender}}'].map((tag) => <button key={tag} onClick={() => setMessage((current) => `${current}\n${tag}`)}>{tag}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={approval} onChange={(event) => setApproval(event.target.checked)}/><span><b>Require approval before send</b><small>{approval ? 'Messages stay in review until approved.' : 'Messages stay as drafts for manual review.'}</small></span></label><div className="route-note"><b>Follow-ups</b><span>{followups ? `GMass sequence enabled: Day ${sequenceDays.join(', Day ')}. Edit timing in Sequences.` : 'GMass follow-up sequence is off. Configure it in Sequences.'}</span></div><button className="button primary send-button" disabled={saving || selected.length === 0} onClick={queueOutreach}>Prepare {selected.length || ''} draft(s) <span>→</span></button></div></section>}
      {view === 'Email' && <section className="content-card"><CardHeading title="Email campaign" sub="Only new or reviewed opportunities with a shared email can be added to a draft." action={<button className="button secondary" onClick={() => setView('Opportunities')}>Review opportunities</button>}/><div className="recipient-rows">{emailContacts.length ? emailContacts.map((item) => <label className="recipient-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))}/><span className="recipient-avatar">{item.contact ? item.contact[0].toUpperCase() : '?'}</span><span className="recipient-info"><b>{item.contact || 'Name not provided'}</b><small>{item.email}</small><small>{item.title}</small></span><span className="score-mini">{scores(item)}</span></label>) : <Empty icon="mail" title="No email opportunities ready" text="Prepared or replied opportunities are removed here to prevent accidental duplicate outreach." action={<button className="button secondary" onClick={() => setView('Opportunities')}>Review opportunity statuses</button>}/>}</div><div className="composer"><CardHeading title="Draft" sub="Prepare a personal message for the selected contacts."/><label className="field-label">Email subject<input value={subject} onChange={(event) => setSubject(event.target.value)}/></label><label className="field-label">Message<textarea rows={6} value={message} onChange={(event) => setMessage(event.target.value)}/></label><div className="template-pills"><span>Load template:</span>{(['first', 'day1', 'day3', 'day7'] as const).map((key) => <button type="button" key={key} onClick={() => addTemplate(key)}>{key === 'first' ? 'First message' : `Day ${key.slice(3)}`}</button>)}</div></div><div className="route-note"><b>Delivery status</b><span>Drafts are saved in Aiventra. Email delivery happens only after review in the GMass queue below.</span></div><button className="button primary" disabled={saving || selected.length === 0} onClick={queueOutreach}>Prepare {selected.length || ''} selected draft(s)</button></section>}
      {view === 'Email' && <GmassDraftQueue workspaceId={workspaceId} refreshKey={draftRefresh} focusOpportunityId={activityTargetOpportunityId} onNotify={notify} onLog={log}/>}
      {view === 'Social outreach' && <>
        <section className="content-card social-composer-card">
          <CardHeading title="Prepare social messages" sub="Choose public social contacts, then create channel-neutral drafts to copy into the relevant platform yourself."/>
          <div className="route-note social-availability"><b>Social draft delivery</b><span>These drafts stay in Social outreach for you to copy into the social platform. They never enter the email queue or GMass; no social account is connected.</span></div>
          <div className="recipient-rows">{socialContacts.length ? socialContacts.map((item) => <label className="recipient-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))}/><span className="recipient-avatar"><Icon name="send"/></span><span className="recipient-info"><b>{item.contact}</b><small>{item.source}</small><small>{item.title}</small></span><span className="score-mini">{scores(item)}</span></label>) : <Empty icon="send" title="No social opportunities ready" text="Prepared or replied opportunities are removed here to prevent accidental duplicate outreach."/>}</div>
          <div className="composer social-composer"><label className="field-label">Social message<textarea rows={5} value={socialMessage} onChange={(event) => setSocialMessage(event.target.value)} placeholder="Write a concise, personal social message"/><small>Available fields: {'{{name}}'}, {'{{project}}'}, {'{{pain_point}}'}, {'{{service}}'}.</small></label><button className="button primary" disabled={saving || selected.length === 0 || !socialMessage.trim()} onClick={() => void queueOutreach()}>{saving ? 'Saving social drafts…' : `Save ${selected.length || ''} social draft(s)`}</button></div>
        </section>
        <SocialDraftQueue workspaceId={workspaceId} refreshKey={draftRefresh} focusOpportunityId={activityTargetOpportunityId} onNotify={notify} onLog={log}/>
      </>}
      {view === 'Replies' && <section className="content-card"><CardHeading title="Replies" sub="Repeated GMass callbacks are grouped by conversation. A reply pauses the matching follow-up sequence." action={<button className="button secondary small" onClick={() => setReplyRefresh((value) => value + 1)}>Refresh</button>}/>{visibleReplies.length ? <div className="recipient-rows">{visibleReplies.map((reply) => { const opportunity = uniqueOpportunities.find((item) => item.id === reply.opportunity_id); const expanded = expandedReplyId === reply.id; const gmailSearch = opportunity?.email ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${opportunity.email}`)}` : null; return <article className="recipient-row reply-row" key={reply.id}><div className="recipient-info"><b>{opportunity ? `${opportunity.contact || 'Contact'} · ${opportunity.title}` : 'Email reply'}</b><small>{new Date(reply.received_at).toLocaleString()}</small>{expanded && <div className="reply-detail"><b>Reply details</b>{reply.body ? <p>{reply.body}</p> : <p>GMass reported the sender, campaign event, and time, but does not include the reply text in this webhook. Open the email thread in Gmail to read the message.</p>}<dl><div><dt>Contact email</dt><dd>{opportunity?.email || 'Not included'}</dd></div><div><dt>GMass campaign</dt><dd>{reply.draft_id && replyCampaigns[reply.draft_id] ? `#${replyCampaigns[reply.draft_id]}` : 'Not included'}</dd></div><div><dt>Detected</dt><dd>{new Date(reply.received_at).toLocaleString()}</dd></div></dl>{gmailSearch && <a className="button secondary small reply-gmail-link" href={gmailSearch} target="_blank" rel="noreferrer">Search this sender in Gmail</a>}</div>}</div><div className="reply-actions"><button className="button secondary small" onClick={() => setExpandedReplyId(expanded ? null : reply.id)}>{expanded ? 'Hide details' : 'View details'}</button>{opportunity && <button className="button secondary small" onClick={() => void returnReplyToReview(opportunity)}>{reply.reviewed_at ? 'View in Replied queue' : 'Return to opportunities'}</button>}</div></article>})}</div> : <Empty icon="mail" title="No replies recorded" text="GMass sends reply events to this workspace when its Replies webhook is configured correctly."/>}</section>}
      {view === 'Sequences' && <section className="content-card sequence-card"><CardHeading title="Follow-up sequence" sub="GMass waits the selected number of days after the initial message and sends the next step only when there is no reply."/><label className="toggle-row"><input type="checkbox" checked={followups} onChange={(event) => setFollowups(event.target.checked)}/><span><b>Enable follow-ups for future email campaigns</b><small>{followups ? 'Enabled for campaigns sent after you save. Existing campaigns are unchanged.' : 'Disabled. No follow-up stages will be added to new campaigns.'}</small></span></label><div className="sequence-list">{sequenceDays.map((day, index) => <div className="sequence-row" key={index}><span className="sequence-index">0{index + 1}</span><div className="sequence-description"><b>Follow-up {index + 1}</b><small>{index === 0 ? 'Short check-in' : index === 1 ? 'Add a relevant idea or sample' : 'Polite close-out message'}</small></div><label>Send on day <input type="number" min={index ? sequenceDays[index - 1] + 1 : 1} max="30" value={day} onChange={(event) => setSequenceDays((current) => current.map((value, i) => i === index ? Number(event.target.value) : value))}/></label><span className="sequence-state">{followups ? 'Will be added to new campaigns' : 'Off'}</span></div>)}</div><div className="inline-warning">GMass executes these stages after the first message. A reply is configured to stop the remaining stages. Saving settings does not edit campaigns already submitted.</div><button className="button primary" disabled={saving} onClick={() => void saveSequenceSettings()}>Save sequence settings</button></section>}
      {view === 'Activity' && <section className="content-card"><CardHeading title="Bot activity" sub="Select an event to open its related workspace area."/><ActivityList activity={activity} onSelect={openActivity}/></section>}
      {view === 'Connections' && <section className="connections-layout"><AgentConnectionCards workspaceId={workspaceId} onRefresh={connectionRefresh}/><div className="content-card make-card-full"><CardHeading title="Connected services" sub="Your workspace uses GMass for email, Make.com for workflow automation, and Supabase for data." action={<button className="button secondary small" onClick={() => setConnectionRefresh((value) => value + 1)}>Refresh status</button>}/><IntegrationRow name="Email provider · GMass" description={`${gmassConnectionDetail} ${gmassWebhookDetail}`} status={gmassConnection} statusLabel={gmassConnection === 'connected' ? (gmassWebhookState === 'receiving' ? 'Connected' : 'API connected') : undefined}/><IntegrationRow name="Make.com" description="Workflow automation is not connected yet." status="idle"/><IntegrationRow name="Supabase" description="Workspace database and authentication are connected." status="connected"/><div className="secure-note">Social messages remain manual drafts and are never sent through GMass.</div></div></section>}
    </main>
    {showLeadForm && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowLeadForm(false) }}><form className="modal lead-modal" onSubmit={saveOpportunity}><div className="modal-header"><div><h2>Add opportunity</h2><p>Record what the public post actually says. Mark conclusions as inferred.</p></div><button type="button" className="icon-close" disabled={saving} onClick={() => setShowLeadForm(false)}>×</button></div><label className="field-label">Project or post title<input required value={newLead.title} onChange={(event) => setNewLead({ ...newLead, title: event.target.value })} placeholder="What help are they looking for?"/></label><div className="field-grid"><label className="field-label">Source<select value={newLead.source} onChange={(event) => setNewLead({ ...newLead, source: event.target.value })}>{['Manual entry', ...platforms].map((source) => <option key={source}>{source}</option>)}</select></label><label className="field-label">Original post URL<input type="url" value={newLead.source_url} onChange={(event) => setNewLead({ ...newLead, source_url: event.target.value })} placeholder="https://…"/></label><label className="field-label">Post published date<input type="date" value={newLead.published_at} onChange={(event) => setNewLead({ ...newLead, published_at: event.target.value })}/></label><label className="field-label">Business name<input value={newLead.business_name} onChange={(event) => setNewLead({ ...newLead, business_name: event.target.value })} placeholder="If stated publicly"/></label><label className="field-label">Name or handle<input value={newLead.contact} onChange={(event) => setNewLead({ ...newLead, contact: event.target.value })} placeholder="As shown on the post"/></label><label className="field-label">Public email<input type="email" value={newLead.email} onChange={(event) => setNewLead({ ...newLead, email: event.target.value })} placeholder="Only if shared for inquiries"/></label><label className="field-label">Public phone<input type="tel" value={newLead.phone} onChange={(event) => setNewLead({ ...newLead, phone: event.target.value })} placeholder="Optional; only if public"/></label><label className="field-label">Budget or range<input value={newLead.budget} onChange={(event) => setNewLead({ ...newLead, budget: event.target.value })} placeholder="Optional, as stated"/></label><label className="field-label">Service needed<input value={newLead.service_needed} onChange={(event) => setNewLead({ ...newLead, service_needed: event.target.value })} placeholder="e.g. website redesign"/><select aria-label="Service evidence" value={newLead.field_evidence.service_needed} onChange={(event) => setNewLead({ ...newLead, field_evidence: { ...newLead.field_evidence, service_needed: event.target.value as FieldEvidence[string] } })}><option value="stated">Explicitly stated</option><option value="inferred">Inferred from post</option><option value="unknown">Not verified</option></select></label><label className="field-label">Buying intent<select value={newLead.buying_intent} onChange={(event) => setNewLead({ ...newLead, buying_intent: event.target.value as BuyingIntent, field_evidence: { ...newLead.field_evidence, buying_intent: 'stated' } })}><option value="unknown">Unknown / not clear</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><small>Choose high only when the post clearly asks to hire or start.</small></label></div><label className="field-label">Pain point<input value={newLead.pain_point} onChange={(event) => setNewLead({ ...newLead, pain_point: event.target.value })} placeholder="What problem are they trying to solve?"/><select aria-label="Pain point evidence" value={newLead.field_evidence.pain_point} onChange={(event) => setNewLead({ ...newLead, field_evidence: { ...newLead.field_evidence, pain_point: event.target.value as FieldEvidence[string] } })}><option value="stated">Explicitly stated</option><option value="inferred">Inferred from post</option><option value="unknown">Not verified</option></select></label><label className="field-label">Original post text or relevant excerpt<textarea rows={5} value={newLead.detail} onChange={(event) => setNewLead({ ...newLead, detail: event.target.value })} placeholder="Keep the original wording or a faithful excerpt. This is the evidence for qualification."/></label><div className="modal-footer"><span className="muted-inline">Email and phone should only be used when publicly offered for contact.</span><button className="button secondary" type="button" disabled={saving} onClick={() => setShowLeadForm(false)}>Cancel</button><button className="button primary" type="submit" disabled={saving || savingOpportunityRef.current}>{saving ? 'Saving…' : 'Save for review'}</button></div></form></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function AuthLoading({ message, action, theme = 'theme-nebula' }: { message: string; action?: ReactNode; theme?: string }) {
  return <main className={`auth-page ${theme}`}><section className="auth-card"><AiventraLogo iconOnly className="brand-symbol auth-logo"/><p className="eyebrow">AIVENTRA SMART OUTSOURCING</p><h1>Your workspace</h1><p className="auth-copy">{message}</p>{action}</section></main>
}

function AuthScreen({ initialMode, configReady, onBack, onSignIn, onSignUp, error, onError }: {
  initialMode: 'signin' | 'signup'
  configReady: boolean
  onBack: () => void
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string, name: string) => Promise<boolean>
  error: string
  onError: (message: string) => void
}) {
  const { style, activeStyleId } = useThemeStyle()
  const dark = activeStyleId === 'linear-dark' || activeStyleId === 'sunset-nebula'
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    onError(''); setFeedback(''); setBusy(true)
    try {
      if (mode === 'signup') {
        const signedIn = await onSignUp(email, password, name)
        if (!signedIn) setFeedback('Check your email to confirm your account, then sign in here.')
      } else await onSignIn(email, password)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.')
    } finally { setBusy(false) }
  }

  const inputStyle = {
    backgroundColor: dark ? 'rgba(8, 5, 20, 0.78)' : '#f8faff',
    borderColor: dark ? 'rgba(216, 180, 254, 0.2)' : '#dce5f1',
    color: style.textPrimary,
  }

  return <div className="aso-auth-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onBack() }}>
    <section className={`aso-auth-dialog ${dark ? 'aso-auth-dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="aso-auth-title" style={{ backgroundColor: dark ? style.bgPage : '#ffffff', borderColor: style.cardBorder, boxShadow: style.cardShadow, color: style.textPrimary }}>
      <button className="aso-auth-close" type="button" onClick={onBack} aria-label="Close sign in"><X size={18}/></button>
      <div className="aso-auth-brand"><AiventraLogo light={dark}/></div>
      <h2 id="aso-auth-title" style={{ color: style.textPrimary }}>{mode === 'signin' ? 'Sign in to your workspace' : 'Create your workspace'}</h2>
      <p className="aso-auth-copy" style={{ color: style.textSecondary }}>{mode === 'signin' ? 'Access your live opportunities, follow-up queues, and client replies.' : 'Create an account to start organizing your outsourcing opportunities.'}</p>
      {!configReady && <p className="aso-auth-alert" role="status">Supabase setup is missing. Add the project URL and publishable key to <code>.env.local</code>, then restart Vite. Keep these values private.</p>}
      <form className="aso-auth-form" onSubmit={submit}>
        {mode === 'signup' && <label className="aso-auth-label aso-auth-name" style={{ color: style.textSecondary }}>Your name<div className="aso-auth-input"><input style={inputStyle} autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></div></label>}
        <label className="aso-auth-label" style={{ color: style.textSecondary }}>Work email<div className="aso-auth-input"><Mail size={17}/><input style={inputStyle} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></div></label>
        <label className="aso-auth-label" style={{ color: style.textSecondary }}>Password<div className="aso-auth-input"><Lock size={17}/><input style={inputStyle} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} /></div></label>
        {error && <p className="aso-auth-alert" role="alert">{error}</p>}
        {feedback && <p className="aso-auth-feedback" role="status">{feedback}</p>}
        <button className="aso-auth-submit" style={{ background: dark ? 'linear-gradient(110deg,#e83b9d,#8b5cf6)' : 'linear-gradient(110deg,#0869f6,#064bd7)' }} disabled={busy || !configReady}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in to Aiventra' : 'Create account'}<ArrowRight size={16}/></button>
      </form>
      <button className="aso-auth-switch" type="button" onClick={() => { setMode((current) => current === 'signin' ? 'signup' : 'signin'); onError(''); setFeedback('') }}>
        {mode === 'signin' ? 'New to Aiventra? Create an account' : 'Already have an account? Sign in'}
      </button>
      <div className="aso-auth-security"><ShieldCheck size={15}/><span>Secure access through Supabase authentication</span></div>
      <button className="aso-auth-back" type="button" onClick={onBack}>Back to the website</button>
    </section>
  </div>
}
function description(view: View) { if (view === "Research Sessions") return "Run supervised research in your visible local browser and review qualified opportunities."; return ({ Overview: 'A clear view of what the sourcing and outreach bot is doing.', Opportunities: 'Review captured posts, extracted details, match scores, and next actions.', Outreach: 'Prepare reviewed outreach drafts.', 'Social outreach': 'Prepare reviewed messages for social channel contacts.', Email: 'Import shared email contacts and prepare email campaigns.', Replies: 'Review replies and paused follow-up sequences.', Sequences: 'Configure the Day 1, Day 3, Day 7 follow-up timing.', Activity: 'See what the system did and whether each step succeeded.', Connections: 'Prepare source connectors, Make.com, Supabase, and email delivery.' })[view] }
function Overview({ opportunities, activity, onGo, onActivitySelect, onRun }: { opportunities: Opportunity[]; activity: LogItem[]; onGo: (view: View) => void; onActivitySelect: (item: LogItem) => void; onRun: () => void }) {
  const stats = [['Opportunities', String(opportunities.length), 'Captured for review', 'briefcase'], ['Need review', String(opportunities.filter((item) => item.status === 'New').length), 'No automatic sends', 'eye'], ['Email contacts', String(opportunities.filter((item) => item.email).length), 'Shared for contact', 'mail'], ['Activity events', String(activity.length), 'Recorded in preview', 'activity']]
  return <><div className="status-banner"><span className="banner-icon"><Icon name="shield"/></span><div><b>Supervised browser research runs only through your paired local companion</b><small>The local browser remains visible. The agent pauses for platform challenges and never sends social messages, comments, or posts.</small></div><button onClick={() => onGo('Connections')}>Review connections <Icon name="arrow"/></button></div><div className="metric-grid">{stats.map(([label, value, caption, icon], index) => <button className="metric-card" key={label} onClick={() => onGo(index < 2 ? 'Opportunities' : index === 2 ? 'Email' : 'Activity')}><span className={`metric-icon tone-${index}`}><Icon name={icon}/></span><span className="metric-label">{label}</span><b>{value}</b><small>{caption}</small></button>)}</div><div className="overview-grid"><section className="content-card workflow-card"><CardHeading title="Bot workflow" sub="Review opportunities before any outreach."/><div className="workflow-list">{[['01', 'Find matching posts', 'Sources checked against your search rules'], ['02', 'Extract and score', 'Capture post details and explain match quality'], ['03', 'Save and notify', 'Store the opportunity and show it in the review queue'], ['04', 'Prepare outreach', 'Separate social drafts from email campaigns'], ['05', 'Pause on replies', 'Replies pause follow-ups for human review']].map(([number, title, text], index) => <div className="workflow-step" key={number}><span className={`workflow-number ${index === 0 ? 'first' : ''}`}>{number}</span><div><b>{title}</b><small>{text}</small></div><span className="step-state">{index === 0 ? 'Not connected' : 'Waiting'}</span></div>)}</div><div className="workflow-actions"><button className="button primary" onClick={onRun}><Icon name="activity"/> Open research sessions</button></div></section><section className="content-card activity-preview"><CardHeading title="Latest activity" sub="System feedback" action={<button className="link-button" onClick={() => onGo('Activity')}>View all <Icon name="arrow"/></button>}/>{activity.length ? <ActivityList activity={activity.slice(0, 5)} onSelect={onActivitySelect}/> : <Empty icon="activity" title="No activity yet" text="When you save search rules or review opportunities, the bot will report each action here."/>}</section></div><section className="quick-links"><b>Set up your workspace</b><button onClick={() => onGo('Research Sessions')}>1. Define what to find <Icon name="arrow"/></button><button onClick={() => onGo('Connections')}>2. Prepare integrations <Icon name="arrow"/></button><button onClick={() => onGo('Sequences')}>3. Review follow-up timing <Icon name="arrow"/></button></section></>
}
function CardHeading({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) { return <div className="card-heading"><div><h2>{title}</h2><p>{sub}</p></div>{action}</div> }
function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Icon name={icon}/></span><h3>{title}</h3><p>{text}</p>{action}</div> }
function OpportunityCard({ item, score, band, breakdown, activityTarget, onOutreach, onReply, onViewDraft, onDelete }: { item: Opportunity; score: number; band: string; breakdown: ReturnType<typeof qualificationFor>; activityTarget: boolean; onOutreach: () => void; onReply: () => void; onViewDraft: () => void; onDelete: () => void }) { const canPrepare = item.status === 'New' || item.status === 'Review'; const pieces: [string, number, number, string][] = [['Service relevance', breakdown.service, 25, breakdown.reasons.service], ['Buying intent', breakdown.intent, 25, breakdown.reasons.intent], ['Problem clarity', breakdown.clarity, 20, breakdown.reasons.clarity], ['Budget fit', breakdown.budget, 15, breakdown.reasons.budget], ['Contact availability', breakdown.contact, 15, breakdown.reasons.contact]]; return <article id={`aso-opportunity-${item.id}`} className={`opportunity-card ${activityTarget ? 'activity-target' : ''}`}><div className="opp-main"><div className="opp-source"><span className="platform-badge">{item.source_platform || item.source}</span> <span>·</span> Added {item.created}{item.published_at && <> <span>·</span> Posted {formatDateTime(item.published_at)}</>}</div><h3>{item.title}</h3>{item.business_name && <p className="lead-business">{item.business_name}</p>}<p>{item.detail || 'No post details added yet.'}</p><div className="opp-meta"><span>{item.contact || 'Name not captured'}</span>{item.profile_url && <a href={item.profile_url} target="_blank" rel="noreferrer">Open public profile ↗</a>}{item.email && <span>{item.email}</span>}{item.phone && <span>{item.phone}</span>}{item.budget && <span>{item.budget}</span>}{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Open original post ↗</a>}</div>{(item.pain_point || item.service_needed || item.qualification_reason) && <div className="lead-signals">{item.pain_point && <span><b>Pain:</b> {item.pain_point} <em>{item.field_evidence.pain_point || 'unknown'}</em></span>}{item.service_needed && <span><b>Service:</b> {item.service_needed} <em>{item.field_evidence.service_needed || 'unknown'}</em></span>}<span><b>Intent:</b> {item.buying_intent} <em>{item.field_evidence.buying_intent || 'unknown'}</em></span>{item.qualification_reason && <span><b>AI assessment:</b> {item.qualification_reason}</span>}</div>}</div><div className="opp-score"><b>{score}</b><small>{band}</small></div><div className="qualification-breakdown">{pieces.map(([label, points, max, reason]) => <div className="qualification-item" key={label} title={reason}><div><span>{label}</span><b>{points}/{max}</b></div><small>{reason}</small><span className="qualification-track"><i style={{ width: `${points / max * 100}%` }}/></span></div>)}</div><div className="opp-bottom"><span className={`status-badge status-${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>{canPrepare ? <button className="button secondary small" onClick={onOutreach}>Prepare outreach →</button> : item.status === 'Draft ready' ? <button className="button secondary small" onClick={onViewDraft}>Open saved drafts →</button> : item.status === 'Contacted' ? <button className="button secondary small" onClick={onReply}>Record a reply</button> : <button className="button secondary small" onClick={onReply}>View reply status →</button>}<button className="button secondary small" onClick={onDelete}>Delete opportunity</button></div></article> }
function ActivityList({ activity, onSelect }: { activity: LogItem[]; onSelect: (item: LogItem) => void }) { return activity.length ? <div className="activity-list">{activity.map((item) => <button type="button" className="activity-row activity-row-action" key={item.id} onClick={() => onSelect(item)} title="Open related workspace area"><span className={`activity-mark ${item.kind}`}><Icon name={({ setup: 'settings', capture: 'briefcase', message: 'send', system: 'activity' })[item.kind]}/></span><span className="activity-text"><b>{item.title}</b><small>{item.detail}</small></span><time>{item.at}</time><span className="activity-open">Open →</span></button>)}</div> : <Empty icon="activity" title="No activity recorded" text="Actions and workflow outcomes will appear here."/> }
function IntegrationRow({ name, description: detail, status, statusLabel }: { name: string; description: string; status: string; statusLabel?: string }) { const label = statusLabel || ({ connected: 'Connected', checking: 'Checking', needs_setup: 'Needs setup', idle: 'Not connected', error: 'Check failed' }[status] || status); return <div className="integration-row"><span className="integration-mark"><Icon name={name.startsWith('Make') || name.includes('webhook') ? 'webhook' : name === 'Supabase' ? 'database' : name.includes('GMass') ? 'send' : 'mail'}/></span><span className="integration-copy"><b>{name}</b><small className="connection-note">{detail}</small></span><span className={`connection-status ${status}`}>{label}</span></div> }
function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="1.5"/></>, search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>, send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>, plug: <><path d="M12 22v-5M9 8V2M15 8V2M5 8h14v4a7 7 0 0 1-14 0z"/></>, shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, help: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.3 1.1-1.8 1.4-1.8 3.2M12 17.5h.01"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>, plus: <><path d="M12 5v14M5 12h14"/></>, check: <path d="m5 12 4 4L19 6"/>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>, mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>, settings: <><circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1a8 8 0 0 1-2 1l-.4 2h-4L10 18a8 8 0 0 1-2-1l-2 1-2-4 2-1a8 8 0 0 1 0-2l-2-1 2-4 2 1a8 8 0 0 1 2-1l.6-2h4L15 6a8 8 0 0 1 2 1l2-1 2 4-2 1a8 8 0 0 1 0 2Z"/></>,
    webhook: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2m-6.6 7.2 6.6 4.2"/></>, database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.globe}</svg>
}
export default App
