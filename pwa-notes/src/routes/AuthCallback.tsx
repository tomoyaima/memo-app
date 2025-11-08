import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthCallback() {
  const { completeRedirect, error, loading } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending')
  const code = searchParams.get('code')
  const state = searchParams.get('state') ?? undefined
  const errorDescription = searchParams.get('error_description')

  useEffect(() => {
    if (!code) {
      setStatus('error')
      return
    }
    completeRedirect({ code, state })
      .then(() => {
        setStatus('done')
        navigate('/', { replace: true })
      })
      .catch(() => {
        setStatus('error')
      })
  }, [code, state, completeRedirect, navigate])

  const message = (() => {
    if (status === 'done') return 'ログインに成功しました。リダイレクトしています...'
    if (status === 'error')
      return errorDescription ?? error ?? 'ログイン処理でエラーが発生しました。'
    return 'ログインを完了しています...'
  })()

  return (
    <div className="section-card">
      <h2>サインイン処理中</h2>
      <p style={{ color: 'var(--text-dim)' }}>{message}</p>
      {loading && <p style={{ color: 'var(--text-dim)' }}>しばらくお待ちください...</p>}
    </div>
  )
}
