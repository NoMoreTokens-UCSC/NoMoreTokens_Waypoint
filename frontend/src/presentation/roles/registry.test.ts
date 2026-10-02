import { describe, expect, it } from 'vitest'
import { entryRedirects } from '../sections/entry-account'
import { appModules, appRoutes, roleModules } from './registry'

describe('module registry', () => {
  it('gives every URL exactly one owner', () => {
    const paths = [...appRoutes.map((route) => route.path), ...Object.keys(entryRedirects)]
    expect(new Set(paths).size).toBe(paths.length)
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
  it('redirects only to registered routes', () => {
    const paths = appRoutes.map((route) => route.path)
    for (const target of Object.values(entryRedirects)) expect(paths).toContain(target)
  })
})
