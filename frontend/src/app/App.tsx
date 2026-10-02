import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom'
import WorkspaceLayout from '../presentation/shared/templates/WorkspaceLayout'

import { Button } from '../presentation/shared/atoms/button'

const FigmaEntryPage = lazy(
  () => import('../presentation/sections/entry-account/pages/FigmaEntryPage'),
)
const FigmaAccountPage = lazy(
  () => import('../presentation/sections/entry-account/pages/FigmaAccountPage'),
)
const FigmaDispatcherPage = lazy(
  () => import('../presentation/sections/dispatcher/pages/FigmaDispatcherPage'),
)
const FigmaStorePage = lazy(
  () => import('../presentation/sections/store-manager/pages/FigmaStorePage'),
)
const FigmaLoaderPage = lazy(() => import('../presentation/sections/loader/pages/FigmaLoaderPage'))
const FigmaDriverPage = lazy(() => import('../presentation/sections/driver/pages/FigmaDriverPage'))
const FigmaAdminPage = lazy(
  () => import('../presentation/sections/administration/pages/FigmaAdminPage'),
)
const RecoveryPage = lazy(() => import('../presentation/sections/recovery/pages/RecoveryPage'))
const DemoMapPage = lazy(() => import('../presentation/design/DemoMapPage'))
const DemoPage = lazy(() => import('../presentation/design/DemoPage'))
const DesignReferencePage = lazy(() => import('../presentation/design/DesignReferencePage'))
const ResponsiveFixturePage = lazy(() => import('../presentation/design/ResponsiveFixturePage'))

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
            <Route path="/demo/responsive/:frameId" element={<ResponsiveFixturePage />} />
            <Route path="/design" element={<DesignReferencePage />} />
            <Route path="/design/:frameId" element={<DesignReferencePage />} />
            <Route path="/" element={<Navigate to="/dispatcher/orders" replace />} />
            <Route path="/welcome" element={<FigmaEntryPage screen="welcome" />} />
            <Route path="/how-it-works" element={<FigmaEntryPage screen="service" />} />
            <Route path="/login" element={<FigmaEntryPage screen="login" />} />
            <Route path="/workspaces" element={<FigmaEntryPage screen="workspaces" />} />
            <Route path="/store-manager/overview" element={<FigmaStorePage />} />
            <Route path="/store-manager/orders" element={<FigmaStorePage />} />
            <Route path="/store-manager/deliveries" element={<FigmaStorePage />} />
            <Route path="/store-manager/alerts" element={<FigmaStorePage />} />
            <Route path="/administration/team" element={<FigmaAdminPage />} />
            <Route path="/administration/roles" element={<FigmaAdminPage />} />
            <Route
              path="/administration/assignments"
              element={<FigmaAdminPage key="assignments" />}
            />
            <Route path="/administration/audit" element={<FigmaAdminPage />} />
            <Route path="/loader/queue" element={<FigmaLoaderPage />} />
            <Route path="/loader/loading" element={<FigmaLoaderPage />} />
            <Route path="/loader/proof" element={<FigmaLoaderPage />} />
            <Route path="/dispatcher/orders" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/planning" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/deferrals" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/review" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/release" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/fleet" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/tracking" element={<FigmaDispatcherPage />} />
            <Route path="/dispatcher/analytics" element={<FigmaDispatcherPage />} />
            <Route path="/driver/home" element={<FigmaDriverPage />} />
            <Route path="/driver/route" element={<FigmaDriverPage />} />
            <Route path="/driver/delivery" element={<FigmaDriverPage />} />
            <Route path="/driver/issues" element={<FigmaDriverPage />} />
            <Route path="/recovery" element={<FigmaDriverPage />} />
            <Route path="/account/profile" element={<FigmaAccountPage key="profile" />} />
            <Route path="/account/settings" element={<FigmaAccountPage key="settings" />} />
            <Route
              path="/account/notifications"
              element={<FigmaAccountPage key="notifications" />}
            />
            <Route element={<WorkspaceLayout />}>
              <Route path="/recovery/review" element={<RecoveryPage />} />
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
