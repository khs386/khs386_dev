'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Guard from '../components/Guard'
import { supabase } from '../lib/supabase'
import { todayKST } from '../lib/constants'
import { isSkipDay } from '../lib/reportData'
import { koreanDate, koreanWeek, weekStart, dday } from '../lib/report/format'
import { statusColor, displayStatus } from '../lib/report/colors'

export default function HomePage() {
  const today = todayKST()
  const [logs, setLogs] = useState([])
  const [weekly, setWeekly] = useState([])
  const [series, setSeries] = useState([])
  const [soon, setSoon] = useState([])

  useEffect(() => {
    const ws = weekStart(today)
    supabase.from('daily_logs').select('*').eq('log_date', today).order('sort_order')
      .then(({ data }) => setLogs(data || []))
    supabase.from('weekly_items').select('*').eq('week_start', ws)
      .then(({ data }) => setWeekly(data || []))
    supabase.from('series_progress').select('*').order('sort_order')
      .then(({ data }) => setSeries(data || []))
    supabase.from('tasks').select('*').eq('archived', false).not('deadline', 'is', null)
      .order('deadline').limit(5)
      .then(({ data }) => setSoon(data || []))
  }, [today])

  const skip = isSkipDay(today, null)
  const stale = series.filter((s) => !s.updated_at || s.updated_at.slice(0, 10) < weekStart(today))

  return (
    <Guard>
      <div className="page-head">
        <div>
          <h1 className="page-title">오늘</h1>
          <p className="muted">{koreanDate(today)} · {koreanWeek(today)}</p>
        </div>
        <div className="row">
          <Link className="btn" href="/daily">일일 기록하기</Link>
          <Link className="btn ghost" href="/weekly">주간 현황</Link>
        </div>
      </div>

      {skip && <p className="notice warn">오늘은 {skip}입니다. 자동 생성은 건너뜁니다.</p>}
      {stale.length > 0 && (
        <p className="notice warn">
          시리즈 진행률이 이번 주에 갱신되지 않았습니다. <Link href="/series">지금 입력하기</Link>
        </p>
      )}

      <div className="card">
        <div className="card-head">
          <h3>오늘 기록한 업무</h3>
          <span className="muted">{logs.length}건</span>
        </div>
        {logs.length === 0 && (
          <p className="empty">
            아직 기록이 없습니다. <Link href="/daily">일일 기록</Link>에서 오늘 진행한 업무를 넣으세요.
          </p>
        )}
        {logs.map((l) => (
          <div className="item" key={l.id}>
            <span className="item-title">{l.title}</span>
            <span className="badge" style={{ background: statusColor(l.status) || '#888' }}>
              {displayStatus(l.status)}
            </span>
            <span className="chip">{l.progress === null ? '진행률 없음' : l.progress + '%'}</span>
            <span className="chip">{l.deadline ? `D-${dday(l.deadline, today)}` : '마감 없음'}</span>
          </div>
        ))}
        {logs.length > 0 && (
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn" href={`/reports?kind=daily&date=${today}`}>일일 보고서 만들기</Link>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>이번 주 현황</h3>
          <span className="muted">
            전주 실적 {weekly.filter((w) => w.kind === '전주 실적').length}건 ·
            금주 예정 {weekly.filter((w) => w.kind === '금주 예정').length}건
          </span>
        </div>
        {weekly.length === 0 ? (
          <p className="empty">
            이번 주 항목이 없습니다. <Link href="/weekly">주간 현황</Link>에서 채우세요.
          </p>
        ) : (
          <div className="row">
            <Link className="btn" href={`/reports?kind=weekly&date=${today}`}>주간 보고서 만들기</Link>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h3>마감이 가까운 업무</h3></div>
        {soon.length === 0 && <p className="empty">마감이 정해진 업무가 없습니다.</p>}
        {soon.map((t) => {
          const d = dday(t.deadline, today)
          return (
            <div className="item" key={t.id}>
              <span className="item-title">{t.title}</span>
              <span className="chip">{t.deadline}</span>
              <span
                className="badge"
                style={{ background: d <= 3 ? '#e74c3c' : d <= 7 ? '#e67e22' : '#888' }}
              >D-{d}</span>
            </div>
          )
        })}
      </div>
    </Guard>
  )
}
