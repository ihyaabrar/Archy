// Atap miring dari kotak luar dinding lantai teratas. Bidang atap melewati puncak dinding (garis as),
// lalu teritisan menjorok keluar dan turun mengikuti kemiringan yang sama.
// Batasan: denah berbentuk L/T tetap diberi satu atap persegi seukuran kotak luarnya.

import { elevationOf, levelOf, levelsOf, type Project } from './project'

export type RoofType = 'datar' | 'pelana' | 'perisai'
export type RoofMaterial = 'genteng' | 'metal' | 'beton'
export type Roof = { type: RoofType; pitch: number; overhang: number; material: RoofMaterial; ridge: 'auto' | 'putar' }

export const DEFAULT_ROOF: Roof = { type: 'datar', pitch: 30, overhang: 0.6, material: 'genteng', ridge: 'auto' }
export const ROOF_LABELS: Record<RoofType, string> = { datar: 'Datar', pelana: 'Pelana', perisai: 'Perisai' }
export const ROOF_MATERIALS: Record<RoofMaterial, { label: string; base: string }> = {
  genteng: { label: 'Genteng tanah liat', base: '#a5543a' },
  metal: { label: 'Genteng metal', base: '#5d6b70' },
  beton: { label: 'Genteng beton', base: '#7f7a74' },
}

export const isRoof = (r: unknown): r is Roof => {
  const o = r as Roof
  return (
    !!o &&
    ['datar', 'pelana', 'perisai'].includes(o.type) &&
    ['genteng', 'metal', 'beton'].includes(o.material) &&
    ['auto', 'putar'].includes(o.ridge) &&
    o.pitch >= 5 &&
    o.pitch <= 60 &&
    o.overhang >= 0 &&
    o.overhang <= 2
  )
}

type V3 = [number, number, number]
// Segitiga dengan UV dalam meter (u sepanjang lis, v sepanjang kemiringan) supaya tekstur genteng seukuran aslinya.
export type Tri = { p: [V3, V3, V3]; uv: [[number, number], [number, number], [number, number]] }
export type RoofMesh = { roof: Tri[]; gables: Tri[]; area: number; ridgeHeight: number }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const triArea = (t: Tri) => len(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))) / 2

// Lantai teratas yang berdinding: atap bertumpu di sana.
export function roofBase(p: Project) {
  const levels = levelsOf(p).filter((l) => p.walls.some((w) => levelOf(p, w) === l.id))
  if (!levels.length) return null
  const top = levels.reduce((a, l) => (l.elevation > a.elevation ? l : a))
  const walls = p.walls.filter((w) => levelOf(p, w) === top.id)
  const xs = walls.flatMap((w) => [w.a[0], w.b[0]])
  const zs = walls.flatMap((w) => [w.a[1], w.b[1]])
  return {
    level: top.id,
    height: elevationOf(p, top.id) + Math.max(...walls.map((w) => w.height)),
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    z0: Math.min(...zs),
    z1: Math.max(...zs),
  }
}

export function roofMesh(p: Project, r: Roof): RoofMesh | null {
  const b = roofBase(p)
  if (!b || r.type === 'datar' || b.x1 - b.x0 < 0.5 || b.z1 - b.z0 < 0.5) return null
  // Kerja di sumbu lokal: a = sepanjang bubungan, c = melintang. Bubungan sejajar sisi terpanjang, kecuali diputar.
  const alongX = (b.x1 - b.x0 >= b.z1 - b.z0) !== (r.ridge === 'putar')
  const [a0, a1, c0, c1] = alongX ? [b.x0, b.x1, b.z0, b.z1] : [b.z0, b.z1, b.x0, b.x1]
  const toW = (a: number, y: number, c: number): V3 => (alongX ? [a, y, c] : [c, y, a])
  const t = Math.tan((r.pitch * Math.PI) / 180)
  const o = r.overhang
  const half = (c1 - c0) / 2
  const cm = (c0 + c1) / 2
  const H = b.height
  const ridgeY = H + half * t
  const eaveY = H - o * t
  const slope = Math.hypot(half + o, ridgeY - eaveY) // panjang sisi miring dari lis ke bubungan
  const A0 = a0 - o
  const A1 = a1 + o

  const roof: Tri[] = []
  const gables: Tri[] = []
  const quad = (list: Tri[], q: [V3, V3, V3, V3], uv: [[number, number], [number, number], [number, number], [number, number]]) => {
    list.push({ p: [q[0], q[1], q[2]], uv: [uv[0], uv[1], uv[2]] }, { p: [q[0], q[2], q[3]], uv: [uv[0], uv[2], uv[3]] })
  }

  if (r.type === 'pelana') {
    // Dua bidang miring penuh sepanjang bangunan + teritisan di ujung.
    quad(roof, [toW(A0, eaveY, c0 - o), toW(A1, eaveY, c0 - o), toW(A1, ridgeY, cm), toW(A0, ridgeY, cm)], [[0, 0], [A1 - A0, 0], [A1 - A0, slope], [0, slope]])
    quad(roof, [toW(A1, eaveY, c1 + o), toW(A0, eaveY, c1 + o), toW(A0, ridgeY, cm), toW(A1, ridgeY, cm)], [[0, 0], [A1 - A0, 0], [A1 - A0, slope], [0, slope]])
    // Dinding sopi-sopi (segitiga) di atas dinding ujung, di garis as dinding.
    for (const a of [a0, a1]) gables.push({ p: [toW(a, H, c0), toW(a, H, c1), toW(a, ridgeY, cm)], uv: [[0, 0], [c1 - c0, 0], [half, ridgeY - H]] })
  } else {
    // Perisai: bubungan menjorok masuk setengah bentang dari tiap ujung; terlalu pendek = limasan (piramida).
    const r0 = Math.min(a0 + half, (a0 + a1) / 2)
    const r1 = Math.max(a1 - half, (a0 + a1) / 2)
    const ry = H + Math.min(half, (a1 - a0) / 2) * t
    const E = (a: number, c: number) => toW(a, eaveY, c)
    const R0 = toW(r0, ry, cm)
    const R1 = toW(r1, ry, cm)
    const sl = Math.hypot(half + o, ry - eaveY)
    quad(roof, [E(A0, c0 - o), E(A1, c0 - o), R1, R0], [[0, 0], [A1 - A0, 0], [r1 - A0, sl], [r0 - A0, sl]])
    quad(roof, [E(A1, c1 + o), E(A0, c1 + o), R0, R1], [[0, 0], [A1 - A0, 0], [A1 - r0, sl], [A1 - r1, sl]])
    const ends = (c1 - c0) / 2 + o
    roof.push({ p: [E(A0, c1 + o), E(A0, c0 - o), R0], uv: [[0, 0], [c1 - c0 + 2 * o, 0], [ends, sl]] })
    roof.push({ p: [E(A1, c0 - o), E(A1, c1 + o), R1], uv: [[0, 0], [c1 - c0 + 2 * o, 0], [ends, sl]] })
  }
  return { roof, gables, area: roof.reduce((s, x) => s + triArea(x), 0), ridgeHeight: ridgeY }
}
