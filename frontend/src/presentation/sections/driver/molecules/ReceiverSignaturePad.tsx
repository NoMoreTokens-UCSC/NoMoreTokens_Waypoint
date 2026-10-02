import { useRef, useState } from 'react'

/** The source optional signature pad; drawn ink is retained with delivery evidence. */
export function ReceiverSignaturePad({
  initial,
  onChange,
}: {
  initial?: string
  onChange: (blob: Blob) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const point = useRef<{ x: number; y: number } | null>(null)
  const [drawn, setDrawn] = useState(false)
  return (
    <div style={{ position: 'relative', width: 318, height: 160 }}>
      {!drawn && initial && (
        <img
          src={initial}
          alt=""
          style={{ position: 'absolute', left: 13, top: 42, width: 200, height: 70 }}
        />
      )}
      <canvas
        ref={canvas}
        width={318}
        height={160}
        aria-label="Optional receiver signature"
        style={{
          position: 'absolute',
          inset: 0,
          touchAction: 'none',
          width: '100%',
          height: '100%',
        }}
        onPointerDown={(event) => {
          setDrawn(true)
          event.currentTarget.setPointerCapture(event.pointerId)
          const rect = event.currentTarget.getBoundingClientRect()
          point.current = {
            x: ((event.clientX - rect.left) * 318) / rect.width,
            y: ((event.clientY - rect.top) * 160) / rect.height,
          }
        }}
        onPointerMove={(event) => {
          const context = canvas.current?.getContext('2d')
          if (!point.current || !context) return
          const rect = event.currentTarget.getBoundingClientRect()
          const next = {
            x: ((event.clientX - rect.left) * 318) / rect.width,
            y: ((event.clientY - rect.top) * 160) / rect.height,
          }
          context.strokeStyle = '#22252a'
          context.lineWidth = 2
          context.lineCap = 'round'
          context.beginPath()
          context.moveTo(point.current.x, point.current.y)
          context.lineTo(next.x, next.y)
          context.stroke()
          point.current = next
        }}
        onPointerUp={() => {
          point.current = null
          canvas.current?.toBlob((blob) => {
            if (blob) onChange(blob)
          }, 'image/png')
        }}
        onPointerCancel={() => {
          point.current = null
        }}
      />
    </div>
  )
}
