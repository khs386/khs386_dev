'use client'
import { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import BriefCard from '../../components/BriefCard'
import { useSession } from '../../lib/useSession'
import { supabase } from '../../lib/supabase'
import { formatKorean } from '../../lib/date'

export default function BriefsPage() {
  const session = useSession()
  const [briefs, setBriefs] = useState(null)
  const uid = session?.user?.id

  useEffect(() => {
    if (!uid) return
    supabase
      .from('briefs')
      .select('*')
      .eq('user_id', uid)
      .order('brief_date', { ascending: false })
      .limit(30)
      .then(({ data }) => setBriefs(data || []))
  }, [uid])

  if (!session) return <p className="center-note">확인 중…</p>

  return (
    <>
      <NavBar />
      <main className="container">
        <h2 className="page-title">브리프 아카이브</h2>
        {briefs === null ? (
          <p className="muted">불러오는 중…</p>
        ) : briefs.length === 0 ? (
          <p className="muted">아직 생성된 브리프가 없습니다. 홈에서 첫 브리프를 만들어 보세요.</p>
        ) : (
          briefs.map((b, i) => (
            <details key={b.id} className="card brief-archive" open={i === 0}>
              <summary>☀️ {formatKorean(b.brief_date)}</summary>
              <BriefCard content={b.content} />
            </details>
          ))
        )}
      </main>
    </>
  )
}
