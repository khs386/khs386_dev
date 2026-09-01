import './globals.css'

export const metadata = {
  title: '모닝브리프',
  description: '아침마다 하루를 브리핑해 주는 팀 업무관리 앱',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
