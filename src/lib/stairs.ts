// Tangga yang menghubungkan dua lantai: lubang pelat lantai atas dan jalur naik saat room tour.
// Tangga lurus di katalog: kaki di sisi +y lokal, puncak di sisi -y lokal (sama dengan susunan anak tangga di mesh.ts).

import { elevationOf, levelOf, levelsOf, onLevel, type Point, type Project } from './project'
import { dims, footprint, type Furniture } from './furniture'
import { BODY_RADIUS, blockers, inPolygon, type Segment } from './walk'

// Satu tangga dari lantai `from` ke lantai tepat di atasnya `to`.
// corners mengikuti footprint(): [0]-[1] = tepi puncak, [2]-[3] = tepi kaki, [1]-[2] dan [3]-[0] = sisi panjang.
export type Flight = { f: Furniture; from: string; to: string; corners: Point[] }

// Lantai dengan elevasi terkecil di atas lantai `id`.
export function levelAbove(p: Project, id: string): string | null {
  const e = elevationOf(p, id)
  const up = levelsOf(p).filter((l) => l.elevation > e).sort((a, b) => a.elevation - b.elevation)
  return up[0]?.id ?? null
}

// Tangga yang punya lantai di atasnya. Tangga di lantai teratas tetap furnitur biasa.
export function flights(p: Project): Flight[] {
  return p.furniture.flatMap((f) => {
    if (f.kind !== 'stairs') return []
    const from = levelOf(p, f)
    const to = levelAbove(p, from)
    return to ? [{ f, from, to, corners: footprint(f) }] : []
  })
}

// Kemajuan sepanjang tangga: 0 di kaki, 1 di puncak. null kalau titik di luar tapak tangga.
export function stairProgress(fl: Flight, pt: Point): number | null {
  const { w, d } = dims(fl.f)
  const r = (fl.f.rot * Math.PI) / 180
  const dx = pt[0] - fl.f.pos[0]
  const dy = pt[1] - fl.f.pos[1]
  const x = dx * Math.cos(r) + dy * Math.sin(r)
  const y = -dx * Math.sin(r) + dy * Math.cos(r)
  if (Math.abs(x) > w / 2 || Math.abs(y) > d / 2) return null
  return (d / 2 - y) / d
}

// Lubang di pelat ruangan lantai `level`: tapak tangga dari lantai bawah yang seluruhnya di dalam ruangan itu.
// shortcut: tangga yang hanya sebagian di dalam ruangan tidak dilubangi; perlu kliping poligon kalau kasus ini sering.
export const slabHoles = (p: Project, level: string, room: Point[]): Point[][] =>
  flights(p)
    .filter((fl) => fl.to === level && fl.corners.every((c) => inPolygon(c, room)))
    .map((fl) => fl.corners)

// Penghalang jalan di satu lantai. Tangga penghubung tidak lagi balok padat:
// di lantai bawah sisi panjangnya jadi pagar, di lantai atas tepi lubangnya pagar kecuali tepi puncak (tempat naik-turun).
export function walkBlockers(p: Project, level: string): Segment[] {
  const fl = flights(p)
  const ids = new Set(fl.map((x) => x.f.id))
  const part = onLevel(p, level)
  const out = blockers({ ...part, furniture: part.furniture.filter((f) => !ids.has(f.id)) })
  // half negatif: badan boleh mendekat sampai 5 cm dari pagar, supaya tangga 1 m tetap bisa dilewati (radius badan 0,25 m).
  const rail = (a: Point, b: Point): Segment => ({ a, b, half: 0.05 - BODY_RADIUS })
  for (const { from, to, corners: c } of fl) {
    if (from === level || to === level) out.push(rail(c[1], c[2]), rail(c[3], c[0]))
    if (to === level) out.push(rail(c[2], c[3]))
  }
  return out
}

// Lantai dan tinggi lantai di titik pt, mulai dari lantai `level`. Di atas tangga penghubung lantai ini,
// tinggi naik rata dari kaki ke puncak, dan lantai berpindah di tengah tangga supaya penghalangnya ikut lantai tujuan.
export function footing(p: Project, level: string, pt: Point): { level: string; y: number } {
  for (const fl of flights(p)) {
    if (fl.from !== level && fl.to !== level) continue
    const v = stairProgress(fl, pt)
    if (v === null) continue
    const a = elevationOf(p, fl.from)
    return { level: v < 0.5 ? fl.from : fl.to, y: a + v * (elevationOf(p, fl.to) - a) }
  }
  return { level, y: elevationOf(p, level) }
}
