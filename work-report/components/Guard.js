'use client'
import { useSession } from '../lib/useSession'
import NavBar from './NavBar'

/** 로그인 확인 + 공통 레이아웃. 확인 중에는 빈 화면을 보여준다. */
export default function Guard({ children, narrow }) {
  const session = useSession()
  if (!session) return null
  return (
    <>
      <NavBar />
      <main className={narrow ? 'container narrow' : 'container'}>{children}</main>
    </>
  )
}
