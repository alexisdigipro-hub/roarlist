// A shot's picture: on the desktop its address is known at once, on the web it is read from the browser's storage first.
import { useEffect, useState } from 'react'

export function Img({ projectId, file, ...rest }: { projectId: string; file: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const first = window.roarlist.imageSrc(projectId, file)
  const [src, setSrc] = useState(typeof first === 'string' ? first : '')
  useEffect(() => {
    let live = true
    const s = window.roarlist.imageSrc(projectId, file)
    if (typeof s === 'string') setSrc(s)
    else { setSrc(''); s.then((v) => { if (live) setSrc(v) }) }
    return () => { live = false }
  }, [projectId, file])
  return src ? <img src={src} alt="" {...rest} /> : null
}
