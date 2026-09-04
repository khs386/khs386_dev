'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LINKS = [
  ['/', '오늘'],
  ['/tasks', '업무'],
  ['/daily', '일일 기록'],
  ['/weekly', '주간 현황'],
  ['/series', '시리즈'],
  ['/reports', '보고서'],
]

export default function NavBar() {
  const path = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''))
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="nav-logo">📋 업무보고서</span>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={path === href ? 'nav-link active' : 'nav-link'}>
            {label}
          </Link>
        ))}
        <span className="nav-right">
          <span className="nav-name">{email}</span>
          <button className="link-btn" onClick={logout}>로그아웃</button>
        </span>
      </div>
    </nav>
  )
}
