import { describe, expect, it } from 'vitest'
import {
  ROLE_ALLOWED_WORKSPACES,
  ROLE_HOME_MAP,
} from './RoleRouteGuard'

describe('RoleRouteGuard configuration', () => {
  it('maps each backend role to the correct home path', () => {
    expect(ROLE_HOME_MAP.DISPATCHER).toBe('/dispatcher/orders')
    expect(ROLE_HOME_MAP.LOADER).toBe('/loader/queue')
    expect(ROLE_HOME_MAP.DRIVER).toBe('/driver/home')
    expect(ROLE_HOME_MAP.STORE_MANAGER).toBe('/store-manager/overview')
    expect(ROLE_HOME_MAP.ADMIN).toBe('/administration/team')
  })

  it('restricts LOADER exclusively to loader workspace', () => {
    const allowed = ROLE_ALLOWED_WORKSPACES.LOADER
    expect(allowed).toEqual(['loader'])
    expect(allowed.includes('dispatcher')).toBe(false)
    expect(allowed.includes('driver')).toBe(false)
    expect(allowed.includes('store-manager')).toBe(false)
    expect(allowed.includes('administration')).toBe(false)
  })

  it('restricts DISPATCHER to dispatcher workspace', () => {
    const allowed = ROLE_ALLOWED_WORKSPACES.DISPATCHER
    expect(allowed).toEqual(['dispatcher'])
    expect(allowed.includes('loader')).toBe(false)
    expect(allowed.includes('driver')).toBe(false)
  })

  it('restricts DRIVER to driver workspace', () => {
    const allowed = ROLE_ALLOWED_WORKSPACES.DRIVER
    expect(allowed).toEqual(['driver'])
    expect(allowed.includes('dispatcher')).toBe(false)
    expect(allowed.includes('loader')).toBe(false)
  })

  it('restricts STORE_MANAGER to store-manager workspace', () => {
    const allowed = ROLE_ALLOWED_WORKSPACES.STORE_MANAGER
    expect(allowed).toEqual(['store-manager'])
    expect(allowed.includes('dispatcher')).toBe(false)
  })

  it('allows ADMIN to access administration and dispatcher workspaces', () => {
    const allowed = ROLE_ALLOWED_WORKSPACES.ADMIN
    expect(allowed).toContain('administration')
    expect(allowed).toContain('dispatcher')
    expect(allowed.includes('loader')).toBe(false)
  })
})
