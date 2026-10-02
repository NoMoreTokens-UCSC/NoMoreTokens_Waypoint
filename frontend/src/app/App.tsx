import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import WorkspaceLayout from '../presentation/shared/templates/WorkspaceLayout'
import { appRoutes } from '../presentation/roles/registry'
import { entryRedirects } from '../presentation/sections/entry-account'

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
const shellRoutes = appRoutes.filter((route) => route.shell)
export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
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
            <Route path="/" element={<Navigate to="/dispatcher/orders" replace />} />
            {Object.entries(entryRedirects).map(([path, target]) => (
              <Route key={path} path={path} element={<Navigate to={target} replace />} />
            ))}
            {standaloneRoutes.map(({ path, component: Page }) => (
              <Route key={path} path={path} element={<Page />} />
            ))}
            <Route element={<WorkspaceLayout />}>
              {shellRoutes.map(({ path, component: Page }) => (
                <Route key={path} path={path} element={<Page />} />
              ))}
              <Route
                path="*"
                element={
                  <div className="empty-state">
                    <h1>Screen not found</h1>
                    <p>Choose a workspace to continue.</p>
                    <Link to="/welcome">
                      <Button>Choose workspace</Button>
                    </Link>
                  </div>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
