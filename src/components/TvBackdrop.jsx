import { useEffect, useRef, useState } from 'react'
import { seriesVideos } from '../lib/tmdb'

// où l'on en était (la vidéo et la seconde) : en rouvrant l'appli, la télé reprend là
const RESUME_KEY = 'levana.tv.reprise'
const readResume = () => { try { return JSON.parse(localStorage.getItem(RESUME_KEY)) || null } catch { return null } }
const saveResume = r => { try { localStorage.setItem(RESUME_KEY, JSON.stringify(r)) } catch { /* ignore */ } }

/**
 * La télé du salon, allumée en fond — pour toute la visite : le lecteur vit au-dessus du salon
 * et de la bibliothèque, il continue quand on va ailleurs (le salon ne fait que le poser sur le
 * mur quand on le voit), et en rouvrant l'appli il reprend la vidéo à la seconde où on l'avait
 * laissée. : les génériques de nos séries (sinon leur bande-annonce),
 * l'un après l'autre, les mieux notées d'abord — sans le son. Le lecteur YouTube est posé
 * exactement sur l'écran de la télé 3D (la scène le place à chaque image) ; il n'apparaît que
 * quand la vidéo tourne vraiment, sinon on voit l'écran des cassettes en dessous.
 */
export default function TvBackdrop({ series, volume = 0, skip = 0, onPlaying, onNow }) {
  const [queue, setQueue] = useState([])        // [{ key, name }]
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const fails = useRef(0)
  const resume = useRef(readResume())   // { key, t, d } : la reprise, utilisée une seule fois
  const lastSave = useRef(0)
  const dur = useRef(0)      // la durée de la vidéo en cours et où l'on en est (envoyées par le lecteur)
  const pos = useRef(0)
  const playing = useRef(false)
  const frame = useRef(null)
  // un seul lecteur pour toute la soirée : on lui fait charger la vidéo suivante (l'iPhone le
  // laisse alors continuer, avec le son s'il est allumé ; un nouveau lecteur, lui, resterait muet ou bloqué)
  const firstKey = useRef(null)
  const firstStart = useRef(null)
  const curKey = useRef(null)
  const ready = useRef(false)
  const volRef = useRef(volume)
  volRef.current = volume
  // le son : coupé par défaut ; la barre de volume du salon le règle (le geste du doigt l'autorise)
  const applySound = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const cmd = (func, args = []) => w.postMessage(JSON.stringify({ id: 'tvbg', channel: 'widget', event: 'command', func, args }), '*')
    if (volRef.current > 0) { cmd('setVolume', [Math.round(volRef.current)]); cmd('unMute') } else cmd('mute')
  }
  useEffect(applySound, [volume])
  useEffect(() => { onPlaying?.(shown) }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPlaying?.(false), []) // eslint-disable-line react-hooks/exhaustive-deps
  // ce qui passe : le salon le sait (l'affiche projetée suit), et un bandeau le dit sur l'image
  const [caption, setCaption] = useState(false)
  useEffect(() => {
    if (!shown) return
    setCaption(true)
    const t = setTimeout(() => setCaption(false), 6000)
    return () => clearTimeout(t)
  }, [shown, i])

  // la liste des vidéos, dans l'ordre de nos séries préférées
  const sig = series.map(s => (s.media || 'tv') + s.tmdb_id).join(',')
  useEffect(() => {
    let live = true
    Promise.all(series.slice(0, 20).map(s => seriesVideos(s.tmdb_id, s.media).then(v => (v[0] ? { key: v[0].key, name: s.name, id: s.id, movie: s.media === 'movie', opening: v[0].type === 'Opening Credits' } : null))))
      .then(list => {
        if (!live) return
        const q = list.filter(Boolean)
        // on reste sur la vidéo en cours ; sinon on reprend celle d'avant (ou la suivante si elle était finie)
        let at = curKey.current ? q.findIndex(x => x.key === curKey.current) : -1
        const r = resume.current
        if (at < 0 && r) {
          at = q.findIndex(x => x.key === r.key)
          if (at >= 0 && r.d && r.t > r.d - 3) { at = (at + 1) % q.length; resume.current = null }
        }
        setQueue(q); setI(Math.max(0, at))
      })
    return () => { live = false }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  const v = queue.length ? queue[i % queue.length] : null
  if (v && !firstKey.current) firstKey.current = v.key
  useEffect(() => { if (v) onNow?.(v.id) }, [v?.id, i]) // eslint-disable-line react-hooks/exhaustive-deps
  // passer à la vidéo suivante (une seule fois par vidéo : la fin peut être signalée plusieurs fois)
  const advanced = useRef(-1)
  const iRef = useRef(0)
  iRef.current = i
  const next = () => {
    if (advanced.current === iRef.current) return
    advanced.current = iRef.current
    playing.current = false; setShown(false); setI(k => k + 1)
  }
  // la seconde où reprendre une vidéo (seulement la première fois, si c'est celle qu'on regardait)
  const startOf = key => {
    const r = resume.current
    if (!r || r.key !== key) return 0
    resume.current = null
    return Math.max(0, (r.t || 0) - 1)
  }
  const command = (func, args = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ id: 'tvbg', channel: 'widget', event: 'command', func, args }), '*')
  // la vidéo change : le même lecteur la charge
  useEffect(() => {
    if (!v || !ready.current) return
    if (v.key === curKey.current) { command('seekTo', [0, true]); command('playVideo') }
    else command('loadVideoById', [{ videoId: v.key, startSeconds: startOf(v.key) }])
    curKey.current = v.key
  }, [i, v?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  // le bouton « générique suivant » du salon
  useEffect(() => { if (skip) next() }, [skip]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // la fin approche : on enchaîne avant l'écran de fin de YouTube (et ses suggestions)
      if (d?.event === 'infoDelivery' && d.info) {
        if (typeof d.info.duration === 'number' && d.info.duration > 0) dur.current = d.info.duration
        if (typeof d.info.currentTime === 'number') pos.current = d.info.currentTime
        // on note où l'on en est (toutes les 2 s)
        if (playing.current && performance.now() - lastSave.current > 2000) {
          lastSave.current = performance.now()
          saveResume({ key: v.key, t: Math.floor(pos.current), d: Math.floor(dur.current) })
        }
        if (playing.current && dur.current > 5 && pos.current > dur.current - 0.9) { next(); return }
      }
      if (state === 1) {
        fails.current = 0
        if (!playing.current) { applySound(); command('unloadModule', ['captions']); command('unloadModule', ['cc']) }   // au mur, sans sous-titres
        playing.current = true; setShown(true)
      }
      else if (state === 0 || d?.event === 'onError') next()
    }
    dur.current = 0; pos.current = 0
    const bye = () => { if (playing.current) saveResume({ key: v.key, t: Math.floor(pos.current), d: Math.floor(dur.current) }) }
    window.addEventListener('pagehide', bye)
    window.addEventListener('message', onMsg)
    const t = setTimeout(() => { if (!playing.current) { fails.current++; next() } }, 15000)
    // filet de sécurité : si la fin n'est jamais signalée, on passe quand même à la suivante
    const guard = setInterval(() => { if (playing.current && dur.current > 5 && pos.current > dur.current - 0.9) next() }, 1000)
    const hard = setTimeout(() => next(), 6 * 60 * 1000)
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('pagehide', bye); clearTimeout(t); clearInterval(guard); clearTimeout(hard) }
  }, [v?.key, i]) // eslint-disable-line react-hooks/exhaustive-deps

  const listen = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const send = o => w.postMessage(JSON.stringify({ id: 'tvbg', channel: 'widget', ...o }), '*')
    send({ event: 'listening' })
    send({ event: 'command', func: 'addEventListener', args: ['onStateChange'] })
    send({ event: 'command', func: 'addEventListener', args: ['onError'] })
    applySound()
    ready.current = true
    curKey.current = firstKey.current
    // la file a déjà avancé pendant le chargement : on rattrape
    if (v && v.key !== curKey.current) { command('loadVideoById', [{ videoId: v.key, startSeconds: startOf(v.key) }]); curKey.current = v.key }
  }

  // aucune vidéo de la liste ne démarre (un tour complet) : la lecture automatique est bloquée, on laisse tomber
  if (!v || fails.current >= Math.max(3, queue.length)) return null
  if (firstStart.current == null) firstStart.current = startOf(firstKey.current)
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(firstKey.current)}?start=${Math.floor(firstStart.current)}&autoplay=1&mute=1&playsinline=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
  return (
    <>
      <iframe ref={frame} src={src} title={`Générique de ${v.name}`} onLoad={listen} tabIndex={-1}
        className={shown ? 'on' : ''} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
      <div className={'tv-now' + (shown && caption ? ' on' : '')} key={'c' + i}>
        <span className="tv-now-kind">{v.movie ? 'Film' : 'Série'} · {v.opening ? 'Générique' : 'Bande-annonce'}</span>
        <span className="tv-now-name">{v.name}</span>
      </div>
    </>
  )
}
