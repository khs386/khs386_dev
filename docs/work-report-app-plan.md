# 업무보고서 앱 기본 계획 (일일 + 주간 통합)

작성일: 2026-09-04

## 1. 배경과 목표

현재 일일·주간 업무보고서는 두 개의 Claude 스킬이 노션 3개 DB를 읽어 HTML을 만든다.
문제는 데이터 읽기 단계다.

- notion-search는 의미 검색이라 같은 날 업무를 누락한다.
- 날짜 필터는 타임존 오차가 있어 Python으로 재검증해야 한다.
- 시리즈별 총 진행률은 formula 필드라 API로 값을 못 읽고 Chrome으로 화면을 긁어야 한다.
- Cowork 로컬 폴더 연결에 의존해 클라우드 세션에서는 저장이 불가능하다.

목표는 **첨부한 두 결과물(report_20260904.html, weekly_report_20260904.html)과 동일한 HTML을
데이터 오류 없이 안정적으로 생성하는 하나의 웹앱**이다.
핵심 방침은 "노션을 읽는 방법을 고치는 것"이 아니라 **데이터를 앱이 직접 소유하는 것**이다.
입력이 정형화되면 읽기 오류가 사라지고, 렌더링은 결정적(deterministic) 함수가 된다.

## 2. 기술 스택

- Next.js 14 (App Router) + Supabase + Vercel. 저장소의 `morning-brief/`와 같은 구성이라
  로그인, Supabase 클라이언트, 배포 절차를 그대로 재사용한다.
- 폴더: `work-report/` (저장소 루트에 독립 앱으로 추가, Vercel Root Directory 지정)
- 사용자: 1인(권호상) 기준. morning-brief의 이메일 로그인만 사용하고 팀 기능은 넣지 않는다.
- 비용: Supabase Free + Vercel Hobby로 충분하다.

## 3. 데이터 모델 (Supabase)

노션 DB 3개를 그대로 옮기되, 보고서에 필요한 필드만 남긴다.

### 3-1. tasks (단위 업무 마스터)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | |
| title | text | 업무명 |
| series | text | 꼬마생각뒤집기 / 꼬마역사뒤집기 / 꼬마 일력 / 기타 |
| work_type | text | 업무 유형 (예: 꼬마시리즈 개발) |
| priority | text | 높음 / 중간 / 낮음 |
| status | text | 예정 / 시작 / 진행 / 완료 / 보류 |
| progress | int | 0~100 |
| deadline | date | 마감 시한 (null 허용) |
| is_misc | bool | "기타 사항" 여부. 요약 카드 집계 제외 |
| archived | bool | |

### 3-2. daily_logs (일별 업무 진행 내역)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | |
| log_date | date | 보고 기준일 |
| task_id | uuid | tasks 참조 |
| detail_lines | text[] | 세부내용 줄 목록 (글머리 없이 저장) |
| status | text | 기록 시점 상태 스냅샷 |
| progress | int | 기록 시점 진행률 스냅샷 (null 허용) |
| deadline | date | 기록 시점 마감 스냅샷 |

일일 보고서 = `log_date = 오늘`인 daily_logs 전체. 날짜가 DB 컬럼이라 필터가 어긋날 일이 없다.

### 3-3. weekly_items (주간업무 현황)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | |
| week_start | date | 해당 주 월요일 |
| kind | text | 전주 실적 / 금주 예정 |
| title | text | 업무명 (일일 업무명과 다를 수 있어 별도 보관) |
| task_id | uuid | 선택. tasks에서 가져오기 용도 |
| work_type | text | 업무 유형 |
| status | text | 진행 상태 |
| progress | int | 진행률 |
| due_date | date | 종결 예정일 |
| note | text | 비고 |
| output | text | 산출물 |

첨부 결과물을 보면 주간 업무명("샘플권 감수 진행")과 일일 업무명("샘플권 감수본 확인")이 다르다.
그래서 주간 항목은 자동 파생하지 않고 별도 테이블로 관리하되, 화면에서 tasks를 골라 채우는
"가져오기" 버튼을 둔다.

### 3-4. series_progress (시리즈별 개발 현황)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| name | text | 꼬마생각뒤집기 / 꼬마역사뒤집기 / 꼬마 일력 |
| total_progress | int | 총 진행률 % |
| color | text | #378ADD / #e67e22 / #9b59b6 고정 |
| sort_order | int | |
| updated_at | timestamptz | |

1단계에서는 숫자 3개를 직접 입력한다. 노션 수식(단계별 가중치)을 알려 주면
2단계에서 단계별 진행률 테이블과 계산식을 앱에 옮겨 자동화한다.

### 3-5. reports (생성 이력)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid | |
| kind | text | daily / weekly |
| report_date | date | |
| html | text | 생성된 HTML 원문 |
| created_at | timestamptz | |

### 3-6. settings
작성자 표기("초등콘텐츠사업부 권호상"), 공휴일 목록(연도별), 자동 생성 시각.

## 4. 렌더링 엔진 (가장 중요한 부분)

두 스킬의 규칙을 순수 함수로 이식한다. 입력은 JSON, 출력은 HTML 문자열이다.
첨부한 두 HTML을 **골든 파일**로 두고, 같은 입력을 넣으면 같은 문자열이 나오는지
스냅샷 테스트로 고정한다. 이 테스트가 통과하면 "결과물이 첨부와 같다"가 보장된다.

```
work-report/lib/report/
  colors.js     bar_color, dday_color, status_color, priority_color, 시리즈 고정색
  date.js       D-day, 요일 표기, 주차 계산 ((일-1)//7+1), 공휴일 판정
  daily.js      일일 보고서 HTML 조립
  weekly.js     주간 보고서 HTML 조립
  fixtures/     첨부 결과물을 재현하는 입력 JSON + 골든 HTML
```

이식할 규칙 목록:

- 요약 카드: "기타 사항" 제외 집계. 완료/진행 분류는 원본 상태값 기준, 표시만 "진행 중"→"진행".
- 가장 빠른 마감: 마감일 있는 업무 중 최소 D-day. 마감 없는 업무는 제외.
- 업무 상세: D-day 오름차순, 마감 없음은 맨 뒤. 마감 없으면 마감 줄 생략. 세부내용은 HTML 이스케이프 후 줄마다 table 글머리.
- 단위 업무 진행률 바: 진행률 1% 이상만. 완료 먼저, 나머지 D-day 오름차순. 색은 bar_color 4단계.
- 시리즈 막대: 고정색, 높이 `max(4, round(진행률×2.2))`px, 순서 꼬마생각→꼬마역사→꼬마 일력.
- 주간 전주 실적 정렬: 완료/종결 먼저 → D-day 오름차순 → 시리즈 순서.
- 주간 금주 예정 정렬: 업무 유형 순서 → 업무명. 비어 있으면 "예정업무 없음" 한 줄.
- 주간 요약 카드: 업무 유형에 "기타" 포함된 항목 제외.
- 일일 바깥 배경 #FFE5CC, 주간 바깥 배경 #D6E4FF (첨부 기준. 스킬 원문의 #f5f6fa와 다름).
- 일일은 body 없는 table 조각, 주간은 완전한 HTML 문서 (첨부 형식 유지).

## 5. 화면 구성

| 경로 | 기능 |
|---|---|
| /login | 이메일 로그인 (morning-brief 재사용) |
| / | 오늘 요약: 오늘 기록된 업무 수, 마감 임박, "일일 보고서 만들기" 버튼 |
| /tasks | 단위 업무 CRUD. 상태·진행률·마감 인라인 수정 |
| /daily | 날짜 선택 → 오늘 진행한 업무 선택 → 세부내용 줄 입력. 진행률/상태 여기서 바로 갱신 |
| /weekly | 주차 선택 → 전주 실적 / 금주 예정 항목 관리. tasks에서 가져오기 |
| /series | 시리즈 3개 총 진행률 입력 |
| /reports | 일일/주간 탭, 날짜 선택, 미리보기(iframe), HTML 복사, 다운로드, 생성 이력 |

## 6. 자동 생성과 전달

- Vercel Cron 두 개: 평일 18:00 KST 일일, 금요일 17:00 KST 주간. 공휴일이면 건너뛴다.
  (Hobby 플랜은 cron이 하루 1회 제한이라 정확한 시각이 중요하면 Pro 또는 GitHub Actions cron 사용)
- 생성 결과는 reports 테이블에 저장하고 /reports에서 열람·다운로드한다.
- 전달 채널은 선택 사항으로 뒤에 붙인다: Gmail 임시보관함 생성(U+웍스 흐름 대체), Google Drive 업로드.
  로컬 폴더 저장은 클라우드 앱에서 불가능하므로 다운로드로 대체한다.

## 7. 노션 데이터 이관

- 일회성 스크립트 `scripts/import-notion.mjs`: Notion API로 [일별 업무 진행 내역], [주간업무 현황],
  [시리즈별 개발 현황]을 덤프해 Supabase에 넣는다. formula 값은 마지막으로 화면에서 확인한 숫자를
  수동 입력한다.
- 이관 후 노션은 읽지 않는다. 병행 기간이 필요하면 앱을 원본으로 두고 노션은 참고용으로만 남긴다.

## 8. 단계별 진행

1. **렌더러 + 골든 테스트**: fixtures JSON으로 첨부 두 파일을 그대로 재현. 여기서 첨부와 다른 부분을 모두 잡는다.
2. **스키마 + 입력 화면 + 미리보기**: Supabase 테이블, /tasks /daily /weekly /series /reports. 이 단계가 끝나면 수동으로 보고서를 만들 수 있다.
3. **노션 이관**: 기존 데이터 import, 시리즈 진행률 입력, 실제 데이터로 보고서 비교.
4. **자동 생성 + 전달**: cron, 이력, Gmail/Drive 옵션.

## 9. 확인이 필요한 결정

1. 데이터 입력을 앱에서 직접 하는 방식(권장)으로 갈지, 노션 입력을 유지하고 API 동기화만 할지.
2. 시리즈 총 진행률을 당분간 수동 입력할지, 노션 수식을 알려 주어 앱에서 계산하게 할지.
3. 배포는 morning-brief와 같은 Supabase 프로젝트를 쓸지, 새 프로젝트로 분리할지.
4. 최종 전달은 다운로드로 충분한지, U+웍스 임시보관함 자동화(Gmail 초안)까지 필요한지.
5. 앱 폴더명과 표시 이름 (안: `work-report/`, "업무보고서").
