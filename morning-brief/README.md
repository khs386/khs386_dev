# ☀️ 모닝브리프 — 소규모 팀 업무관리 앱 (MVP)

아침마다 하루를 브리핑해 주는 팀(10인 이내) 업무관리 앱입니다.
전부 무료 티어(Supabase Free + Vercel Hobby)로 운영 가능합니다.

## MVP 기능

- 이메일/비밀번호 로그인, 초대코드 기반 팀원 가입
- 업무 CRUD: 제목·마감일·우선순위(높음/보통/낮음)·상태(예정/진행/완료/보류)·담당자 배정
- 팀 전체 업무 공유 + "내 업무만" 필터
- 홈(오늘): 오늘 마감·지연 업무 체크리스트, 빠른 추가
- 모닝브리프 수동 생성: 오늘의 우선순위 Top 3 / 오늘 마감 / 지연 / 어제 완료
- 브리프 아카이브 (날짜별 열람)

> 자동 아침 발송(cron)·이메일/푸시·캘린더 연동은 2~3단계에서 추가 예정
> (전체 로드맵: `../docs/morning-brief-app-proposal.md`)

## 설정 방법

### 1. Supabase 준비 (무료)

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. **SQL Editor**에서 `schema.sql` 내용 전체 실행
3. (선택) Authentication → Providers → Email에서 **Confirm email을 끄면**
   팀원이 확인 메일 없이 바로 가입됩니다. 켜 두면 가입 시 확인 메일을 거칩니다.

### 2. 로컬 실행

```bash
cd morning-brief
cp .env.local.example .env.local   # Supabase URL/키, 초대코드 입력
npm install
npm run dev                        # http://localhost:3000
```

### 3. Vercel 배포 (무료)

1. Vercel에서 이 저장소 import
2. **Root Directory를 `morning-brief`로 지정**
3. 환경변수 3개 등록: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_INVITE_CODE`
4. 배포 후 팀원에게 주소와 초대코드 공유

## 알아둘 점

- **초대코드**는 가입 화면에서 간단히 확인하는 용도입니다(클라이언트 검증).
  팀원이 모두 가입한 뒤에는 Supabase에서 신규 가입(Sign up)을 꺼 두는 것을 권장합니다.
- 브리프의 "내 업무" 기준: 나에게 배정된 업무 + 담당자 없이 내가 만든 업무
- Vercel Hobby는 비상업 용도 조건이 있습니다. 회사 공식 도구로 정식 운영할 때는
  Vercel Pro 전환을 검토하세요.
