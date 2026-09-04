import './globals.css'

export const metadata = {
  title: '업무보고서',
  description: '일일·주간 업무보고서 생성 앱',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
