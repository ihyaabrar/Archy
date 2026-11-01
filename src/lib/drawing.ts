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

// Lembar kerja blueprint untuk halaman depan: denah + gelembung as (A, B, C / 1, 2, 3) dan rantai ukuran antar as.
// Tanpa latar, supaya menyatu dengan kertas halaman. Ukuran responsif (tanpa width/height fisik).
export function blueprintSvg(p: Project) {
  const e = extent(p)
  if (!e) return null
  const xs = gridLines(p.walls.filter((w) => Math.abs(w.a[0] - w.b[0]) < 0.01).map((w) => w.a[0]))
  const ys = gridLines(p.walls.filter((w) => Math.abs(w.a[1] - w.b[1]) < 0.01).map((w) => w.a[1]))
  const m = 2.8 // ruang di kiri dan atas untuk gelembung as dan rantai ukuran
  const x0 = e.x0 - m
  const y0 = e.y0 - m
  const w = e.x1 - e.x0 + m + 1
  const h = e.y1 - e.y0 + m + 1
  const out: string[] = []
  const thin = `stroke='${PENCIL}' stroke-width='0.02'`
  const axis = `${thin} stroke-dasharray='0.5 0.12 0.06 0.12' opacity='0.55'`
  const fmt = (v: number) => v.toFixed(2)

  xs.forEach((x, i) => {
    out.push(`<line x1='${x}' y1='${e.y0 - 2.1}' x2='${x}' y2='${e.y1 + 0.6}' ${axis}/>`)
    out.push(`<circle cx='${x}' cy='${e.y0 - 2.4}' r='0.3' fill='#f3eee3' ${thin}/>`)
    out.push(`<text x='${x}' y='${e.y0 - 2.33}' ${MONO} font-size='0.24' fill='${INK}' text-anchor='middle' dominant-baseline='middle'>${String.fromCharCode(65 + i)}</text>`)
  })
  ys.forEach((y, i) => {
    out.push(`<line x1='${e.x0 - 2.1}' y1='${y}' x2='${e.x1 + 0.6}' y2='${y}' ${axis}/>`)
    out.push(`<circle cx='${e.x0 - 2.4}' cy='${y}' r='0.3' fill='#f3eee3' ${thin}/>`)
    out.push(`<text x='${e.x0 - 2.4}' y='${y + 0.07}' ${MONO} font-size='0.24' fill='${INK}' text-anchor='middle' dominant-baseline='middle'>${i + 1}</text>`)
  })
  // Rantai ukuran: garis dengan coret di tiap as, jarak antar as, dan total di atasnya.
  const chain = (vals: number[], horiz: boolean) => {
    if (vals.length < 2) return
    const c = horiz ? e.y0 - 1.2 : e.x0 - 1.2
    const at = (v: number, off = 0): [number, number] => (horiz ? [v, c + off] : [c + off, v])
    const rot = (x: number, y: number) => (horiz ? '' : ` transform='rotate(-90 ${x} ${y})'`)
    const [a, b] = [at(vals[0]), at(vals[vals.length - 1])]
    out.push(`<line x1='${a[0]}' y1='${a[1]}' x2='${b[0]}' y2='${b[1]}' ${thin}/>`)
    vals.forEach((v) => {
      const [tx, ty] = at(v)
      out.push(`<line x1='${tx - 0.1}' y1='${ty + 0.1}' x2='${tx + 0.1}' y2='${ty - 0.1}' stroke='${INK}' stroke-width='0.03'/>`)
    })
    for (let i = 0; i + 1 < vals.length; i++) {
      const [tx, ty] = at((vals[i] + vals[i + 1]) / 2, -0.18)
      out.push(`<text x='${tx}' y='${ty}' ${MONO} font-size='0.18' fill='${PENCIL}' text-anchor='middle'${rot(tx, ty)}>${fmt(vals[i + 1] - vals[i])}</text>`)
    }
    const [tx, ty] = at((vals[0] + vals[vals.length - 1]) / 2, -0.62)
    out.push(`<text x='${tx}' y='${ty}' ${MONO} font-size='0.2' fill='${INK}' text-anchor='middle'${rot(tx, ty)}>${fmt(vals[vals.length - 1] - vals[0])}</text>`)
  }
  chain(xs, true)
  chain(ys, false)
  out.push(...planBody(p, true))
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${x0} ${y0} ${w} ${h}' role='img'>${out.join('')}</svg>`
}
