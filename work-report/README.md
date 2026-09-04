# 📋 업무보고서 — 일일 · 주간 통합 앱

노션을 읽어 보고서를 만들던 두 스킬(`daily-work-report-sungwoobook`, `weekly-work-report`)을
하나의 웹앱으로 옮긴 것입니다. 업무 데이터를 앱이 직접 갖고 있어, 조회 단계에서 생기던
누락·타임존 오차·formula 값 판독 실패가 없습니다.

Cloudflare Workers 하나에 다 들어 있습니다. 화면도, 데이터베이스(D1)도, 정해진 시각의
자동 실행(Cron Triggers)도 같은 계정 안에서 돌아갑니다.

결과물은 기존 보고서와 **바이트 단위로 같습니다.** `test/golden/`의 실제 결과물 2건을
기준으로 자동 검증합니다.

## 무엇을 하는가

- 단위 업무를 등록하고 상태·진행률·마감을 관리합니다.
- 하루치 진행 내역을 적으면 **일일 업무 보고서** HTML을 만듭니다.
- 주차별 전주 실적·금주 예정을 채우면 **주간업무 보고서** HTML을 만듭니다.
- 만든 보고서를 **구글 드라이브 지정 폴더**에 저장합니다. 같은 이름이면 덮어씁니다.
- 평일 18시(일일)·금요일 17시(주간)에 자동 생성합니다. 주말과 공휴일은 건너뜁니다.

## 화면

| 경로 | 하는 일 |
|---|---|
| `/` | 오늘 기록 현황, 마감 임박 업무, 보고서 만들기 바로가기 |
| `/tasks` | 단위 업무 등록·수정·보관 |
| `/daily` | 날짜별 진행 내역과 세부내용 입력 |
| `/weekly` | 주차별 전주 실적 / 금주 예정 관리 |
| `/series` | 시리즈 추가·삭제·순서·색과 총 진행률 입력 |
| `/reports` | 보고서 생성, 미리보기, 드라이브 저장, 내려받기, 이력 |

`docs/mockup.html`을 브라우저로 열면 화면 여섯 개를 표본 데이터로 미리 볼 수 있습니다.

## 설치

### 1. 준비

```bash
cd work-report
npm install
npx wrangler login      # 브라우저가 열리고 계정 승인
```

### 2. 데이터베이스 만들기

```bash
npx wrangler d1 create work-report
```

출력에 나오는 `database_id`를 `wrangler.toml`의 같은 자리에 붙여넣습니다. 그런 다음 표를 만듭니다.

```bash
npm run db:init          # 원격(실제로 쓰는 곳)
npm run db:init:local    # 로컬 개발용 — 필요할 때만
```

이미 쓰고 있는 데이터베이스라면 나중에 추가된 변경만 따로 적용합니다.

```bash
npm run db:migrate       # 시리즈에 색 칸 추가 (0002)
```

### 3. 비밀값 넣기

`wrangler secret put`으로 하나씩 넣습니다. 실행하면 값을 물어봅니다.

```bash
npx wrangler secret put APP_PASSWORD      # 앱에 로그인할 비밀번호
npx wrangler secret put SESSION_SECRET    # 쿠키 서명용 임의 문자열 (길수록 좋음)
```

구글 드라이브에 저장하려면 아래 셋도 넣습니다. 준비 방법은 다음 절에 있습니다.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
```

작성자 표기는 비밀값이 아니라 `wrangler.toml`의 `[vars]`에 있습니다. 이름이 바뀌면 거기서 고칩니다.

### 4. 구글 드라이브 준비

보고서를 **본인 계정 권한으로** 드라이브에 올립니다. 서비스 계정은 저장 공간이 없어
개인 드라이브에 파일을 만들 수 없으므로(`Service Accounts do not have storage quota`)
사용자 권한 위임(OAuth) 방식을 씁니다. 올라간 파일은 본인 소유가 됩니다.

1. 드라이브에서 보고서를 담을 폴더를 만듭니다. 주소의 `folders/` 뒤가 **폴더 ID**입니다.
2. [Google Cloud 콘솔](https://console.cloud.google.com)에서 프로젝트를 만들고 **Google Drive API**를 켭니다.
3. **OAuth 동의 화면**을 설정합니다. 배포된 앱 주소를 그대로 쓰면 됩니다.
   앱에 `/privacy` 와 `/terms` 페이지가 들어 있어 로그인 없이 열립니다.
   - User Type: **외부(External)**
   - 앱 이름·지원 이메일만 채우면 됩니다
   - 범위(Scope)는 추가하지 않아도 됩니다
   - 브랜딩 화면에서 아래 세 가지를 채워야 게시가 열립니다
     - 애플리케이션 홈페이지: `https://work-report.<계정>.workers.dev`
     - 개인정보처리방침 링크: 위 주소 + `/privacy`
     - 승인된 도메인: `<계정>.workers.dev`
   - 설정 후 **게시 상태를 '프로덕션'으로 바꾸세요.** '테스트' 상태로 두면
     연결이 **7일마다 끊깁니다.**
4. **사용자 인증 정보 → OAuth 클라이언트 ID**를 만듭니다.
   - 애플리케이션 유형: **데스크톱 앱**
   - 만들면 **클라이언트 ID**와 **클라이언트 보안 비밀**이 나옵니다
5. 아래 명령으로 접근 권한을 한 번 받아 그대로 등록합니다.

```bash
node scripts/get-google-token.mjs <클라이언트_ID> <클라이언트_보안_비밀> \
  | npx wrangler secret put GOOGLE_REFRESH_TOKEN
```

브라우저가 열리면 본인 구글 계정으로 로그인하고 허용하면 됩니다.
"이 앱은 확인되지 않았습니다" 경고가 나오면 **고급 → 이동**을 누르세요.
본인이 만든 앱이고, 권한은 **이 앱이 만든 파일만** 다루는 범위(`drive.file`)로 한정됩니다.

나머지 세 개도 등록합니다.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
```

### 5. 배포

```bash
npm run deploy
```

`https://work-report.<계정>.workers.dev` 주소가 나옵니다. 들어가서 `APP_PASSWORD`로 로그인합니다.

### 로컬에서 확인하려면

`.dev.vars` 파일에 값을 적어 두면 `npm run dev`로 띄울 수 있습니다. 이 파일은 커밋되지 않습니다.

```
APP_PASSWORD=아무거나
SESSION_SECRET=아무거나
```

## 자동 생성

`wrangler.toml`의 `[triggers]`에 들어 있어서 배포하면 함께 등록됩니다.

- `0 9 * * *` → 매일 18:00 KST · 일일 보고서
- `0 8 * * 5` → 금요일 17:00 KST · 주간 보고서

시각은 UTC 기준이라 한국 시각에서 9시간을 뺀 값입니다. 주말과 공휴일은 코드가 판단해
건너뜁니다. 공휴일 목록은 `settings` 표에 있습니다.

어느 보고서를 만들지는 실행된 시각으로 가릅니다. UTC 8시는 주간, 그 밖은 일일입니다.
실행 기록은 `npx wrangler tail`로 볼 수 있습니다.

## 결과물이 달라지지 않게 하는 장치

`npm test`가 두 층을 확인합니다.

1. **골든 테스트** — 고정 입력을 넣으면 `test/golden/`의 실제 결과물과
   한 글자도 다르지 않은 HTML이 나오는지 봅니다.
2. **배선 테스트** — 실제 D1 표와 같은 모양의 행을 가짜 데이터베이스에 넣고,
   행에서 HTML까지 이어지는 경로가 같은 결과물을 내는지 봅니다.

색상 구간, 정렬 순서, 집계에서 빼는 항목처럼 눈으로 놓치기 쉬운 규칙도 개별 테스트로
고정해 두었습니다. 렌더링을 손볼 일이 생기면 이 테스트가 먼저 알려 줍니다.

### 일일 보고서에만 씌우는 문서 껍데기

기존 일일 보고서는 `<table>`로 시작하는 조각이라 문자 인코딩 선언이 없습니다.
메일 본문에 붙일 때는 문제가 없지만, 파일로 내려받거나 드라이브에서 열면 한글이 깨집니다.
그래서 저장할 때만 `<!DOCTYPE html>`과 `<meta charset="UTF-8">`을 붙인 문서로 감쌉니다.
**보고서 내용 자체는 한 글자도 바뀌지 않습니다** — 이것도 테스트로 확인합니다.
주간 보고서는 원래 완결 문서라 그대로 둡니다.

## 옮겨 온 규칙

기존 스킬에서 그대로 가져온 것들입니다.

- 요약 카드는 "기타 사항"(일일)과 업무 유형에 "기타"가 든 항목(주간)을 세지 않습니다.
  표와 상세 카드에는 그대로 남습니다.
- 마감이 없는 업무는 D-day를 붙이지 않고, 가장 빠른 마감 계산에서 빠지며, 목록 맨 뒤로 갑니다.
- 진행률이 0%이거나 비어 있으면 진행률 바에 나오지 않습니다.
- 진행률 바 색은 5구간입니다. 0%는 회색, 1~24% 빨강, 25~49% 주황, 50~74% 파랑, 75~100% 초록.
- 시리즈 막대 색은 진행률과 무관합니다. `/series`에서 고른 색이 그대로 쓰이고,
  고르지 않으면 기존 시리즈의 색(꼬마생각뒤집기 파랑, 꼬마역사뒤집기 주황, 꼬마 일력 보라)을
  씁니다. 높이는 진행률의 2.2배입니다.
- 전주 실적은 완료·종결을 먼저, 그다음 D-day 오름차순, 같으면 시리즈 순서로 놓습니다.
- 주차 표기는 `(일 - 1) // 7 + 1` 로 계산합니다.

## 구성

```
src/
  index.js          라우터 · 자동 실행 진입점
  lib/
    report/         보고서 렌더러 — 의존성 없는 순수 함수, 손대지 않음
    db.js           D1 접근
    reports.js      DB 행 → 렌더러 입력 → 저장
    auth.js         비밀번호 + 서명 쿠키
    drive.js        구글 드라이브 업로드 (사용자 OAuth)
  views/            화면 HTML (legal.js는 로그인 없이 열리는 약관·방침 페이지)
migrations/         D1 스키마
test/               골든 파일과 테스트
```
