'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Guard from '../../components/Guard'
import { supabase } from '../../lib/supabase'
import { todayKST } from '../../lib/constants'
import { koreanDate, koreanWeek } from '../../lib/report/format'

/** 일일 보고서는 조각(fragment)이라 미리보기용 문서로 감싼다. */
function previewDoc(kind, html) {
  if (kind === 'weekly') return html
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"></head>` +
    `<body style="margin:0;padding:40px 0;background:#fff;">${html}</body></html>`
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token || ''}`,
  }
}

function ReportsInner() {
  const params = useSearchParams()
  const [kind, setKind] = useState(params.get('kind') === 'weekly' ? 'weekly' : 'daily')
  const [date, setDate] = useState(params.get('date') || todayKST())
  const [html, setHtml] = useState('')
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const [history, setHistory] = useState([])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('reports').select('*').order('report_date', { ascending: false }).limit(30)
    setHistory(data || [])
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    setHtml('')
    setMessage(null)
    supabase
      .from('reports').select('*').eq('kind', kind).eq('report_date', date).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHtml(data.html)
          setFilename(data.filename)
        }
      })
  }, [kind, date])

  async function generate() {
    setBusy('generate')
    setMessage(null)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ kind, date }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setHtml(json.html)
      setFilename(json.filename)
      setMessage(
        json.empty
          ? { type: 'warn', text: '기록된 업무가 없어 빈 보고서가 만들어졌습니다.' }
          : { type: 'ok', text: '보고서를 만들었습니다.' }
      )
      loadHistory()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setBusy('')
    }
  }

  async function toDrive() {
    setBusy('drive')
    setMessage(null)
    try {
      const res = await fetch('/api/reports/drive', {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ kind, date }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessage({
        type: 'ok',
        text: `구글 드라이브에 ${json.updated ? '덮어썼습니다' : '저장했습니다'}: ${json.filename}`,
        link: json.link,
      })
      loadHistory()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setBusy('')
    }
  }

  function download() {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function copy() {
    await navigator.clipboard.writeText(html)
    setMessage({ type: 'ok', text: 'HTML을 클립보드에 복사했습니다.' })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">보고서</h1>
          <p className="muted">{kind === 'daily' ? koreanDate(date) : koreanWeek(date)}</p>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <button
            className={kind === 'daily' ? 'btn' : 'btn ghost'} onClick={() => setKind('daily')}
          >일일 업무 보고서</button>
          <button
            className={kind === 'weekly' ? 'btn' : 'btn ghost'} onClick={() => setKind('weekly')}
          >주간업무 보고서</button>
        </div>
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
          <button className="btn" onClick={generate} disabled={busy === 'generate'}>
            {busy === 'generate' ? '만드는 중…' : '보고서 만들기'}
          </button>
          <button className="btn ghost" onClick={toDrive} disabled={!html || busy === 'drive'}>
            {busy === 'drive' ? '올리는 중…' : '구글 드라이브에 저장'}
          </button>
          <button className="btn ghost" onClick={download} disabled={!html}>HTML 내려받기</button>
          <button className="btn ghost" onClick={copy} disabled={!html}>HTML 복사</button>
        </div>
        {message && (
          <p className={message.type === 'error' ? 'notice error' : message.type === 'warn' ? 'notice warn' : 'notice'} style={{ marginTop: 12, marginBottom: 0 }}>
            {message.text}
            {message.link && <> · <a href={message.link} target="_blank" rel="noreferrer">드라이브에서 열기</a></>}
          </p>
        )}
      </div>

      {html ? (
        <div className="card">
          <div className="card-head"><h3>미리보기</h3><span className="muted">{filename}</span></div>
          <iframe className="preview-frame" title="보고서 미리보기" srcDoc={previewDoc(kind, html)} />
        </div>
      ) : (
        <p className="empty">아직 만들어진 보고서가 없습니다. 날짜를 고르고 "보고서 만들기"를 누르세요.</p>
      )}

      <div className="card">
        <div className="card-head"><h3>생성 이력</h3><span className="muted">최근 30건</span></div>
        {history.length === 0 && <p className="empty">이력이 없습니다.</p>}
        {history.map((r) => (
          <div className="item" key={r.id}>
            <span className="chip">{r.kind === 'daily' ? '일일' : '주간'}</span>
            <span className="item-title">{r.filename}</span>
            <span className="chip">{(r.created_at || '').slice(0, 10)}</span>
            {r.drive_link && (
              <a className="link-btn" href={r.drive_link} target="_blank" rel="noreferrer">드라이브</a>
            )}
            <span className="spacer" />
            <button
              className="btn ghost sm"
              onClick={() => { setKind(r.kind); setDate(r.report_date) }}
            >열기</button>
          </div>
        ))}
      </div>
    </>
  )
}

export default function ReportsPage() {
  return (
    <Guard>
      <Suspense fallback={<p className="empty">불러오는 중…</p>}>
        <ReportsInner />
      </Suspense>
    </Guard>
  )
}
