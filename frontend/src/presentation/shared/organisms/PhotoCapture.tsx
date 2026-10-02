import { useState } from 'react'
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
  const { url, evidence } = useEvidence(evidenceId)
  const [file, setFile] = useState<File | null>(null)
  const choose = (next?: File) => {
    if (!next) return
    if (!/^image\/(jpeg|png|webp)$/.test(next.type) || !next.size || next.size > 10 * 1024 * 1024) {
      toast.error('Use a JPEG, PNG, or WebP photo smaller than 10 MB.')
      return
    }
    setFile(next)
  }
  return (
    <div className="photo-capture">
      {url ? (
        <img src={url} alt="Saved operational evidence" className="proof-image" />
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
            onChange={(e) => choose(e.target.files?.[0])}
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
            onChange={(e) => choose(e.target.files?.[0])}
            aria-label="Choose evidence photograph"
          />
        </label>
      </div>
      {file && (
        <div className="flex items-center gap-3 mt-3">
          <span className="text-sm truncate">{file.name}</span>
          <Button
            size="sm"
            disabled={disabled || busy}
            onClick={() => {
              void onSave(file)
                .then(() => setFile(null))
                .catch(() => {})
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
