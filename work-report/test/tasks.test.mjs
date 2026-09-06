// 데일리 브리프의 [마감이 가까운 업무] 고르기.
// 예전에는 단위업무 목록 차례로 앞에서 다섯을 잘랐는데, 그 차례가 시리즈 먼저라
// 뒤 시리즈는 마감이 급해도 잘려 나갔다. 마감일만 보도록 바꾼 뒤의 규칙을 못 박는다.
import test from 'node:test'
import assert from 'node:assert/strict'

import { soonTasks, SOON_DAYS } from '../src/lib/tasks.js'

const TODAY = '2026-09-06'
const t = (title, deadline, status = '진행', series = '꼬마생각뒤집기') =>
  ({ title, deadline, status, series })

test('마감이 7일 이내인 것만 고른다', () => {
  assert.equal(SOON_DAYS, 7)
  const got = soonTasks([
    t('오늘 마감', '2026-09-06'),
    t('이레 뒤', '2026-09-13'),      // D-7 — 든다
    t('여드레 뒤', '2026-09-14'),     // D-8 — 안 든다
    t('한 달 뒤', '2026-10-06'),
  ], TODAY).map((x) => x.title)
  assert.deepEqual(got, ['오늘 마감', '이레 뒤'])
})

test('완료한 것은 뺀다', () => {
  const got = soonTasks([
    t('끝난 일', '2026-09-07', '완료'),
    t('하는 일', '2026-09-07', '진행'),
  ], TODAY).map((x) => x.title)
  assert.deepEqual(got, ['하는 일'])
})

test('보류는 남긴다', () => {
  // 세워 둔 사이에 마감이 닥칠 수 있다. 다시 굴릴지 정하는 것도 일이다.
  const got = soonTasks([t('세워 둔 일', '2026-09-08', '보류')], TODAY)
  assert.equal(got.length, 1)
})

test('지난 마감도 남기고 맨 앞에 둔다', () => {
  // 마감이 지났는데 완료가 아니면 그것이 가장 급하다.
  const got = soonTasks([
    t('내일', '2026-09-07'),
    t('이틀 지남', '2026-09-04'),
    t('오늘', '2026-09-06'),
  ], TODAY)
  assert.deepEqual(got.map((x) => x.title), ['이틀 지남', '오늘', '내일'])
  assert.deepEqual(got.map((x) => x.d), [-2, 0, 1])
})

test('시리즈가 뒤라도 마감이 급하면 앞에 온다', () => {
  // 예전 규칙이 잘라 내던 바로 그 경우다.
  const got = soonTasks([
    t('생각뒤집기 일', '2026-09-11', '진행', '꼬마생각뒤집기'),
    t('일력 일', '2026-09-07', '진행', '꼬마 일력'),
  ], TODAY).map((x) => x.title)
  assert.deepEqual(got, ['일력 일', '생각뒤집기 일'])
})

test('마감이 같으면 이름 차례로 둔다', () => {
  // 볼 때마다 자리가 흔들리면 안 된다.
  const got = soonTasks([
    t('나중', '2026-09-07'), t('가나다', '2026-09-07'),
  ], TODAY).map((x) => x.title)
  assert.deepEqual(got, ['가나다', '나중'])
})

test('마감 없는 업무와 빈 목록', () => {
  assert.deepEqual(soonTasks([t('마감 없음', null)], TODAY), [])
  assert.deepEqual(soonTasks([], TODAY), [])
  assert.deepEqual(soonTasks(null, TODAY), [])
})

test('개수를 자르지 않는다', () => {
  // 날수로 이미 좁혀 놓았다. 급한 것을 말없이 숨기지 않는다.
  const many = Array.from({ length: 9 }, (_, i) => t(`일 ${i}`, '2026-09-07'))
  assert.equal(soonTasks(many, TODAY).length, 9)
})
