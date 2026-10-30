// Ubah denah jadi balok-balok 3D. Tanpa boolean CSG: dinding dipecah per segmen,
// dan bagian di bawah/atas bukaan diisi sebagai balok sendiri.
// Sumbu: x denah = x 3D, y denah = z 3D, tinggi = y 3D. Tiap elemen dinaikkan sesuai elevasi lantainya.

import { elevationOf, levelOf, pointAlong, wallLength, wallSpans, type Opening, type Project, type Wall } from './project'
import { STAIR_STEPS, dims, toPlan } from './furniture'

export type Piece = {
  kind: 'wall' | 'glass' | 'furniture' | 'door'
  wallId: string // id elemen asal (dinding atau furnitur)
  center: [number, number, number]
  size: [number, number, number] // panjang, tinggi, tebal
  rotY: number
}

function piece(kind: Piece['kind'], w: Wall, t0: number, t1: number, y0: number, y1: number, thick: number): Piece {
  const [x, z] = pointAlong(w, (t0 + t1) / 2)
  return {
    kind,
    wallId: w.id,
    center: [x, (y0 + y1) / 2, z],
    size: [t1 - t0, y1 - y0, thick],
    rotY: -Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]),
  }
}

// Daun pintu terbuka 90°, dari engsel tegak lurus dinding: sama dengan simbol pintu di denah 2D.
export function doorLeaf(o: Opening, w: Wall) {
  const len = wallLength(w) || 1
  const a = pointAlong(w, o.at - o.width / 2)
  const n = [-(w.b[1] - w.a[1]) / len, (w.b[0] - w.a[0]) / len]
  return { a, b: [a[0] + n[0] * o.width, a[1] + n[1] * o.width] as [number, number] }
}

export function buildPieces(p: Project): Piece[] {
  const out: Piece[] = []
  for (const w of p.walls) {
    if (wallLength(w) === 0) continue
    const e = elevationOf(p, levelOf(p, w))
    for (const [t0, t1] of wallSpans(w, p.openings)) out.push(piece('wall', w, t0, t1, e, e + w.height, w.thickness))
    for (const o of p.openings.filter((x: Opening) => x.wallId === w.id)) {
      const t0 = o.at - o.width / 2
      const t1 = o.at + o.width / 2
      const top = Math.min(o.sill + o.height, w.height)
      if (o.sill > 0) out.push(piece('wall', w, t0, t1, e, e + o.sill, w.thickness))
      if (top < w.height) out.push(piece('wall', w, t0, t1, e + top, e + w.height, w.thickness))
      if (o.kind === 'window') out.push(piece('glass', w, t0, t1, e + o.sill, e + top, 0.02))
      if (o.kind === 'door') {
        const leaf = doorLeaf(o, w)
        out.push({
          kind: 'door',
          wallId: o.id,
          center: [(leaf.a[0] + leaf.b[0]) / 2, e + o.height / 2, (leaf.a[1] + leaf.b[1]) / 2],
          size: [o.width, o.height, 0.04],
          rotY: -Math.atan2(leaf.b[1] - leaf.a[1], leaf.b[0] - leaf.a[0]),
        })
      }
    }
  }
  for (const f of p.furniture) {
    const { w, d, h } = dims(f)
    const e = elevationOf(p, levelOf(p, f))
    const rotY = (-f.rot * Math.PI) / 180
    if (f.kind === 'stairs') {
      // Anak tangga bertumpuk dari kaki (+y lokal) ke atas (-y lokal); tiap anak tangga balok padat sampai lantai.
      for (let k = 0; k < STAIR_STEPS; k++) {
        const hk = ((k + 1) * h) / STAIR_STEPS
        const [x, z] = toPlan(f, [0, d / 2 - ((k + 0.5) * d) / STAIR_STEPS])
        out.push({ kind: 'furniture', wallId: f.id, center: [x, e + hk / 2, z], size: [w, hk, d / STAIR_STEPS], rotY })
      }
      continue
    }
    // Furnitur lain sebagai satu balok seukuran katalog: cukup untuk membaca skala ruang saat room tour.
    out.push({ kind: 'furniture', wallId: f.id, center: [f.pos[0], e + h / 2, f.pos[1]], size: [w, h, d], rotY })
  }
  return out
}

// Pusat dan ukuran denah, untuk mengarahkan kamera.
export function bounds(p: Project) {
  const pts = p.walls.flatMap((w) => [w.a, w.b])
  if (!pts.length) return { center: [0, 0] as [number, number], size: 10 }
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  return { center: [(x0 + x1) / 2, (y0 + y1) / 2] as [number, number], size: Math.max(x1 - x0, y1 - y0, 4) }
}
