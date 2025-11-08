import { useInstallPrompt } from '../hooks/useInstallPrompt'

type Props = {
  variant?: 'card' | 'inline'
}

function InstallPrompt({ variant = 'card' }: Props) {
  const { canInstall, promptInstall, isInstalled } = useInstallPrompt()
  const className = ['install-banner']
  if (variant === 'card') className.push('section-card')

  if (isInstalled) {
    return (
      <div className={className.join(' ')}>
        <div>
          <strong>インストール済み</strong>
          <p style={{ margin: 0, color: 'var(--text-dim)' }}>
            ホーム画面からすぐにアクセスできます
          </p>
        </div>
      </div>
    )
  }

  if (!canInstall) return null

  return (
    <div className={className.join(' ')}>
      <div>
        <strong>アプリをホームに追加</strong>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          オフライン時でもワンタップで開けます
        </p>
      </div>
      <button type="button" className="primary-btn" onClick={promptInstall}>
        追加する
      </button>
    </div>
  )
}

export default InstallPrompt
