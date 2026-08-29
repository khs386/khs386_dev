'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

// 로그인 세션을 반환한다. 미로그인 시 /login으로 보낸다.
// 첫 로그인이면 profiles 행을 자동 생성한다 (가입 시 입력한 이름 사용).
export function useSession() {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session === null) {
      router.replace('/login')
      return
    }
    if (!session) return
    supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          const name =
            session.user.user_metadata?.name || session.user.email.split('@')[0]
          supabase.from('profiles').insert({ user_id: session.user.id, name }).then(() => {})
        }
      })
  }, [session, router])

  return session
}
