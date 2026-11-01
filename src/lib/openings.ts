// Geometri pintu dan jendela: satu sumber untuk simbol 2D, mesh 3D, dan tabrakan room tour.
// Koordinat denah (meter). p = ujung bukaan dekat titik a dinding, q = ujung lainnya.

import { pointAlong, wallLength, type Opening, type Point, type Wall } from './project'

export const DOOR_STYLES = { swing: 'Pintu ayun', double: 'Pintu ganda', sliding: 'Pintu geser' } as const
export const WINDOW_STYLES = { casement: 'Jendela buka', fixed: 'Jendela mati', louvre: 'Jendela nako' } as const
export type DoorStyle = keyof typeof DOOR_STYLES
export type WindowStyle = keyof typeof WINDOW_STYLES
export type OpeningStyle = DoorStyle | WindowStyle

export const styleOf = (o: Pick<Opening, 'kind' | 'style'>): OpeningStyle => o.style ?? (o.kind === 'door' ? 'swing' : 'casement')
export const isStyle = (kind: Opening['kind'], s: unknown) => typeof s === 'string' && s in (kind === 'door' ? DOOR_STYLES : WINDOW_STYLES)

type Seg = { a: Point; b: Point }

function frame(o: Opening, w: Wall) {
  const len = wallLength(w) || 1
  const u: Point = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len]
  // Sisi ayun: kiri dari arah dinding a→b, atau kanan kalau dibalik.
  const s = o.flipSide ? -1 : 1
  const n: Point = [-u[1] * s, u[0] * s]
  return { p: pointAlong(w, o.at - o.width / 2), q: pointAlong(w, o.at + o.width / 2), u, n, h: w.thickness / 2 }
}

const add = (p: Point, v: Point, k: number): Point => [p[0] + v[0] * k, p[1] + v[1] * k]

// Daun pintu dalam posisi terbuka (garis di denah). Dipakai untuk 3D dan tabrakan.
export function doorLeaves(o: Opening, w: Wall): Seg[] {
  if (o.kind !== 'door') return []
  const { p, q, u, n } = frame(o, w)
  const style = styleOf(o)
  if (style === 'double') return [{ a: p, b: add(p, n, o.width / 2) }, { a: q, b: add(q, n, o.width / 2) }]
  if (style === 'sliding') {
    // Pintu geser terbuka: kedua panel bertumpuk di sisi engsel, di dalam tebal dinding.
    const start = o.flipHinge ? q : p
    const dir: Point = o.flipHinge ? [-u[0], -u[1]] : u
    return [{ a: start, b: add(start, dir, o.width / 2) }]
  }
  const hinge = o.flipHinge ? q : p
  return [{ a: hinge, b: add(hinge, n, o.width) }]
}

// Busur ayun SVG dari ujung daun ke ujung kusen lawannya; arah busur dihitung dari hasil kali silang.
function arc(h: Point, from: Point, to: Point, r: number) {
  const cross = (from[0] - h[0]) * (to[1] - h[1]) - (from[1] - h[1]) * (to[0] - h[0])
  return `M ${from[0]} ${from[1]} A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${to[0]} ${to[1]}`
}

// Simbol 2D ala gambar kerja: garis daun/kaca, busur ayun, dan tanda kecil pembeda jenis.
export function openingSymbol(o: Opening, w: Wall) {
  const { p, q, u, n, h } = frame(o, w)
  const style = styleOf(o)
  const lines: [Point, Point][] = []
  const arcs: string[] = []
  const side = (k: number): [Point, Point] => [add(p, n, h * k), add(q, n, h * k)]

  if (style === 'swing') {
    const hinge = o.flipHinge ? q : p
    const other = o.flipHinge ? p : q
    const leaf = add(hinge, n, o.width)
    lines.push([hinge, leaf])
    arcs.push(arc(hinge, leaf, other, o.width))
  } else if (style === 'double') {
    const m = add(p, u, o.width / 2)
    for (const hinge of [p, q]) {
      const leaf = add(hinge, n, o.width / 2)
      lines.push([hinge, leaf])
      arcs.push(arc(hinge, leaf, m, o.width / 2))
    }
  } else if (style === 'sliding') {
    // Dua panel sejajar dinding yang saling tumpang, plus panah arah geser.
    lines.push([add(p, n, h / 3), add(add(p, u, o.width * 0.6), n, h / 3)])
    lines.push([add(add(q, u, -o.width * 0.6), n, -h / 3), add(q, n, -h / 3)])
    const mid = add(p, u, o.width / 2)
    lines.push([add(mid, u, -o.width * 0.15), add(mid, u, o.width * 0.15)])
  } else {
    lines.push(side(1), side(0), side(-1))
    if (style === 'casement') {
      // Tanda engsel daun jendela di kedua ujung.
      lines.push([p, add(p, n, h * 2)], [q, add(q, n, h * 2)])
    } else if (style === 'louvre') {
      // Bilah kaca nako: garis miring rapat di sepanjang bukaan.
      const count = Math.max(3, Math.round(o.width / 0.12))
      for (let i = 1; i < count; i++) {
        const c = add(p, u, (o.width * i) / count)
        lines.push([add(add(c, u, -0.04), n, -h), add(add(c, u, 0.04), n, h)])
      }
    }
  }
  return { p, q, lines, arcs }
}
