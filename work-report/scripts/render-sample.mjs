// 고정 입력(test/fixtures)으로 보고서를 만들어 파일로 떨어뜨린다.
// 렌더링을 손본 뒤 눈으로 확인할 때 쓴다.
//   node scripts/render-sample.mjs [출력폴더]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { renderDaily } from '../lib/report/daily.js'
import { renderWeekly } from '../lib/report/weekly.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] || join(root, 'sample-out')
mkdirSync(outDir, { recursive: true })

const load = (n) => JSON.parse(readFileSync(join(root, 'test/fixtures', n), 'utf8'))

// 일일 보고서는 조각이라 눈으로 볼 때만 문서로 감싼다.
const daily = renderDaily(load('daily-2026-09-04.json'))
const wrapped =
  '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
  '<title>일일 업무 보고서 2026-09-04</title></head>' +
  `<body style="margin:0;padding:40px 0;background:#fff;">${daily}</body></html>`
writeFileSync(join(outDir, 'report_2026-09-04.html'), wrapped)

writeFileSync(
  join(outDir, 'weekly_report_2026-09-04.html'),
  renderWeekly(load('weekly-2026-09-04.json'))
)

console.log('생성 완료:', outDir)
