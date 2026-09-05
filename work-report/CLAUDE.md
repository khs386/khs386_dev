# 업무관리 — 작업 안내

도서출판 성우 초등콘텐츠사업부의 일일·주간 업무 보고서를 만드는 사내용 웹앱입니다.
쓰는 사람은 권호상 한 명입니다. 구조·화면·설정은 `README.md`에 있으니 먼저 읽으세요.

## 어디서 도는가

- Cloudflare Workers 하나 + D1(SQLite) + Cron Triggers. 빌드 단계가 없고 서버에서
  HTML을 그려 보냅니다. 프레임워크를 새로 들이지 마세요.
- 주소는 `https://work-report.swpub.workers.dev`. `wrangler.toml`의 `name`에서
  나오므로 **이름과 주소는 건드리지 않습니다.**
- 배포는 사용자가 이 폴더에서 `npx wrangler deploy`로 합니다. 코드를 고쳤으면
  배포가 필요하다고 알려 주세요. 대신 배포하지 마세요.

## 작업 브랜치

`claude/daily-weekly-report-skills-in3ny9`

master가 아니라 여기에 커밋합니다. 고친 것은 그때그때 커밋하고 푸시하세요.

    git push -u origin claude/daily-weekly-report-skills-in3ny9

## 지켜야 할 것

1. **보고서 출력은 바이트 단위로 고정입니다.** `test/golden/`의 실제 결과물 2건과
   대조하는 골든 테스트가 있습니다. 사용자가 보고서 모양을 바꿔 달라고 하지 않는 한
   `src/lib/report/`는 손대지 마세요. 바꿔야 한다면 먼저 알리고, 골든 파일을 다시
   만든 뒤 `npm test`로 확인하세요.
2. **모든 변경 뒤 `npm test`.** 20개가 통과해야 합니다.
3. **비밀은 코드에도 git에도 넣지 않습니다.** `APP_PASSWORD`, `SESSION_SECRET`,
   `BRIEF_TOKEN`, 구글 드라이브 열쇠는 `wrangler secret put`으로만 넣습니다.
   `.dev.vars`와 `.wrangler/`는 gitignore 되어 있습니다. 열쇠 값을 화면이나 파일에
   되풀이해 적지 마세요.
4. **DB를 바꾸면 `migrations/`에 새 파일을 더하고** `package.json`에 원격·로컬
   실행 스크립트를 함께 넣으세요. 기존 마이그레이션 파일은 고치지 않습니다 — 이미
   원격에 적용되어 있습니다. D1은 파일을 위에서부터 실행하다 한 줄이 어긋나면 거기서
   멈춥니다. 여러 번 돌려도 안전하게 쓰세요 (`alter table`과 데이터 손질은 파일을
   나눕니다 — 0007과 0008이 그렇게 갈라져 있습니다).
5. **주석과 화면 글은 한국어.** 무엇을 하는지가 아니라 왜 그렇게 했는지를 적습니다.
   기존 파일의 말투를 따르세요.

## 화면을 고칠 때

눈으로 확인하고 알려 주세요. `npx wrangler dev`로 띄워 브라우저에서 실제로 봅니다.
폭·정렬 같은 것은 재서 확인하는 편이 확실합니다.

## 어디에 무엇이 있는가

    src/index.js          라우트, 로그인, cron, 브리프 받기·보여주기
    src/views/layout.js   공통 껍데기와 CSS
    src/views/pages.js    화면 여섯 개
    src/lib/db.js         D1 질의
    src/lib/report/       보고서 렌더러 (골든 테스트로 묶여 있음)
    src/lib/drive.js      구글 드라이브 업로드
    migrations/           스키마 변경
    test/golden/          보고서 기대 결과물

## 모닝브리프

아침마다 클라우드의 Claude가 구글 캘린더·Gmail을 읽어 브리프를 만들어
`POST /api/brief`로 보냅니다. 앱은 받아서 보여주기만 합니다.

브리프 HTML은 바깥에서 오므로 앱이 화면에서 한 번 더 손봅니다 — `src/index.js`의
`prepareBriefHtml`과 `BRIEF_FIXUP`입니다. 버튼 모양·자리, 다크 모드 단추 제거,
글자 크기 맞추기가 거기서 이뤄집니다. 브리프 문서 자체를 믿고 그리지 마세요.

받아 온 브리프는 `iframe`에 `sandbox="allow-scripts allow-popups
allow-popups-to-escape-sandbox"`로 가둡니다. `allow-same-origin`은 주지 않습니다.
