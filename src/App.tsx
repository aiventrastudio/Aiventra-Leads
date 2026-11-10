import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Lock, Mail, ShieldCheck, X } from 'lucide-react'
import LandingPage from './LandingPage'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useAiventraWorkspace } from './lib/useAiventraWorkspace'
import { AiventraLogo } from './newfolder-ui/components/AiventraLogo'
import { useThemeStyle } from './newfolder-ui/context/ThemeStyleContext'
import './auth.css'

type View = 'Overview' | 'Search setup' | 'Opportunities' | 'Outreach' | 'Social outreach' | 'Email' | 'Replies' | 'Sequences' | 'Activity' | 'Connections'
type Opportunity = { id: string; title: string; source: string; contact: string; email: string; detail: string; budget: string; status: 'New' | 'Review' | 'Draft ready' | 'Contacted' | 'Replied'; created: string; replied?: boolean }
type LogItem = { id: string; title: string; detail: string; at: string; kind: 'setup' | 'capture' | 'message' | 'system' }

const nav: { view: View; icon: string }[] = [
  { view: 'Overview', icon: 'dashboard' }, { view: 'Search setup', icon: 'search' }, { view: 'Opportunities', icon: 'briefcase' },
  { view: 'Social outreach', icon: 'send' }, { view: 'Email', icon: 'mail' }, { view: 'Replies', icon: 'activity' }, { view: 'Sequences', icon: 'clock' }, { view: 'Activity', icon: 'activity' }, { view: 'Connections', icon: 'plug' },
]
const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'Reddit', 'TikTok', 'Upwork', 'Other source']
const serviceOptions = ['Website development', 'App development', 'CRM', 'Automation', 'Design', 'Other']
const templates = {
  first: 'Hi {{name}}, I saw your post about {{project}}. We help with projects like this and can share a relevant example. Is this still something you need help with?\n\nBest,\n{{sender}}',
  day1: 'Hi {{name}}, just checking whether you are still looking for help with {{project}}. Happy to share a few ideas if useful.\n\n{{sender}}',
  day3: 'Hi {{name}}, I wanted to follow up with one thought about {{project}}: we could start by {{next_step}}. Would that be helpful?\n\n{{sender}}',
  day7: 'Hi {{name}}, one last note in case {{project}} is still on your list. If priorities have changed, no problem.\n\n{{sender}}',
}

function timeNow() { return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date()) }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function App() {
  let dashboardTheme = 'theme-nebula'
  try {
    if (localStorage.getItem('aiventra:saas-style') === 'aura-cyan') dashboardTheme = 'theme-aura-cyan'
  } catch {}
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
  const [sourcePrefs, setSourcePrefs] = useState<string[]>(platforms)
  const [savedSetup, setSavedSetup] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [loadedDataWorkspace, setLoadedDataWorkspace] = useState<string | null>(null)
  const [, setSaving] = useState(false)
  const [authFormError, setAuthFormError] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [subject, setSubject] = useState('A few ideas for your project')
  const [message, setMessage] = useState(templates.first)
  const [followups, setFollowups] = useState(true)
  const [approval, setApproval] = useState(true)
  const [toast, setToast] = useState('')
  const [sequenceDays, setSequenceDays] = useState([1, 3, 7])
  const [filter, setFilter] = useState('All')
  const [newLead, setNewLead] = useState({ title: '', source: 'Manual entry', contact: '', email: '', detail: '', budget: '' })

  useEffect(() => {
    if (!workspaceId || !user) {
      setOpportunities([]); setActivity([]); setSavedSetup(false); setLoadedDataWorkspace(null)
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
        id: row.id, title: row.title, source: row.source, contact: row.contact, email: row.email,
        detail: row.detail, budget: row.budget, status: row.status, created: formatDateTime(row.created_at), replied: row.replied,
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
        setSourcePrefs(search.source_preferences || [])
        setSavedSetup(true)
      } else setSavedSetup(false)
      if (sequenceResult.data) {
        setSequenceDays(sequenceResult.data.follow_up_days || [1, 3, 7])
        setFollowups(Boolean(sequenceResult.data.enabled))
      }
      setLoadedDataWorkspace(workspaceId)
    })().catch((cause: unknown) => {
      if (active) {
        setLoadedDataWorkspace(workspaceId)
        notify(cause instanceof Error ? `Could not load workspace data: ${cause.message}` : 'Could not load workspace data.')
      }
    }).finally(() => { if (active) setDataLoading(false) })
    return () => { active = false }
  }, [workspaceId, user?.id])

  const log = (title: string, detail: string, kind: LogItem['kind'] = 'system') => {
    const id = crypto.randomUUID()
    setActivity((current) => [{ id, title, detail, at: timeNow(), kind }, ...current])
    if (!workspaceId || !user) return
    void supabase.from('activity_events').insert({ id, workspace_id: workspaceId, title, detail, kind, created_by: user.id })
      .then(({ error }) => { if (error) notify(`Activity could not be saved: ${error.message}`) })
  }
  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast((current) => current === text ? '' : current), 2800) }
  const emailContacts = useMemo(() => opportunities.filter((item) => item.email), [opportunities])
  const filtered = opportunities.filter((item) => filter === 'All' || item.status === filter)
  const scores = (item: Opportunity) => Math.min(98, 44 + (item.email ? 18 : 0) + (item.budget ? 12 : 0) + (item.detail.length > 45 ? 12 : 0) + (services.some((service) => item.title.toLowerCase().includes(service.split(' ')[0].toLowerCase())) ? 12 : 0))

  async function recordReply(item: Opportunity) {
    if (!workspaceId || !user) return
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
    } finally { setSaving(false) }
  }

  async function returnReplyToReview(item: Opportunity) {
    if (!workspaceId) return
    setSaving(true)
    try {
      const update = await supabase.from('opportunities').update({ status: 'Review', replied: false }).eq('id', item.id).eq('workspace_id', workspaceId)
      if (update.error) throw update.error
      const review = await supabase.from('replies').update({ reviewed_at: new Date().toISOString() }).eq('opportunity_id', item.id).eq('workspace_id', workspaceId).is('reviewed_at', null)
      if (review.error) throw review.error
      setOpportunities((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Review', replied: false } : entry))
      log('Reply returned to review', item.title, 'message')
      notify('Opportunity returned to review.')
    } catch (cause) {
      notify(`Could not update reply status: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally { setSaving(false) }
  }

  async function saveSequenceSettings() {
    if (!workspaceId || !user) return
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
      notify('Sequence settings saved to Supabase. No follow-ups were scheduled.')
    } catch (cause) {
      notify(`Sequence settings were not saved: ${cause instanceof Error ? cause.message : 'unknown error'}`)
    } finally { setSaving(false) }
  }

  function saveSearch(event: FormEvent) {
    event.preventDefault()
    if (!workspaceId || !user) return
    setSaving(true)
    void Promise.resolve(supabase.from('search_settings').upsert({
      workspace_id: workspaceId,
      service_categories: services,
      keywords: query,
      excluded_phrases: excluded,
      minimum_budget: budget,
      source_preferences: sourcePrefs,
      monitoring_enabled: false,
      created_by: user.id,
    }, { onConflict: 'workspace_id' })).then(({ error }) => {
      if (error) { notify(`Search rules were not saved: ${error.message}`); return }
      setSavedSetup(true)
      log('Search criteria saved', `${services.length} service categories / ${sourcePrefs.length} selected sources`, 'setup')
      notify('Search rules saved to Supabase.')
    }).finally(() => setSaving(false))
    return
  }
  function startMonitoring() {
    if (!savedSetup) { notify('Save your search rules first.'); return }
    if (!sourcePrefs.length) { notify('Select at least one source first.'); return }
    log('Monitoring blocked', 'Preview only · source connectors are not connected, so no search or scraping started', 'system'); notify('Connect a source connector before monitoring can start.')
  }
  function saveOpportunity(event: FormEvent) {
    event.preventDefault()
    if (!workspaceId || !user) return
    setSaving(true)
    void Promise.resolve(supabase.from('opportunities').insert({ ...newLead, workspace_id: workspaceId, created_by: user.id, status: 'New' }).select('*').single()).then(({ data, error }) => {
      if (error) { notify(`Opportunity was not saved: ${error.message}`); return }
      const item: Opportunity = { id: data.id, title: data.title, source: data.source, contact: data.contact, email: data.email, detail: data.detail, budget: data.budget, status: data.status, created: formatDateTime(data.created_at), replied: data.replied }
      setOpportunities((current) => [item, ...current])
      setNewLead({ title: '', source: 'Manual entry', contact: '', email: '', detail: '', budget: '' })
      setShowLeadForm(false)
      log('Opportunity added', `${item.title} / ${item.source}`, 'capture')
      notify('Opportunity saved to Supabase.')
    }).finally(() => setSaving(false))
    return
  }
  function queueOutreach() {
    if (!selected.length) { notify('Select at least one contact'); return }
    if (!workspaceId || !user) return
    const targets = opportunities.filter((item) => selected.includes(item.id))
    const drafts = targets.map((item) => ({
      workspace_id: workspaceId,
      opportunity_id: item.id,
      channel: item.email ? 'email' : 'social',
      recipient_name: item.contact,
      recipient_email: item.email,
      recipient_handle: item.email ? '' : item.contact,
      subject: item.email ? subject : '',
      body: message.replace(/\{\{name\}\}/g, item.contact || 'there').replace(/\{\{project\}\}/g, item.title).replace(/\{\{sender\}\}/g, user.email || 'Aiventra Smart Outsourcing'),
      status: approval ? 'pending_review' : 'draft',
      requires_approval: approval,
      created_by: user.id,
    }))
    setSaving(true)
    void Promise.resolve(supabase.from('outreach_drafts').insert(drafts)).then(async ({ error }) => {
      if (error) { notify(`Drafts were not saved: ${error.message}`); return }
      const update = await supabase.from('opportunities').update({ status: 'Draft ready' }).in('id', selected).eq('workspace_id', workspaceId)
      if (update.error) { notify(`Drafts saved, but opportunity statuses could not update: ${update.error.message}`); return }
      setOpportunities((current) => current.map((item) => selected.includes(item.id) ? { ...item, status: 'Draft ready' } : item))
      log('Outreach drafts prepared', `${targets.length} draft(s) saved for review. Nothing was sent.`, 'message')
      notify('Drafts saved to Supabase. Nothing was sent.')
    }).finally(() => setSaving(false))
    return
  }
  function addTemplate(key: keyof typeof templates) { setMessage(templates[key]); notify(`${key === 'first' ? 'First message' : `Day ${key.slice(3)}`} template loaded`) }
  function connectPreview(platform: string) { notify(`${platform} connector is not configured yet. No account was accessed.`) }

  if (!authReady) return <AuthLoading theme={dashboardTheme} message="Checking your secure session…" />
  if (!session) return <LandingPage onGetStarted={() => { setAuthMode('signup'); setAuthFormError(''); setShowAuth(true) }} onSignIn={() => { setAuthMode('signin'); setAuthFormError(''); setShowAuth(true) }} authOverlay={showAuth ? <AuthScreen initialMode={authMode} configReady={supabaseConfigured} onBack={() => setShowAuth(false)} onSignIn={signIn} onSignUp={signUp} error={authFormError || workspaceError} onError={setAuthFormError} /> : null} />
  if (workspaceError && !workspaceId) return <AuthLoading theme={dashboardTheme} message={workspaceError} action={<button className="button secondary" onClick={() => void signOut()}>Sign out</button>} />
  if (workspaceLoading || !workspaceId || dataLoading || loadedDataWorkspace !== workspaceId) return <AuthLoading theme={dashboardTheme} message="Loading your Aiventra Smart Outsourcing workspace…" />

  return <div className={`shell ${dashboardTheme}`}>
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setView('Overview') }}><AiventraLogo iconOnly className="brand-symbol"/><span><b>Aiventra Smart Outsourcing</b><small>OUTSOURCING MANAGEMENT SYSTEM</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="navigation">{nav.map((item) => <button key={item.view} className={view === item.view ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.view)}><span className="nav-icon"><Icon name={item.icon}/></span>{item.view}{item.view === 'Opportunities' && opportunities.length > 0 && <span className="nav-count">{opportunities.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="bot-status"><Icon name="shield"/><div><b>Bot is in preview mode</b><small>Sources and Make.com not connected</small></div></div><div className="user-box"><div className="user-avatar">{(user?.email || 'A').slice(0, 1).toUpperCase()}</div><div><b>{user?.user_metadata?.full_name || user?.email || 'Workspace member'}</b><small>Signed in</small></div><button aria-label="Sign out" title="Sign out" onClick={() => void signOut().catch((error: Error) => notify(error.message))}><Icon name="more"/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="crumb">Aiventra Smart Outsourcing <span>/</span> <b>{view}</b></div><div className="top-actions"><span className="preview-label">SUPABASE DATA</span><button className="help-button" onClick={() => notify('Records are stored in your authenticated Supabase workspace. Source and delivery integrations remain in preview mode.')}><Icon name="help"/> Help</button></div></header>
      <section className="page-heading"><div><div className="eyebrow">OUTSOURCING MANAGEMENT SYSTEM</div><h1>{view === 'Overview' ? 'Opportunity operations' : view}</h1><p>{description(view)}</p></div>{(view === 'Opportunities' || view === 'Overview') && <button className="button primary" onClick={() => setShowLeadForm(true)}><span>＋</span> Add opportunity</button>}</section>

      {view === 'Overview' && <Overview opportunities={opportunities} activity={activity} onGo={setView} onAdd={() => setShowLeadForm(true)} onRun={() => { log('Workflow preview started', 'Demo only · no source scanned and no message sent', 'system'); notify('Preview event logged. No external action taken.') }} />}
      {view === 'Search setup' && <form className="content-card setup-form" onSubmit={saveSearch}><CardHeading title="Tell the bot what to find" sub="Saving search rules stores the criteria; monitoring requires connected sources."/><div className="form-section"><label className="field-label">Services you provide</label><div className="chip-grid">{serviceOptions.map((option) => <label key={option} className={services.includes(option) ? 'choice-chip selected' : 'choice-chip'}><input type="checkbox" checked={services.includes(option)} onChange={() => setServices((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])}/><span>{option}</span></label>)}</div></div><div className="field-grid"><label className="field-label">Keywords and phrases<textarea rows={3} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. need a website, looking for CRM help"/><small>Separate terms with commas. Include phrases people use when asking for help.</small></label><label className="field-label">Exclude phrases<textarea rows={3} value={excluded} onChange={(event) => setExcluded(event.target.value)} placeholder="e.g. internship, unpaid"/><small>Posts containing these terms can be filtered out.</small></label></div><div className="field-grid compact"><label className="field-label">Minimum project budget <span className="optional">Optional</span><input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="e.g. 500 USD"/></label><div className="field-label">Contact policy<div className="input-hint">Use contact details people shared for project inquiries. Review opportunities before outreach.</div></div></div><div className="form-section"><div className="section-label-row"><label className="field-label">Sources to prepare</label><span className="muted-inline">Connectors are configured separately</span></div><div className="source-checks">{platforms.map((platform) => <label className="source-check" key={platform}><input type="checkbox" checked={sourcePrefs.includes(platform)} onChange={() => setSourcePrefs((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform])}/><span className="platform-dot"><PlatformIcon platform={platform}/></span><span>{platform}</span></label>)}</div></div><div className="form-footer"><span>{savedSetup ? 'Saved in this browser preview' : 'Changes are not saved until you click save'}</span><button className="button secondary" type="button" onClick={startMonitoring}>Start monitoring</button><button className="button primary" type="submit"><Icon name="check"/> Save search rules</button></div></form>}
      {view === 'Opportunities' && <section className="content-card"><CardHeading title="Opportunity review queue" sub="Review captured posts, extracted details, and match scores before outreach." action={<div className="heading-actions"><select className="select-control" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>New</option><option>Review</option><option>Draft ready</option><option>Contacted</option><option>Replied</option></select><button className="button primary" onClick={() => setShowLeadForm(true)}><Icon name="plus"/> Add opportunity</button></div>}/>{filtered.length ? <div className="opportunity-list">{filtered.map((item) => <OpportunityCard key={item.id} item={item} score={scores(item)} onOutreach={() => { setSelected((current) => current.includes(item.id) ? current : [...current, item.id]); setView(item.email ? 'Email' : 'Social outreach') }} onReply={() => void recordReply(item)} />)}</div> : <Empty icon="briefcase" title="No opportunities yet" text="Add a post manually, or connect a permitted source to capture matching opportunities." action={<button className="button secondary" onClick={() => setShowLeadForm(true)}>Add opportunity manually</button>}/>}</section>}
      {view === 'Outreach' && <section className="outreach-grid"><div className="content-card"><CardHeading title="Recipients" sub="Only opportunities with a collected email are available."/><div className="recipient-rows">{emailContacts.length ? emailContacts.map((item) => <label className="recipient-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}/><span className="recipient-avatar">{item.contact ? item.contact[0].toUpperCase() : '?'}</span><span className="recipient-info"><b>{item.contact || 'Name not provided'}</b><small>{item.email}</small><small>{item.title}</small></span><span className="score-mini">{scores(item)}</span></label>) : <Empty icon="mail" title="No collected emails" text="Add an opportunity with a contact email shared for inquiries. We will not guess or enrich missing addresses."/>}</div></div><div className="content-card composer"><CardHeading title="Message composer" sub="Personalize each draft with opportunity details."/><div className="template-pills saved-templates"><span>Templates:</span><button onClick={() => addTemplate('first')}>First message</button><button onClick={() => addTemplate('day1')}>Day 1</button><button onClick={() => addTemplate('day3')}>Day 3</button><button onClick={() => addTemplate('day7')}>Day 7</button></div><label className="field-label">Email subject<input value={subject} onChange={(event) => setSubject(event.target.value)}/></label><label className="field-label">Message<textarea rows={8} value={message} onChange={(event) => setMessage(event.target.value)}/></label><div className="template-pills"><span>Insert field:</span>{['{{name}}', '{{project}}', '{{sender}}'].map((tag) => <button key={tag} onClick={() => setMessage((current) => `${current}\n${tag}`)}>{tag}</button>)}</div><label className="toggle-row"><input type="checkbox" checked={approval} onChange={(event) => setApproval(event.target.checked)}/><span><b>Require approval before send</b><small>{approval ? 'Messages stay in review until approved.' : 'Automatic sending requires a connected, authorized email provider.'}</small></span></label><label className="toggle-row"><input type="checkbox" checked={followups} onChange={(event) => setFollowups(event.target.checked)}/><span><b>Queue follow-ups</b><small>{followups ? `Day ${sequenceDays.join(' · Day ')}` : 'No follow-up messages'}</small></span></label><div className="route-note"><b>Delivery status</b><span>Not connected · Make.com webhook and email provider required</span></div><button className="button primary send-button" onClick={queueOutreach}>Prepare {approval ? 'drafts' : 'automation preview'} <span>→</span></button></div></section>}
      {(view === 'Email' || view === 'Social outreach') && <section className="content-card"><CardHeading title={view === 'Email' ? 'Email campaign' : 'Social outreach'} sub={view === 'Email' ? 'Select opportunities with an email shared for project contact.' : 'Select reviewed opportunities for channel appropriate drafts.'} action={<button className="button secondary" onClick={() => setView('Opportunities')}>Review opportunities</button>}/><div className="recipient-rows">{(view === 'Email' ? emailContacts : opportunities.filter((item) => item.source !== 'Manual entry' && item.contact)).length ? (view === 'Email' ? emailContacts : opportunities.filter((item) => item.source !== 'Manual entry' && item.contact)).map((item) => <label className="recipient-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}/><span className="recipient-avatar">{item.contact ? item.contact[0].toUpperCase() : '?'}</span><span className="recipient-info"><b>{item.contact || 'Name not provided'}</b><small>{view === 'Email' ? item.email : `${item.source} · ${item.contact}`}</small><small>{item.title}</small></span><span className="score-mini">{scores(item)}</span></label>) : <Empty icon="mail" title={view === 'Email' ? 'No email contacts to import' : 'No social contacts to review'} text={view === 'Email' ? 'Add opportunities with contact emails shared for inquiries.' : 'Add reviewed opportunities with public contact handles.'}/>}</div><div className="composer"><CardHeading title="Draft" sub="Prepare a personal message for the selected contacts."/>{view === 'Email' && <label className="field-label">Email subject<input value={subject} onChange={(event) => setSubject(event.target.value)}/></label>}<label className="field-label">Message<textarea rows={6} value={message} onChange={(event) => setMessage(event.target.value)}/></label><div className="template-pills"><span>Load template:</span>{(['first', 'day1', 'day3', 'day7'] as const).map((key) => <button type="button" key={key} onClick={() => addTemplate(key)}>{key === 'first' ? 'First message' : `Day ${key.slice(3)}`}</button>)}</div></div><div className="route-note"><b>Delivery status</b><span>Preview only · provider and social channel integrations are not connected. Messages require review.</span></div><button className="button primary" onClick={queueOutreach}>Prepare {selected.length || ''} selected draft(s)</button></section>}
      {view === 'Replies' && <section className="content-card"><CardHeading title="Replies" sub="Detected replies pause follow-ups and return the conversation for your review."/><div className="recipient-rows">{opportunities.filter((item) => item.replied || item.status === 'Replied').length ? opportunities.filter((item) => item.replied || item.status === 'Replied').map((item) => <div className="recipient-row" key={item.id}><span className="recipient-info"><b>{item.contact || 'Contact'} · {item.title}</b><small>Reply detected; scheduled follow-ups paused</small></span><button className="button secondary small" onClick={() => void returnReplyToReview(item)}>Return to review</button></div>) : <Empty icon="mail" title="No replies yet" text="Reply detection requires a connected email or channel integration. Replies will appear here and pause scheduled follow-ups."/>}</div></section>}
      {view === 'Sequences' && <section className="content-card sequence-card"><CardHeading title="Follow-up sequence" sub="Each delay starts after the first approved message. Replies pause follow-ups for review."/><div className="sequence-list">{sequenceDays.map((day, index) => <div className="sequence-row" key={index}><span className="sequence-index">0{index + 1}</span><div className="sequence-description"><b>Follow-up {index + 1}</b><small>{index === 0 ? 'Short check-in' : index === 1 ? 'Add a relevant idea or sample' : 'Polite close-out message'}</small></div><label>Send on day <input type="number" min={index ? sequenceDays[index - 1] + 1 : 1} max="30" value={day} onChange={(event) => setSequenceDays((current) => current.map((value, i) => i === index ? Number(event.target.value) : value))}/></label><span className="sequence-state">Configured</span></div>)}</div><div className="inline-warning">Sequence execution is not active until the backend scheduler and Make.com scenario are connected.</div><button className="button primary" onClick={() => void saveSequenceSettings()}>Save sequence settings</button></section>}
      {view === 'Activity' && <section className="content-card"><CardHeading title="Bot activity" sub="Feedback for each capture, score, draft, send, reply, and follow-up."/><ActivityList activity={activity}/></section>}
      {view === 'Connections' && <section className="connections-layout"><div className="content-card"><CardHeading title="Source connectors" sub="Choose sources to prepare. Each connector will need approved access and its own configuration."/><div className="connector-list">{platforms.map((platform) => <div className="connector-row" key={platform}><span className="platform-mark">{platform[0]}</span><span className="connector-copy"><b>{platform}</b><small>{sourcePrefs.includes(platform) ? 'Selected for setup' : 'Not selected'}</small></span><span className="not-connected">Not connected</span><button className="button secondary small" onClick={() => connectPreview(platform)}>Configure</button></div>)}</div><div className="inline-warning">The app is designed for pluggable connectors. A selected source is not an active integration.</div></div><div className="content-card make-card-full"><CardHeading title="Make.com & storage" sub="Workflow delivery and persistent records."/><IntegrationRow name="Make.com webhook" description="Send gig, approval, message, reply, and follow-up events to your scenario."/><IntegrationRow name="Supabase" description="Store search rules, opportunities, outreach drafts, replies, and activity." connected/><IntegrationRow name="Email provider" description="Deliver approved email and report delivery, bounce, reply, and opt-out events."/><div className="secure-note">Credentials belong in backend environment variables. Never paste webhook secrets into the browser.</div></div></section>}
    </main>
    {showLeadForm && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLeadForm(false) }}><form className="modal" onSubmit={saveOpportunity}><div className="modal-header"><div><h2>Add opportunity</h2><p>Manual intake for a public post you are allowed to use.</p></div><button type="button" className="icon-close" onClick={() => setShowLeadForm(false)}>×</button></div><label className="field-label">Project or post title<input required value={newLead.title} onChange={(event) => setNewLead({ ...newLead, title: event.target.value })} placeholder="What help are they looking for?"/></label><div className="field-grid"><label className="field-label">Source<select value={newLead.source} onChange={(event) => setNewLead({ ...newLead, source: event.target.value })}>{['Manual entry', ...platforms].map((source) => <option key={source}>{source}</option>)}</select></label><label className="field-label">Budget<input value={newLead.budget} onChange={(event) => setNewLead({ ...newLead, budget: event.target.value })} placeholder="Optional"/></label><label className="field-label">Name or handle<input value={newLead.contact} onChange={(event) => setNewLead({ ...newLead, contact: event.target.value })} placeholder="As shown on the post"/></label><label className="field-label">Email shared for contact<input type="email" value={newLead.email} onChange={(event) => setNewLead({ ...newLead, email: event.target.value })} placeholder="Optional"/></label></div><label className="field-label">Post details<textarea rows={4} value={newLead.detail} onChange={(event) => setNewLead({ ...newLead, detail: event.target.value })} placeholder="Paste the relevant post text or summary"/></label><div className="modal-footer"><button className="button secondary" type="button" onClick={() => setShowLeadForm(false)}>Cancel</button><button className="button primary" type="submit">Save for review</button></div></form></div>}
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
function description(view: View) { return ({ Overview: 'A clear view of what the sourcing and outreach bot is doing.', 'Search setup': 'Define services, phrases, and sources. Saving rules does not start monitoring.', Opportunities: 'Review captured posts, extracted details, match scores, and next actions.', Outreach: 'Prepare reviewed outreach drafts.', 'Social outreach': 'Prepare reviewed messages for social channel contacts.', Email: 'Import shared email contacts and prepare email campaigns.', Replies: 'Review replies and paused follow-up sequences.', Sequences: 'Configure the Day 1, Day 3, Day 7 follow-up timing.', Activity: 'See what the system did and whether each step succeeded.', Connections: 'Prepare source connectors, Make.com, Supabase, and email delivery.' })[view] }
function Overview({ opportunities, activity, onGo, onAdd, onRun }: { opportunities: Opportunity[]; activity: LogItem[]; onGo: (view: View) => void; onAdd: () => void; onRun: () => void }) {
  const stats = [['Opportunities', String(opportunities.length), 'Captured for review', 'briefcase'], ['Need review', String(opportunities.filter((item) => item.status === 'New').length), 'No automatic sends', 'eye'], ['Email contacts', String(opportunities.filter((item) => item.email).length), 'Shared for contact', 'mail'], ['Activity events', String(activity.length), 'Recorded in preview', 'activity']]
  return <><div className="status-banner"><span className="banner-icon"><Icon name="shield"/></span><div><b>Preview mode — nothing is being scraped or sent</b><small>Saving search rules only stores settings. Connect authorized sources and services before monitoring or outreach can run.</small></div><button onClick={() => onGo('Connections')}>Review connections <Icon name="arrow"/></button></div><div className="metric-grid">{stats.map(([label, value, caption, icon], index) => <button className="metric-card" key={label} onClick={() => onGo(index < 2 ? 'Opportunities' : index === 2 ? 'Email' : 'Activity')}><span className={`metric-icon tone-${index}`}><Icon name={icon}/></span><span className="metric-label">{label}</span><b>{value}</b><small>{caption}</small></button>)}</div><div className="overview-grid"><section className="content-card workflow-card"><CardHeading title="Bot workflow" sub="Review opportunities before any outreach."/><div className="workflow-list">{[['01', 'Find matching posts', 'Sources checked against your search rules'], ['02', 'Extract and score', 'Capture post details and explain match quality'], ['03', 'Save and notify', 'Store the opportunity and show it in the review queue'], ['04', 'Prepare outreach', 'Separate social drafts from email campaigns'], ['05', 'Pause on replies', 'Replies pause follow-ups for human review']].map(([number, title, text], index) => <div className="workflow-step" key={number}><span className={`workflow-number ${index === 0 ? 'first' : ''}`}>{number}</span><div><b>{title}</b><small>{text}</small></div><span className="step-state">{index === 0 ? 'Not connected' : 'Waiting'}</span></div>)}</div><div className="workflow-actions"><button className="button secondary" onClick={onAdd}><Icon name="plus"/> Add a test opportunity</button><button className="button primary" onClick={onRun}><Icon name="activity"/> Preview activity</button></div></section><section className="content-card activity-preview"><CardHeading title="Latest activity" sub="System feedback" action={<button className="link-button" onClick={() => onGo('Activity')}>View all <Icon name="arrow"/></button>}/>{activity.length ? <ActivityList activity={activity.slice(0, 5)}/> : <Empty icon="activity" title="No activity yet" text="When you save search rules or review opportunities, the bot will report each action here."/>}</section></div><section className="quick-links"><b>Set up your workspace</b><button onClick={() => onGo('Search setup')}>1. Define what to find <Icon name="arrow"/></button><button onClick={() => onGo('Connections')}>2. Prepare integrations <Icon name="arrow"/></button><button onClick={() => onGo('Sequences')}>3. Review follow-up timing <Icon name="arrow"/></button></section></>
}
function CardHeading({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) { return <div className="card-heading"><div><h2>{title}</h2><p>{sub}</p></div>{action}</div> }
function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Icon name={icon}/></span><h3>{title}</h3><p>{text}</p>{action}</div> }
function OpportunityCard({ item, score, onOutreach, onReply }: { item: Opportunity; score: number; onOutreach: () => void; onReply: () => void }) { return <article className="opportunity-card"><div className="opp-main"><div className="opp-source">{item.source} <span>·</span> Added {item.created}</div><h3>{item.title}</h3><p>{item.detail || 'No post details added yet.'}</p><div className="opp-meta"><span>{item.contact || 'Name not captured'}</span><span>{item.email || 'No email shared'}</span>{item.budget && <span>{item.budget}</span>}</div></div><div className="opp-score"><b>{score}</b><small>match</small></div><div className="opp-bottom"><span className={`status-badge status-${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span><span className="score-reason">Score uses service match, detail, budget, and contact availability.</span><button className="button secondary small" onClick={onOutreach}>Prepare outreach →</button>{item.status === 'Contacted' && <button className="button secondary small" onClick={onReply}>Record reply</button>}</div></article> }
function ActivityList({ activity }: { activity: LogItem[] }) { return activity.length ? <div className="activity-list">{activity.map((item) => <div className="activity-row" key={item.id}><span className={`activity-mark ${item.kind}`}><Icon name={({ setup: 'settings', capture: 'briefcase', message: 'send', system: 'activity' })[item.kind]}/></span><span className="activity-text"><b>{item.title}</b><small>{item.detail}</small></span><time>{item.at}</time></div>)}</div> : <Empty icon="activity" title="No activity recorded" text="Actions and workflow outcomes will appear here."/> }
function IntegrationRow({ name, description: detail, connected = false }: { name: string; description: string; connected?: boolean }) { return <div className="integration-row"><span className="integration-mark"><Icon name={name.startsWith('Make') ? 'webhook' : name === 'Supabase' ? 'database' : 'mail'}/></span><span><b>{name}</b><small>{detail}</small></span><span className={connected ? 'connected' : 'not-connected'}>{connected ? 'Connected' : 'Not connected'}</span></div> }
function PlatformIcon({ platform }: { platform: string }) {
  const value = platform.toLowerCase()
  if (value === 'facebook') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4C17.3 1.2 16.1 1 15 1c-3.3 0-5.5 2-5.5 5.7V9H6v4h3.5v8H14Z" fill="currentColor"/></svg>
  if (value === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>
  if (value === 'linkedin') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.5A2.5 2.5 0 1 0 5 3.5a2.5 2.5 0 0 0 0 5ZM3 10h4v11H3zM10 10h3.8v1.5h.1a4.2 4.2 0 0 1 3.8-2c4.1 0 4.9 2.6 4.9 6V21h-4v-4.9c0-1.2 0-2.8-1.8-2.8s-2.1 1.3-2.1 2.7V21h-4z" fill="currentColor"/></svg>
  if (value === 'x') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.9 5.8 22H2.7l7.3-8.4L2.2 2h6.5l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.7 3.9H5.9z" fill="currentColor"/></svg>
  if (value === 'reddit') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="m9 14 1.4 1.2a2.5 2.5 0 0 0 3.2 0L15 14M9 10h.1M15 10h.1M12 5l1-3 4 1"/><circle cx="18" cy="4" r="1" fill="currentColor"/></svg>
  if (value === 'tiktok') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.2a4.2 4.2 0 1 1-3.1-4.1M14 3c.6 3.2 2.5 5.1 5.5 5.5"/></svg>
  if (value === 'upwork') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4c1.6 3.4 2.6 6.5 2.6 9.3 0 3.3-1.5 5.2-3.8 5.2-1.6 0-2.7-1.1-2.7-2.8 0-2.7 2.3-4.7 5.8-4.7 4.3 0 6.1 3.1 9 3.1 2.1 0 3.7-1.5 3.7-3.6 0-2-1.3-3.3-3.2-3.3-2.7 0-4.3 3.4-5.8 8.1"/></svg>
  return <Icon name="globe"/>
}
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
