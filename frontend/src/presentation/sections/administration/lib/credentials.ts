/** Easy to read out and type: no 0/O, 1/l/I. */
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
const digits = '23456789'
const alphabet = letters + digits

const pick = (set: string, random: number) => set[random % set.length]

/** A temporary password the administrator hands over: 12 characters, always letters and numbers. */
export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (value) => pick(alphabet, value))
  // Guarantee both kinds, so it always passes the same rule the account service applies.
  chars[0] = pick(letters, bytes[0])
  chars[length - 1] = pick(digits, bytes[length - 1])
  return chars.join('')
}

/** "Chamari Wijesinghe" → "chamari.wijesinghe". */
export const suggestUsername = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('.')
    .replace(/[^a-z0-9._-]/g, '')

/** Why a username cannot be used, or nothing when it can. `taken` holds the existing usernames. */
export function usernameProblem(username: string, taken: Set<string>) {
  const value = username.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(value))
    return 'Use 3 to 30 letters, numbers, dots, dashes or underscores.'
  if (taken.has(value)) return 'That username is already taken.'
  return undefined
}

export function passwordProblem(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return 'Use at least 8 characters, with letters and numbers.'
  return undefined
}

/** Copies text for the administrator to paste into a message. Resolves to whether it worked. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
