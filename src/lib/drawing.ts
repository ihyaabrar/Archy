// Geometri gambar denah, dipakai bersama oleh kanvas editor dan ekspor (PNG/PDF),
// supaya hasil ekspor sama persis dengan yang terlihat di layar.

import { centroid, dist, levelsOf, onLevel, pointAlong, polygonArea, wallLength, wallSpans, type Opening, type Point, type Project, type Wall } from './project'
import { roomAt } from './walk'
import { dims, symbol } from './furniture'
import { DEFAULT_FLOOR, FLOORS } from './materials'

// Poligon tiap bagian padat dinding.
export function wallPolygons(w: Wall, openings: Opening[]): Point[][] {
  const len = wallLength(w)
  if (len === 0) return []
  const nx = (-(w.b[1] - w.a[1]) / len) * (w.thickness / 2)
  const ny = ((w.b[0] - w.a[0]) / len) * (w.thickness / 2)
  return wallSpans(w, openings).map(([t0, t1]) => {
    const p = pointAlong(w, t0)
    const q = pointAlong(w, t1)
    return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]]
  })
}

// Simbol bukaan: pintu = daun tegak lurus dari engsel + busur ayun; jendela = tiga garis sejajar.
export function openingSymbol(o: Opening, w: Wall) {
  const len = wallLength(w) || 1
  const ux = (w.b[0] - w.a[0]) / len
  const uy = (w.b[1] - w.a[1]) / len
  const p = pointAlong(w, o.at - o.width / 2)
  const q = pointAlong(w, o.at + o.width / 2)
  const h = w.thickness / 2
  if (o.kind === 'door') {
    const leaf: Point = [p[0] - uy * o.width, p[1] + ux * o.width]
    return { p, q, lines: [[p, leaf]] as [Point, Point][], arc: `M ${leaf[0]} ${leaf[1]} A ${o.width} ${o.width} 0 0 0 ${q[0]} ${q[1]}` }
  }
  const off = (s: number): [Point, Point] => [[p[0] - uy * h * s, p[1] + ux * h * s], [q[0] - uy * h * s, q[1] + ux * h * s]]
  return { p, q, lines: [off(1), off(0), off(-1)], arc: null }
}

// Posisi label ukuran: di sisi dinding yang tidak berada di dalam ruangan (dimensi luar di gambar kerja).
// Tanpa ruangan, patokannya menjauhi `away` (tengah denah). Teks tidak pernah terbalik.
export function dimensionLabel(a: Point, b: Point, offset: number, p?: Pick<Project, 'rooms'>, away?: Point) {
  const len = dist(a, b)
  if (len < 0.05) return null
  const rooms = p?.rooms ?? []
  let nx = -(b[1] - a[1]) / len
  let ny = (b[0] - a[0]) / len
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const side = (sx: number, sy: number) => roomAt([mid[0] + sx * 0.3, mid[1] + sy * 0.3], rooms)
  if (rooms.length && (side(nx, ny) || side(-nx, -ny))) {
    if (side(nx, ny) && !side(-nx, -ny)) [nx, ny] = [-nx, -ny]
  } else if (away && (mid[0] - away[0]) * nx + (mid[1] - away[1]) * ny < 0) [nx, ny] = [-nx, -ny]
  let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  if (angle > 90) angle -= 180
  else if (angle < -90) angle += 180
  return { x: mid[0] + nx * offset, y: mid[1] + ny * offset, angle, text: len.toFixed(2) }
}

export const planCenter = (p: Project) => (p.walls.length ? centroid(p.walls.flatMap((w) => [w.a, w.b])) : undefined)

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const pts = (ps: Point[]) => ps.map((q) => `${+q[0].toFixed(3)},${+q[1].toFixed(3)}`).join(' ')

// Gambar denah lengkap sebagai SVG mandiri (gaya inline, koordinat meter), untuk diunduh atau dicetak.
// Ukuran fisik 1 m = 1 cm, jadi dicetak 100% hasilnya skala 1:100.
// Satu gambar per lantai yang berisi (urut dari bawah). Judul memuat nama lantai kalau bangunannya bertingkat.
export function planSheets(p: Project, title: string) {
  const levels = [...levelsOf(p)].sort((a, b) => a.elevation - b.elevation)
  return levels
    .map((l) => planSvg(onLevel(p, l.id), levels.length > 1 ? `${title}, ${l.name}` : title))
    .filter((s): s is NonNullable<typeof s> => !!s)
}

export function planSvg(p: Project, title: string) {
  const all = [...p.walls.flatMap((w) => [w.a, w.b]), ...p.rooms.flatMap((r) => r.points)]
  if (!all.length) return null
  const pad = 1.5
  const x0 = Math.min(...all.map((q) => q[0])) - pad
  const y0 = Math.min(...all.map((q) => q[1])) - pad
  const w = Math.max(...all.map((q) => q[0])) + pad - x0
  const h = Math.max(...all.map((q) => q[1])) + pad + 1 - y0 // +1 m untuk kepala gambar di bawah
  const ink = '#2a2420'
  const pencil = '#645a50'
  // Halo kertas di belakang teks: label tetap terbaca walau menimpa garis atau teks lain.
  const halo = "stroke='#f3eee3' stroke-width='0.06' stroke-linejoin='round' paint-order='stroke'"
  const mono = `font-family='IBM Plex Mono, ui-monospace, monospace' ${halo}`
  const serif = `font-family='Stardos Stencil, Georgia, serif' font-weight='700' ${halo}`
  const center = planCenter(p)
  const out: string[] = []

  out.push(`<rect x='${x0}' y='${y0}' width='${w}' height='${h}' fill='#f3eee3'/>`)
  for (const r of p.rooms) out.push(`<polygon points='${pts(r.points)}' fill='${FLOORS[r.floor ?? DEFAULT_FLOOR].plan}'/>`)
  for (const f of p.furniture) {
    const { w: fw, d: fd } = dims(f)
    out.push(
      `<g transform='translate(${f.pos[0]} ${f.pos[1]}) rotate(${f.rot})'><rect x='${-fw / 2}' y='${-fd / 2}' width='${fw}' height='${fd}' fill='#f3eee3'/>` +
        symbol(f.kind, fw, fd).map((d) => `<path d='${d}' fill='none' stroke='${pencil}' stroke-width='0.015'/>`).join('') +
        '</g>',
    )
  }
  for (const wall of p.walls) for (const poly of wallPolygons(wall, p.openings)) out.push(`<polygon points='${pts(poly)}' fill='${ink}'/>`)
  for (const o of p.openings) {
    const wall = p.walls.find((x) => x.id === o.wallId)
    if (!wall) continue
    const s = openingSymbol(o, wall)
    for (const [a, b] of s.lines) out.push(`<line x1='${a[0]}' y1='${a[1]}' x2='${b[0]}' y2='${b[1]}' stroke='${ink}' stroke-width='0.025'/>`)
    if (s.arc) out.push(`<path d='${s.arc}' fill='none' stroke='${ink}' stroke-width='0.015' stroke-dasharray='0.08 0.06'/>`)
  }
  for (const wall of p.walls) {
    const d = dimensionLabel(wall.a, wall.b, wall.thickness / 2 + 0.25, p, center)
    if (d)
      out.push(
        `<text x='${d.x}' y='${d.y}' transform='rotate(${d.angle} ${d.x} ${d.y})' ${mono} font-size='0.2' fill='${pencil}' text-anchor='middle' dominant-baseline='middle'>${d.text}</text>`,
      )
  }
  for (const r of p.rooms) {
    // Ditulis setelah furnitur dan dinding: nama ruangan selalu di lapisan atas.
    const [cx, cy] = centroid(r.points)
    out.push(`<text x='${cx}' y='${cy - 0.1}' ${serif} font-size='0.3' fill='${ink}' text-anchor='middle'>${esc(r.name)}</text>`)
    out.push(`<text x='${cx}' y='${cy + 0.22}' ${mono} font-size='0.18' fill='${pencil}' text-anchor='middle'>${polygonArea(r.points).toFixed(1)} m²</text>`)
  }

  // Kepala gambar: judul dan batang skala 0 sampai 5 m, supaya ukuran tetap terbaca setelah dicetak di skala apa pun.
  const by = y0 + h - 0.6
  const bx = x0 + 0.5
  out.push(`<text x='${bx}' y='${by - 0.15}' ${serif} font-size='0.35' fill='${ink}'>${esc(title)}</text>`)
  for (let i = 0; i < 5; i++) out.push(`<rect x='${bx + i}' y='${by}' width='1' height='0.12' fill='${i % 2 ? '#f3eee3' : ink}' stroke='${ink}' stroke-width='0.02'/>`)
  out.push(`<text x='${bx}' y='${by + 0.35}' ${mono} font-size='0.16' fill='${pencil}'>0</text>`)
  out.push(`<text x='${bx + 5}' y='${by + 0.35}' ${mono} font-size='0.16' fill='${pencil}' text-anchor='middle'>5 m</text>`)

  return {
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${x0} ${y0} ${w} ${h}' width='${w}cm' height='${h}cm'>${out.join('')}</svg>`,
    width: w,
    height: h,
  }
}
