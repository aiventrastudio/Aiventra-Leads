import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Bot, Pause, Play, Square, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Platform = 'Reddit' | 'X' | 'Facebook' | 'LinkedIn' | 'Instagram' | 'TikTok' | 'YouTube'
type SessionRow = {
  id: string; platform: Platform; queries: string[]; max_posts: number; max_minutes: number; minimum_score: number
  status: 'queued' | 'running' | 'paused' | 'needs_user' | 'completed' | 'stopped'; control_mode: 'agent' | 'user'
  started_at: string | null; ended_at: string | null; created_at: string; posts_seen: number; opportunities_added: number
  sign_in_confirmed: boolean
}
type EventRow = { id: string; event_at: string; type: string; message: string }
const platforms: Platform[] = ['Reddit', 'X', 'Facebook', 'LinkedIn', 'Instagram', 'TikTok', 'YouTube']
const serviceOptions = ['Website development', 'App development', 'CRM', 'Automation', 'Design', 'Other']
const hostedAgentUrl = import.meta.env.VITE_RESEARCH_AGENT_URL?.trim()
const researchAgentBase = (hostedAgentUrl || 'http://127.0.0.1:3210').replace(/\/$/, '')
const hostedAgent = Boolean(hostedAgentUrl)
const time = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function ResearchSessions({ workspaceId, userId, searchRules, onNotify }: {
  workspaceId: string; userId: string; searchRules: {
    services: string[]; setServices: (value: string[]) => void
    query: string; setQuery: (value: string) => void
    excluded: string; setExcluded: (value: string) => void
    budget: string; setBudget: (value: string) => void
    voice: string; setVoice: (value: string) => void
    scoreThresholds: number[]; setScoreThresholds: (value: number[]) => void
    save: () => Promise<boolean>
  }; onNotify: (message: string) => void
}) {
  const [platform, setPlatform] = useState<Platform>('Reddit')
  const [minimumScore, setMinimumScore] = useState(60)
  const [pairCode, setPairCode] = useState('')
  const [agentState, setAgentState] = useState<'checking' | 'offline' | 'unpaired' | 'connected'>('checking')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = sessions.find((item) => item.id === selectedId) || sessions[0]
  const queryList = useMemo(() => searchRules.query.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), [searchRules.query])

  const checkAgent = useCallback(async () => {
    try {
      const response = await fetch(`${researchAgentBase}/health`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      const result = await response.json()
      setAgentState(result.paired ? 'connected' : 'unpaired')
    } catch { setAgentState('offline') }
  }, [])

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase.from('agent_sessions').select('*')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20)
    if (error) { onNotify(`Research sessions could not be loaded: ${error.message}`); return }
    const rows = (data || []) as SessionRow[]
    setSessions(rows)
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id || '')
  }, [workspaceId, onNotify])

  useEffect(() => {
    void checkAgent(); void loadSessions()
    const agentTimer = window.setInterval(() => void checkAgent(), 5000)
    const sessionTimer = window.setInterval(() => void loadSessions(), 3000)
    return () => { window.clearInterval(agentTimer); window.clearInterval(sessionTimer) }
  }, [checkAgent, loadSessions])
  useEffect(() => {
    if (!selected?.id) { setEvents([]); return }
    let alive = true
    const loadEvents = async () => {
      const { data, error } = await supabase.from('agent_events').select('id, event_at, type, message')
        .eq('session_id', selected.id).order('event_at', { ascending: false }).limit(100)
      if (!alive) return
      if (error) onNotify(`Session events could not be loaded: ${error.message}`)
      else setEvents((data || []) as EventRow[])
    }
    void loadEvents()
    const timer = window.setInterval(() => void loadEvents(), 2500)
    return () => { alive = false; window.clearInterval(timer) }
  }, [selected?.id, onNotify])

  async function pairAgent() {
    if (!pairCode.trim()) { onNotify(`Enter the one-time pairing code ${hostedAgent ? 'shown in the hosted worker logs' : 'shown in the local agent terminal'}.`); return }
    setBusy(true)
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) throw new Error('Sign in to Aiventra before pairing the local companion.')
      const response = await fetch(`${researchAgentBase}/pair`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pairCode.trim()}` },
        body: JSON.stringify({
          supabase_url: import.meta.env.VITE_SUPABASE_URL,
          anon_key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          access_token: session.access_token, refresh_token: session.refresh_token, workspace_id: workspaceId,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pairing failed.')
      setPairCode(''); setAgentState('connected'); onNotify(`${hostedAgent ? 'Hosted' : 'Local'} research agent paired. Its refresh token stays in process memory.`)
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'Could not pair the local companion.')
    } finally { setBusy(false) }
  }

  async function startSession() {
    if (agentState !== 'connected') { onNotify(`Start and pair the ${hostedAgent ? 'hosted research worker' : 'local research companion'} first.`); return }
    if (!queryList.length) { onNotify('Enter at least one search query.'); return }
    setBusy(true)
    const rulesSaved = await searchRules.save()
    if (!rulesSaved) { setBusy(false); return }
    const { data, error } = await supabase.from('agent_sessions').insert({
      workspace_id: workspaceId, platform, queries: queryList,
      max_posts: 0, max_minutes: 0,
      minimum_score: minimumScore, voice_instructions: searchRules.voice.trim(), status: 'queued', created_by: userId,
    }).select('*').single()
    if (error) onNotify(`Research session could not be queued: ${error.message}`)
    else {
      setSessions((current) => [data as SessionRow, ...current]); setSelectedId(data.id)
      onNotify(`Queued ${platform} research. The ${hostedAgent ? 'hosted' : 'local'} visible browser will open shortly.`)
      void supabase.from('activity_events').insert({ workspace_id: workspaceId, title: 'Browser research queued', detail: `${platform} · ${queryList.length} query(s) · unlimited posts and duration`, kind: 'setup', created_by: userId })
    }
    setBusy(false)
  }

  async function control(action: 'pause' | 'takeover' | 'resume' | 'stop') {
    if (!selected) return
    setBusy(true)
    const values = action === 'pause' ? { status: 'paused', control_mode: 'agent' }
      : action === 'takeover' ? { status: 'paused', control_mode: 'user' }
        : action === 'resume' ? { status: 'running', control_mode: 'agent' }
          : { status: 'stopped', control_mode: 'user', ended_at: new Date().toISOString() }
    const { error } = await supabase.from('agent_sessions').update(values).eq('id', selected.id).eq('workspace_id', workspaceId)
    if (error) onNotify(`Could not ${action} session: ${error.message}`)
    else {
      const message = action === 'takeover' ? 'User took over the visible browser. Agent controls are paused.' : `Session ${action === 'resume' ? 'resumed' : `${action}d`}.`
      await supabase.from('agent_events').insert({ session_id: selected.id, type: action === 'pause' || action === 'takeover' ? 'paused' : 'status', message })
      onNotify(action === 'takeover' ? 'Agent stopped touching the page. The browser is yours until you resume.' : `Session ${action === 'resume' ? 'resumed' : `${action}d`}.`)
      void loadSessions()
    }
    setBusy(false)
  }

  async function openHostedBrowser() {
    if (!selected || !hostedAgent) return
    const viewer = window.open('about:blank', '_blank')
    if (!viewer) { onNotify('Allow pop-ups for Aiventra to open the supervised browser viewer.'); return }
    viewer.opener = null
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) throw new Error('Sign in to Aiventra to open the browser viewer.')
      const response = await fetch(`${researchAgentBase}/viewer-token?session_id=${encodeURIComponent(selected.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not open the hosted browser viewer.')
      const params = new URLSearchParams({ autoconnect: 'true', resize: 'remote', path: `websockify?token=${result.token}` })
      viewer.location.href = `${researchAgentBase}/vnc.html?${params.toString()}`
    } catch (cause) {
      viewer.close()
      onNotify(cause instanceof Error ? cause.message : 'Could not open the hosted browser viewer.')
    }
  }

  return <div className="research-layout">
    <section className="content-card research-config">
      <div className="card-heading"><div><h2>Research setup</h2><p>Set what to find and choose a platform. Starting a session saves the latest rules.</p></div></div>
      <div className="research-body">
        <div className="form-section research-rules-section"><label className="field-label">Services you provide</label><div className="chip-grid">{serviceOptions.map((option) => <label key={option} className={searchRules.services.includes(option) ? 'choice-chip selected' : 'choice-chip'}><input type="checkbox" checked={searchRules.services.includes(option)} onChange={() => searchRules.setServices(searchRules.services.includes(option) ? searchRules.services.filter((item) => item !== option) : [...searchRules.services, option])}/><span>{option}</span></label>)}</div></div>
        <label className="field-label">Keywords and phrases<textarea rows={3} value={searchRules.query} onChange={(event) => searchRules.setQuery(event.target.value)} placeholder="e.g. need a website, looking for CRM help"/><small>Separate terms with commas or new lines. Each becomes a browser search.</small></label>
        <div className="field-grid research-fields"><label className="field-label">Platform<select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}>{platforms.map((item) => <option key={item}>{item}</option>)}</select><small>No session, post-count, or duration caps.</small></label><label className="field-label">Minimum match score<input type="number" min="1" max="100" value={minimumScore} onChange={(event) => setMinimumScore(Math.max(1, Math.min(100, Number(event.target.value))))}/></label></div>
        <details className="research-advanced"><summary>Advanced qualification settings</summary><div className="research-advanced-body"><label className="field-label">Exclude phrases<textarea rows={2} value={searchRules.excluded} onChange={(event) => searchRules.setExcluded(event.target.value)} placeholder="e.g. internship, unpaid"/><small>Posts with these phrases are excluded from qualification.</small></label><div className="field-grid research-rule-grid"><label className="field-label">Minimum project budget <span className="optional">Optional</span><input value={searchRules.budget} onChange={(event) => searchRules.setBudget(event.target.value)} placeholder="e.g. 500 USD"/><small>Used as a budget-fit signal when a post states an amount.</small></label><label className="field-label">Reply draft voice <span className="optional">Optional</span><textarea rows={2} value={searchRules.voice} onChange={(event) => searchRules.setVoice(event.target.value)} placeholder="Warm, professional, concise, and specific"/><small>Used only to create drafts for your review.</small></label></div><div className="score-band-settings research-score-settings"><div><b>Lead score bands</b><small>Explainable bands for the 100-point match score.</small></div><div className="score-band-inputs">{['Excellent', 'Strong', 'Potential', 'Research'].map((label, index) => <label key={label}>{label} from<input aria-label={`${label} match threshold`} type="number" min="1" max="100" value={searchRules.scoreThresholds[index] ?? ''} onChange={(event) => searchRules.setScoreThresholds(searchRules.scoreThresholds.map((value, i) => i === index ? Number(event.target.value) : value))}/></label>)}</div></div><p className="research-contact-note">Contact details are recorded only when publicly shared for business inquiries. The agent does not guess or enrich contact information.</p></div></details>
        <div className="agent-connect-box">
          <div><b>{hostedAgent ? 'Hosted browser agent' : 'Local companion'}</b><small>{agentState === 'connected' ? 'Connected and paired to this workspace' : agentState === 'unpaired' ? 'Running; pair it to your workspace' : agentState === 'offline' ? `Not connected · ${hostedAgent ? 'check the hosted worker' : 'start it on this computer'}` : 'Checking browser agent…'}</small></div>
          <span className={`connection-status ${agentState === 'connected' ? 'connected' : agentState === 'checking' ? 'checking' : 'needs_setup'}`}>{agentState === 'connected' ? 'Connected' : agentState === 'checking' ? 'Checking' : 'Not connected'}</span>
        </div>
        {agentState !== 'connected' && <div className="pair-agent"><label className="field-label">One-time pairing code<input value={pairCode} onChange={(event) => setPairCode(event.target.value)} placeholder={hostedAgent ? 'Paste the code from the hosted worker logs' : 'Paste the code printed by npm start'} autoComplete="off"/></label><button className="button secondary" disabled={busy || agentState === 'offline'} onClick={() => void pairAgent()}>Pair {hostedAgent ? 'hosted agent' : 'local companion'}</button><small>{hostedAgent ? 'The worker runs in your cloud account. Sign into each platform in its supervised remote browser.' : <>Run the setup steps in <b>local-agent/README.md</b>. The browser password is never shared with Aiventra.</>}</small></div>}
        <div className="research-safety"><Activity size={16}/><span>{hostedAgent ? 'Research runs in a supervised remote browser. Sign in there when prompted. The browser profile is discarded when the session ends.' : 'Research stays in the visible browser.'} The agent pauses for sign-in challenges, CAPTCHAs, unusual activity, or rate limits. It never submits messages, comments, or posts.</span></div>
        <button className="button primary" disabled={busy || agentState !== 'connected' || !queryList.length} onClick={() => void startSession()}><Bot size={16}/> Start research session</button>
      </div>
    </section>
    <section className="content-card session-live">
      <div className="card-heading"><div><h2>Live session</h2><p>Updates automatically from the {hostedAgent ? 'hosted browser worker' : 'local companion'}</p></div></div>
      {selected ? <>
        <div className="live-session-overview"><div><b>{selected.platform} research</b><small>{selected.queries.join(' · ')}</small></div><span className={`connection-status ${selected.status === 'running' ? 'connected' : selected.status === 'needs_user' ? 'error' : selected.status === 'queued' ? 'checking' : 'idle'}`}>{selected.control_mode === 'user' && selected.status === 'paused' ? 'Take over' : selected.status.replace('_', ' ')}</span></div>
        <div className="session-metrics"><div><small>Posts seen</small><b>{selected.posts_seen}</b></div><div><small>Opportunities</small><b>{selected.opportunities_added}</b></div><div><small>Signed in</small><b>{selected.sign_in_confirmed ? 'Confirmed' : 'Not yet'}</b></div></div>
        <div className="session-actions">
          {hostedAgent && ['running', 'paused', 'needs_user'].includes(selected.status) && <button className="button secondary small" disabled={busy} onClick={() => void openHostedBrowser()}><UserRound size={14}/> Open browser</button>}
          {selected.status === 'running' && <><button className="button secondary small" disabled={busy} onClick={() => void control('pause')}><Pause size={14}/> Pause</button><button className="button secondary small" disabled={busy} onClick={() => void control('takeover')}><UserRound size={14}/> Take over</button></>}
          {(selected.status === 'paused' || selected.status === 'needs_user') && <button className="button primary small" disabled={busy} onClick={() => void control('resume')}><Play size={14}/> Resume agent</button>}
          {['queued', 'running', 'paused', 'needs_user'].includes(selected.status) && <button className="button secondary small" disabled={busy} onClick={() => void control('stop')}><Square size={13}/> Stop</button>}
        </div>
        {selected.status === 'needs_user' && <div className="inline-warning">The agent has stopped interacting with the site. Resolve the issue in the visible browser, then choose Resume agent.</div>}
        {selected.status === 'paused' && selected.control_mode === 'user' && <div className="inline-warning">Take over is active. The agent will not touch the page until you resume it.</div>}
        <div className="agent-event-list">{events.length ? events.map((event) => <article key={event.id}><span className={`event-type event-${event.type}`}>{event.type.replace('_', ' ')}</span><span>{event.message}</span><time>{time(event.event_at)}</time></article>) : <div className="empty-state"><Activity size={20}/><h3>No session events yet</h3><p>Start a session to see browser activity here.</p></div>}</div>
      </> : <div className="empty-state"><Bot size={22}/><h3>No research sessions</h3><p>Pair the local companion and start your first supervised session.</p></div>}
      {sessions.length > 1 && <label className="field-label session-history">Recent sessions<select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>{sessions.map((item) => <option key={item.id} value={item.id}>{item.platform} · {item.status} · {time(item.created_at)}</option>)}</select></label>}
    </section>
  </div>
}

export function AgentConnectionCards({ workspaceId, onRefresh }: { workspaceId: string; onRefresh: number }) {
  const [paired, setPaired] = useState(false)
  const [lastSessions, setLastSessions] = useState<SessionRow[]>([])
  useEffect(() => {
    let active = true
    const refresh = async () => {
      const health = await fetch(`${researchAgentBase}/health`, { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then((response) => response.json()).catch(() => null)
      const { data } = await supabase.from('agent_sessions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20)
      if (!active) return
      setPaired(Boolean(health?.paired));
      const all = (data || []) as SessionRow[]
      setLastSessions(platforms.map((platform) => all.find((row) => row.platform === platform)).filter(Boolean) as SessionRow[])
    }
    void refresh(); const timer = window.setInterval(() => void refresh(), 8000)
    return () => { active = false; window.clearInterval(timer) }
  }, [workspaceId, onRefresh])
  return <section className="content-card agent-connection-card"><div className="card-heading"><div><h2>{hostedAgent ? 'Hosted browser research' : 'Local browser research'}</h2><p>Platform sign-in is checked in the {hostedAgent ? 'supervised remote' : 'local visible'} browser during a session.</p></div><span className={`connection-status ${paired ? 'connected' : 'needs_setup'}`}>{paired ? 'Agent connected' : 'Agent not connected'}</span></div><div className="agent-platform-list">{platforms.map((platform) => {
    const last = lastSessions.find((item) => item.platform === platform)
    return <div className="agent-platform-row" key={platform}><span className="platform-mark">{platform[0]}</span><div><b>{platform}</b><small>{last?.sign_in_confirmed ? `Signed in · last confirmed ${last.started_at ? time(last.started_at) : 'during session'}` : 'Sign-in not confirmed yet'}{last ? ` · Last session ${last.status}` : ' · No session yet'}</small></div><span className={`connection-status ${last?.sign_in_confirmed ? 'connected' : 'idle'}`}>{last?.sign_in_confirmed ? 'Signed in' : 'Not checked'}</span></div>
  })}</div></section>
}
