// Model data proyek. Satuan meter. Editor 2D dan tampilan 3D membaca bentuk yang sama.

import { isKind, type Furniture } from './furniture'
import { isFloor, isWall, type FloorKey, type WallKey } from './materials'
import { isRoof, type Roof } from './roof'

export type Point = [number, number]

// level: id lantai. Kosong = lantai pertama (proyek sebelum fitur bertingkat tidak punya field ini).
export type Wall = { id: string; a: Point; b: Point; thickness: number; height: number; level?: string }

export type Opening = {
  id: string
  wallId: string
  at: number // jarak tengah bukaan dari titik a dinding, meter
  width: number
  kind: 'door' | 'window'
  sill: number
  height: number
}

export type Room = { id: string; name: string; points: Point[]; floor?: FloorKey; level?: string } // tanpa floor = DEFAULT_FLOOR

// Lantai bangunan. elevation = tinggi lantai jadi dari muka tanah (meter).
export type Level = { id: string; name: string; elevation: number }

export type Project = {
  version: 1
  walls: Wall[]
  openings: Opening[]
  rooms: Room[]
  furniture: Furniture[]
  wallFinish?: WallKey
  levels?: Level[] // kosong = satu lantai
  roof?: Roof // kosong = atap datar
}

export const emptyProject = (): Project => ({ version: 1, walls: [], openings: [], rooms: [], furniture: [] })

export const FIRST_LEVEL: Level = { id: 'L1', name: 'Lantai 1', elevation: 0 }
export const LEVEL_GAP = 3.2 // jarak antar lantai bawaan: dinding 3 m + pelat 0,2 m

export const levelsOf = (p: Pick<Project, 'levels'>): Level[] => (p.levels?.length ? p.levels : [FIRST_LEVEL])

// Elemen tanpa level ada di lantai pertama.
export const levelOf = (p: Pick<Project, 'levels'>, el: { level?: string }) => el.level ?? levelsOf(p)[0].id

export const elevationOf = (p: Pick<Project, 'levels'>, id: string) => levelsOf(p).find((l) => l.id === id)?.elevation ?? 0

// Sebagian denah yang berada di satu lantai (bukaan ikut dindingnya).
export function onLevel(p: Project, id: string): Project {
  const walls = p.walls.filter((w) => levelOf(p, w) === id)
  const ids = new Set(walls.map((w) => w.id))
  return {
    ...p,
    walls,
    openings: p.openings.filter((o) => ids.has(o.wallId)),
    rooms: p.rooms.filter((r) => levelOf(p, r) === id),
    furniture: p.furniture.filter((f) => levelOf(p, f) === id),
  }
}

// Denah sampai lantai tertentu (lantai itu dan semua di bawahnya): untuk melihat isi lantai bawah di 3D.
export function upTo(p: Project, id: string): Project {
  const top = elevationOf(p, id)
  const ok = new Set(levelsOf(p).filter((l) => l.elevation <= top).map((l) => l.id))
  const walls = p.walls.filter((w) => ok.has(levelOf(p, w)))
  const ids = new Set(walls.map((w) => w.id))
  return {
    ...p,
    walls,
    openings: p.openings.filter((o) => ids.has(o.wallId)),
    rooms: p.rooms.filter((r) => ok.has(levelOf(p, r))),
    furniture: p.furniture.filter((f) => ok.has(levelOf(p, f))),
  }
}

// Ubah hanya isi satu lantai; lantai lain tidak tersentuh (mis. menggeser titik yang kebetulan bertumpuk antar lantai).
export function withLevel(p: Project, id: string, fn: (part: Project) => Project): Project {
  const part = onLevel(p, id)
  const next = fn(part)
  if (next === part) return p
  const inPart = <T extends { id: string }>(list: T[], x: T) => list.some((y) => y.id === x.id)
  return {
    ...next,
    walls: [...p.walls.filter((w) => !inPart(part.walls, w)), ...next.walls],
    openings: [...p.openings.filter((o) => !inPart(part.openings, o)), ...next.openings],
    rooms: [...p.rooms.filter((r) => !inPart(part.rooms, r)), ...next.rooms],
    furniture: [...p.furniture.filter((f) => !inPart(part.furniture, f)), ...next.furniture],
  }
}

// Tambah lantai di atas lantai teratas.
export function addLevel(p: Project): { project: Project; id: string } {
  const levels = levelsOf(p)
  const top = levels.reduce((a, l) => (l.elevation > a.elevation ? l : a))
  const id = uid()
  const level = { id, name: `Lantai ${levels.length + 1}`, elevation: +(top.elevation + LEVEL_GAP).toFixed(2) }
  return { project: { ...p, levels: [...levels, level] }, id }
}

// Hapus lantai beserta isinya. Lantai terakhir tidak bisa dihapus.
export function removeLevel(p: Project, id: string): Project {
  const levels = levelsOf(p)
  if (levels.length < 2) return p
  const keep = <T extends { level?: string }>(el: T) => levelOf(p, el) !== id
  const walls = p.walls.filter(keep)
  const ids = new Set(walls.map((w) => w.id))
  const rest = levels.filter((l) => l.id !== id)
  // Elemen tanpa level ikut lantai pertama lama; kalau lantai itu tetap ada, tandai eksplisit supaya tidak berpindah.
  const pin = <T extends { level?: string }>(el: T): T => ({ ...el, level: levelOf(p, el) })
  return {
    ...p,
    levels: rest,
    walls: walls.map(pin),
    openings: p.openings.filter((o) => ids.has(o.wallId)),
    rooms: p.rooms.filter(keep).map(pin),
    furniture: p.furniture.filter(keep).map(pin),
  }
}

export const WALL_DEFAULTS = { thickness: 0.15, height: 3 }
export const OPENING_DEFAULTS = {
  door: { width: 0.9, sill: 0, height: 2.1 },
  window: { width: 1.2, sill: 0.9, height: 1.2 },
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const round = (n: number, step = 0.01) => Math.round(n / step) * step

export const snap = (p: Point, step: number): Point => [round(p[0], step), round(p[1], step)]

export const dist = (p: Point, q: Point) => Math.hypot(q[0] - p[0], q[1] - p[1])

export const wallLength = (w: Wall) => dist(w.a, w.b)

// Proyeksi titik ke segmen dinding: t = jarak dari a (dibatasi ke panjang dinding), d = jarak tegak lurus.
export function projectOnWall(p: Point, w: Wall) {
  const len = wallLength(w)
  if (len === 0) return { t: 0, d: dist(p, w.a) }
  const ux = (w.b[0] - w.a[0]) / len
  const uy = (w.b[1] - w.a[1]) / len
  const t = Math.min(len, Math.max(0, (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy))
  return { t, d: dist(p, [w.a[0] + ux * t, w.a[1] + uy * t]) }
}

export const pointAlong = (w: Wall, t: number): Point => {
  const len = wallLength(w) || 1
  return [w.a[0] + ((w.b[0] - w.a[0]) * t) / len, w.a[1] + ((w.b[1] - w.a[1]) * t) / len]
}

// Bukaan harus muat utuh di dalam dinding.
export const clampOpening = (at: number, width: number, w: Wall) =>
  Math.min(Math.max(at, width / 2), Math.max(width / 2, wallLength(w) - width / 2))

// Bagian dinding yang padat (tidak terpotong bukaan), sebagai interval jarak dari titik a.
export function wallSpans(w: Wall, openings: Opening[]): [number, number][] {
  const len = wallLength(w)
  const cuts = openings
    .filter((o) => o.wallId === w.id)
    .map((o) => [o.at - o.width / 2, o.at + o.width / 2] as [number, number])
    .sort((x, y) => x[0] - y[0])
  const spans: [number, number][] = []
  let start = 0
  for (const [c0, c1] of cuts) {
    if (c0 > start) spans.push([start, c0])
    start = Math.max(start, c1)
  }
  if (start < len) spans.push([start, len])
  return spans
}

export function nearestWall(p: Point, walls: Wall[], maxDist: number) {
  let best: { wall: Wall; t: number; d: number } | null = null
  for (const wall of walls) {
    const { t, d } = projectOnWall(p, wall)
    if (d <= maxDist && (!best || d < best.d)) best = { wall, t, d }
  }
  return best
}

// Tarik titik ke ujung dinding terdekat supaya sambungan dinding rapat.
export function snapToEndpoint(p: Point, walls: Wall[], maxDist: number): Point | null {
  let best: Point | null = null
  let bestD = maxDist
  for (const w of walls)
    for (const e of [w.a, w.b]) {
      const d = dist(p, e)
      if (d <= bestD) [best, bestD] = [e, d]
    }
  return best
}

// Kunci sudut ke kelipatan 45 derajat dari titik awal.
export function lockAngle(from: Point, to: Point): Point {
  const len = dist(from, to)
  const ang = Math.round(Math.atan2(to[1] - from[1], to[0] - from[0]) / (Math.PI / 4)) * (Math.PI / 4)
  return [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len]
}

const same = (p: Point, q: Point) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6

// Pindahkan satu titik sudut denah: semua ujung dinding dan sudut ruangan di titik itu ikut pindah,
// jadi sambungan tetap rapat. Bukaan dipertahankan di posisi dunianya, lalu dijaga tetap muat di dinding.
export function moveVertex(p: Project, from: Point, to: Point): Project {
  const moved = new Map<string, Wall>()
  const walls = p.walls.map((w) => {
    if (!same(w.a, from) && !same(w.b, from)) return w
    const nw = { ...w, a: same(w.a, from) ? to : w.a, b: same(w.b, from) ? to : w.b }
    moved.set(w.id, w)
    return nw
  })
  const byId = new Map(walls.map((w) => [w.id, w]))
  const openings = p.openings.map((o) => {
    const old = moved.get(o.wallId)
    if (!old) return o
    const nw = byId.get(o.wallId)!
    return { ...o, at: clampOpening(projectOnWall(pointAlong(old, o.at), nw).t, o.width, nw) }
  })
  const rooms = p.rooms.map((r) => (r.points.some((q) => same(q, from)) ? { ...r, points: r.points.map((q) => (same(q, from) ? to : q)) } : r))
  return { ...p, walls, openings, rooms }
}

export function polygonArea(points: Point[]) {
  let s = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

export const centroid = (points: Point[]): Point => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
]

// Validasi data dari localStorage atau file: data luar tidak dipercaya begitu saja.
export function parseProject(raw: unknown): Project {
  const isPt = (p: unknown): p is Point =>
    Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n))
  const o = raw as Partial<Project> | null
  if (!o || o.version !== 1 || !Array.isArray(o.walls) || !Array.isArray(o.openings) || !Array.isArray(o.rooms))
    throw new Error('Format proyek tidak dikenali')
  for (const w of o.walls)
    if (typeof w?.id !== 'string' || !isPt(w.a) || !isPt(w.b) || !(w.thickness > 0) || !(w.height > 0))
      throw new Error('Data dinding rusak')
  const wallIds = new Set(o.walls.map((w) => w.id))
  for (const op of o.openings)
    if (typeof op?.id !== 'string' || !wallIds.has(op.wallId) || !(op.width > 0) || !['door', 'window'].includes(op.kind))
      throw new Error('Data bukaan rusak')
  for (const r of o.rooms)
    if (typeof r?.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.points) || !r.points.every(isPt))
      throw new Error('Data ruangan rusak')
  if (o.rooms.some((r) => r.floor !== undefined && !isFloor(r.floor))) throw new Error('Data material lantai rusak')
  if (o.wallFinish !== undefined && !isWall(o.wallFinish)) throw new Error('Data material dinding rusak')
  // Proyek dari tahap sebelum furnitur belum punya daftar ini.
  const furniture = (o as { furniture?: unknown }).furniture ?? []
  if (!Array.isArray(furniture)) throw new Error('Data furnitur rusak')
  for (const f of furniture as Furniture[])
    if (
      typeof f?.id !== 'string' ||
      !isKind(f.kind) ||
      !isPt(f.pos) ||
      !Number.isFinite(f.rot) ||
      [f.w, f.d].some((v) => v !== undefined && !(v > 0 && v <= 10))
    )
      throw new Error('Data furnitur rusak')
  if ((o as { roof?: unknown }).roof !== undefined && !isRoof((o as { roof?: unknown }).roof)) throw new Error('Data atap rusak')
  // Lantai: daftar valid dan setiap elemen menunjuk lantai yang ada.
  const levels = (o as { levels?: unknown }).levels
  if (levels !== undefined) {
    if (!Array.isArray(levels) || levels.some((l) => typeof l?.id !== 'string' || typeof l.name !== 'string' || !Number.isFinite(l.elevation)))
      throw new Error('Data lantai rusak')
    const ids = new Set((levels as Level[]).map((l) => l.id))
    const all: { level?: unknown }[] = [...o.walls, ...o.rooms, ...(furniture as Furniture[])]
    if (all.some((el) => el.level !== undefined && !ids.has(el.level as string))) throw new Error('Elemen menunjuk lantai yang tidak ada')
  }
  return { ...(o as Project), furniture: furniture as Furniture[] }
}
