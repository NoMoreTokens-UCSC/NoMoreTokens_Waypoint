/** "16:00" → "4:00 PM" */
export function cutoffLabel(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}
