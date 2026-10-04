import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { Modal } from '../../../shared/molecules/Common'
import { Button } from '../../../shared/atoms/button'
import { Wordmark } from '../components/EntryChrome'
import { ApiError, login as apiLogin } from '../../../../infrastructure/http/apiClient'

const IS_REAL_BACKEND =
  !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''

/**
 * Sign-in page.
 *
 * When VITE_API_URL is configured: calls the real /auth/login endpoint and stores
 * the JWT in localStorage. On success navigates to /workspaces.
 *
 * When VITE_API_URL is not set: any filled-in credentials open the workspace chooser
 * without an API call (demo behaviour unchanged).
 */
const ROLE_HOME_MAP: Record<string, string> = {
  DISPATCHER: '/dispatcher/orders',
  LOADER: '/loader/queue',
  DRIVER: '/driver/home',
  STORE_MANAGER: '/store-manager/overview',
  ADMIN: '/administration/team',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [failed, setFailed] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [recovery, setRecovery] = useState<'closed' | 'request' | 'sent'>('closed')
  const [recoveryId, setRecoveryId] = useState('')

  async function performLogin(user: string, pass: string) {
    if (!user.trim() || !pass.trim()) {
      setFailed(true)
      setErrorMsg('Please enter your username and password.')
      return
    }
    setFailed(false)
    setErrorMsg('')

    if (IS_REAL_BACKEND) {
      setLoading(true)
      try {
        const resp = await apiLogin(user.trim(), pass)
        const target = ROLE_HOME_MAP[resp.user.role] ?? '/workspaces'
        navigate(target)
      } catch (err) {
        setFailed(true)
        setErrorMsg(
          err instanceof ApiError && err.status === 401
            ? 'Incorrect username or password.'
            : 'Sign-in failed. Check your connection and try again.',
        )
      } finally {
        setLoading(false)
      }
    } else {
      // Demo mode: any credentials work
      navigate('/workspaces')
    }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    await performLogin(identifier, password)
  }
  return (
    <div className="entry-login">
      <div className="entry-login-photo">
        <blockquote>
          <p>“Ready before the doors open.”</p>
          <footer>Waypoint dispatch, before sunrise.</footer>
        </blockquote>
      </div>
      <main className="entry-login-panel">
        <form className="entry-login-form" onSubmit={signIn} noValidate>
          <Wordmark />
          <h1>Sign in to Waypoint</h1>
          <p className="entry-login-lead">Enter your workspace credentials to continue.</p>
          {failed && (
            <p className="entry-login-error" role="alert">
              <CircleAlert size={16} />
              {errorMsg || 'Incorrect credentials.'}
            </p>
          )}
          <label className="entry-field">
            Email or employee ID
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="you@waypointgroup.lk"
              autoComplete="username"
              aria-invalid={failed}
            />
          </label>
          <label className="entry-field">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              aria-invalid={failed}
            />
          </label>
          <div className="entry-login-options">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span className="entry-hide-mobile">Keep me signed in</span>
              <span className="entry-show-mobile">Keep signed in</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setRecoveryId(identifier)
                setRecovery('request')
              }}
            >
              <span className="entry-hide-mobile">Forgot password?</span>
              <span className="entry-show-mobile">Forgot?</span>
            </button>
          </div>
          <button type="submit" className="entry-button entry-button-primary entry-button-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="entry-divider">or</div>
          <button
            type="button"
            className="entry-button entry-button-muted entry-button-block"
            onClick={() => navigate('/workspaces')}
          >
            <span className="entry-hide-mobile">Continue with Waypoint SSO</span>
            <span className="entry-show-mobile">Continue with SSO</span>
          </button>
          <p className="entry-login-help">
            Trouble signing in? Contact your dispatcher administrator.
          </p>
        </form>
      </main>
      <Modal
        title={recovery === 'sent' ? 'Recovery requested' : 'Recover access'}
        description={
          recovery === 'sent'
            ? 'Your demo request is saved for this session. No message was sent.'
            : 'Enter your email or employee ID.'
        }
        open={recovery !== 'closed'}
        onOpenChange={(open) => !open && setRecovery('closed')}
      >
        {recovery === 'request' && (
          <label className="entry-field">
            Email or employee ID
            <input
              value={recoveryId}
              onChange={(event) => setRecoveryId(event.target.value)}
              placeholder="you@waypointgroup.lk"
            />
          </label>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setRecovery('closed')}>
            {recovery === 'sent' ? 'Close' : 'Cancel'}
          </Button>
          {recovery === 'request' && (
            <Button disabled={!recoveryId.trim()} onClick={() => setRecovery('sent')}>
              Request recovery
            </Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
