# 모닝브리프 업무관리 앱 — 전체 구조 제안서

## 1. 개요

매일 아침 "오늘 무엇을 해야 하는가"를 자동으로 정리해 주는 **모닝브리프**를 중심에 두고,
그 재료가 되는 업무(할 일)·프로젝트·일정을 관리하는 개인/소규모 팀용 업무관리 앱.

핵심 컨셉: **"업무를 입력해 두면, 아침마다 앱이 하루를 브리핑해 준다."**

## 2. 앱 형식(플랫폼) 제안

**추천: 웹앱(Next.js) + PWA(홈 화면 설치 + 웹 푸시)**

| 형식 | 장점 | 단점 | 판단 |
|------|------|------|------|
| 웹앱 + PWA | 기존 스택 재사용, 배포 간단(Vercel), 모바일/PC 겸용, 푸시 가능 | iOS 푸시는 홈 화면 설치 필요 | ✅ 추천 |
| 네이티브 앱(React Native 등) | 푸시·UX 최고 | 개발/배포 비용 큼, 스토어 심사 | 차후 검토 |
| 메신저 봇(카카오/슬랙)만 | 개발 최소 | 업무 관리 UI가 없음 | 브리프 "전달 채널"로만 활용 |

아침 브리프의 전달은 **앱 홈 화면 카드 + 이메일(또는 웹 푸시)** 이중으로 제공하면,
앱을 열지 않아도 받아볼 수 있고 앱을 열면 바로 실행(체크)할 수 있다.

## 3. 기술 스택

기존 voting-app과 동일 계열로 학습 비용 최소화:

- **프론트/백엔드**: Next.js 14+ (App Router 권장) + React
- **DB/인증**: Supabase (Postgres + Auth + Row Level Security)
- **스케줄러**: Vercel Cron(또는 Supabase pg_cron + Edge Function) — 평일 아침 브리프 자동 생성
- **알림**: 이메일(Resend 등) / Web Push, 필요 시 카카오·슬랙 웹훅
- **AI 요약(선택)**: Claude API — 수집된 데이터를 자연어 브리핑 문장으로 요약
- **배포**: Vercel

## 4. 기능 모듈

### 4.1 업무 관리 (기본기)
- 할 일 CRUD: 제목, 설명, 마감일, 우선순위(높음/보통/낮음), 상태(예정/진행/완료/보류)
- 프로젝트(또는 카테고리)별 그룹핑, 태그
- 반복 업무(매일/매주/매월 — 예: "금요일 주간보고")
- 하위 작업(체크리스트)

### 4.2 모닝브리프 (핵심 차별점)
평일 아침 정해진 시간(기본 08:00, 설정 가능)에 자동 생성:

1. **오늘의 일정** — 캘린더 연동 일정(구글 캘린더, 3단계)
2. **오늘 마감 업무** — 마감일이 오늘인 할 일
3. **지연 업무** — 마감을 넘긴 미완료 업무 (경고 표시)
4. **어제 한 일** — 어제 완료 처리된 업무 요약
5. **오늘의 추천 우선순위** — 마감·우선순위 기반 Top 3 (AI 요약 적용 시 자연어 브리핑)
6. **한 줄 메모/날씨** (선택)

브리프는 `briefs` 테이블에 저장되어 아카이브로 남고, 지난 브리프를 날짜별로 다시 볼 수 있다.

### 4.3 리포트
- 주간 요약: 완료/미완료 통계, 프로젝트별 진행률
- (기존 노션 기반 일일·주간 보고 워크플로와 연동 여지)

### 4.4 설정
- 브리프 발송 시간·요일(평일만/매일), 전달 채널(앱만/이메일/푸시)
- 외부 연동 관리(구글 캘린더, 노션 등)

## 5. DB 스키마 초안

```sql
-- 사용자는 Supabase Auth 사용 (auth.users)

create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  color text,
  created_at timestamptz default now()
);

create table tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  description text,
  status text default 'todo',          -- todo | doing | done | hold
  priority int default 2,              -- 1 높음 / 2 보통 / 3 낮음
  due_date date,
  repeat_rule text,                    -- null | daily | weekly:MON | monthly:1 ...
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table briefs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  brief_date date not null,
  content jsonb not null,              -- 섹션별 구조화 데이터
  summary_text text,                   -- (선택) AI 자연어 요약
  sent_at timestamptz,
  unique (user_id, brief_date)
);

create table user_settings (
  user_id uuid references auth.users primary key,
  brief_time time default '08:00',
  brief_weekdays_only boolean default true,
  channels jsonb default '{"app": true, "email": false}',
  timezone text default 'Asia/Seoul'
);
```

모든 테이블에 RLS(본인 데이터만 접근) 적용.

## 6. 모닝브리프 생성 파이프라인

```
[Vercel Cron 평일 08:00 KST]
        │
        ▼
/api/cron/morning-brief  (시크릿 헤더로 보호)
        │  1. 대상 사용자 조회 (user_settings)
        │  2. 데이터 수집: 오늘 마감·지연 업무, 어제 완료, (연동 시) 캘린더 일정
        │  3. (선택) Claude API로 자연어 브리핑 생성
        │  4. briefs 테이블 저장
        ▼
알림 발송 (이메일 / 웹 푸시) → 앱 홈 화면에 브리프 카드 표시
```

## 7. 화면 구성

```
├─ 홈 (오늘)          : 오늘의 브리프 카드 + 오늘 할 일 체크리스트
├─ 업무               : 전체 할 일 목록 (필터: 프로젝트/상태/마감) + 칸반 뷰
├─ 캘린더             : 마감일 기준 월간 뷰
├─ 브리프 아카이브     : 지난 브리프 날짜별 열람
└─ 설정               : 브리프 시간·채널, 프로젝트 관리, 외부 연동
```

디렉터리 구조(App Router 기준):

```
app/
├─ (auth)/login/
├─ (main)/
│  ├─ page.tsx              # 홈(오늘)
│  ├─ tasks/
│  ├─ calendar/
│  ├─ briefs/[date]/
│  └─ settings/
├─ api/
│  ├─ cron/morning-brief/route.ts
│  └─ ...
lib/
├─ supabase.ts
├─ brief/generate.ts        # 브리프 생성 로직 (수동/cron 공용)
└─ notify/email.ts
```

## 8. 단계별 로드맵

| 단계 | 범위 | 산출물 |
|------|------|--------|
| **1단계 (MVP)** | 로그인, 업무 CRUD, 홈 화면, "지금 브리프 생성" 수동 버튼 | 앱으로서 매일 쓸 수 있는 상태 |
| **2단계** | Cron 자동 브리프 + 이메일/푸시 발송, 브리프 아카이브, 반복 업무 | 아침마다 자동 브리핑 |
| **3단계** | 구글 캘린더·노션 연동, Claude API 자연어 요약, 주간 리포트 | 외부 데이터까지 통합된 브리프 |

## 9. 결정이 필요한 사항

1. **레포 위치**: 이 레포(voting-app)를 개조할지, 새 레포로 시작할지 → 새 레포 권장(투표 앱과 성격이 다름). 단, 이 레포에서 시작해도 무방.
2. **사용 인원**: 개인용이면 인증을 단순화 가능, 팀용이면 업무 배정·공유 기능 추가 필요.
3. **브리프 전달 채널 우선순위**: 이메일 vs 웹 푸시 vs 카카오톡.
4. **AI 요약 도입 시점**: MVP부터 넣을지, 3단계로 미룰지 (비용/키 관리 고려).
