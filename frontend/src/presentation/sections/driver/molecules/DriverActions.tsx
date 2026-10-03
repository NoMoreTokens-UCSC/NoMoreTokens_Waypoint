import type { ReactNode } from 'react'

export function DriverActions({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[761px]:flex min-[761px]:flex-wrap min-[761px]:items-center max-[760px]:[&_[data-slot=button]]:min-h-13 max-[760px]:[&_[data-slot=button]]:w-full max-[760px]:[&_[data-slot=button]]:rounded-lg">
      {children}
    </div>
  )
}
