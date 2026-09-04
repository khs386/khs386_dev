'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

/** 로그인 세션을 반환한다. 미로그인이면 /login으로 보낸다. undefined는 확인 중. */
export function useSession() {
  const [session, setSession] = useState(undefined)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session === null) router.replace('/login')
  }, [session, router])

  return session
}
