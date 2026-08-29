'use client'
import { useCallback, useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import TaskItem from '../../components/TaskItem'
import { useSession } from '../../lib/useSession'
import { supabase } from '../../lib/supabase'
import { PRIORITY_LABEL, myTaskFilter } from '../../lib/tasks'

const TABS = [
  ['open', '미완료'],
  ['done', '완료'],
  ['all', '전체'],
]

export default function TasksPage() {
  const session = useSession()
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [tab, setTab] = useState('open')
  const [mineOnly, setMineOnly] = useState(false)
  const [form, setForm] = useState({ title: '', due_date: '', priority: 2, assignee_id: '' })
  const uid = session?.user?.id

  const load = useCallback(async () => {
    if (!uid) return
    let query = supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: true })
    if (tab === 'open') query = query.neq('status', 'done')
    if (tab === 'done') query = query.eq('status', 'done')
    if (mineOnly) query = query.or(myTaskFilter(uid))
    const [taskRes, profileRes] = await Promise.all([
      query,
      supabase.from('profiles').select('user_id, name').order('name'),
    ])
    setTasks(taskRes.data || [])
    setProfiles(profileRes.data || [])
  }, [uid, tab, mineOnly])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (uid && !form.assignee_id) setForm((f) => ({ ...f, assignee_id: uid }))
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTask(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const { error } = await supabase.from('tasks').insert({
      title: form.title.trim(),
      due_date: form.due_date || null,
      priority: Number(form.priority),
      assignee_id: form.assignee_id || null,
    })
    if (error) alert('추가 실패: ' + error.message)
    else {
      setForm({ ...form, title: '', due_date: '' })
      load()
    }
  }

  if (!session) return <p className="center-note">확인 중…</p>

  return (
    <>
      <NavBar />
      <main className="container">
        <h2 className="page-title">업무</h2>

        <section className="card">
          <form onSubmit={addTask} className="task-add">
            <input
              placeholder="새 업무 제목"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {[1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
            <select
              value={form.assignee_id}
              onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
            >
              <option value="">담당자 없음</option>
              {profiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn">추가</button>
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <div className="tabs">
              {TABS.map(([v, label]) => (
                <button
                  key={v}
                  className={tab === v ? 'tab active' : 'tab'}
                  onClick={() => setTab(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
              />
              내 업무만
            </label>
          </div>
          {tasks.length === 0 ? (
            <p className="muted">표시할 업무가 없습니다.</p>
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
