import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })
