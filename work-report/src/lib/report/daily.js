// 일일 업무 보고서 HTML 렌더러.
// 출력은 <table>로 시작하는 조각(fragment)이다 — 메일 본문에 그대로 붙일 수 있다.
// test/golden/report_2026-09-04.html 과 바이트 단위로 일치해야 한다.

import {
  barColor, ddayColor, deadlineColor, statusColor, cardAccentColor,
  priorityColor, SERIES_COLOR, SERIES_ORDER, displayStatus, isDone, isGoing,
} from './colors.js'
import { escapeHtml, dday, koreanDate, barHeight, ddayKey } from './format.js'

export const DEFAULT_FOOTER = '이 보고서는 Notion 업무 관리 데이터를 기반으로 자동 생성되었습니다.'

function summaryCard(label, value, opts = {}) {
  const { bg, color, width = '23%', border = '', sub = '' } = opts
  const subLine = sub ? `<p style="margin:0;font-size:14px;color:${color};">${sub}</p>` : ''
  const margin = sub ? '10px 0 6px' : '10px 0 0'
  return (
    `<td width="${width}" style="background:${bg};border-radius:12px;padding:26px 18px;text-align:center;${border}">` +
    `<p style="margin:0;font-size:15px;color:#666;">${label}</p>` +
    `<p style="margin:${margin};font-size:54px;font-weight:700;color:${color};">${value}</p>` +
    `${subLine}</td>`
  )
}

function detailRow(text, first) {
  const margin = first ? '8px 0 2px' : '0 0 2px'
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${margin};padding-left:8px;">` +
    `<tr><td width="14" style="font-size:15px;color:#555;vertical-align:top;line-height:1.7;white-space:nowrap;padding-right:4px;">·</td>` +
    `<td style="font-size:15px;color:#555;line-height:1.7;">${escapeHtml(text)}</td></tr></table>`
  )
}

function taskCard(task, today) {
  const d = dday(task.deadline, today)
  const lines = (task.details || [])
    .map((l) => String(l || '').replace(/^[·\-•*\s]+/, '').trim())
    .filter(Boolean)

  const parts = [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-radius:10px;border-left:6px solid ${cardAccentColor(task.status)};background:#f8f9fa;"><tr><td style="padding:22px 24px;">`,
    `  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td><p style="margin:0;font-size:18px;font-weight:700;color:#1a1a2e;">${escapeHtml(task.title)}</p></td>` +
      `<td align="right" style="white-space:nowrap;">` +
      `<span style="background:${statusColor(task.status)};color:#fff;font-size:13px;padding:4px 12px;border-radius:10px;">${escapeHtml(displayStatus(task.status))}</span>` +
      `<span style="background:${priorityColor(task.priority)};color:#fff;font-size:13px;padding:4px 12px;border-radius:10px;margin-left:6px;">${escapeHtml(task.priority || '')}</span>` +
      `</td></tr></table>`,
  ]
  lines.forEach((l, i) => parts.push('  ' + detailRow(l, i === 0)))
  if (task.deadline) {
    parts.push(`  <p style="margin:10px 0 0;font-size:14px;color:${deadlineColor(d)};">마감: ${task.deadline} &nbsp;(D-${d})</p>`)
  }
  parts.push('</td></tr></table>')
  return parts.join('\n')
}

function progressBar(item) {
  const p = item.progress
  const c = barColor(p)
  const ddayHtml =
    item.dday === null || item.dday === undefined
      ? ''
      : ` &nbsp;<span style="color:${ddayColor(item.dday)};font-size:14px;font-weight:700;">D-${item.dday}</span>`
  return (
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">` +
    `<tr><td style="font-size:15px;font-weight:600;color:#1a1a2e;padding-bottom:7px;">${escapeHtml(item.title)}${ddayHtml}</td>` +
    `<td align="right" style="font-size:15px;font-weight:700;color:${c};padding-bottom:7px;">${p}%</td></tr>` +
    `<tr><td colspan="2" style="background:#e8e8e8;border-radius:20px;height:22px;padding:0;overflow:hidden;">` +
    `<div style="width:${p}%;background:${c};height:22px;border-radius:20px;"></div></td></tr></table>`
  )
}

function seriesCell(s, width) {
  const c = s.color || SERIES_COLOR[s.name] || '#378ADD'
  return (
    `<td width="${width}%" style="text-align:center;vertical-align:bottom;padding:0 4px;">` +
    `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${c};">${s.progress}%</p>` +
    `<table width="50%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">` +
    `<tr><td style="background:${c};height:${barHeight(s.progress)}px;border-radius:6px 6px 0 0;min-height:4px;"></td></tr></table>` +
    `<p style="margin:4px 0 0;font-size:11px;color:#555;word-break:keep-all;text-align:center;">${escapeHtml(s.name)}</p></td>`
  )
}

/** 시리즈 목록을 고정 순서로 정렬하고 고정색을 붙인다 */
export function normalizeSeries(series) {
  const map = new Map((series || []).map((s) => [s.name, s]))
  const ordered = []
  for (const n of SERIES_ORDER) if (map.has(n)) ordered.push(map.get(n))
  for (const s of series || []) if (!SERIES_ORDER.includes(s.name)) ordered.push(s)
  return ordered.map((s) => ({
    name: s.name,
    progress: Number(s.progress) || 0,
    color: SERIES_COLOR[s.name] || '#378ADD',
  }))
}

/**
 * @param {object} data
 *  - date: 'YYYY-MM-DD' 보고 기준일
 *  - author: 부서/이름 표기
 *  - tasks: [{ title, status, priority, progress, deadline, isMisc, details[] }]
 *  - series: [{ name, progress }]
 *  - footer: 하단 문구 (선택)
 */
export function renderDaily(data) {
  const today = data.date
  const author = data.author || ''
  const footer = data.footer || DEFAULT_FOOTER

  const tasks = (data.tasks || []).map((t) => ({ ...t, dday: dday(t.deadline, today) }))
  tasks.sort((a, b) => ddayKey(a.dday) - ddayKey(b.dday))

  // 요약 카드 집계는 "기타 사항"을 제외한다. 업무 상세에는 그대로 남는다.
  const counted = tasks.filter((t) => !t.isMisc && t.title !== '기타 사항')
  const total = counted.length
  const done = counted.filter((t) => isDone(t.status)).length
  const going = counted.filter((t) => isGoing(t.status)).length

  const withDeadline = counted.filter((t) => t.dday !== null).sort((a, b) => a.dday - b.dday)
  const soonest = withDeadline[0] || null

  let out = ''
  out += '<table width="920" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFE5CC" style="margin:0 auto;border-radius:14px;"><tr><td style="padding:42px;">'
  out += '<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,0.08);"><tr><td style="padding:46px;">\n'

  out += `<p style="margin:0 0 8px;font-size:34px;font-weight:700;color:#1a1a2e;">일일 업무 보고서</p>`
  out += `<p style="margin:0 0 36px;font-size:17px;color:#888;">${koreanDate(today)} &nbsp;·&nbsp; ${escapeHtml(author)}</p>\n`

  out += '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;"><tr>\n'
  out += summaryCard('오늘 업무', total, { bg: '#f0f4ff', color: '#1a1a2e' }) + '<td width="2%"></td>\n'
  out += summaryCard('완료', done, { bg: '#f0fff4', color: '#639922' }) + '<td width="2%"></td>\n'
  out += summaryCard('진행', going, { bg: '#f0f7ff', color: '#378ADD' }) + '<td width="2%"></td>\n'
  out += summaryCard('가장 빠른 마감', soonest ? `D-${soonest.dday}` : '-', {
    bg: '#fff0f0',
    color: '#e74c3c',
    width: '25%',
    border: 'border:2px solid #e74c3c;',
    sub: soonest ? `${escapeHtml(soonest.title)} · 마감임박` : '마감 예정 없음',
  }) + '\n'
  out += '</tr></table>\n'

  out += '<hr style="border:none;border-top:1px solid #eee;margin:0 0 24px;">'
  out += '<p style="margin:0 0 16px;font-size:21px;font-weight:700;color:#1a1a2e;">업무 상세</p>\n'
  for (const t of tasks) out += taskCard(t, today) + '\n'

  out += '<hr style="border:none;border-top:1px solid #eee;margin:24px 0 28px;">'
  out += '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;"><tr>'
  out += '<td width="46%"><p style="margin:0;font-size:21px;font-weight:700;color:#1a1a2e;">단위 업무 진행율</p></td>'
  out += '<td width="8%"></td>'
  out += '<td width="46%"><p style="margin:0;font-size:21px;font-weight:700;color:#1a1a2e;">시리즈별 개발 현황</p></td></tr></table>\n'

  out += '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top"><td width="46%">\n'
  // 진행률 1% 이상만. 완료(100%)를 먼저, 나머지는 D-day 오름차순.
  const bars = tasks
    .filter((t) => Number(t.progress) >= 1)
    .sort((a, b) => (b.progress === 100) - (a.progress === 100) || ddayKey(a.dday) - ddayKey(b.dday))
  if (bars.length) {
    for (const b of bars) out += progressBar(b) + '\n'
  } else {
    out += '<p style="font-size:14px;color:#aaa;">진행률 데이터가 없습니다.</p>\n'
  }

  out += '</td><td width="8%"></td><td width="46%" valign="bottom">'
  out += '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="bottom">\n'
  const series = normalizeSeries(data.series)
  if (series.length) {
    const w = Math.trunc(100 / series.length)
    for (const s of series) out += seriesCell(s, w) + '\n'
  }
  out += '</tr></table></td></tr></table>\n'

  out += '<hr style="border:none;border-top:1px solid #eee;margin:10px 0 18px;">'
  out += `<p style="margin:0;font-size:13px;color:#aaa;text-align:center;">${escapeHtml(footer)}</p>`
  out += '</td></tr></table></td></tr></table>'
  return out
}
