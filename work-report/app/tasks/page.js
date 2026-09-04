'use client'
import { useEffect, useState } from 'react'
import Guard from '../../components/Guard'
import { supabase } from '../../lib/supabase'
import { STATUSES, PRIORITIES, SERIES_NAMES, WORK_TYPES } from '../../lib/constants'
import { statusColor, priorityColor, displayStatus } from '../../lib/report/colors'

const BLANK = {
  title: '', series: '꼬마생각뒤집기', work_type: '꼬마시리즈 개발',
  priority: '중간', status: '진행', progress: '', deadline: '', is_misc: false,
}

export default function TasksPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(BLANK)
  const [editing, setEditing] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [showArchived])

  async function load() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('archived', showArchived)
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('created_at')
    setRows(data || [])
  }

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [k]: v })
  }

  function payload(f) {
    return {
      title: f.title.trim(),
      series: f.series || null,
      work_type: f.work_type || null,
      priority: f.priority,
      status: f.status,
      progress: f.progress === '' || f.progress === null ? null : Number(f.progress),
      deadline: f.deadline || null,
      is_misc: Boolean(f.is_misc),
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) return
    const { error: err } = editing
      ? await supabase.from('tasks').update(payload(form)).eq('id', editing)
      : await supabase.from('tasks').insert(payload(form))
    if (err) return setError(err.message)
    setForm(BLANK)
    setEditing(null)
    load()
  }

  function edit(r) {
    setEditing(r.id)
    setForm({
      title: r.title, series: r.series || '', work_type: r.work_type || '',
      priority: r.priority, status: r.status,
      progress: r.progress === null ? '' : r.progress,
      deadline: r.deadline || '', is_misc: r.is_misc,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function archive(r) {
    await supabase.from('tasks').update({ archived: !r.archived }).eq('id', r.id)
    load()
  }

  async function remove(r) {
    if (!confirm(`"${r.title}" 업무를 삭제할까요? 이 업무의 일일 기록도 함께 지워집니다.`)) return
    await supabase.from('tasks').delete().eq('id', r.id)
    load()
  }

  return (
    <Guard>
      <div className="page-head">
        <div>
          <h1 className="page-title">단위 업무</h1>
          <p className="muted">보고서에 들어가는 업무 목록입니다. 여기서 상태와 진행률을 관리합니다.</p>
        </div>
        <button className="btn ghost sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? '진행 중 목록 보기' : '보관함 보기'}
        </button>
      </div>

      {!showArchived && (
        <div className="card">
          <div className="card-head"><h3>{editing ? '업무 수정' : '업무 추가'}</h3></div>
          {error && <p className="notice error">{error}</p>}
          <form onSubmit={submit}>
            <div className="field">
              <label>업무명</label>
              <input value={form.title} onChange={set('title')} placeholder="예: 꼬마생각 샘플권 감수본 확인" required />
            </div>
            <div className="grid">
              <div className="field">
                <label>시리즈</label>
                <select value={form.series} onChange={set('series')}>
                  <option value="">선택 안 함</option>
                  {SERIES_NAMES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>업무 유형</label>
                <select value={form.work_type} onChange={set('work_type')}>
                  <option value="">선택 안 함</option>
                  {WORK_TYPES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>진행 상태</label>
                <select value={form.status} onChange={set('status')}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>우선순위</label>
                <select value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>진행률 (%) · 비우면 진행률 바에서 빠집니다</label>
                <input type="number" min="0" max="100" value={form.progress} onChange={set('progress')} />
              </div>
              <div className="field">
                <label>마감 시한 · 비우면 D-day를 표시하지 않습니다</label>
                <input type="date" value={form.deadline} onChange={set('deadline')} />
              </div>
            </div>
            <label className="row" style={{ margin: '4px 0 12px', fontSize: 13 }}>
              <input type="checkbox" checked={form.is_misc} onChange={set('is_misc')} style={{ width: 'auto' }} />
              <span>기타 사항으로 표시 (요약 카드 집계에서 제외)</span>
            </label>
            <div className="row">
              <button className="btn">{editing ? '수정 저장' : '추가'}</button>
              {editing && (
                <button type="button" className="btn ghost" onClick={() => { setEditing(null); setForm(BLANK) }}>
                  취소
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>{showArchived ? '보관함' : '업무 목록'}</h3>
          <span className="muted">{rows.length}건</span>
        </div>
        {rows.length === 0 && <p className="empty">업무가 없습니다.</p>}
        {rows.map((r) => (
          <div className="item" key={r.id}>
            <span className="item-title">{r.title}</span>
            {r.work_type && <span className="chip">{r.work_type}</span>}
            <span className="badge" style={{ background: statusColor(r.status) || '#888' }}>
              {displayStatus(r.status)}
            </span>
            <span className="badge" style={{ background: priorityColor(r.priority) }}>{r.priority}</span>
            <span className="chip">{r.progress === null ? '진행률 없음' : r.progress + '%'}</span>
            <span className="chip">{r.deadline || '마감 없음'}</span>
            {r.is_misc && <span className="chip">기타</span>}
            <span className="spacer" />
            <button className="btn ghost sm" onClick={() => edit(r)}>수정</button>
            <button className="btn ghost sm" onClick={() => archive(r)}>
              {r.archived ? '복구' : '보관'}
            </button>
            <button className="btn danger sm" onClick={() => remove(r)}>삭제</button>
          </div>
        ))}
      </div>
    </Guard>
  )
}
