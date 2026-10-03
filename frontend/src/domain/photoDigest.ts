/** Binds the retained photo bytes to the handoff reviewed before signing. */
export async function photoDigest(photo: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error('Open Waypoint on HTTPS or localhost to save signed proof.')
  const bytes = await crypto.subtle.digest('SHA-256', await photo.arrayBuffer())
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
