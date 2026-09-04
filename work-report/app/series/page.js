'use client'
import { useEffect, useState } from 'react'
import Guard from '../../components/Guard'
import { supabase } from '../../lib/supabase'
import { SERIES_COLOR } from '../../lib/report/colors'
import { barHeight } from '../../lib/report/format'

export default function SeriesPage() {
  const [rows, setRows] = useState([])
  const [saved, setSaved] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('series_progress').select('*').order('sort_order')
    setRows(data || [])
  }

  function change(name, value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0))
    setRows(rows.map((r) => (r.name === name ? { ...r, total_progress: v } : r)))
  }

  async function save() {
    setSaved('')
    for (const r of rows) {
      await supabase
        .from('series_progress')
        .update({ total_progress: r.total_progress, updated_at: new Date().toISOString() })
        .eq('name', r.name)
    }
    setSaved('저장했습니다.')
    load()
  }

  return (
    <Guard narrow>
      <div className="page-head">
        <div>
          <h1 className="page-title">시리즈별 개발 현황</h1>
          <p className="muted">보고서 오른쪽 세로 막대에 쓰이는 총 진행률입니다. 노션 화면의 값을 그대로 입력하세요.</p>
        </div>
      </div>

      <div className="card">
        {rows.map((r) => (
          <div className="field" key={r.name}>
            <label>{r.name}</label>
            <div className="row">
              <input
                className="grow" type="number" min="0" max="100"
                value={r.total_progress}
                onChange={(e) => change(r.name, e.target.value)}
              />
              <span className="chip">{r.updated_at ? r.updated_at.slice(0, 10) + ' 갱신' : '미입력'}</span>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={save}>저장</button>
          {saved && <span className="muted">{saved}</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>미리보기</h3></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, minHeight: 240, padding: '0 8px' }}>
          {rows.map((r) => {
            const c = SERIES_COLOR[r.name] || '#378ADD'
            return (
              <div key={r.name} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c, marginBottom: 6 }}>
                  {r.total_progress}%
                </div>
                <div style={{
                  background: c, height: barHeight(r.total_progress),
                  borderRadius: '8px 8px 0 0', margin: '0 auto', width: '60%',
                }} />
                <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>{r.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Guard>
  )
}
