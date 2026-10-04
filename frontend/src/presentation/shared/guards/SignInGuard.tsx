import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getUser } from '../../../infrastructure/http/apiClient'

const IS_REAL_BACKEND = !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''

/** Screens shared by every role need someone signed in whenever a real backend is in use. */
export function SignInGuard({ children }: { children: ReactNode }) {
  if (IS_REAL_BACKEND && !getUser()) return <Navigate to="/login" replace />
  return <>{children}</>
}
