import type { SignatureStroke } from '../../../../domain/deliveryVerification'
import { useSignaturePad } from '../hooks/useSignaturePad'
import { DriverButton } from '../atoms/DriverButton'

const EMPTY: SignatureStroke[] = []
export function ReceiverSignaturePad({
  initial = EMPTY,
  resetKey,
  valid,
  onChange,
  onClear,
}: {
  initial?: SignatureStroke[]
  resetKey: number
  valid: boolean
  onChange: (strokes: SignatureStroke[], image: Blob) => void
  onClear: () => void
}) {
  const { canvasRef, onPointerDown, onPointerMove, onPointerUp, onKeyDown } = useSignaturePad(
    initial,
    resetKey,
    onChange,
  )
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-sm font-semibold">Store Manager e-signature</legend>
      <p id="signature-instructions" className="text-xs leading-relaxed text-muted-foreground">
        The Store Manager signs after reviewing quantities and remarks. Draw with a finger, pen or
        mouse. Keyboard: Space starts a stroke, arrow keys draw, Enter saves it.
      </p>
      <canvas
        ref={canvasRef}
        width={640}
        height={200}
        tabIndex={0}
        aria-label="Store Manager signature"
        aria-describedby="signature-instructions"
        className="h-[160px] w-full touch-none rounded-lg border border-input bg-white focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
      <p role="status" className="text-xs text-muted-foreground">
        {valid
          ? 'Signature captured for these handoff details.'
          : 'A signature is required. A dot or blank drawing is not accepted.'}
      </p>
      <DriverButton variant="outline" type="button" onClick={onClear}>
        Clear signature
      </DriverButton>
    </fieldset>
  )
}
