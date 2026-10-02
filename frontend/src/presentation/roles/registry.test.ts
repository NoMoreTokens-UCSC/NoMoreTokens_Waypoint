import { describe, expect, it } from 'vitest'
import { appModules, appRoutes, roleModules } from './registry'

describe('module registry', () => {
  it('gives every URL exactly one owner', () => {
    const paths = appRoutes.map((route) => route.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
  it('names every page for the breadcrumb', () => {
    for (const route of appRoutes) expect(route.title.trim(), route.path).not.toBe('')
  })
  it('uses unique module keys', () => {
    const keys = appModules.map((module) => module.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it.each(roleModules.map((module) => [module.key, module] as const))(
    '%s navigation and home resolve to its own routes',
    (_, module) => {
      const paths = module.routes.map((route) => route.path)
      expect(paths).toContain(module.home)
      for (const item of module.nav) expect(paths).toContain(item.path)
      for (const path of paths) expect(path.startsWith(`${module.basePath}/`)).toBe(true)
    },
  )
  it('registers the public entry pages', () => {
    const paths = appRoutes.map((route) => route.path)
    for (const path of ['/welcome', '/how-it-works', '/login', '/workspaces'])
      expect(paths).toContain(path)
  })
})
