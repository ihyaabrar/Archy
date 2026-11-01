'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { OPENING_DEFAULTS, WALL_DEFAULTS, clampOpening, dist, levelsOf, lockAngle, pointAlong, projectOnWall, round, moveVertex, translateWall, moveNote, nearestWall, onLevel, withLevel, snap, snapToEndpoint, uid, wallLength, type Opening, type Point, type Wall } from '@/lib/project'
import { planCenter as getPlanCenter, wallPolygons } from '@/lib/drawing'
import { useProject } from '@/lib/store'
import { dims, type Furniture, type FurnitureKind } from '@/lib/furniture'
import { Dimension, FurnitureShape, NoteShape, OpeningShape, RoomLabel, WallShape } from './PlanShapes'
import { DEFAULT_FLOOR, FLOORS } from '@/lib/materials'
import { nudge } from './editActions'

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room' | 'furniture' | 'text' | 'measure'
export type Selection = { kind: 'wall' | 'opening' | 'room' | 'furniture' | 'note'; id: string } | null
export type View = { tx: number; ty: number; s: number } // s = piksel per meter

const GRID_SNAP = 0.05
const PICK_PX = 10 // jarak tangkap dalam piksel layar, tetap sama di semua zoom

type Props = {
  tool: Tool
  view: View
  setView: (fn: (v: View) => View) => void
  selection: Selection
  setSelection: (s: Selection) => void
  draft: Point[]
  setDraft: (d: Point[]) => void
  furnitureKind: FurnitureKind
  placeRot: number
  level: string
}

export function PlanCanvas({ tool, view, setView, selection, setSelection, draft, setDraft, furnitureKind, placeRot, level }: Props) {
  const full = useProject((s) => s.project)
  // Kanvas hanya membaca dan menyunting lantai aktif.
  const project = useMemo(() => onLevel(full, level), [full, level])
  const below = useMemo(() => {
    const ls = levelsOf(full)
    const me = ls.find((l) => l.id === level)
    const lower = ls.filter((l) => me && l.elevation < me.elevation).sort((a, b) => b.elevation - a.elevation)[0]
    return lower ? onLevel(full, lower.id) : null
  }, [full, level])
  const apply = useProject((s) => s.apply)
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  // Pesan untuk pembaca layar (aria-live): elemen terpilih, geseran, titik yang ditaruh.
  const [say, setSay] = useState('')
  const [freeAngle, setFreeAngle] = useState(false)
  const pan = useRef<{ x: number; y: number } | null>(null)
  // Furnitur yang sedang diseret: posisi sementara, baru dicatat ke riwayat saat dilepas (satu langkah undo).
  const [drag, setDrag] = useState<{ id: string; offset: Point; pos: Point; moved: boolean } | null>(null)
  // Pintu/jendela yang sedang digeser sepanjang dindingnya (posisi sementara, satu langkah urungkan saat dilepas).
  const [odrag, setOdrag] = useState<{ id: string; at: number; moved: boolean } | null>(null)
  // Dinding utuh yang sedang diseret: titik awal seret dan pergeseran (dibulatkan ke grid).
  const [wdrag, setWdrag] = useState<{ id: string; start: Point; d: Point } | null>(null)
  // Anotasi yang sedang diseret, sama seperti dinding utuh.
  const [ndrag, setNdrag] = useState<{ id: string; start: Point; d: Point } | null>(null)
  // Titik sudut dinding yang sedang diseret (dari posisi lama ke posisi baru).
  const [vdrag, setVdrag] = useState<{ from: Point; to: Point } | null>(null)

  // Tangkap pointer supaya seretan tetap terbaca di luar kanvas. Bisa gagal (pointer sudah lepas); itu tidak fatal.
  const capture = (id: number) => {
    try {
      svgRef.current!.setPointerCapture(id)
    } catch {}
  }

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left - view.tx) / view.s, (e.clientY - r.top - view.ty) / view.s]
  }
  const pick = PICK_PX / view.s

  // Titik kerja: ujung dinding terdekat, lalu kunci sudut, lalu grid.
  // Titik kerja, urutan prioritas: ujung dinding, garis dinding (sambungan T), lalu kunci sudut dan grid.
  const workPoint = (raw: Point, free: boolean): Point => {
    const end = snapToEndpoint(raw, project.walls, pick)
    if (end) return end
    const from = draft.at(-1)
    const lock = !!from && tool === 'wall' && !free
    const p = lock ? lockAngle(from!, raw) : raw
    const near = nearestWall(p, project.walls, pick)
    if (near) {
      // Dengan kunci sudut, titik diambil di perpotongan arah gambar dengan dinding, supaya sekat tetap lurus.
      // Tanpa kunci, posisi di sepanjang dinding dibulatkan ke grid supaya ujung dinding berikutnya bisa sejajar.
      const x = lock ? rayOnWall(from!, p, near.wall) : null
      const q = x ?? pointAlong(near.wall, round(near.t, GRID_SNAP))
      return [round(q[0], 0.001), round(q[1], 0.001)]
    }
    if (lock) {
      // Kunci sudut: bulatkan panjangnya, bukan x dan y, supaya arah 0/45/90° tidak bergeser oleh grid.
      const len = round(Math.hypot(p[0] - from![0], p[1] - from![1]), GRID_SNAP)
      const ang = Math.atan2(p[1] - from![1], p[0] - from![0])
      return [round(from![0] + Math.cos(ang) * len, 0.001), round(from![1] + Math.sin(ang) * len, 0.001)]
    }
    return snap(p, GRID_SNAP)
  }

  // Panjang dinding yang sedang diketik, terikat ke titik awal tempat mulai mengetik.
  const [typed, setTyped] = useState<{ at: string; text: string } | null>(null)
  const from = draft.at(-1)
  const typing = tool === 'wall' && from && typed?.at === from.join(',') ? typed.text : null
  const typedLen = typing ? Number(typing.replace(',', '.')) : NaN
  // Arah dinding ketikan mengikuti kursor (dengan kunci sudut); tanpa kursor, ke kanan.
  const typedEnd = (): Point | null => {
    if (!from || !(typedLen > 0)) return null
    const dir = cursor ? workPoint(cursor, freeAngle) : ([from[0] + 1, from[1]] as Point)
    const d = Math.hypot(dir[0] - from[0], dir[1] - from[1]) || 1
    const ux = d > 1e-6 ? (dir[0] - from[0]) / d : 1
    const uy = d > 1e-6 ? (dir[1] - from[1]) / d : 0
    return [round(from[0] + ux * typedLen, 0.001), round(from[1] + uy * typedLen, 0.001)]
  }

  useEffect(() => {
    if (tool !== 'wall' || !from) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
      const at = from.join(',')
      const cur = typed?.at === at ? typed.text : ''
      // Pemisah desimal dikenali dari tombolnya (koma, titik, numpad), tidak bergantung tata letak keyboard.
      const isSep = [',', '.'].includes(e.key) || ['Comma', 'Period', 'NumpadDecimal'].includes(e.code)
      if (/^[0-9]$/.test(e.key) || (isSep && !cur.includes(','))) {
        e.preventDefault()
        setTyped({ at, text: (cur + (isSep ? ',' : e.key)).slice(0, 7) })
      } else if (e.key === 'Backspace' && cur) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setTyped({ at, text: cur.slice(0, -1) })
      } else if (e.key === 'Enter' && cur) {
        e.preventDefault()
        const end = typedEnd()
        if (!end) return
        apply((pr) => ({ ...pr, walls: [...pr.walls, { id: uid(), a: from, b: end, ...WALL_DEFAULTS, level }] }))
        setDraft([end])
        setTyped(null)
      }
    }
    // Didaftarkan saat capture supaya Backspace tidak sampai ke pintasan hapus elemen di editor.
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
  })

  const openingPreview = (p: Point): Opening | null => {
    if (tool !== 'door' && tool !== 'window') return null
    const hit = nearestWall(p, project.walls, Math.max(pick, 0.3))
    if (!hit) return null
    const d = OPENING_DEFAULTS[tool]
    if (wallLength(hit.wall) < d.width) return null
    return { id: 'preview', wallId: hit.wall.id, at: clampOpening(hit.t, d.width, hit.wall), kind: tool, ...d }
  }

  // Layar sentuh: dua jari = pinch-zoom + geser; satu jari di alat gambar baru menaruh titik saat diangkat
  // (ketukan), supaya jari pertama dari pinch tidak ikut menaruh titik. Seret satu jari = geser kanvas.
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null)
  const tap = useRef<{ x: number; y: number; alt: boolean } | null>(null)

  const touchSpread = () => {
    const [a, b] = [...touches.current.values()]
    const r = svgRef.current!.getBoundingClientRect()
    return { d: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top }
  }

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      capture(e.pointerId)
      if (touches.current.size === 2) {
        tap.current = null
        pan.current = null
        pinch.current = touchSpread()
        return
      }
      if (tool !== 'select') {
        tap.current = { x: e.clientX, y: e.clientY, alt: false }
        pan.current = { x: e.clientX, y: e.clientY }
        return
      }
    }
    // Elemen yang diklik dengan alat Pilih sudah menghentikan event, jadi yang sampai sini adalah area kosong.
    if (e.button === 1 || tool === 'select') {
      pan.current = { x: e.clientX, y: e.clientY }
      capture(e.pointerId)
      if (tool === 'select') setSelection(null)
      return
    }
    if (e.button !== 0) return
    place(e.clientX, e.clientY, e.altKey)
  }

  const place = (clientX: number, clientY: number, alt: boolean) => {
    const raw = toWorld({ clientX, clientY })
    const p = workPoint(raw, alt)

    if (tool === 'wall') {
      const from = draft.at(-1)
      if (!from) return setDraft([p])
      if (dist(from, p) < GRID_SNAP) return
      apply((pr) => ({ ...pr, walls: [...pr.walls, { id: uid(), a: from, b: p, ...WALL_DEFAULTS, level }] }))
      setDraft([p])
    } else if (tool === 'room') {
      if (draft.length >= 3 && dist(draft[0], p) <= pick) return closeRoom(draft)
      if (draft.at(-1) && dist(draft.at(-1)!, p) < GRID_SNAP) return
      setDraft([...draft, p])
    } else if (tool === 'door' || tool === 'window') {
      const o = openingPreview(raw)
      if (!o) return
      const id = uid()
      apply((pr) => ({ ...pr, openings: [...pr.openings, { ...o, id }] }))
      setSelection({ kind: 'opening', id })
    } else if (tool === 'furniture') {
      const id = uid()
      const pos = snap(raw, GRID_SNAP)
      apply((pr) => ({ ...pr, furniture: [...pr.furniture, { id, kind: furnitureKind, pos, rot: placeRot, level }] }))
      setSelection({ kind: 'furniture', id })
    } else if (tool === 'text') {
      const id = uid()
      apply((pr) => ({ ...pr, notes: [...(pr.notes ?? []), { id, a: snap(raw, GRID_SNAP), text: 'Catatan', level }] }))
      setSelection({ kind: 'note', id })
    } else if (tool === 'measure') {
      // Klik pertama = titik awal, klik kedua = garis ukur jadi. Titik menempel ke ujung dinding.
      const from = draft.at(-1)
      if (!from) return setDraft([p])
      if (dist(from, p) < GRID_SNAP) return
      const id = uid()
      apply((pr) => ({ ...pr, notes: [...(pr.notes ?? []), { id, a: from, b: p, level }] }))
      setDraft([])
      setSelection({ kind: 'note', id })
    }
  }

  const startDrag = (f: Furniture) => (e: RPointerEvent) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    setSelection({ kind: 'furniture', id: f.id })
    const w = toWorld(e)
    setDrag({ id: f.id, offset: [w[0] - f.pos[0], w[1] - f.pos[1]], pos: f.pos, moved: false })
    capture(e.pointerId)
  }

  const closeRoom = (pts: Point[]) => {
    const id = uid()
    apply((pr) => ({ ...pr, rooms: [...pr.rooms, { id, name: `Ruang ${pr.rooms.length + 1}`, points: pts, level }] }))
    setDraft([])
    setSelection({ kind: 'room', id })
  }

  const startWallDrag = (id: string) => (e: RPointerEvent) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    setSelection({ kind: 'wall', id })
    setWdrag({ id, start: toWorld(e), d: [0, 0] })
    capture(e.pointerId)
  }

  const startNoteDrag = (id: string) => (e: RPointerEvent) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    setSelection({ kind: 'note', id })
    setNdrag({ id, start: toWorld(e), d: [0, 0] })
    capture(e.pointerId)
  }

  const startOpeningDrag = (o: Opening) => (e: RPointerEvent) => {
    if (tool !== 'select' || e.button !== 0) return
    e.stopPropagation()
    setSelection({ kind: 'opening', id: o.id })
    setOdrag({ id: o.id, at: o.at, moved: false })
    capture(e.pointerId)
  }

  const startVertexDrag = (from: Point) => (e: RPointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setVdrag({ from, to: from })
    capture(e.pointerId)
  }

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch.current && touches.current.size === 2) {
        const now = touchSpread()
        const prev = pinch.current
        pinch.current = now
        setView((v) => {
          const s = Math.min(400, Math.max(8, (v.s * now.d) / (prev.d || now.d)))
          // Titik di bawah tengah dua jari tetap di tempat, lalu ikut bergeser bersama jari.
          return { s, tx: now.mx - ((prev.mx - v.tx) * s) / v.s, ty: now.my - ((prev.my - v.ty) * s) / v.s }
        })
        return
      }
      if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 10) tap.current = null
    }
    if (ndrag) {
      const w = toWorld(e)
      const d = snap([w[0] - ndrag.start[0], w[1] - ndrag.start[1]], GRID_SNAP)
      if (d[0] !== ndrag.d[0] || d[1] !== ndrag.d[1]) setNdrag({ ...ndrag, d })
      return
    }
    if (wdrag) {
      const w = toWorld(e)
      const d = snap([w[0] - wdrag.start[0], w[1] - wdrag.start[1]], GRID_SNAP)
      if (d[0] !== wdrag.d[0] || d[1] !== wdrag.d[1]) setWdrag({ ...wdrag, d })
      return
    }
    if (odrag) {
      const o = project.openings.find((x) => x.id === odrag.id)
      const w = o && project.walls.find((x) => x.id === o.wallId)
      if (!o || !w) return
      const at = clampOpening(round(projectOnWall(toWorld(e), w).t, GRID_SNAP), o.width, w)
      if (at !== odrag.at) setOdrag({ ...odrag, at, moved: true })
      return
    }
    if (vdrag) {
      // Tarik ke ujung dinding lain (bukan titik yang sedang digeser), lalu grid.
      const w = toWorld(e)
      const ends = project.walls.flatMap((x) => [x.a, x.b]).filter((q) => dist(q, vdrag.from) > 1e-6)
      const near = ends.reduce<Point | null>((best, q) => (dist(q, w) <= pick && (!best || dist(q, w) < dist(best, w)) ? q : best), null)
      const to = near ?? snap(w, GRID_SNAP)
      if (to[0] !== vdrag.to[0] || to[1] !== vdrag.to[1]) setVdrag({ ...vdrag, to })
      return
    }
    if (drag) {
      const w = toWorld(e)
      const pos = snap([w[0] - drag.offset[0], w[1] - drag.offset[1]], GRID_SNAP)
      if (pos[0] !== drag.pos[0] || pos[1] !== drag.pos[1]) setDrag({ ...drag, pos, moved: true })
      return
    }
    if (pan.current) {
      const dx = e.clientX - pan.current.x
      const dy = e.clientY - pan.current.y
      pan.current = { x: e.clientX, y: e.clientY }
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
      return
    }
    setFreeAngle(e.altKey)
    setCursor(toWorld(e))
  }

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId)
      if (touches.current.size < 2) pinch.current = null
      if (tap.current && e.type === 'pointerup') place(tap.current.x, tap.current.y, false)
      tap.current = null
    }
    pan.current = null
    if (drag?.moved) {
      const { id, pos } = drag
      apply((pr) => ({ ...pr, furniture: pr.furniture.map((f) => (f.id === id ? { ...f, pos } : f)) }))
    }
    setDrag(null)
    if (vdrag && dist(vdrag.from, vdrag.to) > 1e-6) {
      const { from, to } = vdrag
      // Dinding yang menyusut jadi titik dibuang supaya tidak ada dinding nol meter.
      apply((all) => withLevel(all, level, (pr) => {
        const next = moveVertex(pr, from, to)
        const gone = new Set(next.walls.filter((w) => dist(w.a, w.b) < GRID_SNAP).map((w) => w.id))
        return gone.size ? { ...next, walls: next.walls.filter((w) => !gone.has(w.id)), openings: next.openings.filter((o) => !gone.has(o.wallId)) } : next
      }))
    }
    setVdrag(null)
    if (odrag?.moved) {
      const { id, at } = odrag
      apply((pr) => ({ ...pr, openings: pr.openings.map((x) => (x.id === id ? { ...x, at } : x)) }))
    }
    setOdrag(null)
    if (wdrag && (wdrag.d[0] || wdrag.d[1])) {
      const { id, d } = wdrag
      apply((all) => withLevel(all, level, (pr) => translateWall(pr, id, d)))
    }
    setWdrag(null)
    if (ndrag && (ndrag.d[0] || ndrag.d[1])) {
      const { id, d } = ndrag
      apply((pr) => ({ ...pr, notes: pr.notes?.map((n) => (n.id === id ? moveNote(n, d) : n)) }))
    }
    setNdrag(null)
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    setView((v) => {
      const s = Math.min(400, Math.max(8, v.s * Math.exp(-e.deltaY * 0.0015)))
      return { s, tx: mx - ((mx - v.tx) * s) / v.s, ty: my - ((my - v.ty) * s) / v.s }
    })
  }

  const selectOn = (sel: NonNullable<Selection>) => (e: RPointerEvent) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelection(sel)
  }

  const isSel = (kind: string, id: string) => selection?.kind === kind && selection.id === id
  const work = cursor ? workPoint(cursor, freeAngle) : null
  const preview = cursor ? openingPreview(cursor) : null
  const k = 1 / view.s // satu piksel layar dalam meter
  // Saat titik dinding diseret, gambar memakai denah sementara; riwayat baru dicatat saat dilepas.
  const shown = vdrag ? moveVertex(project, vdrag.from, vdrag.to) : wdrag ? translateWall(project, wdrag.id, wdrag.d) : project
  const planCenter = getPlanCenter(shown)

  // Keyboard: semua yang bisa dilakukan dengan tetikus juga bisa dari keyboard saat kanvas difokus (Tab).
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')
  const describe = (sel: NonNullable<Selection>) => {
    if (sel.kind === 'wall') {
      const w = project.walls.find((x) => x.id === sel.id)
      return w ? `Dinding ${fmt(wallLength(w))} m` : 'Dinding'
    }
    if (sel.kind === 'opening') return project.openings.find((x) => x.id === sel.id)?.kind === 'door' ? 'Pintu' : 'Jendela'
    if (sel.kind === 'room') return `Ruangan ${project.rooms.find((x) => x.id === sel.id)?.name ?? ''}`
    if (sel.kind === 'furniture') {
      const f = project.furniture.find((x) => x.id === sel.id)
      return f ? `Furnitur ${dims(f).label}` : 'Furnitur'
    }
    const n = project.notes?.find((x) => x.id === sel.id)
    return n?.b ? `Garis ukur ${fmt(dist(n.a, n.b))} m` : `Catatan ${n?.text ?? ''}`
  }
  const elements = (): NonNullable<Selection>[] => [
    ...project.walls.map((x) => ({ kind: 'wall' as const, id: x.id })),
    ...project.openings.map((x) => ({ kind: 'opening' as const, id: x.id })),
    ...project.rooms.map((x) => ({ kind: 'room' as const, id: x.id })),
    ...project.furniture.map((x) => ({ kind: 'furniture' as const, id: x.id })),
    ...(project.notes ?? []).map((x) => ({ kind: 'note' as const, id: x.id })),
  ]
  const toClient = (q: Point) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { clientX: r.left + view.tx + q[0] * view.s, clientY: r.top + view.ty + q[1] * view.s }
  }
  const onKeyDown = (e: RKeyboardEvent<SVGSVGElement>) => {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented) return
    const arrows: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const dir = arrows[e.key]
    if (tool === 'select') {
      if (e.key === '[' || e.key === ']') {
        const list = elements()
        if (!list.length) return setSay('Belum ada elemen di lantai ini.')
        const i = selection ? list.findIndex((x) => x.kind === selection.kind && x.id === selection.id) : -1
        const next = list[(i + (e.key === ']' ? 1 : -1) + list.length) % list.length]
        e.preventDefault()
        setSelection(next)
        setSay(`${describe(next)} dipilih. Panah untuk menggeser, Delete untuk menghapus.`)
      } else if (dir && selection) {
        e.preventDefault()
        const step = e.shiftKey ? 0.5 : e.altKey ? 0.01 : GRID_SNAP
        const sel = selection
        apply((all) => withLevel(all, level, (pr) => nudge(pr, sel, [dir[0] * step, dir[1] * step])))
        setSay(`${describe(sel)} digeser ${fmt(step)} m.`)
      } else if (dir) {
        e.preventDefault()
        setView((v) => ({ ...v, tx: v.tx - dir[0] * 40, ty: v.ty - dir[1] * 40 }))
      }
      return
    }
    // Alat gambar: panah menggerakkan kursor, Enter atau Spasi menaruh titik seperti klik.
    // Tanpa kursor (belum ada tetikus atau panah): mulai dari titik terakhir, tengah denah, atau titik nol.
    const here = cursor ?? draft.at(-1) ?? planCenter ?? ([0, 0] as Point)
    if (dir) {
      e.preventDefault()
      const step = e.shiftKey ? 1 : e.altKey ? GRID_SNAP : 0.25
      const from = here
      const next: Point = [round(from[0] + dir[0] * step, 0.001), round(from[1] + dir[1] * step, 0.001)]
      setCursor(next)
      setSay(`Kursor x ${fmt(next[0])}, y ${fmt(next[1])} m.`)
    } else if ((e.key === 'Enter' || e.key === ' ') && !(tool === 'room' && e.key === 'Enter' && draft.length >= 3)) {
      e.preventDefault()
      const { clientX, clientY } = toClient(here)
      place(clientX, clientY, e.altKey)
      setCursor(here)
      const at = workPoint(here, e.altKey)
      setSay(`Titik ditaruh di x ${fmt(at[0])}, y ${fmt(at[1])} m.`)
    }
  }

  return (
    <>
      <p id="kanvas-bantuan" className="sr-only">
        Alat Pilih: kurung siku buka dan tutup untuk berpindah antar elemen, panah untuk menggeser (Shift 0,5 meter, Alt 1 sentimeter),
        tanpa elemen terpilih panah menggeser tampilan. Alat gambar: panah menggerakkan kursor (0,25 meter, Shift 1 meter, Alt 5 sentimeter),
        Enter atau Spasi menaruh titik, Escape berhenti.
      </p>
      <p className="sr-only" aria-live="polite">
        {say}
      </p>
      <svg
        ref={svgRef}
        className="plan-canvas"
        data-tool={tool}
        role="application"
        tabIndex={0}
        aria-label="Kanvas denah"
        aria-describedby="kanvas-bantuan"
        onKeyDown={onKeyDown}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setCursor(null)}
        onWheel={onWheel}
        onDoubleClick={() => tool === 'room' && draft.length >= 3 && closeRoom(draft)}
        onContextMenu={(e) => {
          e.preventDefault()
          setDraft([])
        }}
      >
        <defs>
          {/* Grid 1 m dan 0,25 m: acuan skala dan snap saat menggambar, bukan hiasan. */}
          <pattern id="grid-minor" width={0.25 * view.s} height={0.25 * view.s} patternUnits="userSpaceOnUse" x={view.tx} y={view.ty}>
            <path d={`M ${0.25 * view.s} 0 L 0 0 0 ${0.25 * view.s}`} className="grid-minor" />
          </pattern>
          <pattern id="grid-major" width={view.s} height={view.s} patternUnits="userSpaceOnUse" x={view.tx} y={view.ty}>
            {view.s >= 40 && <rect width={view.s} height={view.s} fill="url(#grid-minor)" />}
            <path d={`M ${view.s} 0 L 0 0 0 ${view.s}`} className="grid-major" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-major)" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          {shown.rooms.map((r) => (
            <g key={r.id} onPointerDown={selectOn({ kind: 'room', id: r.id })}>
              <polygon
                points={r.points.join(' ')}
                className={isSel('room', r.id) ? 'room room-sel' : 'room'}
                style={isSel('room', r.id) ? undefined : { fill: FLOORS[r.floor ?? DEFAULT_FLOOR].plan }}
              />
            </g>
          ))}

          {/* Lantai di bawahnya tampil samar sebagai acuan supaya dinding antar lantai bisa disejajarkan. */}
          {below?.walls.map((w) => (
            <g key={'below' + w.id} className="below">
              {wallPolygons(w, below.openings).map((poly, i) => (
                <polygon key={i} points={poly.join(' ')} />
              ))}
            </g>
          ))}

          {project.furniture.map((f) => (
            <FurnitureShape
              key={f.id}
              f={drag?.id === f.id ? { ...f, pos: drag.pos } : f}
              selected={isSel('furniture', f.id)}
              onDown={startDrag(f)}
            />
          ))}

          {shown.walls.map((w) => (
            <WallShape key={w.id} wall={w} openings={shown.openings} selected={isSel('wall', w.id)} onDown={startWallDrag(w.id)} />
          ))}

          {shown.openings.map((o) => {
            const w = shown.walls.find((x) => x.id === o.wallId)
            return w ? (
              <OpeningShape key={o.id} o={odrag?.id === o.id ? { ...o, at: odrag.at } : o} wall={w} selected={isSel('opening', o.id)} onDown={startOpeningDrag(o)} />
            ) : null
          })}

          {/* Nama ruangan di atas furnitur supaya selalu terbaca. */}
          {shown.rooms.map((r) => (
            <RoomLabel key={r.id} name={r.name} points={r.points} k={k} />
          ))}

          {shown.walls.map((w) => (
            <Dimension key={w.id} a={w.a} b={w.b} k={k} offset={w.thickness / 2 + 14 * k} away={planCenter} rooms={shown.rooms} />
          ))}

          {project.notes?.map((n) => (
            <NoteShape key={n.id} n={ndrag?.id === n.id ? moveNote(n, ndrag.d) : n} k={k} selected={isSel('note', n.id)} onDown={startNoteDrag(n.id)} />
          ))}

          {tool === 'select' &&
            selection?.kind === 'wall' &&
            shown.walls
              .filter((w) => w.id === selection.id)
              .flatMap((w) => [w.a, w.b])
              .map((q, i) => (
                <g key={i} className="handle" onPointerDown={startVertexDrag(vdrag ? vdrag.from : q)}>
                  {/* Area sentuh 22 px, titik terlihat 7 px. */}
                  <circle cx={q[0]} cy={q[1]} r={22 * k} className="handle-hit" />
                  <circle cx={q[0]} cy={q[1]} r={7 * k} className="handle-dot" />
                </g>
              ))}

          {preview && (
            <OpeningShape o={preview} wall={project.walls.find((w) => w.id === preview.wallId)!} selected ghost />
          )}

          {draft.length > 0 && work && tool === 'measure' && <NoteShape n={{ id: 'preview', a: draft[0], b: work }} k={k} selected />}

          {draft.length > 0 && (work || typing) && (tool === 'wall' || tool === 'room') && (
            <g className="draft">
              <polyline points={[...draft, typedEnd() ?? work!].join(' ')} vectorEffect="non-scaling-stroke" />
              {typing ? (
                <text className="typed" x={(typedEnd() ?? from!)[0]} y={(typedEnd() ?? from!)[1] - 12 * k} fontSize={13 * k} strokeWidth={3 * k} textAnchor="middle">
                  {typing} m, Enter
                </text>
              ) : (
                <Dimension a={draft.at(-1)!} b={work!} k={k} offset={14 * k} />
              )}
              {tool === 'room' && draft.length >= 3 && <circle cx={draft[0][0]} cy={draft[0][1]} r={PICK_PX * k} className="close-target" />}
            </g>
          )}

          {cursor && tool === 'furniture' && (
            <FurnitureShape f={{ id: 'preview', kind: furnitureKind, pos: snap(cursor, GRID_SNAP), rot: placeRot }} selected ghost />
          )}

          {work && (tool === 'wall' || tool === 'room' || tool === 'measure') && (
            <g className="crosshair">
              <circle cx={work[0]} cy={work[1]} r={4 * k} />
            </g>
          )}
        </g>
      </svg>
    </>
  )
}

// Perpotongan garis dari `from` melewati `to` dengan segmen dinding; null kalau sejajar atau di luar dinding.
function rayOnWall(from: Point, to: Point, w: Wall): Point | null {
  const r: Point = [to[0] - from[0], to[1] - from[1]]
  const s: Point = [w.b[0] - w.a[0], w.b[1] - w.a[1]]
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return null
  const u = ((w.a[0] - from[0]) * r[1] - (w.a[1] - from[1]) * r[0]) / den
  if (u < 0 || u > 1) return null
  return [w.a[0] + s[0] * u, w.a[1] + s[1] * u]
}

