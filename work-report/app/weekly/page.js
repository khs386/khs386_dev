'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Guard from '../../components/Guard'
import { supabase } from '../../lib/supabase'
import { STATUSES, WORK_TYPES, todayKST } from '../../lib/constants'
import { weekStart, koreanWeek, dday } from '../../lib/report/format'

const KINDS = ['전주 실적', '금주 예정']

export default function WeeklyPage() {
  const [date, setDate] = useState(todayKST())
  const [items, setItems] = useState([])
  const [tasks, setTasks] = useState([])
  const [pick, setPick] = useState({ '전주 실적': '', '금주 예정': '' })
  const [message, setMessage] = useState('')
  const ws = weekStart(date)

  const load = useCallback(async () => {
    const [{ data: i }, { data: t }] = await Promise.all([
      supabase.from('weekly_items').select('*').eq('week_start', ws).order('sort_order'),
      supabase.from('tasks').select('*').eq('archived', false).order('created_at'),
    ])
    setItems(i || [])
    setTasks(t || [])
  }, [ws])

  useEffect(() => { load() }, [load])

  const byKind = (k) => items.filter((i) => i.kind === k)

  async function addFromTask(kind) {
    const id = pick[kind]
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    await supabase.from('weekly_items').insert({
      week_start: ws, kind, task_id: t.id, title: t.title, work_type: t.work_type,
      status: kind === '전주 실적' ? t.status : null,
      progress: kind === '전주 실적' ? t.progress : null,
      due_date: t.deadline, note: '', output: '', sort_order: byKind(kind).length,
    })
    setPick({ ...pick, [kind]: '' })
    load()
  }

  async function addFree(kind) {
    const title = prompt('업무명을 입력하세요')
    if (!title || !title.trim()) return
    await supabase.from('weekly_items').insert({
      week_start: ws, kind, task_id: null, title: title.trim(),
      work_type: '꼬마시리즈 개발',
      status: kind === '전주 실적' ? '진행' : null,
      progress: null, due_date: null, note: '', output: '',
      sort_order: byKind(kind).length,
    })
    load()
  }

  function patch(id, changes) {
    setItems(items.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  async function save(item) {
    setMessage('')
    const { error } = await supabase.from('weekly_items').update({
      title: item.title,
      work_type: item.work_type || null,
      status: item.status || null,
      progress: item.progress === '' || item.progress === null ? null : Number(item.progress),
      due_date: item.due_date || null,
      note: item.note || '',
      output: item.output || '',
    }).eq('id', item.id)
    if (error) return setMessage('저장 실패: ' + error.message)
    setMessage(`"${item.title}" 저장했습니다.`)
    load()
  }

  async function remove(item) {
    if (!confirm(`"${item.title}" 항목을 뺄까요?`)) return
    await supabase.from('weekly_items').delete().eq('id', item.id)
    load()
  }

  /** 지난 주 '금주 예정'을 이번 주 '전주 실적'으로 옮겨 온다. */
  async function carryOver() {
    const prevWeek = new Date(`${ws}T00:00:00Z`)
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7)
    const prevWs = prevWeek.toISOString().slice(0, 10)
    const { data } = await supabase
      .from('weekly_items').select('*').eq('week_start', prevWs).eq('kind', '금주 예정')
    if (!data || data.length === 0) return setMessage('지난 주 금주 예정 항목이 없습니다.')
    const base = byKind('전주 실적').length
    await supabase.from('weekly_items').insert(
      data.map((d, n) => ({
        week_start: ws, kind: '전주 실적', task_id: d.task_id, title: d.title,
        work_type: d.work_type, status: '진행', progress: d.progress,
        due_date: d.due_date, note: '', output: '', sort_order: base + n,
      }))
    )
    setMessage(`지난 주 예정 ${data.length}건을 전주 실적으로 가져왔습니다.`)
    load()
  }

  return (
    <Guard>
      <div className="page-head">
        <div>
          <h1 className="page-title">주간 현황</h1>
          <p className="muted">{koreanWeek(date)} · 주 시작 {ws}</p>
        </div>
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
          <Link className="btn" href={`/reports?kind=weekly&date=${date}`}>보고서 만들기</Link>
        </div>
      </div>

      {message && <p className="notice">{message}</p>}

      {KINDS.map((kind) => (
        <div key={kind}>
          <div className="card">
            <div className="card-head">
              <h3>{kind}</h3>
              <div className="row">
                <span className="muted">{byKind(kind).length}건</span>
                {kind === '전주 실적' && (
                  <button className="btn ghost sm" onClick={carryOver}>지난 주 예정 가져오기</button>
                )}
              </div>
            </div>
            <div className="row">
              <select
                className="grow" value={pick[kind]}
                onChange={(e) => setPick({ ...pick, [kind]: e.target.value })}
              >
                <option value="">업무 목록에서 고르기…</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <button className="btn" onClick={() => addFromTask(kind)} disabled={!pick[kind]}>추가</button>
              <button className="btn ghost" onClick={() => addFree(kind)}>직접 입력</button>
            </div>
          </div>

          {byKind(kind).map((item) => (
            <div className="card" key={item.id}>
              <div className="card-head">
                <input
                  value={item.title} onChange={(e) => patch(item.id, { title: e.target.value })}
                  style={{ fontWeight: 600, maxWidth: 420 }}
                />
                <div className="row">
                  {item.due_date && <span className="chip">D-{dday(item.due_date, date)}</span>}
                  <button className="btn danger sm" onClick={() => remove(item)}>빼기</button>
                </div>
              </div>
              <div className="grid">
                <div className="field">
                  <label>업무 유형</label>
                  <select value={item.work_type || ''} onChange={(e) => patch(item.id, { work_type: e.target.value })}>
                    <option value="">선택 안 함</option>
                    {WORK_TYPES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {kind === '전주 실적' && (
                  <>
                    <div className="field">
                      <label>진행 상태</label>
                      <select value={item.status || ''} onChange={(e) => patch(item.id, { status: e.target.value })}>
                        <option value="">선택 안 함</option>
                        {[...STATUSES, '종결'].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>진행률 (%)</label>
                      <input
                        type="number" min="0" max="100"
                        value={item.progress === null ? '' : item.progress}
                        onChange={(e) => patch(item.id, { progress: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div className="field">
                  <label>종결 예정일</label>
                  <input
                    type="date" value={item.due_date || ''}
                    onChange={(e) => patch(item.id, { due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid">
                {kind === '전주 실적' && (
                  <div className="field">
                    <label>산출물</label>
                    <input value={item.output || ''} onChange={(e) => patch(item.id, { output: e.target.value })} />
                  </div>
                )}
                <div className="field">
                  <label>비고</label>
                  <input value={item.note || ''} onChange={(e) => patch(item.id, { note: e.target.value })} />
                </div>
              </div>
              <button className="btn" onClick={() => save(item)}>저장</button>
            </div>
          ))}
          {byKind(kind).length === 0 && <p className="empty">{kind} 항목이 없습니다.</p>}
        </div>
      ))}
    </Guard>
  )
}
