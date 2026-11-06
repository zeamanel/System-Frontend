import { useEffect, useRef, useState } from 'react'
import { loadTelegramHubImage, type TelegramHubItem } from '../../lib/api/endpoints/telegram-bridge'

/**
 * A Telegram file's image. The lists come without images; each one is read
 * when it comes into view, once per file, and kept while the page is open.
 */
export function TelegramHubImage({
  item,
  className,
  imgClassName,
  onOpen,
}: {
  item: Pick<TelegramHubItem, 'id' | 'imageDataUrl' | 'filename'>
  className?: string
  imgClassName?: string
  /** Called with the image's URL when the image is clicked. */
  onOpen?: (url: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  const [url, setUrl] = useState<string | null>(item.imageDataUrl ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (visible || !ref.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [visible])

  const { id, imageDataUrl } = item
  useEffect(() => {
    if (!visible || url) return
    let cancelled = false
    loadTelegramHubImage({ id, imageDataUrl })
      .then((loaded) => {
        if (!cancelled) setUrl(loaded)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [visible, url, id, imageDataUrl])

  if (failed) return null
  return (
    <div ref={ref} className={className} data-testid="telegram-hub-image">
      {url ? (
        <img src={url} alt={item.filename} className={imgClassName} onClick={onOpen ? () => onOpen(url) : undefined} />
      ) : (
        <div className="telegram-hub-image__placeholder" aria-hidden="true" />
      )}
    </div>
  )
}
