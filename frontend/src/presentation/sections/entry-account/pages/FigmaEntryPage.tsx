import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { HomeMotionContext, revealEase } from '../../../design/motion'
import { ProductFrameView as DesignFrameView } from '../../../design/ProductFrameView'
import { allText, useDesignAssets, useDesignCatalog } from '../../../design/hooks'
import type { Layer, PrototypeAction } from '../../../design/types'

type EntryScreen = 'welcome' | 'service' | 'login' | 'workspaces'
const frames = {
  welcome: { desktop: '7:2', mobile: '7:3' },
  service: { desktop: '7:4', mobile: '7:5' },
  login: { desktop: '2029:22748', mobile: '2029:22993' },
  workspaces: { desktop: '7:6', mobile: '7:6' },
}
const destinations: Record<string, string> = {
  '7:2': '/welcome',
  '7:3': '/welcome',
  '7:4': '/how-it-works',
  '7:5': '/how-it-works',
  '7:6': '/workspaces',
  '2029:22748': '/login',
  '2029:22993': '/login',
  '137:17712': '/dispatcher/orders',
  '7:27': '/loader/queue',
  '353:21235': '/driver/home',
  '7:15': '/store-manager/orders',
}

export default function FigmaEntryPage({ screen }: { screen: EntryScreen }) {
  const navigate = useNavigate()
  const catalog = useDesignCatalog().data
  const assets = useDesignAssets().data
  const [width, setWidth] = useState(window.innerWidth)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loginError, setLoginError] = useState(false)
  const [remember, setRemember] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [recoveryComplete, setRecoveryComplete] = useState(false)
  const recoveryRef = useRef<HTMLDialogElement>(null)
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    if (recovery) recoveryRef.current?.showModal()
    else recoveryRef.current?.close()
  }, [recovery])
  const mobile = width < 768
  const frameId =
    screen === 'login' && loginError && !mobile
      ? '2029:22952'
      : frames[screen][mobile ? 'mobile' : 'desktop']
  const frame = catalog?.frames.find((f) => f.id === frameId)
  if (!catalog || !assets || !frame) return <p>Opening Waypoint…</p>
  function onAction(action: PrototypeAction) {
    const target = action.destinationId && destinations[action.destinationId]
    if (target) {
      navigate(target)
      window.scrollTo(0, 0)
    } else if (action.type === 'BACK') navigate(-1)
  }
  function activate(layer: Layer) {
    const label = allText(layer)
    if (/sign in/i.test(label) && layer.name.startsWith('Button/')) {
      signIn()
      return true
    }
    if (/continue with.*sso/i.test(label)) {
      setValues({})
      navigate('/workspaces')
      return true
    }
    if (/forgot/i.test(label)) {
      setRecoveryComplete(false)
      setRecovery(true)
      return true
    }
    if (/back to welcome/i.test(label)) {
      navigate('/welcome')
      return true
    }
    if (layer.name === 'Checkbox') {
      setRemember((current) => !current)
      return true
    }
    return false
  }
  function signIn() {
    // A local demo session only; credentials are never persisted or sent.
    if (!values['Email or employee ID']?.trim() || !values.Password?.trim()) setLoginError(true)
    else {
      setLoginError(false)
      setValues({})
      navigate('/workspaces')
    }
  }
  return (
    <main className="figma-entry">
      <div
        onKeyDown={(event) => {
          if (
            screen === 'login' &&
            event.key === 'Enter' &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault()
            signIn()
          }
        }}
      >
        <HomeMotionContext.Provider value={screen === 'welcome'}>
          <DesignFrameView
            id={frameId}
            catalog={catalog}
            assets={assets}
            onAction={onAction}
            controls={
              screen === 'login'
                ? {
                    values: { ...values, Remember: String(remember) },
                    change: (field, value) =>
                      setValues((current) => ({ ...current, [field]: value })),
                    activate,
                  }
                : undefined
            }
          />
        </HomeMotionContext.Provider>
      </div>
      <motion.dialog
        ref={recoveryRef}
        className="figma-account-dialog"
        onCancel={() => setRecovery(false)}
        onClose={() => setRecovery(false)}
        data-motion="popup"
        data-motion-reduced={Boolean(reducedMotion)}
        initial={false}
        animate={{ opacity: recovery ? 1 : 0, y: recovery || reducedMotion ? 0 : 10 }}
        transition={{ duration: reducedMotion ? 0 : 0.22, ease: revealEase }}
      >
        <h2>{recoveryComplete ? 'Recovery requested' : 'Recover access'}</h2>
        {recoveryComplete ? (
          <p>Your demo request is saved for this session. No message was sent.</p>
        ) : (
          <>
            <p>Enter your email or employee ID.</p>
            <label>
              Email or employee ID
              <input
                value={values['Email or employee ID'] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    'Email or employee ID': event.target.value,
                  }))
                }
              />
            </label>
          </>
        )}
        <div>
          <button onClick={() => setRecovery(false)}>Cancel</button>
          <button
            disabled={!recoveryComplete && !values['Email or employee ID']?.trim()}
            onClick={() => (recoveryComplete ? setRecovery(false) : setRecoveryComplete(true))}
          >
            {recoveryComplete ? 'Done' : 'Request recovery'}
          </button>
        </div>
      </motion.dialog>
      {screen === 'login' && loginError && mobile && (
        <p className="figma-mobile-login-error" role="alert">
          Incorrect email or password. 2 attempts left before a 5-minute lock.
        </p>
      )}
    </main>
  )
}
