import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, MessageCircle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type SocialDraft = {
  id: string
  opportunity_id: string | null
  recipient_name: string
  recipient_handle: string
  body: string
  source_url?: string
  status: string
  created_at: string
}

export function SocialDraftQueue({ workspaceId, refreshKey, focusOpportunityId, onNotify, onLog }: {
  workspaceId: string
  refreshKey: number
  focusOpportunityId: string | null
  onNotify: (message: string) => void
  onLog: (title: string, detail: string, kind?: 'setup' | 'capture' | 'message' | 'system') => void
}) {
  const [drafts, setDrafts] = useState<SocialDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const notifyRef = useRef(onNotify)
  const logRef = useRef(onLog)
  useEffect(() => { notifyRef.current = onNotify; logRef.current = onLog }, [onNotify, onLog])

  const loadDrafts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('outreach_drafts')
      .select('id, opportunity_id, recipient_name, recipient_handle, body, status, created_at')
      .eq('workspace_id', workspaceId).eq('channel', 'social')
      .in('status', ['pending_review', 'approved', 'draft', 'failed'])
      .order('created_at', { ascending: false }).limit(100)
    if (error) notifyRef.current(`Social drafts could not be loaded: ${error.message}`)
    else {
      const drafts = (data || []) as SocialDraft[]
      const ids = drafts.map((draft) => draft.opportunity_id).filter((id): id is string => Boolean(id))
      const opportunities = ids.length ? await supabase.from('opportunities').select('id, source_url').eq('workspace_id', workspaceId).in('id', ids) : { data: [], error: null }
      if (opportunities.error) notifyRef.current(`Source links could not be loaded: ${opportunities.error.message}`)
      const sourceById = new Map((opportunities.data || []).map((item) => [item.id, item.source_url || '']))
      setDrafts(drafts.map((draft) => ({ ...draft, source_url: draft.opportunity_id ? sourceById.get(draft.opportunity_id) : '' })))
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { void loadDrafts() }, [loadDrafts, refreshKey])
  useEffect(() => {
    if (!focusOpportunityId) return
    document.querySelector(`[data-opportunity-id="${focusOpportunityId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusOpportunityId, drafts])

  async function copyDraft(draft: SocialDraft) {
    try {
      await navigator.clipboard.writeText(draft.body)
      notifyRef.current('Social message copied. Paste it into the appropriate social platform.')
    } catch {
      notifyRef.current('Could not access the clipboard. Select and copy the message text manually.')
    }
  }

  async function deleteDraft(draft: SocialDraft) {
    if (!window.confirm(`Delete this unsent social draft for ${draft.recipient_name || draft.recipient_handle || 'this contact'}?`)) return
    setBusyId(draft.id)
    const { data, error } = await supabase.from('outreach_drafts').delete()
      .eq('id', draft.id).eq('workspace_id', workspaceId)
      .in('status', ['pending_review', 'approved', 'draft', 'failed']).select('id').maybeSingle()
    if (error) notifyRef.current(`Social draft could not be deleted: ${error.message}`)
    else if (!data) notifyRef.current('Draft was not deleted because its status changed. Refresh the list.')
    else {
      setDrafts((current) => current.filter((item) => item.id !== draft.id))
      logRef.current('Social draft deleted', `${draft.opportunity_id || ''} · ${draft.recipient_name || draft.recipient_handle || 'Contact'} · unsent`, 'message')
      notifyRef.current('Unsent social draft deleted.')
    }
    setBusyId(null)
  }

  return <section className="content-card social-draft-queue">
    <div className="card-heading"><div><h2>Social message drafts</h2><p>Copy these into the social platform yourself. They stay out of the email queue and GMass.</p></div><button className="button secondary small" onClick={() => void loadDrafts()} disabled={loading || Boolean(busyId)}>Refresh</button></div>
    {loading ? <p className="muted-inline">Loading social drafts…</p> : drafts.length ? <div className="recipient-rows">
      {drafts.map((draft) => <article data-opportunity-id={draft.opportunity_id || undefined} className={`recipient-row social-draft-row ${focusOpportunityId === draft.opportunity_id ? 'activity-target' : ''}`} key={draft.id}>
        <span className="recipient-avatar"><MessageCircle size={16}/></span>
        <div className="recipient-info"><b>{draft.recipient_name || 'Contact'}{draft.recipient_handle ? ` · ${draft.recipient_handle}` : ''}</b><small>{draft.status === 'draft' ? 'Draft' : 'Ready for review'} · {new Date(draft.created_at).toLocaleString()}</small><small className="gmass-message-preview">{draft.body}</small></div>
        {draft.source_url && <a className="button secondary small" href={draft.source_url} target="_blank" rel="noreferrer">Open post</a>}
        <button className="button secondary small" disabled={Boolean(busyId)} onClick={() => void copyDraft(draft)}><Copy size={14}/> Copy</button>
        <button className="button secondary small draft-delete" disabled={Boolean(busyId)} onClick={() => void deleteDraft(draft)}>{busyId === draft.id ? 'Deleting…' : <><Trash2 size={14}/>Delete</>}</button>
      </article>)}
    </div> : <div className="empty-state"><span className="empty-icon"><MessageCircle size={20}/></span><h3>No social drafts yet</h3><p>Prepare a reviewed message above. It will remain here until you copy or delete it.</p></div>}
  </section>
}
