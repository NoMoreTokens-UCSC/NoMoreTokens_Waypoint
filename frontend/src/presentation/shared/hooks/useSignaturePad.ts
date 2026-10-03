import { useEffect, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { SignaturePoint, SignatureStroke } from '../../../domain/deliveryVerification'

const WIDTH = 640,
  HEIGHT = 200
export function useSignaturePad(
  initial: SignatureStroke[],
  resetKey: number,
  onChange: (strokes: SignatureStroke[], image: Blob) => void,
) {
  const initialStrokes = useRef(initial)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<SignatureStroke[]>([])
  const active = useRef(false)
  const generation = useRef(0)
  const cursor = useRef<SignaturePoint>({ x: 0.2, y: 0.5 })
  useEffect(() => {
    generation.current++
    active.current = false
    strokes.current = resetKey ? [] : structuredClone(initialStrokes.current)
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.lineWidth = 2.5
    context.strokeStyle = '#22252a'
    context.lineCap = 'round'
    for (const stroke of strokes.current) {
      context.beginPath()
      stroke.forEach((point, index) => {
        if (index) context.lineTo(point.x * WIDTH, point.y * HEIGHT)
        else context.moveTo(point.x * WIDTH, point.y * HEIGHT)
      })
      context.stroke()
    }
  }, [resetKey])
  function append(point: SignaturePoint) {
    const stroke = strokes.current.at(-1)
    const context = canvas.current?.getContext('2d')
    if (!stroke || !context || stroke.length >= 10000) return
    const previous = stroke.at(-1)!
    context.beginPath()
    context.moveTo(previous.x * WIDTH, previous.y * HEIGHT)
    context.lineTo(point.x * WIDTH, point.y * HEIGHT)
    context.stroke()
    stroke.push(point)
  }
  function finish() {
    active.current = false
    const version = generation.current
    const captured = structuredClone(strokes.current)
    canvas.current?.toBlob((blob) => {
      if (blob && generation.current === version) onChange(captured, blob)
    }, 'image/png')
  }
  function pointAt(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    }
  }
  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    generation.current++
    strokes.current.push([pointAt(event)])
    active.current = true
  }
  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (active.current) append(pointAt(event))
  }
  function onPointerUp() {
    if (active.current) finish()
  }
  function onKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === ' ') {
      event.preventDefault()
      if (active.current) finish()
      else {
        generation.current++
        strokes.current.push([{ ...cursor.current }])
        active.current = true
      }
    } else if (event.key === 'Enter' && active.current) {
      event.preventDefault()
      finish()
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      cursor.current = {
        x: Math.max(
          0,
          Math.min(
            1,
            cursor.current.x +
              (event.key === 'ArrowRight' ? 0.02 : event.key === 'ArrowLeft' ? -0.02 : 0),
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            1,
            cursor.current.y +
              (event.key === 'ArrowDown' ? 0.04 : event.key === 'ArrowUp' ? -0.04 : 0),
          ),
        ),
      }
      if (active.current) append({ ...cursor.current })
    }
  }
  return { canvasRef: canvas, onPointerDown, onPointerMove, onPointerUp, onKeyDown }
}
