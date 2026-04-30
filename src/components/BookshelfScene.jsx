/**
 * BookshelfScene — Three.js vanilla (useEffect + canvas ref)
 * Pas de react-three-fiber → compatible React 19 sans problème.
 */
import { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'

// ── Helpers ───────────────────────────────────────────────────────────────
const SPINE_HEXES = [
  0x6B2530, 0x183860, 0x255040, 0x5E3A0E, 0x361558,
  0x165058, 0x582020, 0x1E3414, 0x443410, 0x141E4C,
]
function spineHex(title = '', id = '') {
  const s = (title + id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return SPINE_HEXES[s % SPINE_HEXES.length]
}
function spineW(pageCount) {
  if (!pageCount) return 0.028
  if (pageCount < 100) return 0.016
  if (pageCount < 250) return 0.022
  if (pageCount < 400) return 0.030
  if (pageCount < 600) return 0.038
  return 0.048
}

const STATUS_ORDER   = ['lu', 'possede', 'souhaite']
const BOOKS_PER_ROW  = 16
const BOOK_GAP       = 0.003
const ROW_HEIGHT     = 0.31   // espacement vertical entre rangées
const BW             = 0.135  // épaisseur livre (axe Z)

// ── Composant ─────────────────────────────────────────────────────────────
export default function BookshelfScene({ books, onBookClick, filter = 'all' }) {
  const canvasRef    = useRef(null)
  const onClickRef   = useRef(onBookClick)
  useEffect(() => { onClickRef.current = onBookClick }, [onBookClick])

  // Calcul du nombre de rangées → hauteur du canvas
  const statuses = filter === 'all' ? STATUS_ORDER : [filter]
  const totalRows = useMemo(() => {
    return statuses.reduce((acc, s) => {
      const n = books.filter(b => b.status === s).length
      return acc + Math.max(1, Math.ceil(n / BOOKS_PER_ROW))
    }, 0)
  }, [books, filter])
  const canvasH = Math.max(300, totalRows * 185 + 60)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Renderer ──────────────────────────────────────────────────────────
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap

    // ── Scène + caméra ────────────────────────────────────────────────────
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(44, W / H, 0.001, 20)
    camera.position.set(-0.42, 0.15, 0.48)

    // ── Lumières ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.68))
    const dir = new THREE.DirectionalLight(0xffffff, 1.1)
    dir.position.set(1, 2, 1)
    dir.castShadow = true
    scene.add(dir)
    const pt = new THREE.PointLight(0xffe8c0, 0.45)
    pt.position.set(-0.22, 0.3, 0.22)
    scene.add(pt)

    // ── Matériaux partagés ────────────────────────────────────────────────
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x1E1535, roughness: 0.7 })
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.9 })
    const botMat  = new THREE.MeshStandardMaterial({ color: 0xddd5c5, roughness: 0.9 })
    const backMat = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 0.9 })

    // ── Construction de la scène ──────────────────────────────────────────
    const bookMeshes    = []
    const loader        = new THREE.TextureLoader()
    let   rowIndex      = 0

    statuses.forEach(status => {
      const sectionBooks = books.filter(b => b.status === status)
      if (!sectionBooks.length) return

      for (let ci = 0; ci < sectionBooks.length; ci += BOOKS_PER_ROW) {
        const rowBooks = sectionBooks.slice(ci, ci + BOOKS_PER_ROW)
        const rowY     = -rowIndex * ROW_HEIGHT
        let   rowX     = 0

        rowBooks.forEach(book => {
          const SW  = spineW(book.page_count || book.pageCount)
          const BH  = 0.21
          const hex = spineHex(book.title, book.google_id || book.googleId)
          const bx  = rowX + SW / 2

          const spineMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })
          const coverMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 })

          // BoxGeometry face order: +X -X +Y -Y +Z(couverture) -Z(dos)
          const geo  = new THREE.BoxGeometry(SW, BH, BW)
          const mesh = new THREE.Mesh(geo, [spineMat, spineMat, pageMat, botMat, coverMat, backMat])
          mesh.position.set(bx, rowY + BH / 2, 0)
          mesh.castShadow  = true
          mesh.receiveShadow = true
          mesh.userData = { book, baseX: bx, targetX: bx }
          scene.add(mesh)
          bookMeshes.push(mesh)

          // Chargement texture couverture
          const cover = book.cover || book.cover_url
          if (cover) {
            loader.load(cover, tex => {
              tex.colorSpace    = THREE.SRGBColorSpace
              coverMat.map      = tex
              coverMat.needsUpdate = true
            }, undefined, () => {/* ignore CORS */})
          }

          rowX += SW + BOOK_GAP
        })

        // Planche en bois
        const plankGeo  = new THREE.BoxGeometry(rowX + 0.05, 0.018, 0.168)
        const plankMesh = new THREE.Mesh(plankGeo, woodMat)
        plankMesh.position.set(rowX / 2, rowY - 0.009, 0)
        plankMesh.receiveShadow = true
        scene.add(plankMesh)

        rowIndex++
      }
    })

    // Orienter la caméra vers le centre de l'étagère
    const maxX = bookMeshes.reduce((m, mesh) => Math.max(m, mesh.userData.baseX), 0.3)
    const midY = -(rowIndex - 1) * ROW_HEIGHT / 2
    camera.lookAt(maxX / 2, midY + 0.05, 0)

    // ── Raycaster ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2(-999, -999)
    let   hoveredMesh = null

    const toNDC = e => {
      const rect = canvas.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    }

    const onMouseMove = e => toNDC(e)

    const handleClick = e => {
      toNDC(e)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(bookMeshes)
      if (hits.length) onClickRef.current(hits[0].object.userData.book)
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('click',     handleClick)

    // ── Boucle de rendu ───────────────────────────────────────────────────
    let rafId
    const animate = () => {
      rafId = requestAnimationFrame(animate)

      // Détection du hover
      raycaster.setFromCamera(mouse, camera)
      const hits    = raycaster.intersectObjects(bookMeshes)
      const hitMesh = hits.length ? hits[0].object : null

      if (hitMesh !== hoveredMesh) {
        if (hoveredMesh) hoveredMesh.userData.targetX = hoveredMesh.userData.baseX
        hoveredMesh = hitMesh
        if (hitMesh) hitMesh.userData.targetX = hitMesh.userData.baseX - 0.12
        canvas.style.cursor = hitMesh ? 'pointer' : 'default'
      }

      // Lerp smooth pour chaque livre
      bookMeshes.forEach(m => {
        m.position.x += (m.userData.targetX - m.position.x) * 0.13
      })

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // ── Nettoyage ─────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('click',     handleClick)
      window.removeEventListener('resize',    onResize)
      renderer.dispose()
      scene.clear()
    }
  }, [books, filter])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${canvasH}px`, display: 'block' }}
    />
  )
}
