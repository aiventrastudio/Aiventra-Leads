import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') return cause.message
  return fallback
}

export function useAiventraWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthReady(true)
      return
    }
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setAuthReady(true)
      setError('')
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthReady(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const user = session?.user
    if (!authReady || !user) {
      setWorkspaceId(null)
      setWorkspaceLoading(false)
      return
    }

    setWorkspaceLoading(true)
    setError('')
    void (async () => {
      const membership = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (membership.error) throw membership.error

      let id = membership.data?.workspace_id as string | undefined
      if (!id) {
        const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'My'
        const created = await supabase.rpc('open_my_workspace', { workspace_name: `${displayName} Workspace` })
        if (created.error) throw created.error
        id = created.data
      }

      if (active && id) setWorkspaceId(id)
    })().catch((cause: unknown) => {
      if (active) setError(errorMessage(cause, 'Could not open your workspace.'))
    }).finally(() => {
      if (active) setWorkspaceLoading(false)
    })

    return () => { active = false }
  }, [authReady, session?.user.id])

  async function signIn(email: string, password: string) {
    if (!supabaseConfigured) throw new Error('Supabase is not configured yet. Add the project URL and publishable key to .env.local, then restart the dev server.')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
  }

  async function signInWithGoogle() {
    if (!supabaseConfigured) throw new Error('Supabase is not configured yet. Add the project URL and publishable key to .env.local, then restart the dev server.')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (oauthError) throw oauthError
  }

  async function signUp(email: string, password: string, name: string) {
    if (!supabaseConfigured) throw new Error('Supabase is not configured yet. Add the project URL and publishable key to .env.local, then restart the dev server.')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      },
    })
    if (signUpError) throw signUpError
    return Boolean(data.session)
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw signOutError
  }

  return { session, authReady, workspaceId, workspaceLoading, error, setError, signIn, signInWithGoogle, signUp, signOut }
}
