import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom'
import { DriverRuntimeBoundary } from '../presentation/sections/driver/hooks/DriverRuntime'
import WorkspaceLayout from '../presentation/shared/templates/WorkspaceLayout'
import { appRoutes, roleModules, appModules } from '../presentation/roles/registry'
import { RoleRouteGuard, ROLE_HOME_MAP } from '../presentation/shared/guards/RoleRouteGuard'
import { getUser } from '../infrastructure/http/apiClient'

import { Button } from '../presentation/shared/atoms/button'

const DemoMapPage = lazy(() => import('../presentation/design/DemoMapPage'))
const DemoPage = lazy(() => import('../presentation/design/DemoPage'))

class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info)
  }
  render() {
    return this.state.error ? (
      <div className="empty-state">
        <h1>We couldn’t open this screen.</h1>
        <p>Your saved evidence remains in browser storage.</p>
        <Button onClick={() => window.location.reload()}>Reload workspace</Button>
      </div>
    ) : (
      this.props.children
    )
  }
}
// Routes come from each module's definition in presentation/sections/<module>/index.ts.
const standaloneRoutes = appRoutes.filter((route) => !route.shell)
const sharedShellRoutes = appModules
  .filter((mod) => !roleModules.some((rm) => rm.key === mod.key))
  .flatMap((mod) => mod.routes.filter((route) => route.shell))

function NotFoundView() {
  const navigate = useNavigate()
  const user = getUser()
  const roleUpper = (user?.role || '').toUpperCase()
  const homePath = user ? (ROLE_HOME_MAP[roleUpper] ?? '/workspaces') : '/welcome'

  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>The screen or address you requested does not exist.</p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Link to={homePath}>
          <Button>{user ? 'Go to your workspace' : 'Back to home'}</Button>
        </Link>
      </div>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DriverRuntimeBoundary>
          <Suspense
            fallback={
              <div className="min-h-[70dvh] grid place-items-center text-muted-foreground">
                Opening your workspace…
              </div>
            }
          >
            <Routes>
              <Route path="/demo/map" element={<DemoMapPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/" element={<Navigate to="/welcome" replace />} />
              {standaloneRoutes.map(({ path, component: Page }) => (
                <Route key={path} path={path} element={<Page />} />
              ))}
              <Route element={<WorkspaceLayout />}>
                {roleModules.map((module) =>
                  module.routes
                    .filter((route) => route.shell)
                    .map(({ path, component: Page }) => (
                      <Route
                        key={path}
                        path={path}
                        element={
                          <RoleRouteGuard allowedRole={module.key}>
                            <Page />
                          </RoleRouteGuard>
                        }
                      />
                    )),
                )}
                {sharedShellRoutes.map(({ path, component: Page }) => (
                  <Route key={path} path={path} element={<Page />} />
                ))}
                <Route path="*" element={<NotFoundView />} />
              </Route>
            </Routes>
          </Suspense>
        </DriverRuntimeBoundary>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
