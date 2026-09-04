'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp(form)
        if (error) throw error
        if (data.session) router.replace('/')
        else {
          setMessage('확인 메일을 보냈습니다. 링크를 누른 뒤 로그인해 주세요.')
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(form)
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
        <h1>📋 업무보고서</h1>
        <p className="muted">일일·주간 업무보고서를 만들고 드라이브에 저장합니다</p>
        <form onSubmit={submit} className="auth-form">
          <input type="email" placeholder="이메일" value={form.email} onChange={set('email')} required />
          <input
            type="password" placeholder="비밀번호 (6자 이상)" value={form.password}
            onChange={set('password')} minLength={6} required
          />
          <button className="btn" disabled={busy}>
            {busy ? '처리 중…' : mode === 'signup' ? '가입하기' : '로그인'}
          </button>
        </form>
        {message && <p className="notice">{message}</p>}
        <button className="link-btn" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
          {mode === 'login' ? '계정 만들기 →' : '← 로그인으로 돌아가기'}
        </button>
      </div>
    </main>
  )
}
