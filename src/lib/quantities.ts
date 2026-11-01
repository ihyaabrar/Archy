// Volume material dari denah, per lantai. Ukuran dihitung dari geometri; perkiraan jumlah bahan memakai
// koefisien yang tampil dan bisa diubah pengguna, karena koefisien bergantung spesifikasi dan pemasok.

import { CATALOG } from './furniture'
import { DEFAULT_FLOOR, FLOORS, WALLS, type FloorKey, type WallKey } from './materials'
import { finishOf, levelsOf, onLevel, polygonArea, wallLength, type Project, type Wall } from './project'
import { DEFAULT_ROOF, ROOF_MATERIALS, roofBase, roofMesh, triArea } from './roof'

export type Coefficients = {
  bricksPerM2: number // bata per m² dinding (pasangan setengah bata)
  tileSize: number // sisi keramik, meter
  paintM2PerLiter: number // daya sebar cat per lapis
  paintCoats: number
  waste: number // sisa potong, 0,05 = 5%
  roofTilesPerM2: number // genteng per m² bidang atap miring
}

// Nilai awal yang umum dipakai; pengguna wajib menyesuaikan dengan spesifikasi proyeknya.
export const DEFAULT_COEF: Coefficients = { bricksPerM2: 70, tileSize: 0.6, paintM2PerLiter: 10, paintCoats: 2, waste: 0.05, roofTilesPerM2: 25 }

export type Row = { level: string; group: string; item: string; qty: number; unit: string; note: string }

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

export function quantities(p: Project, c: Coefficients = DEFAULT_COEF): Row[] {
  const rows: Row[] = []
  for (const l of [...levelsOf(p)].sort((a, b) => a.elevation - b.elevation)) {
    const part = onLevel(p, l.id)
    if (!part.walls.length && !part.rooms.length && !part.furniture.length) continue
    const add = (group: string, item: string, qty: number, unit: string, note = '') => rows.push({ level: l.name, group, item, qty, unit, note })

    // Dinding: panjang as, luas kotor, dikurangi bukaan (tinggi bukaan dibatasi tinggi dinding).
    const length = part.walls.reduce((s, w) => s + wallLength(w), 0)
    const gross = part.walls.reduce((s, w) => s + wallLength(w) * w.height, 0)
    const holesOf = (w: Wall) =>
      part.openings.filter((o) => o.wallId === w.id).reduce((s, o) => s + o.width * Math.max(0, Math.min(o.height, w.height - o.sill)), 0)
    const holes = part.walls.reduce((s, w) => s + holesOf(w), 0)
    const net = Math.max(0, gross - holes)
    // Luas bersih per material dinding (material bisa beda per dinding).
    const byFinish = new Map<WallKey, number>()
    for (const w of part.walls) {
      const f = finishOf(p, w)
      byFinish.set(f, (byFinish.get(f) ?? 0) + Math.max(0, wallLength(w) * w.height - holesOf(w)))
    }
    if (part.walls.length) {
      add('Dinding', 'Panjang dinding (as)', length, 'm')
      add('Dinding', 'Luas dinding bersih (satu sisi)', net, 'm²', `kotor ${fmt(gross)} m² dikurangi bukaan ${fmt(holes)} m²`)
      add('Dinding', 'Bata (perkiraan)', Math.ceil(net * c.bricksPerM2 * (1 + c.waste)), 'buah', `${fmt(c.bricksPerM2)} bata/m², sisa ${fmt(c.waste * 100)}%`)
      for (const [f, area] of byFinish) {
        add('Dinding', 'Luas bidang finishing (dua sisi)', area * 2, 'm²', WALLS[f].label)
        if (f === 'cat')
          add('Dinding', 'Cat (perkiraan)', Math.ceil((area * 2 * c.paintCoats) / c.paintM2PerLiter), 'liter', `${c.paintCoats} lapis, ${fmt(c.paintM2PerLiter)} m²/liter per lapis`)
      }
    }

    // Lantai per material.
    const byFloor = new Map<FloorKey, number>()
    for (const r of part.rooms) byFloor.set(r.floor ?? DEFAULT_FLOOR, (byFloor.get(r.floor ?? DEFAULT_FLOOR) ?? 0) + polygonArea(r.points))
    for (const [k, area] of byFloor) {
      add('Lantai', FLOORS[k].label, area, 'm²')
      if (k === 'keramik')
        add('Lantai', `Keramik ${fmt(c.tileSize * 100)}×${fmt(c.tileSize * 100)} cm (perkiraan)`, Math.ceil((area * (1 + c.waste)) / c.tileSize ** 2), 'buah', `sisa ${fmt(c.waste * 100)}%`)
      if (k === 'kayu') add('Lantai', 'Parket kayu termasuk sisa potong', area * (1 + c.waste), 'm²', `sisa ${fmt(c.waste * 100)}%`)
    }

    // Bukaan dikelompokkan per jenis dan ukuran.
    const open = new Map<string, number>()
    for (const o of part.openings) {
      const key = `${o.kind === 'door' ? 'Pintu' : 'Jendela'} ${fmt(o.width)} × ${fmt(o.height)} m`
      open.set(key, (open.get(key) ?? 0) + 1)
    }
    for (const [item, n] of [...open].sort()) add('Pintu dan jendela', item, n, 'unit')

    // Furnitur per jenis (ukuran khusus disebut di keterangan).
    const furn = new Map<string, { n: number; custom: number }>()
    for (const f of part.furniture) {
      const e = furn.get(f.kind) ?? { n: 0, custom: 0 }
      furn.set(f.kind, { n: e.n + 1, custom: e.custom + (f.w !== undefined || f.d !== undefined ? 1 : 0) })
    }
    for (const [k, v] of furn) add('Furnitur', CATALOG[k as keyof typeof CATALOG].label, v.n, 'unit', v.custom ? `${v.custom} berukuran khusus` : '')

    // Atap miring dihitung di lantai tempatnya bertumpu (lantai teratas berdinding).
    const r = p.roof ?? DEFAULT_ROOF
    const mesh = roofMesh(p, r)
    if (mesh && roofBase(p)?.level === l.id) {
      const m = ROOF_MATERIALS[r.material]
      add('Atap', `Luas bidang atap ${r.type}`, mesh.area, 'm²', `kemiringan ${fmt(r.pitch)}°, teritisan ${fmt(r.overhang)} m`)
      if (r.material === 'metal') add('Atap', `${m.label} termasuk sisa potong`, mesh.area * (1 + c.waste), 'm²', `sisa ${fmt(c.waste * 100)}%`)
      else add('Atap', `${m.label} (perkiraan)`, Math.ceil(mesh.area * c.roofTilesPerM2 * (1 + c.waste)), 'buah', `${fmt(c.roofTilesPerM2)} buah/m², sisa ${fmt(c.waste * 100)}%`)
      if (mesh.gables.length) add('Atap', 'Dinding sopi-sopi', mesh.gables.reduce((s, t) => s + triArea(t), 0), 'm²', 'bidang di atas dinding ujung pelana')
    }
  }
  return rows
}

// CSV untuk Excel berbahasa Indonesia: pemisah titik koma, desimal koma, BOM supaya huruf terbaca benar.
export function toCsv(rows: Row[]) {
  const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  const lines = [
    ['Lantai', 'Kelompok', 'Item', 'Jumlah', 'Satuan', 'Keterangan'].join(';'),
    ...rows.map((r) => [r.level, r.group, r.item, num(r.qty), r.unit, r.note].map((v, i) => (i === 3 ? v : cell(v))).join(';')),
  ]
  return '﻿' + lines.join('\r\n')
}
