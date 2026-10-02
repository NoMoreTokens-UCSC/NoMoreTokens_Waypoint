export interface Contact {
  name: string
  mobile: string
  email: string
}
export type ContactErrors = Partial<Record<keyof Contact, string>>

/** Checks the editable details before they are sent; the same rules are enforced behind the API. */
export function checkContact(contact: Contact): ContactErrors {
  const errors: ContactErrors = {}
  if (contact.name.trim().length < 2) errors.name = 'Enter your full name.'
  if (!/^[+\d][\d\s-]{6,}$/.test(contact.mobile.trim()))
    errors.mobile = 'Enter a phone number with at least 7 digits.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()))
    errors.email = 'Enter a valid email address.'
  return errors
}

export const sameContact = (a: Contact, b: Contact) =>
  a.name.trim() === b.name.trim() &&
  a.mobile.trim() === b.mobile.trim() &&
  a.email.trim() === b.email.trim()
