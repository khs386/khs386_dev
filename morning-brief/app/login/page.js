'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // login | signup
  const [form, setForm] = useState({ name: '', email: '', password: '', invite: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const inviteCode = process.env.NEXT_PUBLIC_INVITE_CODE
        if (inviteCode && form.invite !== inviteCode) {
          setMessage('초대코드가 올바르지 않습니다.')
          return
        }
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name.trim() } },
        })
        if (error) throw error
        if (data.session) {
          router.replace('/')
        } else {
          setMessage('확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.')
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error
        router.replace('/')
      }
    } catch (err) {
      setMessage('실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <h1>☀️ 모닝브리프</h1>
        <p className="muted">아침마다 하루를 브리핑해 주는 팀 업무관리</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <input placeholder="이름" value={form.name} onChange={set('name')} required />
          )}
          <input
            type="email"
            placeholder="이메일"
            value={form.email}
            onChange={set('email')}
            required
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={form.password}
            onChange={set('password')}
            minLength={6}
            required
          />
          {mode === 'signup' && (
            <input
              placeholder="팀 초대코드"
              value={form.invite}
              onChange={set('invite')}
              required
            />
          )}
          <button className="btn" disabled={busy}>
            {busy ? '처리 중…' : mode === 'signup' ? '가입하기' : '로그인'}
          </button>
        </form>
        {message && <p className="notice">{message}</p>}
        <button
          className="link-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMessage('')
          }}
        >
          {mode === 'login' ? '팀원 가입하기 →' : '← 로그인으로 돌아가기'}
        </button>
      </div>
    </main>
  )
}
