import { useEffect, useMemo, useState } from 'react'
import { Camera, Upload, ImageIcon } from 'lucide-react'
import { Button } from '../atoms/button'
import { useEvidence } from '../../hooks/useOperations'
import { toast } from 'sonner'

export function PhotoCapture({
  evidenceId,
  disabled,
  busy,
  onSave,
  saveLabel = 'Save photograph',
}: {
  evidenceId?: string
  disabled?: boolean
  busy?: boolean
  onSave: (file: File) => Promise<unknown>
  saveLabel?: string
}) {
  const { url, evidence, isError, error: evidenceError, refetch } = useEvidence(evidenceId)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [cameraHelp, setCameraHelp] = useState(false)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file])
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )
  const choose = (next?: File) => {
    if (!next) return
    if (!/^image\/(jpeg|png|webp)$/.test(next.type) || !next.size || next.size > 10 * 1024 * 1024) {
      toast.error('Use a JPEG, PNG, or WebP photo smaller than 10 MB.')
      setError('Use a JPEG, PNG, or WebP photo up to 10 MB.')
      return
    }
    setFile(next)
    setError('')
  }
  return (
    <div className="photo-capture">
      {evidenceId && isError && (
        <div role="alert">
          <p>Saved photograph could not be loaded: {evidenceError?.message}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry photograph
          </Button>
        </div>
      )}
      {preview || url ? (
        <img
          src={preview ?? url}
          alt={preview ? 'Selected photograph preview' : 'Saved operational evidence'}
          className="proof-image"
        />
      ) : (
        <div className="photo-placeholder">
          <ImageIcon size={32} />
          <span>A clear photograph is required</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="upload-control">
          <Camera size={16} />
          Take photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={disabled || busy}
            onChange={(e) => {
              choose(e.target.files?.[0])
              e.target.value = ''
            }}
            aria-label="Take evidence photograph"
          />
        </label>
        <label className="upload-control">
          <Upload size={16} />
          Choose photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || busy}
            onChange={(e) => {
              choose(e.target.files?.[0])
              e.target.value = ''
            }}
            aria-label="Choose evidence photograph"
          />
        </label>
      </div>
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          className="mt-2"
          onClick={() => setCameraHelp(!cameraHelp)}
        >
          Camera unavailable?
        </Button>
      )}
      {cameraHelp && (
        <p className="text-sm mt-2" role="status">
          Camera access is needed to take a photo. If access is denied or this device has no camera,
          choose an existing photo or retry on a camera-equipped device. This local demo cannot
          transfer a load between devices.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive mt-2">
          {error}
        </p>
      )}
      {file && (
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-sm break-all">{file.name} · Not saved</span>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setFile(null)
              setError('')
            }}
          >
            Discard photo
          </Button>
          <Button
            size="sm"
            disabled={disabled || busy}
            onClick={() => {
              void onSave(file)
                .then(() => {
                  setFile(null)
                  setError('')
                })
                .catch((error: unknown) =>
                  setError(
                    error instanceof Error
                      ? error.message
                      : 'Photograph could not be saved. Retry; the selected photo is retained.',
                  ),
                )
            }}
          >
            {saveLabel}
          </Button>
        </div>
      )}
      {evidence && (
        <p className="text-xs text-muted-foreground mt-3">
          Saved on this device · {evidence.fileName} · Revision {evidence.revision}
        </p>
      )}
      {disabled && (
        <p className="text-xs text-muted-foreground mt-3">
          Complete the required checks to unlock photo capture.
        </p>
      )}
    </div>
  )
}
