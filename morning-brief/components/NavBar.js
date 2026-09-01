'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const LINKS = [
  ['/', '오늘'],
  ['/tasks', '업무'],
  ['/briefs', '브리프'],
]

export default function NavBar() {
  const path = usePathname()
  const router = useRouter()
  const [name, setName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('profiles')
        .select('name')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: p }) => setName(p?.name || data.user.email.split('@')[0]))
    })
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="nav-logo">☀️ 모닝브리프</span>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? 'nav-link active' : 'nav-link'}>
            {label}
          </Link>
        ))}
        <span className="nav-right">
          <span className="nav-name">{name}</span>
          <button className="link-btn" onClick={logout}>
            로그아웃
          </button>
        </span>
      </div>
    </nav>
  )
}
