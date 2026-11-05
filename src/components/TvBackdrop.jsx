import { useEffect, useRef, useState } from 'react'
import { seriesVideos } from '../lib/tmdb'

/**
 * La télé du salon, allumée en fond : les génériques de nos séries (sinon leur bande-annonce),
 * l'un après l'autre, les mieux notées d'abord — sans le son. Le lecteur YouTube est posé
 * exactement sur l'écran de la télé 3D (la scène le place à chaque image) ; il n'apparaît que
 * quand la vidéo tourne vraiment, sinon on voit l'écran des cassettes en dessous.
 */
export default function TvBackdrop({ series, sound = false, onPlaying }) {
  const [queue, setQueue] = useState([])        // [{ key, name }]
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const fails = useRef(0)
  const playing = useRef(false)
  const frame = useRef(null)
  const soundRef = useRef(sound)
  soundRef.current = sound
  // le son : coupé par défaut ; le bouton du salon le rallume (le geste du doigt l'autorise)
  const applySound = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const cmd = (func, args = []) => w.postMessage(JSON.stringify({ id: 'tvbg', channel: 'widget', event: 'command', func, args }), '*')
    if (soundRef.current) { cmd('unMute'); cmd('setVolume', [70]) } else cmd('mute')
  }
  useEffect(applySound, [sound])
  useEffect(() => { onPlaying?.(shown) }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps

  // la liste des vidéos, dans l'ordre de nos séries préférées
  const sig = series.map(s => (s.media || 'tv') + s.tmdb_id).join(',')
  useEffect(() => {
    let live = true
    Promise.all(series.slice(0, 20).map(s => seriesVideos(s.tmdb_id, s.media).then(v => (v[0] ? { key: v[0].key, name: s.name } : null))))
      .then(list => { if (live) { setQueue(list.filter(Boolean)); setI(0) } })
    return () => { live = false }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = queue.length ? queue[i % queue.length] : null
  const next = () => { playing.current = false; setShown(false); setI(k => k + 1) }

  // fin de la vidéo, erreur, ou lecture qui ne démarre pas (lecture automatique bloquée) : la suivante
  useEffect(() => {
    if (!v) return
    const onMsg = e => {
      let host = ''
      try { host = new URL(e.origin).hostname } catch { return }
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host) || e.source !== frame.current?.contentWindow) return
      let d
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }
      const state = d?.event === 'onStateChange' ? d.info : d?.event === 'infoDelivery' ? d.info?.playerState : undefined
      if (state === 1) { fails.current = 0; if (!playing.current) applySound(); playing.current = true; setShown(true) }
      else if (state === 0 || d?.event === 'onError') next()
    }
    window.addEventListener('message', onMsg)
    const t = setTimeout(() => { if (!playing.current) { fails.current++; next() } }, 12000)
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t) }
  }, [v?.key, i]) // eslint-disable-line react-hooks/exhaustive-deps

  const listen = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const send = o => w.postMessage(JSON.stringify({ id: 'tvbg', channel: 'widget', ...o }), '*')
    send({ event: 'listening' })
    send({ event: 'command', func: 'addEventListener', args: ['onStateChange'] })
    send({ event: 'command', func: 'addEventListener', args: ['onError'] })
    applySound()
  }

  // trois vidéos de suite qui ne démarrent pas : la lecture automatique est bloquée, on laisse tomber
  if (!v || fails.current >= 3) return null
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.key)}?autoplay=1&mute=1&playsinline=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
  return (
    <iframe ref={frame} key={v.key + i} src={src} title={`Générique de ${v.name}`} onLoad={listen} tabIndex={-1}
      className={shown ? 'on' : ''} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
  )
}
