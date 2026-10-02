import { Dialog } from 'radix-ui'
import { createContext, useEffect, useState, type ReactNode } from 'react'
import { PopupReveal } from './motion'

export const OverlayRenderingContext = createContext(false)

/** Focus and dismissal behavior without adding controls absent from the source. */
export function SourceOverlay({
  title,
  close,
  children,
  fullFrame = false,
  placement = 'center',
}: {
  title: string
  close: () => void
  children: ReactNode
  fullFrame?: boolean
  placement?: 'center' | 'menu' | 'drawer'
}) {
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const trigger = opener?.getBoundingClientRect()
  const menuTop = trigger?.height ? Math.min(viewport.height - 96, trigger.bottom + 8) : 80
  const menuRight = trigger?.width ? Math.max(16, viewport.width - trigger.right) : 16
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(34,37,42,.2)',
            zIndex: 70,
          }}
        />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (opener?.isConnected) opener.focus()
            else
              document
                .querySelector<HTMLElement>(
                  '[data-layer="IconButton/user"], [data-layer="MenuButton"]',
                )
                ?.focus()
          }}
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            zIndex: 71,
            top: placement === 'drawer' ? 0 : placement === 'menu' ? menuTop : '50%',
            left: placement === 'center' ? '50%' : undefined,
            right: placement === 'drawer' ? 0 : placement === 'menu' ? menuRight : undefined,
            transform: placement === 'center' ? 'translate(-50%,-50%)' : undefined,
            width: fullFrame ? 'calc(100vw - 32px)' : 'max-content',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight:
              placement === 'drawer'
                ? '100dvh'
                : placement === 'menu'
                  ? `calc(100dvh - ${menuTop + 16}px)`
                  : 'calc(100dvh - 32px)',
            overflow: 'auto',
            outline: 'none',
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <OverlayRenderingContext.Provider value={true}>
            <PopupReveal placement={placement}>{children}</PopupReveal>
          </OverlayRenderingContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
