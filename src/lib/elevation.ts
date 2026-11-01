// Gambar tampak dan potongan dari model 3D yang sama dengan tampilan bangunan (balok dinding, kaca, pintu, atap).
// Tiap elemen diproyeksikan tegak lurus ke bidang gambar lalu digambar dari yang terjauh ke yang terdekat (painter).
// Potongan: elemen di depan bidang potong dibuang, elemen yang terpotong digambar hitam (poché), sisanya tampak di belakang.
// Satuan meter, 1 m = 1 cm saat dicetak (skala 1:100), sama dengan denah.

import { buildPieces, type Piece } from './mesh'
import { DEFAULT_ROOF, ROOF_MATERIALS, exposedRooms, roofBase, roofMesh, type Tri } from './roof'
import { elevationOf, finishOf, levelOf, levelsOf, type Point, type Project } from './project'
import { WALLS } from './materials'
import { INK, MONO, PENCIL, SERIF, esc, sectionCuts, type Site } from './drawing'

export type Side = 'selatan' | 'utara' | 'timur' | 'barat'
// u = arah mendatar di gambar (kiri ke kanan), d = jarak ke penonton (besar = dekat).
const VIEWS: Record<Side, { u: (x: number, y: number) => number; d: (x: number, y: number) => number }> = {
  selatan: { u: (x) => x, d: (_, y) => y },
  utara: { u: (x) => -x, d: (_, y) => -y },
  timur: { u: (_, y) => -y, d: (x) => x },
  barat: { u: (_, y) => y, d: (x) => -x },
}
export const SIDE_LABELS: Record<Side, string> = { selatan: 'Tampak Selatan', utara: 'Tampak Utara', timur: 'Tampak Timur', barat: 'Tampak Barat' }

export type Sheet = { svg: string; width: number; height: number; title: string }

const GLASS = '#c9d8db'
const DOOR = '#9c7652'
const FURN = '#d6c8b0'
const CUT = INK
const f2 = (n: number) => +n.toFixed(3)

// Sudut tapak balok di denah.
function corners(pc: Piece): Point[] {
  const th = -pc.rotY
  const [cx, , cz] = pc.center
  const [len, , thick] = pc.size
  const [ax, ay] = [Math.cos(th) * (len / 2), Math.sin(th) * (len / 2)]
  const [bx, by] = [-Math.sin(th) * (thick / 2), Math.cos(th) * (thick / 2)]
  return [
    [cx - ax - bx, cz - ay - by],
    [cx + ax - bx, cz + ay - by],
    [cx + ax + bx, cz + ay + by],
    [cx - ax + bx, cz - ay + by],
  ]
}

// Ruas-ruas u tempat poligon denah memotong garis d = c (pasangan titik potong yang diurutkan).
function crossing(pts: Point[], view: (typeof VIEWS)[Side], c: number): [number, number][] {
  const us: number[] = []
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]
    const [da, db] = [view.d(a[0], a[1]), view.d(b[0], b[1])]
    if (da === db || (da - c) * (db - c) > 0 || Math.max(da, db) === c) return
    const t = (c - da) / (db - da)
    us.push(view.u(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
  })
  us.sort((a, b) => a - b)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < us.length; i += 2) out.push([us[i], us[i + 1]])
  return out
}

function draw(p: Project, side: Side, title: string, cut?: number): Sheet | null {
  const view = VIEWS[side]
  // Di tampak, furnitur dalam rumah tertutup dinding; hanya benda luar (kanopi, tanaman, pohon, mobil) dan kolom yang digambar.
  const outside = new Set(p.furniture.filter((f) => ['canopy', 'plant', 'tree', 'car', 'column'].includes(f.kind)).map((f) => f.id))
  const pieces = buildPieces(p).filter((pc) => cut !== undefined || pc.kind !== 'furniture' || outside.has(pc.wallId))
  if (!pieces.length) return null
  const finishes = new Map(p.walls.map((w) => [w.id, WALLS[finishOf(p, w)].base]))
  const items: { d: number; svg: string }[] = []
  const front: string[] = [] // bagian terpotong, digambar paling atas
  let [u0, u1, top] = [Infinity, -Infinity, 0]
  const rect = (ua: number, ub: number, y0: number, y1: number, fill: string, w = 0.012) =>
    `<rect x='${f2(Math.min(ua, ub))}' y='${f2(-y1)}' width='${f2(Math.abs(ub - ua))}' height='${f2(y1 - y0)}' fill='${fill}' stroke='${INK}' stroke-width='${w}'/>`

  for (const pc of pieces) {
    const cs = corners(pc)
    const us = cs.map((q) => view.u(q[0], q[1]))
    const ds = cs.map((q) => view.d(q[0], q[1]))
    const [dmin, dmax] = [Math.min(...ds), Math.max(...ds)]
    const [y0, y1] = [pc.center[1] - pc.size[1] / 2, pc.center[1] + pc.size[1] / 2]
    if (cut !== undefined && dmin > cut) continue
    const [ua, ub] = [Math.min(...us), Math.max(...us)]
    ;[u0, u1, top] = [Math.min(u0, ua), Math.max(u1, ub), Math.max(top, y1)]
    const fill = pc.kind === 'glass' ? GLASS : pc.kind === 'door' ? DOOR : pc.kind === 'furniture' ? (pc.color ?? FURN) : (finishes.get(pc.wallId) ?? WALLS.cat.base)
    if (cut !== undefined && dmax >= cut) {
      // Terpotong: dinding jadi poché hitam selebar tebalnya di garis potong; kaca tetap kaca; daun pintu dan furnitur tidak.
      if (pc.kind === 'wall') for (const [a, b] of crossing(cs, view, cut)) front.push(rect(a, b, y0, y1, CUT, 0.01))
      else if (pc.kind === 'glass') front.push(rect(ua, ub, y0, y1, GLASS, 0.02))
      continue
    }
    items.push({ d: (dmin + dmax) / 2, svg: rect(ua, ub, y0, y1, fill) })
  }

  // Atap miring: segitiga diproyeksikan; yang terpotong jadi garis tebal.
  const roof = p.roof ?? DEFAULT_ROOF
  const mesh = roofMesh(p, roof)
  const tri = (t: Tri, fill: string) => {
    const pts = t.p.map((v) => [view.u(v[0], v[2]), view.d(v[0], v[2]), v[1]] as const)
    const ds = pts.map((q) => q[1])
    if (cut !== undefined && Math.min(...ds) > cut) return
    for (const q of pts) [u0, u1, top] = [Math.min(u0, q[0]), Math.max(u1, q[0]), Math.max(top, q[2])]
    if (cut !== undefined && Math.max(...ds) >= cut) {
      // Titik potong sisi segitiga dengan bidang d = cut.
      const seg: [number, number][] = []
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % 3]
        if (a[1] === b[1] || (a[1] - cut) * (b[1] - cut) > 0) return
        const k = (cut - a[1]) / (b[1] - a[1])
        seg.push([a[0] + (b[0] - a[0]) * k, a[2] + (b[2] - a[2]) * k])
      })
      if (seg.length >= 2) front.push(`<line x1='${f2(seg[0][0])}' y1='${f2(-seg[0][1])}' x2='${f2(seg[1][0])}' y2='${f2(-seg[1][1])}' stroke='${CUT}' stroke-width='0.12' stroke-linecap='round'/>`)
      return
    }
    // Garis tepi segitiga sewarna isinya: diagonal antar segitiga tidak tampak, bidang yang terlihat dari samping tetap jadi garis.
    items.push({ d: ds.reduce((s, v) => s + v, 0) / 3, svg: `<polygon points='${pts.map((q) => `${f2(q[0])},${f2(-q[2])}`).join(' ')}' fill='${fill}' stroke='${fill === WALLS.cat.base ? INK : fill}' stroke-width='0.03' stroke-linejoin='round'/>` })
  }
  if (mesh) {
    mesh.gables.forEach((t) => tri(t, WALLS[p.wallFinish ?? 'cat'].base))
    mesh.roof.forEach((t) => tri(t, ROOF_MATERIALS[roof.material].base))
    // Bilah roster gevel: diproyeksikan seperti balok dinding, sedikit lebih dekat dari bidang gevel.
    for (const s of mesh.vents) {
      const cs = corners({ kind: 'door', wallId: '', center: s.center, size: s.size, rotY: s.rotY })
      const us = cs.map((q) => view.u(q[0], q[1]))
      const ds = cs.map((q) => view.d(q[0], q[1]))
      if (cut !== undefined && Math.min(...ds) > cut) continue
      items.push({ d: Math.max(...ds) + 0.01, svg: rect(Math.min(...us), Math.max(...us), s.center[1] - s.size[1] / 2, s.center[1] + s.size[1] / 2, DOOR) })
    }
  }

  // Pelat: lantai atas, atap datar, dan dak. Di tampak hanya lis tepinya yang terlihat (di depan dinding);
  // di potongan, pelat yang terpotong jadi poché.
  const b = roofBase(p)
  const roofSlabs = [
    ...(roof.type === 'datar' && b ? p.rooms.filter((r) => levelOf(p, r) === b.level).map((r) => ({ pts: r.points, y: b.height + 0.15 })) : []),
    ...exposedRooms(p).map(({ room, y }) => ({ pts: room.points, y: y + 0.15 })),
  ]
  const floorSlabs = p.rooms.filter((r) => elevationOf(p, levelOf(p, r)) > 0).map((r) => ({ pts: r.points, y: elevationOf(p, levelOf(p, r)) }))
  if (cut !== undefined)
    for (const { pts, y } of [...floorSlabs, ...roofSlabs]) for (const [a, c] of crossing(pts, view, cut)) front.push(rect(a, c, y - 0.15, y, CUT, 0.01))
  else
    for (const { pts, y } of roofSlabs) {
      // Atap datar dan dak terlihat dari luar sebagai lis setebal pelat di atas dinding.
      const us = pts.map((q) => view.u(q[0], q[1]))
      const ds = pts.map((q) => view.d(q[0], q[1]))
      items.push({ d: Math.max(...ds) + 0.2, svg: rect(Math.min(...us) - 0.1, Math.max(...us) + 0.1, y - 0.15, y, '#e9e2d3') })
      top = Math.max(top, y)
    }
  if (!isFinite(u0)) return null

  items.sort((a, b) => a.d - b.d)
  const out = [...items.map((i) => i.svg), ...front]

  // Muka tanah, ketinggian lantai, dan puncak bangunan.
  const pad = 2.2
  out.unshift(`<rect x='${f2(u0 - pad)}' y='0' width='${f2(u1 - u0 + 2 * pad)}' height='0.6' fill='url(#tanah)'/>`)
  out.push(`<line x1='${f2(u0 - pad)}' y1='0' x2='${f2(u1 + pad)}' y2='0' stroke='${INK}' stroke-width='0.05'/>`)
  const marks = [...new Set([...levelsOf(p).map((l) => l.elevation), top])].sort((a, c) => a - c)
  for (const y of marks) {
    const x = u0 - 1.4
    out.push(
      `<line x1='${f2(x - 0.4)}' y1='${f2(-y)}' x2='${f2(u0 - 0.1)}' y2='${f2(-y)}' stroke='${PENCIL}' stroke-width='0.012' stroke-dasharray='0.15 0.08'/>`,
      `<polygon points='${f2(x)},${f2(-y)} ${f2(x - 0.15)},${f2(-y - 0.2)} ${f2(x + 0.15)},${f2(-y - 0.2)}' fill='none' stroke='${INK}' stroke-width='0.015'/>`,
      `<text x='${f2(x - 0.25)}' y='${f2(-y - 0.06)}' ${MONO} font-size='0.18' fill='${INK}' text-anchor='end'>${y === 0 ? '±0.00' : `+${y.toFixed(2)}`}</text>`,
    )
  }
  // Kepala gambar di bawah: judul dan batang skala.
  const by = 1.3
  out.push(`<text x='${f2(u0)}' y='${by}' ${SERIF} font-size='0.35' fill='${INK}'>${esc(title)}</text>`)
  for (let i = 0; i < 5; i++) out.push(`<rect x='${f2(u0 + i)}' y='${by + 0.2}' width='1' height='0.12' fill='${i % 2 ? '#f3eee3' : INK}' stroke='${INK}' stroke-width='0.02'/>`)
  out.push(`<text x='${f2(u0)}' y='${by + 0.55}' ${MONO} font-size='0.16' fill='${PENCIL}'>0</text>`)
  out.push(`<text x='${f2(u0 + 5)}' y='${by + 0.55}' ${MONO} font-size='0.16' fill='${PENCIL}' text-anchor='middle'>5 m</text>`)

  const x0 = u0 - pad - 0.6
  const y0 = -top - 1
  const width = Math.max(u1 - u0 + 2 * pad + 1.2, 8)
  const height = top + 1 + by + 0.9
  const defs = `<defs><pattern id='tanah' width='0.3' height='0.3' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><path d='M0 0V0.3' stroke='${PENCIL}' stroke-width='0.012'/></pattern></defs>`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${f2(width)}cm' height='${f2(height)}cm' viewBox='${f2(x0)} ${f2(y0)} ${f2(width)} ${f2(height)}' role='img'><rect x='${f2(x0)}' y='${f2(y0)}' width='${f2(width)}' height='${f2(height)}' fill='#f3eee3'/>${defs}${out.join('')}</svg>`
  return { svg, width, height, title }
}

export const elevationSvg = (p: Project, side: Side, name: string) => draw(p, side, `${name}, ${SIDE_LABELS[side]}`)

// Potongan A memandang ke utara di garis mendatar y = a, potongan B memandang ke barat di garis tegak x = b
// (sama dengan tanda potongan di denah).
export function sectionSheets(p: Project, name: string, axes?: Site['axes']): Sheet[] {
  const { a, b } = sectionCuts(p, axes)
  return [
    a !== null ? draw(p, 'selatan', `${name}, Potongan A-A`, a) : null,
    b !== null ? draw(p, 'timur', `${name}, Potongan B-B`, b) : null,
    roofPlanSvg(p, name),
  ].filter((s): s is Sheet => !!s)
}

export const elevationSheets = (p: Project, name: string) =>
  (['selatan', 'timur', 'utara', 'barat'] as Side[]).map((s) => elevationSvg(p, s, name)).filter((s): s is Sheet => !!s)

// Denah atap (tampak atas): bidang atap dikelompokkan per bidang datar, garis tepinya jadi lis, bubungan, dan jurai.
// Tiap bidang miring diberi panah ke arah air mengalir dan kemiringannya. Dinding lantai teratas digambar putus-putus.
export function roofPlanSvg(p: Project, name: string): Sheet | null {
  const b = roofBase(p)
  if (!b) return null
  const roof = p.roof ?? DEFAULT_ROOF
  const mesh = roofMesh(p, roof)
  const out: string[] = []
  const fill = ROOF_MATERIALS[roof.material].base
  let [x0, x1, z0, z1] = [b.x0, b.x1, b.z0, b.z1]
  const title = `${name}, Denah Atap`

  if (mesh) {
    // Kelompok per bidang: normal dibulatkan.
    const groups = new Map<string, Tri[]>()
    for (const t of mesh.roof) {
      const [a, c, d] = t.p
      const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const len = Math.hypot(n[0], n[1], n[2]) || 1
      n = n.map((k) => k / len)
      if (n[1] < 0) n = n.map((k) => -k)
      const key = `${n.map((k) => k.toFixed(2)).join(',')}|${(n[0] * a[0] + n[1] * a[1] + n[2] * a[2]).toFixed(2)}`
      groups.set(key, [...(groups.get(key) ?? []), t])
    }
    for (const [key, tris] of groups) {
      const n = key.split('|')[0].split(',').map(Number)
      const pts = tris.flatMap((t) => t.p)
      for (const t of tris) out.push(`<polygon points='${t.p.map((v) => `${f2(v[0])},${f2(v[2])}`).join(' ')}' fill='${fill}' stroke='${fill}' stroke-width='0.06' stroke-linejoin='round'/>`)
      // Tepi bidang = sisi segitiga yang hanya dimiliki satu segitiga dalam kelompoknya.
      const edges = new Map<string, [number, number, number, number]>()
      for (const t of tris)
        for (let i = 0; i < 3; i++) {
          const [a, c] = [t.p[i], t.p[(i + 1) % 3]]
          const k = [a, c].map((v) => `${v[0].toFixed(2)},${v[2].toFixed(2)}`).sort().join('|')
          if (edges.has(k)) edges.delete(k)
          else edges.set(k, [a[0], a[2], c[0], c[2]])
        }
      for (const [ax, az, cx, cz] of edges.values()) out.push(`<line x1='${f2(ax)}' y1='${f2(az)}' x2='${f2(cx)}' y2='${f2(cz)}' stroke='${INK}' stroke-width='0.03'/>`)
      // Panah turun: arah komponen datar normal bidang.
      const h = Math.hypot(n[0], n[2])
      if (h < 0.05) continue
      const [dx, dz] = [n[0] / h, n[2] / h]
      const cx = pts.reduce((s, v) => s + v[0], 0) / pts.length
      const cz = pts.reduce((s, v) => s + v[2], 0) / pts.length
      const [ex, ez] = [cx + dx * 0.9, cz + dz * 0.9]
      out.push(
        `<line x1='${f2(cx - dx * 0.4)}' y1='${f2(cz - dz * 0.4)}' x2='${f2(ex)}' y2='${f2(ez)}' stroke='${INK}' stroke-width='0.025'/>`,
        `<polygon points='${f2(ex + dx * 0.2)},${f2(ez + dz * 0.2)} ${f2(ex - dz * 0.1)},${f2(ez + dx * 0.1)} ${f2(ex + dz * 0.1)},${f2(ez - dx * 0.1)}' fill='${INK}'/>`,
        `<text x='${f2(cx - dx * 0.4 - dz * 0.3)}' y='${f2(cz - dz * 0.4 + dx * 0.3)}' ${MONO} font-size='0.2' fill='${INK}' text-anchor='middle'>${roof.pitch}°</text>`,
      )
      for (const v of pts) [x0, x1, z0, z1] = [Math.min(x0, v[0]), Math.max(x1, v[0]), Math.min(z0, v[2]), Math.max(z1, v[2])]
    }
  } else {
    // Atap datar: pelat per ruangan lantai teratas.
    for (const r of p.rooms.filter((r) => levelOf(p, r) === b.level))
      out.push(`<polygon points='${r.points.map((q) => `${f2(q[0])},${f2(q[1])}`).join(' ')}' fill='#e9e2d3' stroke='${INK}' stroke-width='0.03'/>`)
    out.push(`<text x='${f2((b.x0 + b.x1) / 2)}' y='${f2((b.z0 + b.z1) / 2)}' ${MONO} font-size='0.24' fill='${INK}' text-anchor='middle'>ATAP DATAR</text>`)
  }
  // Dak lantai bawah.
  for (const { room } of exposedRooms(p))
    out.push(`<polygon points='${room.points.map((q) => `${f2(q[0])},${f2(q[1])}`).join(' ')}' fill='#e9e2d3' stroke='${INK}' stroke-width='0.03'/>`)
  // Dinding lantai teratas di bawah atap: garis as putus-putus.
  for (const w of p.walls.filter((w) => levelOf(p, w) === b.level))
    out.push(`<line x1='${w.a[0]}' y1='${w.a[1]}' x2='${w.b[0]}' y2='${w.b[1]}' stroke='${PENCIL}' stroke-width='0.02' stroke-dasharray='0.2 0.1'/>`)

  const pad = 1.5
  const by = z1 + 1.1
  out.push(`<text x='${f2(x0)}' y='${f2(by)}' ${SERIF} font-size='0.35' fill='${INK}'>${esc(title)}</text>`)
  for (let i = 0; i < 5; i++) out.push(`<rect x='${f2(x0 + i)}' y='${f2(by + 0.2)}' width='1' height='0.12' fill='${i % 2 ? '#f3eee3' : INK}' stroke='${INK}' stroke-width='0.02'/>`)
  const vx = x0 - pad
  const vy = z0 - pad
  const width = Math.max(x1 - x0 + 2 * pad, 8)
  const height = by + 0.9 - vy
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${f2(width)}cm' height='${f2(height)}cm' viewBox='${f2(vx)} ${f2(vy)} ${f2(width)} ${f2(height)}' role='img'><rect x='${f2(vx)}' y='${f2(vy)}' width='${f2(width)}' height='${f2(height)}' fill='#f3eee3'/>${out.join('')}</svg>`
  return { svg, width, height, title }
}
