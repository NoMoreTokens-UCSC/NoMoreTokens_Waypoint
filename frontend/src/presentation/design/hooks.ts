import { useQuery } from '@tanstack/react-query'
import type { AssetManifest, DesignCatalog, Layer } from './types'
async function read<T>(path: string): Promise<T> {
  const result = await fetch(path)
  if (!result.ok) throw new Error(`Design reference could not be loaded (${result.status}).`)
  return result.json() as Promise<T>
}
export function useDesignCatalog() {
  return useQuery({
    queryKey: ['figma', 'catalog'],
    queryFn: () => read<DesignCatalog>('/figma/catalog.json'),
    staleTime: Infinity,
  })
}
export function useDesignAssets() {
  return useQuery({
    queryKey: ['figma', 'assets'],
    queryFn: () => read<AssetManifest>('/figma/assets.json'),
    staleTime: Infinity,
  })
}
export function useDesignFrame(url?: string) {
  return useQuery({
    queryKey: ['figma', 'frame', url],
    queryFn: () => read<Layer>(url!),
    enabled: !!url,
    staleTime: Infinity,
  })
}
export function allText(node: Layer): string {
  return node.characters ?? node.children?.map(allText).filter(Boolean).join(' ') ?? ''
}
