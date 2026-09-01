'use client'
import { useCallback, useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import BriefCard from '../components/BriefCard'
import TaskItem from '../components/TaskItem'
import { useSession } from '../lib/useSession'
import { supabase } from '../lib/supabase'
import { generateBrief } from '../lib/brief'
import { ymd, formatKorean } from '../lib/date'
import { myTaskFilter } from '../lib/tasks'

export default function HomePage() {
  const session = useSession()
  const [brief, setBrief] = useState(null)
  const [briefLoaded, setBriefLoaded] = useState(false)
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const today = ymd()
  const uid = session?.user?.id

  const load = useCallback(async () => {
    if (!uid) return
    const [briefRes, taskRes, profileRes] = await Promise.all([
      supabase.from('briefs').select('*').eq('brief_date', today).eq('user_id', uid).maybeSingle(),
      supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .or(myTaskFilter(uid))
        .lte('due_date', today)
        .order('due_date', { ascending: true }),
      supabase.from('profiles').select('user_id, name').order('name'),
    ])
    setBrief(briefRes.data)
    setBriefLoaded(true)
    setTasks(taskRes.data || [])
    setProfiles(profileRes.data || [])
  }, [uid, today])

  useEffect(() => {
    load()
  }, [load])

  async function makeBrief() {
    setBusy(true)
    try {
      const b = await generateBrief(uid)
      setBrief(b)
      load()
    } catch (err) {
      alert('브리프 생성 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  async function quickAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const { error } = await supabase.from('tasks').insert({
      title: newTitle.trim(),
      due_date: today,
      assignee_id: uid,
    })
    if (error) alert('추가 실패: ' + error.message)
    else {
      setNewTitle('')
      load()
    }
  }

  if (!session) return <p className="center-note">확인 중…</p>

  return (
    <>
      <NavBar />
      <main className="container">
        <h2 className="page-title">{formatKorean(today)}</h2>

        <section className="card">
          <div className="card-head">
            <h3>☀️ 오늘의 브리프</h3>
            <button className="btn btn-sm" onClick={makeBrief} disabled={busy}>
              {busy ? '생성 중…' : brief ? '다시 생성' : '브리프 생성'}
            </button>
          </div>
          {!briefLoaded ? (
            <p className="muted">불러오는 중…</p>
          ) : brief ? (
            <BriefCard content={brief.content} />
          ) : (
            <p className="muted">
              아직 오늘의 브리프가 없습니다. 버튼을 눌러 생성해 보세요.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>📋 오늘 할 일</h3>
          </div>
          <form onSubmit={quickAdd} className="quick-add">
            <input
              placeholder="+ 오늘 할 일 추가 (Enter)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </form>
          {tasks.length === 0 ? (
            <p className="muted">오늘 마감이거나 지연된 업무가 없습니다.</p>
          ) : (
            <ul className="task-list">
              {tasks.map((t) => (
                <TaskItem key={t.id} task={t} profiles={profiles} onChanged={load} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
