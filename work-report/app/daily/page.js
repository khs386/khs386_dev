'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Guard from '../../components/Guard'
import { supabase } from '../../lib/supabase'
import { STATUSES, PRIORITIES, todayKST } from '../../lib/constants'
import { isSkipDay } from '../../lib/reportData'
import { koreanDate, dday } from '../../lib/report/format'

export default function DailyPage() {
  const [date, setDate] = useState(todayKST())
  const [logs, setLogs] = useState([])
  const [tasks, setTasks] = useState([])
  const [pick, setPick] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [{ data: l }, { data: t }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('log_date', date).order('sort_order'),
      supabase.from('tasks').select('*').eq('archived', false).order('created_at'),
    ])
    setLogs(l || [])
    setTasks(t || [])
  }, [date])

  useEffect(() => { load() }, [load])

  const used = new Set(logs.map((l) => l.task_id).filter(Boolean))
  const available = tasks.filter((t) => !used.has(t.id))
  const skip = isSkipDay(date, null)

  async function addFromTask() {
    if (!pick) return
    const t = tasks.find((x) => x.id === pick)
    if (!t) return
    await supabase.from('daily_logs').insert({
      log_date: date, task_id: t.id, title: t.title, detail_lines: [],
      status: t.status, priority: t.priority, progress: t.progress,
      deadline: t.deadline, is_misc: t.is_misc, sort_order: logs.length,
    })
    setPick('')
    load()
  }

  async function addFree() {
    const title = prompt('업무명을 입력하세요 (업무 목록에 없는 단발성 기록)')
    if (!title || !title.trim()) return
    await supabase.from('daily_logs').insert({
      log_date: date, task_id: null, title: title.trim(), detail_lines: [],
      status: '진행', priority: '중간', progress: null, deadline: null,
      is_misc: title.trim() === '기타 사항', sort_order: logs.length,
    })
    load()
  }

  function patch(id, changes) {
    setLogs(logs.map((l) => (l.id === id ? { ...l, ...changes } : l)))
  }

  /** 기록을 저장하고, 연결된 단위 업무의 상태·진행률·마감도 함께 맞춘다. */
  async function save(log) {
    setMessage('')
    const body = {
      title: log.title,
      detail_lines: (log.detailText ?? (log.detail_lines || []).join('\n'))
        .split('\n').map((s) => s.replace(/^[·\-•*\s]+/, '').trim()).filter(Boolean),
      status: log.status,
      priority: log.priority,
      progress: log.progress === '' || log.progress === null ? null : Number(log.progress),
      deadline: log.deadline || null,
      is_misc: log.is_misc,
    }
    const { error } = await supabase.from('daily_logs').update(body).eq('id', log.id)
    if (error) return setMessage('저장 실패: ' + error.message)
    if (log.task_id) {
      await supabase.from('tasks').update({
        status: body.status, priority: body.priority,
        progress: body.progress, deadline: body.deadline,
      }).eq('id', log.task_id)
    }
    setMessage(`"${log.title}" 저장했습니다.`)
    load()
  }

  async function remove(log) {
    if (!confirm(`"${log.title}" 기록을 이 날짜에서 뺄까요?`)) return
    await supabase.from('daily_logs').delete().eq('id', log.id)
    load()
  }

  async function move(log, dir) {
    const idx = logs.findIndex((l) => l.id === log.id)
    const swap = logs[idx + dir]
    if (!swap) return
    await Promise.all([
      supabase.from('daily_logs').update({ sort_order: swap.sort_order }).eq('id', log.id),
      supabase.from('daily_logs').update({ sort_order: log.sort_order }).eq('id', swap.id),
    ])
    load()
  }

  return (
    <Guard>
      <div className="page-head">
        <div>
          <h1 className="page-title">일일 기록</h1>
          <p className="muted">{koreanDate(date)} 에 진행한 업무와 세부내용을 적습니다.</p>
        </div>
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
          <Link className="btn" href={`/reports?kind=daily&date=${date}`}>보고서 만들기</Link>
        </div>
      </div>

      {skip && <p className="notice warn">{skip}입니다. 자동 생성은 이 날짜를 건너뜁니다.</p>}
      {message && <p className="notice">{message}</p>}

      <div className="card">
        <div className="card-head">
          <h3>업무 추가</h3>
          <span className="muted">{logs.length}건 기록됨</span>
        </div>
        <div className="row">
          <select className="grow" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">업무 목록에서 고르기…</option>
            {available.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <button className="btn" onClick={addFromTask} disabled={!pick}>추가</button>
          <button className="btn ghost" onClick={addFree}>직접 입력</button>
        </div>
        {available.length === 0 && tasks.length > 0 && (
          <p className="muted" style={{ marginTop: 8 }}>등록된 업무를 모두 넣었습니다.</p>
        )}
        {tasks.length === 0 && (
          <p className="muted" style={{ marginTop: 8 }}>
            아직 업무가 없습니다. <Link href="/tasks">업무 화면</Link>에서 먼저 등록하세요.
          </p>
        )}
      </div>

      {logs.length === 0 && <p className="empty">이 날짜에 기록된 업무가 없습니다.</p>}

      {logs.map((log, i) => {
        const d = dday(log.deadline, date)
        return (
          <div className="card" key={log.id}>
            <div className="card-head">
              <h3>{log.title}</h3>
              <div className="row">
                {d !== null && <span className="chip">D-{d}</span>}
                <button className="btn ghost sm" onClick={() => move(log, -1)} disabled={i === 0}>↑</button>
                <button className="btn ghost sm" onClick={() => move(log, 1)} disabled={i === logs.length - 1}>↓</button>
                <button className="btn danger sm" onClick={() => remove(log)}>빼기</button>
              </div>
            </div>
            <div className="grid">
              <div className="field">
                <label>진행 상태</label>
                <select value={log.status} onChange={(e) => patch(log.id, { status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>우선순위</label>
                <select value={log.priority} onChange={(e) => patch(log.id, { priority: e.target.value })}>
                  {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>진행률 (%)</label>
                <input
                  type="number" min="0" max="100"
                  value={log.progress === null ? '' : log.progress}
                  onChange={(e) => patch(log.id, { progress: e.target.value })}
                />
              </div>
              <div className="field">
                <label>마감 시한</label>
                <input
                  type="date" value={log.deadline || ''}
                  onChange={(e) => patch(log.id, { deadline: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>세부내용 · 한 줄에 하나씩 적으면 글머리로 들어갑니다</label>
              <textarea
                value={log.detailText ?? (log.detail_lines || []).join('\n')}
                onChange={(e) => patch(log.id, { detailText: e.target.value })}
                placeholder={'감수 내용 수령\n담당자 전달 및 내용 확인'}
              />
            </div>
            <div className="row">
              <button className="btn" onClick={() => save(log)}>저장</button>
              <label className="row" style={{ fontSize: 13 }}>
                <input
                  type="checkbox" checked={log.is_misc} style={{ width: 'auto' }}
                  onChange={(e) => patch(log.id, { is_misc: e.target.checked })}
                />
                <span>기타 사항 (요약 카드 집계 제외)</span>
              </label>
            </div>
          </div>
        )
      })}
    </Guard>
  )
}
