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

export { openingSymbol } from './openings'
import { openingSymbol } from './openings'

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

const INK = '#2a2420'
const PENCIL = '#645a50'
// Halo kertas di belakang teks: label tetap terbaca walau menimpa garis atau teks lain.
const HALO = "stroke='#f3eee3' stroke-width='0.06' stroke-linejoin='round' paint-order='stroke'"
const MONO = `font-family='IBM Plex Mono, ui-monospace, monospace' ${HALO}`
const SERIF = `font-family='Stardos Stencil, Georgia, serif' font-weight='700' ${HALO}`

// Isi gambar denah (ruangan, furnitur, dinding, bukaan, label). `sheet` = gaya lembar kerja blueprint:
// tanpa ukuran per dinding (diganti rantai ukuran di as) dan nama ruangan kapital.
function planBody(p: Project, sheet = false) {
  const center = planCenter(p)
  const out: string[] = []
  const roomFill = sheet ? " fill-opacity='0.45'" : ''
  for (const r of p.rooms) out.push(`<polygon points='${pts(r.points)}' fill='${FLOORS[r.floor ?? DEFAULT_FLOOR].plan}'${roomFill}/>`)
  for (const f of p.furniture) {
    const { w: fw, d: fd } = dims(f)
    out.push(
      `<g transform='translate(${f.pos[0]} ${f.pos[1]}) rotate(${f.rot})'><rect x='${-fw / 2}' y='${-fd / 2}' width='${fw}' height='${fd}' fill='#f3eee3'/>` +
        symbol(f.kind, fw, fd).map((d) => `<path d='${d}' fill='none' stroke='${PENCIL}' stroke-width='0.015'/>`).join('') +
        '</g>',
    )
  }
  for (const wall of p.walls) for (const poly of wallPolygons(wall, p.openings)) out.push(`<polygon points='${pts(poly)}' fill='${INK}'/>`)
  for (const o of p.openings) {
    const wall = p.walls.find((x) => x.id === o.wallId)
    if (!wall) continue
    const s = openingSymbol(o, wall)
    for (const [a, b] of s.lines) out.push(`<line x1='${a[0]}' y1='${a[1]}' x2='${b[0]}' y2='${b[1]}' stroke='${INK}' stroke-width='0.025'/>`)
    for (const d of s.arcs) out.push(`<path d='${d}' fill='none' stroke='${INK}' stroke-width='0.015' stroke-dasharray='0.08 0.06'/>`)
  }
  if (!sheet)
    for (const wall of p.walls) {
      const d = dimensionLabel(wall.a, wall.b, wall.thickness / 2 + 0.25, p, center)
      if (d)
        out.push(
          `<text x='${d.x}' y='${d.y}' transform='rotate(${d.angle} ${d.x} ${d.y})' ${MONO} font-size='0.2' fill='${PENCIL}' text-anchor='middle' dominant-baseline='middle'>${d.text}</text>`,
        )
    }
  const nameFont = sheet ? `${MONO} font-weight='600' letter-spacing='0.04'` : SERIF
  for (const r of p.rooms) {
    // Ditulis setelah furnitur dan dinding: nama ruangan selalu di lapisan atas.
    const [cx, cy] = centroid(r.points)
    const name = sheet ? r.name.toUpperCase() : r.name
    out.push(`<text x='${cx}' y='${cy - 0.1}' ${nameFont} font-size='${sheet ? 0.24 : 0.3}' fill='${INK}' text-anchor='middle'>${esc(name)}</text>`)
    out.push(`<text x='${cx}' y='${cy + 0.22}' ${MONO} font-size='0.16' fill='${PENCIL}' text-anchor='middle'>${polygonArea(r.points).toFixed(1)} m²</text>`)
  }
  for (const n of p.notes ?? []) {
    if (!n.b) {
      out.push(`<text x='${n.a[0]}' y='${n.a[1]}' font-family='IBM Plex Sans, sans-serif' ${HALO} font-size='0.22' fill='${INK}' dominant-baseline='middle'>${esc(n.text || '')}</text>`)
      continue
    }
    const len = dist(n.a, n.b)
    if (len < 0.05) continue
    // Tanda miring 45° di kedua ujung, seperti garis ukur di gambar kerja.
    const ux = (n.b[0] - n.a[0]) / len
    const uy = (n.b[1] - n.a[1]) / len
    const [tx, ty] = [(ux - uy) * 0.1, (uy + ux) * 0.1]
    out.push(`<line x1='${n.a[0]}' y1='${n.a[1]}' x2='${n.b[0]}' y2='${n.b[1]}' stroke='${INK}' stroke-width='0.015'/>`)
    for (const q of [n.a, n.b]) out.push(`<line x1='${q[0] - tx}' y1='${q[1] - ty}' x2='${q[0] + tx}' y2='${q[1] + ty}' stroke='${INK}' stroke-width='0.025'/>`)
    const d = dimensionLabel(n.a, n.b, 0.18)
    if (d)
      out.push(
        `<text x='${d.x}' y='${d.y}' transform='rotate(${d.angle} ${d.x} ${d.y})' ${MONO} font-size='0.2' fill='${INK}' text-anchor='middle' dominant-baseline='middle'>${d.text}</text>`,
      )
  }
  return out
}

function extent(p: Project) {
  const all = [...p.walls.flatMap((w) => [w.a, w.b]), ...p.rooms.flatMap((r) => r.points), ...(p.notes ?? []).flatMap((n) => (n.b ? [n.a, n.b] : [n.a]))]
  if (!all.length) return null
  return {
    x0: Math.min(...all.map((q) => q[0])),
    y0: Math.min(...all.map((q) => q[1])),
    x1: Math.max(...all.map((q) => q[0])),
    y1: Math.max(...all.map((q) => q[1])),
  }
}

// Gambar denah lengkap sebagai SVG mandiri (gaya inline, koordinat meter), untuk diunduh atau dicetak.
// Ukuran fisik 1 m = 1 cm, jadi dicetak 100% hasilnya skala 1:100.
export function planSvg(p: Project, title: string) {
  const e = extent(p)
  if (!e) return null
  const pad = 1.5
  const x0 = e.x0 - pad
  const y0 = e.y0 - pad
  // Minimal 10 m: kepala gambar (judul, batang skala, luas, panah utara) muat tanpa bertumpuk.
  const w = Math.max(e.x1 + pad - x0, 10)
  const h = e.y1 + pad + 1 - y0 // +1 m untuk kepala gambar di bawah
  const out = [`<rect x='${x0}' y='${y0}' width='${w}' height='${h}' fill='#f3eee3'/>`, ...planBody(p)]

  // Kepala gambar: judul dan batang skala 0 sampai 5 m, supaya ukuran tetap terbaca setelah dicetak di skala apa pun.
  const by = y0 + h - 0.6
  const bx = x0 + 0.5
  out.push(`<text x='${bx}' y='${by - 0.15}' ${SERIF} font-size='0.35' fill='${INK}'>${esc(title)}</text>`)
  for (let i = 0; i < 5; i++) out.push(`<rect x='${bx + i}' y='${by}' width='1' height='0.12' fill='${i % 2 ? '#f3eee3' : INK}' stroke='${INK}' stroke-width='0.02'/>`)
  out.push(`<text x='${bx}' y='${by + 0.35}' ${MONO} font-size='0.16' fill='${PENCIL}'>0</text>`)
  out.push(`<text x='${bx + 5}' y='${by + 0.35}' ${MONO} font-size='0.16' fill='${PENCIL}' text-anchor='middle'>5 m</text>`)
  const area = p.rooms.reduce((s, r) => s + polygonArea(r.points), 0)
  if (area > 0) out.push(`<text x='${bx + 5.6}' y='${by + 0.12}' ${MONO} font-size='0.18' fill='${PENCIL}'>Luas ruangan ${area.toFixed(1)} m²</text>`)
  // Panah utara di pojok kanan kepala gambar. Utara = atas denah, sama dengan arah matahari di 3D.
  const nx = x0 + w - 0.7
  const ny = by - 0.05
  out.push(
    `<circle cx='${nx}' cy='${ny}' r='0.3' fill='none' stroke='${INK}' stroke-width='0.02'/>` +
      `<path d='M${nx} ${ny - 0.3} L${nx + 0.15} ${ny + 0.22} L${nx} ${ny + 0.1} Z' fill='#f3eee3' stroke='${INK}' stroke-width='0.02'/>` +
      `<path d='M${nx} ${ny - 0.3} L${nx} ${ny + 0.1} L${nx - 0.15} ${ny + 0.22} Z' fill='${INK}'/>` +
      `<text x='${nx}' y='${ny - 0.38}' ${MONO} font-size='0.16' fill='${INK}' text-anchor='middle'>U</text>`,
  )

  return {
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${x0} ${y0} ${w} ${h}' width='${w}cm' height='${h}cm'>${out.join('')}</svg>`,
    width: w,
    height: h,
  }
}

// Satu gambar per lantai yang berisi (urut dari bawah). Judul memuat nama lantai kalau bangunannya bertingkat.
export function planSheets(p: Project, title: string) {
  const levels = [...levelsOf(p)].sort((a, b) => a.elevation - b.elevation)
  return levels
    .map((l) => planSvg(onLevel(p, l.id), levels.length > 1 ? `${title}, ${l.name}` : title))
    .filter((s): s is NonNullable<typeof s> => !!s)
}

// Garis as dari dinding lurus: posisi unik (digabung bila berjarak < 0,3 m), paling banyak 10 per arah.
export function gridLines(values: number[]) {
  const sorted = [...values].map((v) => Math.round(v * 100) / 100).sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) if (!out.length || v - out[out.length - 1] >= 0.3) out.push(v)
  return out.length > 10 ? out.filter((_, i) => i % Math.ceil(out.length / 10) === 0) : out
}

// Kode bukaan seperti di gambar kerja: pintu P1, P2, …, jendela J1, J2, … Bukaan sejenis (jenis, gaya, ukuran) berbagi kode.
export function openingCodes(openings: Opening[]) {
  const types = new Map<string, string>()
  const count = { door: 0, window: 0 }
  return new Map(
    openings.map((o) => {
      const key = `${o.kind}:${o.style ?? ''}:${o.width}:${o.height}:${o.sill}`
      if (!types.has(key)) types.set(key, `${o.kind === 'door' ? 'P' : 'J'}${++count[o.kind]}`)
      return [o.id, types.get(key)!]
    }),
  )
}

// Lembar kerja blueprint untuk halaman depan. Di keempat sisi: rantai ukuran bukaan (dinding luar), rantai ukuran antar as,
// ukuran total, dan gelembung as (A, B, C / 1, 2, 3). Di dalam: kode pintu/jendela dan tanda potongan A dan B.
// Tanpa latar, supaya menyatu dengan kertas halaman. Ukuran responsif (tanpa width/height fisik).
export function blueprintSvg(p: Project) {
  const e = extent(p)
  if (!e) return null
  const xs = gridLines(p.walls.filter((w) => Math.abs(w.a[0] - w.b[0]) < 0.01).map((w) => w.a[0]))
  const ys = gridLines(p.walls.filter((w) => Math.abs(w.a[1] - w.b[1]) < 0.01).map((w) => w.a[1]))
  // Jarak tiap baris dari tepi denah ke luar: rantai bukaan, rantai as, total, gelembung as.
  const ROW = { open: 0.7, axis: 1.35, total: 2.0, bubble: 2.75 }
  const m = 3.3
  const x0 = e.x0 - m
  const y0 = e.y0 - m
  const w = e.x1 - e.x0 + 2 * m
  const h = e.y1 - e.y0 + 2 * m
  const out: string[] = []
  const thin = `stroke='${PENCIL}' stroke-width='0.02'`
  const axis = `${thin} stroke-dasharray='0.5 0.12 0.06 0.12' opacity='0.55'`
  const fmt = (v: number) => v.toFixed(2)
  const label = (x: number, y: number, text: string, size = 0.24) =>
    `<text x='${x}' y='${y + size * 0.35}' ${MONO} font-size='${size}' fill='${INK}' text-anchor='middle'>${text}</text>`
  const bubble = (x: number, y: number, text: string) => `<circle cx='${x}' cy='${y}' r='0.3' fill='#f3eee3' ${thin}/>` + label(x, y, text)

  xs.forEach((x, i) => {
    out.push(`<line x1='${x}' y1='${e.y0 - ROW.bubble + 0.3}' x2='${x}' y2='${e.y1 + ROW.bubble - 0.3}' ${axis}/>`)
    for (const y of [e.y0 - ROW.bubble, e.y1 + ROW.bubble]) out.push(bubble(x, y, String.fromCharCode(65 + i)))
  })
  ys.forEach((y, i) => {
    out.push(`<line x1='${e.x0 - ROW.bubble + 0.3}' y1='${y}' x2='${e.x1 + ROW.bubble - 0.3}' y2='${y}' ${axis}/>`)
    for (const x of [e.x0 - ROW.bubble, e.x1 + ROW.bubble]) out.push(bubble(x, y, String(i + 1)))
  })

  // Satu rantai ukuran di sisi `side` (-1 atas/kiri, +1 bawah/kanan): garis, coretan di tiap titik, angka di sisi luar.
  const chain = (vals: number[], horiz: boolean, side: -1 | 1, row: number, total = false) => {
    if (vals.length < 2) return
    const c = (horiz ? (side < 0 ? e.y0 : e.y1) : side < 0 ? e.x0 : e.x1) + side * row
    const at = (v: number, off = 0): [number, number] => (horiz ? [v, c + off] : [c + off, v])
    const rot = (x: number, y: number) => (horiz ? '' : ` transform='rotate(-90 ${x} ${y})'`)
    const [a, b] = [at(vals[0]), at(vals[vals.length - 1])]
    out.push(`<line x1='${a[0]}' y1='${a[1]}' x2='${b[0]}' y2='${b[1]}' ${thin}/>`)
    vals.forEach((v) => {
      const [tx, ty] = at(v)
      out.push(`<line x1='${tx - 0.1}' y1='${ty + 0.1}' x2='${tx + 0.1}' y2='${ty - 0.1}' stroke='${INK}' stroke-width='0.03'/>`)
    })
    // Angka di luar garis. Teks tegak diputar -90°, jadi di sisi kanan garis butuh geser sebesar tinggi huruf.
    const off = side < 0 ? -0.12 : 0.27
    const segs = total ? [[vals[0], vals[vals.length - 1]]] : vals.slice(1).map((v, i) => [vals[i], v])
    for (const [p0, p1] of segs) {
      if (p1 - p0 < 0.3) continue // terlalu sempit untuk angka
      const [tx, ty] = at((p0 + p1) / 2, off)
      out.push(`<text x='${tx}' y='${ty}' ${MONO} font-size='${total ? 0.2 : 0.17}' fill='${total ? INK : PENCIL}' text-anchor='middle'${rot(tx, ty)}>${fmt(p1 - p0)}</text>`)
    }
  }
  const uniq = (vals: number[]) => {
    const sorted = vals.map((v) => Math.round(v * 100) / 100).sort((a, b) => a - b)
    return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] >= 0.05)
  }
  // Rantai bukaan di satu sisi: ujung dinding luar, as, dan tepi tiap pintu/jendela di dinding luar sisi itu.
  const wx = p.walls.flatMap((q) => [q.a[0], q.b[0]])
  const wy = p.walls.flatMap((q) => [q.a[1], q.b[1]])
  const wb = { x0: Math.min(...wx), x1: Math.max(...wx), y0: Math.min(...wy), y1: Math.max(...wy) }
  const openChain = (horiz: boolean, edge: number) => {
    const [r0, r1] = horiz ? [wb.x0, wb.x1] : [wb.y0, wb.y1]
    const vals = [r0, r1, ...(horiz ? xs : ys).filter((v) => v > r0 && v < r1)]
    const k = horiz ? 1 : 0
    for (const q of p.walls) {
      if (Math.abs(q.a[k] - edge) > 0.01 || Math.abs(q.b[k] - edge) > 0.01) continue
      for (const o of p.openings.filter((o) => o.wallId === q.id))
        for (const t of [o.at - o.width / 2, o.at + o.width / 2]) vals.push(pointAlong(q, t)[1 - k])
    }
    return uniq(vals)
  }
  for (const side of [-1, 1] as const) {
    chain(openChain(true, side < 0 ? wb.y0 : wb.y1), true, side, ROW.open)
    chain(openChain(false, side < 0 ? wb.x0 : wb.x1), false, side, ROW.open)
    chain(xs, true, side, ROW.axis)
    chain(ys, false, side, ROW.axis)
    chain(xs, true, side, ROW.total, true)
    chain(ys, false, side, ROW.total, true)
  }

  // Tanda potongan: garis tebal pendek di luar denah, lingkaran berhuruf, segitiga ke arah pandang.
  // Potongan A memandang ke utara (atas gambar), B ke barat (kiri).
  const cut = (letter: string, horiz: boolean, v: number) => {
    for (const side of [-1, 1] as const) {
      const [cx, cy] = horiz ? [(side < 0 ? e.x0 : e.x1) + side * ROW.bubble, v] : [v, (side < 0 ? e.y0 : e.y1) + side * ROW.bubble]
      const [ix, iy] = horiz ? [cx - side * 0.6, cy] : [cx, cy - side * 0.6]
      out.push(`<line x1='${cx}' y1='${cy}' x2='${ix}' y2='${iy}' stroke='${INK}' stroke-width='0.07'/>`)
      const tri = horiz ? `${cx - 0.2},${cy - 0.26} ${cx + 0.2},${cy - 0.26} ${cx},${cy - 0.58}` : `${cx - 0.26},${cy - 0.2} ${cx - 0.26},${cy + 0.2} ${cx - 0.58},${cy}`
      out.push(`<polygon points='${tri}' fill='${INK}'/>`)
      out.push(`<circle cx='${cx}' cy='${cy}' r='0.28' fill='#f3eee3' stroke='${INK}' stroke-width='0.03'/>` + label(cx, cy, letter, 0.22))
    }
  }
  // Di tengah bentang as terlebar: jauh dari gelembung as di kiri-kanannya.
  const mid = (vals: number[]) => {
    if (vals.length < 2) return null
    let i = 0
    for (let k = 1; k + 1 < vals.length; k++) if (vals[k + 1] - vals[k] > vals[i + 1] - vals[i]) i = k
    return (vals[i] + vals[i + 1]) / 2
  }
  const [cutY, cutX] = [mid(ys), mid(xs)]
  if (cutY !== null) cut('A', true, cutY)
  if (cutX !== null) cut('B', false, cutX)

  out.push(...planBody(p, true))

  // Kode pintu/jendela: di dinding luar selalu di sisi luar (walau ada teras), di dalam di sisi tanpa ruangan bila ada.
  const codes = openingCodes(p.openings)
  const center = planCenter(p)
  const outer = (q: Wall) =>
    [wb.x0, wb.x1].some((x) => Math.abs(q.a[0] - x) < 0.01 && Math.abs(q.b[0] - x) < 0.01) ||
    [wb.y0, wb.y1].some((y) => Math.abs(q.a[1] - y) < 0.01 && Math.abs(q.b[1] - y) < 0.01)
  for (const o of p.openings) {
    const q = p.walls.find((x) => x.id === o.wallId)
    if (!q) continue
    const ends = [pointAlong(q, o.at - o.width / 2), pointAlong(q, o.at + o.width / 2)] as const
    const d = dimensionLabel(...ends, q.thickness / 2 + 0.3, outer(q) ? undefined : p, center)
    if (!d) continue
    const shape =
      o.kind === 'door'
        ? `<ellipse cx='${d.x}' cy='${d.y}' rx='0.26' ry='0.15' fill='#f3eee3' stroke='${INK}' stroke-width='0.018'/>`
        : `<rect x='${d.x - 0.24}' y='${d.y - 0.13}' width='0.48' height='0.26' fill='#f3eee3' stroke='${INK}' stroke-width='0.018'/>`
    out.push(shape + label(d.x, d.y, codes.get(o.id)!, 0.14))
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${x0} ${y0} ${w} ${h}' role='img'>${out.join('')}</svg>`
}
