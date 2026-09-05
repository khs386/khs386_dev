// 주간업무 보고서 HTML 렌더러.
// 출력은 <!DOCTYPE html>로 시작하는 완결 문서다.
// test/golden/weekly_report_2026-09-04.html 과 바이트 단위로 일치해야 한다.

import { barColor, ddayColor, statusColor, displayStatus, isDone, isGoing } from './colors.js'
import { escapeHtml, dday, koreanWeek, barHeight, ddayKey, seriesRank } from './format.js'
import { normalizeSeries, DEFAULT_FOOTER } from './daily.js'

const TYPE_ORDER = { '꼬마생각뒤집기 개발': 0, '꼬마역사뒤집기 개발': 1, '꼬마과학뒤집기 개발': 2 }

function typeRank(t) {
  const s = String(t || '')
  if (s in TYPE_ORDER) return TYPE_ORDER[s]
  if (s.includes('꼬마')) return 3
  return 99
}

function typeBadge(t) {
  if (!t) return ''
  const c = String(t).includes('꼬마') ? '#0a7c6e' : '#888'
  return `<span style="background:${c};color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;white-space:nowrap;">${escapeHtml(t)}</span>`
}

function statusBadge(s) {
  const c = statusColor(s)
  if (!s || !c) return ''
  return `<span style="background:${c};color:#fff;font-size:12px;padding:4px 10px;border-radius:8px;white-space:nowrap;">${escapeHtml(displayStatus(s))}</span>`
}

/** 업무명 칸은 왼쪽 여백이 더 넓다. 머리글도 같은 자리에서 시작해야 줄이 맞는다. */
function th(label, align, padLeft = 12) {
  return `<th style="padding:14px 12px 14px ${padLeft}px;font-size:14px;color:#fff;font-weight:700;white-space:nowrap;text-align:${align};">${label}</th>`
}

/** 전주 실적 표 (teal 헤더, 짝수 행 #daf0ec) */
function prevTable(rows) {
  let html =
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;margin-bottom:28px;table-layout:fixed;">\n' +
    '<colgroup><col style="width:22%;"><col style="width:38%;"><col style="width:13%;"><col style="width:27%;"></colgroup>\n' +
    '<tr style="background:#0a7c6e;">' +
    th('업무 유형', 'left') + th('업무명', 'left', 20) + th('진행 상태', 'center') + th('비고 / 산출물', 'left') +
    '</tr>'
  rows.forEach((r, i) => {
    const bg = i % 2 === 0 ? '#daf0ec' : '#ffffff'
    const note = [r.output, r.note].filter(Boolean).join(' ').trim()
    html +=
      `\n<tr style="background:${bg};border-bottom:1px solid #eee;">\n` +
      `  <td style="padding:13px 12px;">${typeBadge(r.workType)}</td>\n` +
      `  <td style="padding:13px 12px 13px 20px;font-size:14px;font-weight:600;color:#1a1a2e;">${escapeHtml(r.title)}</td>\n` +
      `  <td style="padding:13px 12px;text-align:center;">${statusBadge(r.status)}</td>\n` +
      `  <td style="padding:13px 12px;font-size:13px;color:#888;">${escapeHtml(note)}</td>\n` +
      `</tr>`
  })
  return html + '\n</table>'
}

/** 금주 예정 표 (purple 헤더, 짝수 행 #e4dff5) */
function planTable(rows) {
  let html =
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:10px;overflow:hidden;margin-bottom:28px;table-layout:fixed;">\n' +
    '<colgroup><col style="width:22%;"><col style="width:41%;"><col style="width:13%;"><col style="width:24%;"></colgroup>\n' +
    '<tr style="background:#6b5bb8;">' +
    th('업무 유형', 'left') + th('업무명', 'left', 20) + th('종결 예정일', 'center') + th('비고', 'left') +
    '</tr>'
  rows.forEach((r, i) => {
    const bg = i % 2 === 0 ? '#e4dff5' : '#ffffff'
    const due = (r.dueDate || '').trim()
    html +=
      `\n<tr style="background:${bg};border-bottom:1px solid #eee;">\n` +
      `  <td style="padding:13px 12px;">${typeBadge(r.workType)}</td>\n` +
      `  <td style="padding:13px 12px 13px 20px;font-size:14px;font-weight:600;color:#1a1a2e;">${escapeHtml(r.title)}</td>\n` +
      `  <td style="padding:13px 12px;font-size:13px;text-align:center;color:#555;white-space:nowrap;">${due || '-'}</td>\n` +
      `  <td style="padding:13px 12px;font-size:13px;color:#888;">${escapeHtml(r.note || '')}</td>\n` +
      `</tr>`
  })
  return html + '\n</table>'
}

function summaryCard(label, value, bg, color) {
  return (
    `<td width="23%" style="background:${bg};border-radius:12px;padding:26px 18px;text-align:center;">` +
    `<p style="margin:0;font-size:15px;color:#666;">${label}</p>` +
    `<p style="margin:10px 0 0;font-size:54px;font-weight:700;color:${color};">${value}</p></td>`
  )
}

/**
 * @param {object} data
 *  - date: 'YYYY-MM-DD' 보고 기준일(금요일)
 *  - author: 부서/이름 표기, shortAuthor: 문서 제목용 이름
 *  - prev: [{ workType, title, status, progress, dueDate, note, output }]
 *  - plan: [{ workType, title, dueDate, note }]
 *  - series: [{ name, progress }]
 */
export function renderWeekly(data) {
  const today = data.date
  const author = data.author || ''
  const shortAuthor = data.shortAuthor || author.split(' ').pop() || ''
  const period = koreanWeek(today)
  const footer = data.footer || DEFAULT_FOOTER

  // 전주 실적: ① 완료/종결 먼저 ② D-day 오름차순 ③ 시리즈 순서
  const prev = (data.prev || [])
    .map((r) => ({ ...r, dday: dday(r.dueDate, today) }))
    .sort(
      (a, b) =>
        (isDone(a.status) ? 0 : 1) - (isDone(b.status) ? 0 : 1) ||
        ddayKey(a.dday) - ddayKey(b.dday) ||
        seriesRank(a.title) - seriesRank(b.title)
    )

  // 금주 예정: ① 업무 유형 순위 ② 종결 예정일 오름차순 ③ 업무명
  let plan = (data.plan || [])
    .slice()
    .sort(
      (a, b) =>
        typeRank(a.workType) - typeRank(b.workType) ||
        String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31')) ||
        String(a.title).localeCompare(String(b.title))
    )
  if (!plan.length) plan = [{ workType: '', title: '예정업무 없음', dueDate: '', note: '' }]

  // 요약 카드는 업무 유형에 "기타"가 들어간 항목을 제외한다.
  const counted = prev.filter((r) => !String(r.workType || '').includes('기타'))
  const total = counted.length
  const done = counted.filter((r) => isDone(r.status)).length
  const going = counted.filter((r) => isGoing(r.status)).length

  // 단위업무 진행률 바: 전주 실적의 진행률 필드를 그대로 쓴다 (0%·미입력 제외)
  const bars = prev.filter((r) => Number(r.progress) >= 1)

  let barsHtml = ''
  if (bars.length) {
    for (const b of bars) {
      const p = Number(b.progress)
      const c = barColor(p)
      const ddayHtml =
        b.dday === null || b.dday === undefined
          ? ''
          : `&nbsp;<span style="color:${ddayColor(b.dday)};font-size:14px;font-weight:700;">D-${b.dday}</span>`
      barsHtml +=
        `\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">\n` +
        `<tr><td style="font-size:15px;font-weight:600;color:#1a1a2e;padding-bottom:7px;">${escapeHtml(b.title)}${ddayHtml}</td>\n` +
        `<td align="right" style="font-size:15px;font-weight:700;color:${c};padding-bottom:7px;">${p}%</td></tr>\n` +
        `<tr><td colspan="2" style="background:#e8e8e8;border-radius:20px;height:22px;padding:0;">\n` +
        `<table width="${p}%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${c};height:22px;border-radius:20px;"></td></tr></table>\n` +
        `</td></tr></table>`
    }
  } else {
    barsHtml = '<p style="font-size:14px;color:#aaa;">진행률 데이터가 없습니다.</p>'
  }

  const series = normalizeSeries(data.series)
  let seriesHtml
  if (series.length) {
    const w = Math.trunc(100 / series.length)
    const cols = series
      .map(
        (s) =>
          `\n<td style="text-align:center;vertical-align:bottom;padding:0 4px;width:${w}%;">\n` +
          `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${s.color};">${s.progress}%</p>\n` +
          `<table width="50%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="background:${s.color};height:${barHeight(s.progress)}px;border-radius:8px 8px 0 0;min-height:4px;"></td></tr></table>\n` +
          `<p style="margin:6px 0 0;font-size:12px;color:#555;word-break:keep-all;text-align:center;">${escapeHtml(s.name)}</p></td>`
      )
      .join('')
    seriesHtml = `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="bottom">${cols}</tr></table>`
  } else {
    seriesHtml = '<p style="font-size:14px;color:#aaa;">시리즈 데이터를 불러오지 못했습니다.</p>'
  }

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>주간업무 보고서 ${escapeHtml(period)} ${escapeHtml(shortAuthor)}</title></head>
<body style="margin:0;padding:40px 0;background:#ffffff;">
<table width="960" cellpadding="0" cellspacing="0" border="0" bgcolor="#D6E4FF" style="margin:0 auto;border-radius:14px;"><tr><td style="padding:42px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,0.08);"><tr><td style="padding:46px;">
<p style="margin:0 0 4px;font-size:34px;font-weight:700;color:#0a7c6e;">주간업무 보고서</p>
<p style="margin:0 0 36px;font-size:17px;color:#888;">${escapeHtml(period)} &nbsp;·&nbsp; ${escapeHtml(author)}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;"><tr>
${summaryCard('전주 실적', total, '#e6f4f1', '#0a7c6e')}<td width="2%"></td>${summaryCard('종결', done, '#f0fff4', '#639922')}<td width="2%"></td>${summaryCard('진행', going, '#f0f7ff', '#378ADD')}<td width="2%"></td>${summaryCard('금주 예정', plan.length, '#e6f4f1', '#0a7c6e')}
</tr></table>
<hr style="border:none;border-top:1px solid #eee;margin:0 0 24px;">
<p style="margin:0 0 16px;font-size:21px;font-weight:700;color:#0a7c6e;">전주 실적</p>
${prevTable(prev)}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0 28px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;"><tr>
<td width="46%"><p style="margin:0;font-size:21px;font-weight:700;color:#0a7c6e;">단위업무 진행률</p></td><td width="8%"></td>
<td width="46%"><p style="margin:0;font-size:21px;font-weight:700;color:#0a7c6e;">시리즈별 개발 현황</p></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top"><td width="46%">${barsHtml}</td><td width="8%"></td><td width="46%" valign="bottom">${seriesHtml}</td></tr></table>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0 24px;">
<p style="margin:0 0 16px;font-size:21px;font-weight:700;color:#6b5bb8;">금주 예정</p>
${planTable(plan)}
<hr style="border:none;border-top:1px solid #eee;margin:10px 0 18px;">
<p style="margin:0;font-size:13px;color:#aaa;text-align:center;">${escapeHtml(footer)}</p>
</td></tr></table></td></tr></table></body></html>`
}
