// Ubah denah jadi balok-balok 3D. Tanpa boolean CSG: dinding dipecah per segmen,
// dan bagian di bawah/atas bukaan diisi sebagai balok sendiri.
// Sumbu: x denah = x 3D, y denah = z 3D, tinggi = y 3D. Tiap elemen dinaikkan sesuai elevasi lantainya.

import { elevationOf, levelOf, pointAlong, wallLength, wallSpans, type Opening, type Point, type Project, type Wall } from './project'
import { levelAbove } from './stairs'
import { STAIR_STEPS, U_FIRST, dims, toPlan, uLanding } from './furniture'
import { doorLeaves, styleOf } from './openings'
import { TONES, blocks } from './furniture3d'

export type Piece = {
  kind: 'wall' | 'glass' | 'furniture' | 'door'
  wallId: string // id elemen asal (dinding atau furnitur)
  center: [number, number, number]
  size: [number, number, number] // panjang, tinggi, tebal
  rotY: number
  color?: string // warna bahan furnitur; kosong = warna bawaan jenisnya
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

// Perpanjangan ujung dinding supaya sudut tertutup: di sudut L, kotak sudut luar (setengah tebal) tidak tertutup
// dinding mana pun kalau dinding berhenti di garis as. Ujung diperpanjang setengah tebal dinding yang ditemuinya;
// dinding segaris dan ujung bebas tidak diperpanjang.
function endReach(p: Project, w: Wall, q: Point) {
  const level = levelOf(p, w)
  const dir = [(w.b[0] - w.a[0]) / wallLength(w), (w.b[1] - w.a[1]) / wallLength(w)]
  let reach = 0
  for (const o of p.walls) {
    if (o === w || levelOf(p, o) !== level || wallLength(o) === 0) continue
    const len = wallLength(o)
    const od = [(o.b[0] - o.a[0]) / len, (o.b[1] - o.a[1]) / len]
    if (Math.abs(dir[0] * od[1] - dir[1] * od[0]) < 0.01) continue // segaris
    const t = (q[0] - o.a[0]) * od[0] + (q[1] - o.a[1]) * od[1]
    const off = Math.abs((q[0] - o.a[0]) * od[1] - (q[1] - o.a[1]) * od[0])
    if (off < 1e-3 && t >= -1e-3 && t <= len + 1e-3) reach = Math.max(reach, o.thickness / 2)
  }
  return reach
}

export function buildPieces(p: Project): Piece[] {
  const out: Piece[] = []
  for (const w of p.walls) {
    const len = wallLength(w)
    if (len === 0) continue
    const level = levelOf(p, w)
    const e = elevationOf(p, level)
    // Dinding setinggi ruangan naik sampai lantai di atasnya: tanpa ini ada celah setebal pelat di antara dua lantai.
    const up = levelAbove(p, level)
    const h = w.height >= 2 && up ? Math.max(w.height, elevationOf(p, up) - e) : w.height
    const [r0, r1] = [endReach(p, w, w.a), endReach(p, w, w.b)]
    for (const [t0, t1] of wallSpans(w, p.openings)) out.push(piece('wall', w, t0 === 0 ? -r0 : t0, t1 >= len - 1e-9 ? len + r1 : t1, e, e + h, w.thickness))
    for (const o of p.openings.filter((x: Opening) => x.wallId === w.id)) {
      const t0 = o.at - o.width / 2
      const t1 = o.at + o.width / 2
      const top = Math.min(o.sill + o.height, h)
      if (o.sill > 0) out.push(piece('wall', w, t0, t1, e, e + o.sill, w.thickness))
      if (top < h) out.push(piece('wall', w, t0, t1, e + top, e + h, w.thickness))
      if (o.kind === 'window') out.push(piece('glass', w, t0, t1, e + o.sill, e + top, 0.02))
      for (const leaf of doorLeaves(o, w))
        out.push({
          kind: 'door',
          wallId: o.id,
          center: [(leaf.a[0] + leaf.b[0]) / 2, e + o.height / 2, (leaf.a[1] + leaf.b[1]) / 2],
          size: [Math.hypot(leaf.b[0] - leaf.a[0], leaf.b[1] - leaf.a[1]), o.height, 0.04],
          rotY: -Math.atan2(leaf.b[1] - leaf.a[1], leaf.b[0] - leaf.a[0]),
        })
      // Jendela nako: bilah kaca horizontal tiap 10 cm, bukan satu kaca utuh.
      if (o.kind === 'window' && styleOf(o) === 'louvre') {
        out.pop()
        for (let y = e + o.sill + 0.05; y < e + top - 0.02; y += 0.1) out.push(piece('glass', w, t0, t1, y - 0.035, y + 0.035, 0.02))
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
    if (f.kind === 'stairsU') {
      // Lengan 1 (kanan, x > 0) naik ke -y, bordes penuh lebar, lengan 2 (kiri) naik kembali ke +y. Tiap anak tangga balok padat sampai lantai.
      const L = uLanding(w, d)
      const run = d - L
      const n2 = STAIR_STEPS - U_FIRST
      const step = (lx: number, ly: number, sx: number, sz: number, k: number) => {
        const hk = (k * h) / STAIR_STEPS
        const [x, z] = toPlan(f, [lx, ly])
        out.push({ kind: 'furniture', wallId: f.id, center: [x, e + hk / 2, z], size: [sx, hk, sz], rotY })
      }
      for (let k = 0; k < U_FIRST; k++) step(w / 4, d / 2 - ((k + 0.5) * run) / U_FIRST, w / 2, run / U_FIRST, k + 1)
      step(0, -d / 2 + L / 2, w, L, U_FIRST)
      for (let k = 0; k < n2; k++) step(-w / 4, -d / 2 + L + ((k + 0.5) * run) / n2, w / 2, run / n2, U_FIRST + k + 1)
      continue
    }
    for (const b of blocks(f.kind, w, d, h)) {
      const [x, z] = toPlan(f, [b.x, b.z])
      out.push({ kind: 'furniture', wallId: f.id, center: [x, e + b.y, z], size: [b.sx, b.sy, b.sz], rotY, color: TONES[b.tone] })
    }
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
