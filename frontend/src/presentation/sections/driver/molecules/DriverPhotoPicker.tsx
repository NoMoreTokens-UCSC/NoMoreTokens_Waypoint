import { useRef, useState, type ChangeEvent } from 'react'
import { DriverButton as Button } from '../atoms/DriverButton'

export function DriverPhotoPicker({
  busy,
  onPick,
}: {
  busy?: boolean
  onPick: (file: File) => Promise<void>
}) {
  const camera = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  function openCamera() {
    camera.current?.click()
  }
  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
      setError('Choose a non-empty JPEG, PNG or WebP photograph smaller than 10 MB.')
      return
    }
    setError('')
    void onPick(file).catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Photo could not be saved. Try again.'),
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <input
        ref={camera}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Capture delivery photograph"
        disabled={busy}
        onChange={selectPhoto}
      />
      <Button disabled={busy} onClick={openCamera}>
        Capture photo
      </Button>
      <label className="grid gap-2 text-sm">
        Choose an existing photograph
        <input
          className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card p-2 file:mr-2 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-2"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose delivery photograph"
          disabled={busy}
          onChange={selectPhoto}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm leading-relaxed text-muted-foreground">
        Camera capture uses the browser’s file chooser. Your device decides whether a camera is
        available.
      </p>
    </div>
  )
}
