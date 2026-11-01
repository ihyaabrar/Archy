// Atap miring dari tapak dinding lantai teratas. Bidang atap melewati puncak dinding (garis as),
// lalu teritisan menjorok keluar dan turun mengikuti kemiringan yang sama.
// Denah L/T/U dipecah jadi sayap persegi; sayap sempit bertemu sayap lebar di bubungannya.

import { elevationOf, levelOf, levelsOf, type Project, type Wall } from './project'
import { faces } from './rooms'
import { inPolygon } from './walk'

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

type Rect = { x0: number; x1: number; z0: number; z1: number }
const EPS = 1e-6

// Tapak lantai teratas dipecah jadi persegi panjang yang boleh bertumpuk (denah L/T/U jadi dua-tiga sayap).
// Hanya untuk dinding sejajar sumbu; dinding miring atau tanpa bidang tertutup memakai kotak luar.
export function footprintRects(walls: Pick<Wall, 'a' | 'b'>[]): Rect[] | null {
  if (walls.some((w) => Math.abs(w.a[0] - w.b[0]) > EPS && Math.abs(w.a[1] - w.b[1]) > EPS)) return null
  const fs = faces(walls)
  if (!fs.length) return null
  const uniq = (v: number[]) => [...new Set(v.map((n) => Math.round(n * 1000) / 1000))].sort((a, b) => a - b)
  const xs = uniq(fs.flat().map((q) => q[0]))
  const zs = uniq(fs.flat().map((q) => q[1]))
  const nx = xs.length - 1
  const nz = zs.length - 1
  const inside = Array.from({ length: nx }, (_, i) =>
    Array.from({ length: nz }, (_, j) => fs.some((f) => inPolygon([(xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2], f))),
  )
  const area = (i: number, j: number) => (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j])
  const covered = inside.map((col) => col.map(() => false))
  const rects: Rect[] = []
  // Serakah: tiap putaran ambil persegi penuh yang menutup luas belum tertutup terbanyak (seri: yang terluas),
  // jadi sayap boleh menumpang di sudut yang sudah tertutup dan tetap sepanjang mungkin.
  // shortcut: pencarian brute force atas garis grid; cukup untuk denah rumah (puluhan garis), perlu prefix sum kalau denah besar.
  for (;;) {
    let best: { r: [number, number, number, number]; gain: number; size: number } | null = null
    for (let i0 = 0; i0 < nx; i0++)
      for (let j0 = 0; j0 < nz; j0++) {
        if (!inside[i0][j0]) continue
        for (let i1 = i0; i1 < nx && inside[i1][j0]; i1++)
          for (let j1 = j0; j1 < nz; j1++) {
            let full = true
            let gain = 0
            let size = 0
            for (let i = i0; i <= i1 && full; i++)
              for (let j = j0; j <= j1; j++) {
                if (!inside[i][j]) {
                  full = false
                  break
                }
                size += area(i, j)
                if (!covered[i][j]) gain += area(i, j)
              }
            if (!full) break
            if (gain > EPS && (!best || gain > best.gain + EPS || (Math.abs(gain - best.gain) <= EPS && size > best.size)))
              best = { r: [i0, i1, j0, j1], gain, size }
          }
      }
    if (!best) break
    const [i0, i1, j0, j1] = best.r
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) covered[i][j] = true
    rects.push({ x0: xs[i0], x1: xs[i1 + 1], z0: zs[j0], z1: zs[j1 + 1] })
  }
  return rects
}

// Lantai teratas yang berdinding: atap bertumpu di sana.
export function roofBase(p: Project) {
  const levels = levelsOf(p).filter((l) => p.walls.some((w) => levelOf(p, w) === l.id))
  if (!levels.length) return null
  const top = levels.reduce((a, l) => (l.elevation > a.elevation ? l : a))
  const walls = p.walls.filter((w) => levelOf(p, w) === top.id)
  const xs = walls.flatMap((w) => [w.a[0], w.b[0]])
  const zs = walls.flatMap((w) => [w.a[1], w.b[1]])
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
  return {
    level: top.id,
    height: elevationOf(p, top.id) + Math.max(...walls.map((w) => w.height)),
    thickness: Math.max(...walls.map((w) => w.thickness)),
    ...box,
    rects: footprintRects(walls) ?? [box],
  }
}

// Sayap: persegi dengan arah bubungannya. a = sepanjang bubungan, c = melintang; cut = ujung yang masuk ke sayap lain.
type Wing = { a0: number; a1: number; c0: number; c1: number; alongX: boolean; cut: [boolean, boolean] }

const wingOf = (b: Rect, flip: boolean): Wing => {
  const alongX = (b.x1 - b.x0 >= b.z1 - b.z0) !== flip
  const [a0, a1, c0, c1] = alongX ? [b.x0, b.x1, b.z0, b.z1] : [b.z0, b.z1, b.x0, b.x1]
  return { a0, a1, c0, c1, alongX, cut: [false, false] }
}
const span = (w: Wing) => w.c1 - w.c0
// Batas sayap pada sumbu dunia x (x = true) atau z.
const range = (w: Wing, x: boolean): [number, number] => (w.alongX === x ? [w.a0, w.a1] : [w.c0, w.c1])

// Sayap yang lebih sempit berhenti di dalam sayap yang lebih lebar. Kalau bubungan sayap lebar melintang,
// ujungnya ditarik ke bubungan itu (pertemuannya jadi talang jurai dalam). Ujung itu tanpa teritisan dan
// tanpa sopi-sopi karena tertutup atap sayap lebar.
function joinWings(wings: Wing[]): Wing[] {
  const dominates = (q: Wing, r: Wing, iq: number, ir: number) =>
    span(q) > span(r) + EPS ||
    (Math.abs(span(q) - span(r)) <= EPS && ((q.a1 - q.a0) > (r.a1 - r.a0) + EPS || (Math.abs(q.a1 - q.a0 - (r.a1 - r.a0)) <= EPS && iq < ir)))
  return wings
    .map((orig, ir) => {
      const r = { ...orig, cut: [false, false] as [boolean, boolean] }
      wings.forEach((q, iq) => {
        if (iq === ir || !dominates(q, orig, iq, ir)) return
        const [qa0, qa1] = range(q, orig.alongX) // batas q searah bubungan sayap ini
        const [qc0, qc1] = range(q, !orig.alongX) // batas q melintang
        if (orig.c0 < qc0 - EPS || orig.c1 > qc1 + EPS) return
        const ridge = q.alongX === orig.alongX ? null : (q.c0 + q.c1) / 2
        for (const e of [0, 1] as const) {
          const at = e ? orig.a1 : orig.a0
          if (at < qa0 - EPS || at > qa1 + EPS) continue
          r.cut[e] = true
          if (ridge !== null) {
            if (e) r.a1 = ridge
            else r.a0 = ridge
          }
        }
      })
      return r
    })
    .filter((w) => w.a1 - w.a0 > 0.05)
}

// Luas gabungan persegi-persegi (kompresi koordinat).
function unionArea(rs: Rect[]) {
  const xs = [...new Set(rs.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b)
  const zs = [...new Set(rs.flatMap((r) => [r.z0, r.z1]))].sort((a, b) => a - b)
  let sum = 0
  for (let i = 0; i + 1 < xs.length; i++)
    for (let j = 0; j + 1 < zs.length; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cz = (zs[j] + zs[j + 1]) / 2
      if (rs.some((r) => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1)) sum += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j])
    }
  return sum
}

export function roofMesh(p: Project, r: Roof): RoofMesh | null {
  const b = roofBase(p)
  if (!b || r.type === 'datar' || b.x1 - b.x0 < 0.5 || b.z1 - b.z0 < 0.5) return null
  const wings = joinWings(b.rects.filter((q) => q.x1 - q.x0 >= 0.5 && q.z1 - q.z0 >= 0.5).map((q) => wingOf(q, r.ridge === 'putar')))
  const t = Math.tan((r.pitch * Math.PI) / 180)
  const o = r.overhang
  // Bidang atap melewati tepi luar puncak dinding (bukan garis as), supaya puncak dinding tidak menembus genteng.
  const H = b.height + (b.thickness / 2) * t
  const W = b.height // puncak dinding: alas sopi-sopi
  const eaveY = H - o * t
  const hip = r.type === 'perisai'
  const roof: Tri[] = []
  const gables: Tri[] = []
  const plan: Rect[] = []
  let ridgeHeight = H

  const quad = (list: Tri[], q: [V3, V3, V3, V3], uv: [[number, number], [number, number], [number, number], [number, number]]) => {
    list.push({ p: [q[0], q[1], q[2]], uv: [uv[0], uv[1], uv[2]] }, { p: [q[0], q[2], q[3]], uv: [uv[0], uv[2], uv[3]] })
  }

  for (const w of wings) {
    const { a0, a1, c0, c1, cut } = w
    const toW = (a: number, y: number, c: number): V3 => (w.alongX ? [a, y, c] : [c, y, a])
    const half = (c1 - c0) / 2
    const cm = (c0 + c1) / 2
    // Teritisan hanya di ujung yang bebas.
    const A0 = cut[0] ? a0 : a0 - o
    const A1 = cut[1] ? a1 : a1 + o
    // Ujung perisai: bubungan menjorok masuk setengah bentang; terlalu pendek = limasan (piramida).
    const hip0 = hip && !cut[0]
    const hip1 = hip && !cut[1]
    const room = hip0 && hip1 ? (a1 - a0) / 2 : hip0 || hip1 ? a1 - a0 : half
    const r0 = hip0 ? a0 + Math.min(half, room) : A0
    const r1 = hip1 ? a1 - Math.min(half, room) : A1
    const ry = H + Math.min(half, room) * t
    ridgeHeight = Math.max(ridgeHeight, ry)
    const E = (a: number, c: number) => toW(a, eaveY, c)
    const R0 = toW(r0, ry, cm)
    const R1 = toW(r1, ry, cm)
    const sl = Math.hypot(half + o, ry - eaveY) // panjang sisi miring dari lis ke bubungan

    quad(roof, [E(A0, c0 - o), E(A1, c0 - o), R1, R0], [[0, 0], [A1 - A0, 0], [r1 - A0, sl], [r0 - A0, sl]])
    quad(roof, [E(A1, c1 + o), E(A0, c1 + o), R0, R1], [[0, 0], [A1 - A0, 0], [A1 - r0, sl], [A1 - r1, sl]])
    const ends = half + o
    if (hip0) roof.push({ p: [E(A0, c1 + o), E(A0, c0 - o), R0], uv: [[0, 0], [c1 - c0 + 2 * o, 0], [ends, sl]] })
    if (hip1) roof.push({ p: [E(A1, c0 - o), E(A1, c1 + o), R1], uv: [[0, 0], [c1 - c0 + 2 * o, 0], [ends, sl]] })
    // Dinding sopi-sopi (segitiga) di atas dinding ujung pelana yang terbuka, di garis as dinding.
    if (!hip)
      for (const e of [0, 1] as const)
        if (!cut[e]) {
          const a = e ? a1 : a0
          // Segitiga ditambah lajur setinggi selisih puncak dinding ke bidang atap.
          gables.push(
            { p: [toW(a, W, c0), toW(a, W, c1), toW(a, ry, cm)], uv: [[0, 0], [c1 - c0, 0], [half, ry - W]] },
            { p: [toW(a, W, c0), toW(a, ry, cm), toW(a, H, c0)], uv: [[0, 0], [half, ry - W], [0, H - W]] },
            { p: [toW(a, W, c1), toW(a, H, c1), toW(a, ry, cm)], uv: [[c1 - c0, 0], [c1 - c0, H - W], [half, ry - W]] },
          )
        }
    const [x0, x1] = w.alongX ? [A0, A1] : [c0 - o, c1 + o]
    const [z0, z1] = w.alongX ? [c0 - o, c1 + o] : [A0, A1]
    plan.push({ x0, x1, z0, z1 })
  }
  if (!roof.length) return null
  // Semua bidang berkemiringan sama, jadi luas sebenarnya = luas tampak atas / cos(kemiringan).
  // Dihitung dari tampak atas gabungan supaya bagian sayap yang bertumpuk tidak terhitung dua kali.
  const area = unionArea(plan) / Math.cos((r.pitch * Math.PI) / 180)
  return { roof, gables, area, ridgeHeight }
}
