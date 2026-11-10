import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Mail, Send, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Draft = {
  id: string
  opportunity_id: string | null
  recipient_name: string
  recipient_email: string
  subject: string
  body: string
  status: 'pending_review' | 'approved' | 'queued' | 'sent' | 'failed' | 'cancelled' | 'draft'
  error_detail: string | null
  gmass_campaign_id: number | null
  gmass_campaign_status: string | null
  created_at: string
}

export function GmassDraftQueue({ workspaceId, refreshKey, focusOpportunityId, onNotify, onLog }: {
  workspaceId: string
  refreshKey: number
  focusOpportunityId: string | null
  onNotify: (message: string) => void
  onLog: (title: string, detail: string, kind?: 'setup' | 'capture' | 'message' | 'system') => void
}) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [bulkSending, setBulkSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const notifyRef = useRef(onNotify)
  useEffect(() => { notifyRef.current = onNotify }, [onNotify])

  const loadDrafts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('outreach_drafts')
      .select('id, opportunity_id, recipient_name, recipient_email, subject, body, status, error_detail, gmass_campaign_id, gmass_campaign_status, created_at')
      .eq('workspace_id', workspaceId)
      .eq('channel', 'email')
      .in('status', ['pending_review', 'approved', 'queued', 'sent', 'failed'])
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) notifyRef.current(`Email drafts could not be loaded: ${error.message}`)
    else setDrafts((data || []) as Draft[])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { void loadDrafts() }, [loadDrafts, refreshKey])
  useEffect(() => {
    if (!focusOpportunityId) return
    document.querySelector(`[data-opportunity-id="${focusOpportunityId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusOpportunityId, drafts])

  async function deleteDraft(draft: Draft) {
    if (!['pending_review', 'approved', 'failed'].includes(draft.status)) return
    if (!window.confirm(`Delete the unsent draft for ${draft.recipient_email}? This cannot be undone.`)) return
    setDeletingId(draft.id)
    const { data, error } = await supabase.from('outreach_drafts').delete()
      .eq('id', draft.id).eq('workspace_id', workspaceId)
      .in('status', ['pending_review', 'approved', 'failed']).select('id').maybeSingle()
    if (error) onNotify(`Draft could not be deleted: ${error.message}`)
    else if (!data) onNotify('Draft was not deleted because its status changed. Refresh the queue.')
    else {
      onLog('Email draft deleted', `${draft.recipient_email} · ${draft.subject}`, 'message')
      onNotify('Unsent email draft deleted.')
      setDrafts((current) => current.filter((item) => item.id !== draft.id))
    }
    setDeletingId(null)
  }

  async function approveAndSend(draft: Draft): Promise<boolean> {
    if (sendingId && !bulkSending) return false
    setSendingId(draft.id)
    try {
      if (draft.status === 'pending_review') {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Your sign-in expired. Sign in again before approving this email.')
        const { data, error } = await supabase.from('outreach_drafts')
          .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
          .eq('id', draft.id)
          .eq('workspace_id', workspaceId)
          .eq('status', 'pending_review')
          .select('id')
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('This draft was already changed. Refresh the queue and review its current status.')
      }

      const { data, error } = await supabase.functions.invoke('gmass-send', { body: { draft_id: draft.id } })
      if (error) {
        let message = typeof data?.error === 'string' ? data.error : ''
        const context = (error as Error & { context?: unknown }).context
        if (!message && context instanceof Response) {
          const responseBody = await context.clone().json().catch(() => null) as { error?: string } | null
          message = responseBody?.error || ''
        }
        message ||= error.message
        throw new Error(message)
      }
      if (!data?.ok) throw new Error(data?.error || 'GMass did not confirm this campaign.')
      onLog('Email submitted to GMass', `${draft.opportunity_id || ''} · ${draft.recipient_email} · campaign ${data.campaign_id ?? 'processing'}`, 'message')
      onNotify('GMass accepted the approved email campaign.')
      await loadDrafts()
      return true
    } catch (cause) {
      onNotify(cause instanceof Error ? cause.message : 'Could not send this draft through GMass.')
      await loadDrafts()
      return false
    } finally {
      setSendingId(null)
    }
  }

  async function approveAndSendPending() {
    const pending = drafts.filter((draft) => draft.status === 'pending_review')
    if (!pending.length || bulkSending || sendingId) return
    setBulkSending(true)
    let sent = 0
    try {
      for (const draft of pending) {
        const ok = await approveAndSend(draft)
        if (!ok) {
          onNotify(`Bulk send paused after ${sent} campaign(s). Review the failed item and resume when ready.`)
          return
        }
        sent += 1
      }
      onNotify(`Submitted ${sent} approved recipient campaign(s) to GMass.`)
    } finally {
      setBulkSending(false)
      await loadDrafts()
    }
  }

  return <section className="content-card gmass-draft-queue">
    <div className="card-heading"><div><h2>Email approval queue</h2><p>Review each personalized message. Approval submits it to your GMass account.</p></div><div className="heading-actions"><button className="button secondary small" onClick={() => void loadDrafts()} disabled={loading || bulkSending}>Refresh</button>{drafts.some((draft) => draft.status === 'pending_review') && <button className="button primary small" onClick={() => void approveAndSendPending()} disabled={loading || bulkSending || Boolean(sendingId)}>{bulkSending ? 'Sending approved queue…' : `Approve & send ${drafts.filter((draft) => draft.status === 'pending_review').length} pending`}</button>}</div></div>
    {loading ? <p className="muted-inline">Loading email drafts…</p> : drafts.length ? <div className="recipient-rows">
      {drafts.map((draft) => <article data-opportunity-id={draft.opportunity_id || undefined} className={`recipient-row gmass-draft-row ${focusOpportunityId === draft.opportunity_id ? 'activity-target' : ''}`} key={draft.id}>
        <span className="recipient-avatar"><Mail size={16}/></span>
        <div className="recipient-info"><b>{draft.recipient_name || 'Contact'} · {draft.subject}</b><small>{draft.recipient_email}</small><small className="gmass-message-preview">{draft.body}</small>{draft.error_detail && <small className="gmass-error">{draft.error_detail}</small>}</div>
        <span className={`connection-status ${draft.status === 'sent' ? 'connected' : draft.status === 'failed' ? 'error' : 'needs_setup'}`}>{draft.status === 'sent' ? 'Submitted' : draft.status.replace('_', ' ')}</span>
        {(draft.status === 'pending_review' || draft.status === 'approved') && <button className="button primary small" disabled={Boolean(sendingId) || bulkSending} onClick={() => void approveAndSend(draft)}>{sendingId === draft.id ? 'Sending…' : <><Check size={14}/><Send size={14}/>{draft.status === 'pending_review' ? 'Approve & send' : 'Send approved draft'}</>}</button>}
        {['pending_review', 'approved', 'failed'].includes(draft.status) && <button className="button secondary small draft-delete" disabled={Boolean(sendingId) || bulkSending || Boolean(deletingId)} title="Delete unsent draft" onClick={() => void deleteDraft(draft)}>{deletingId === draft.id ? 'Deleting…' : <><Trash2 size={14}/>Delete</>}</button>}
        {draft.gmass_campaign_status && <small>GMass: {draft.gmass_campaign_status}</small>}
        {draft.status === 'sent' && draft.gmass_campaign_id && <small>Campaign #{draft.gmass_campaign_id}</small>}
      </article>)}
    </div> : <div className="empty-state"><span className="empty-icon"><Mail size={20}/></span><h3>No email drafts awaiting review</h3><p>Prepare an email draft above; it will appear here before anything is sent.</p></div>}
    <p className="secure-note">Bulk approval sends personalized campaigns sequentially, one recipient per campaign. GMass/Gmail quotas still apply. The queue shows up to 100 recent drafts; repeat after refreshing for older drafts.</p>
  </section>
}
