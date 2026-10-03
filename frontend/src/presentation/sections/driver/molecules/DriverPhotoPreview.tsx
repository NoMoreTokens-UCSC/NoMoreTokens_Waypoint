import { useBlobUrl } from '../hooks/useBlobUrl'

export function DriverPhotoPreview({ photo, fileName }: { photo?: Blob; fileName?: string }) {
  const url = useBlobUrl(photo)
  return (
    <figure className="m-0">
      <img
        className="block aspect-square max-h-[440px] w-full rounded-lg bg-foreground object-contain"
        src={url ?? '/driver/proof-goods.svg'}
        alt={
          url
            ? 'Delivery photograph saved on this device'
            : 'Illustration showing how to frame the delivered goods'
        }
      />
      <figcaption className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {fileName ?? 'Illustration · capture or choose your own photograph below.'}
      </figcaption>
    </figure>
  )
}
