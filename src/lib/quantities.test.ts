import { describe, expect, it } from 'vitest'
import { DEFAULT_COEF, quantities, toCsv } from './quantities'
import { addLevel, emptyProject, type Project } from './project'

// Ruang 4×3 m, dinding 3 m, satu pintu 0,9×2,1 dan satu jendela 1,2×1,2.
const W = (id: string, a: [number, number], b: [number, number]) => ({ id, a, b, thickness: 0.15, height: 3 })
const base: Project = {
  ...emptyProject(),
  walls: [W('a', [0, 0], [4, 0]), W('b', [4, 0], [4, 3]), W('c', [4, 3], [0, 3]), W('d', [0, 3], [0, 0])],
  openings: [
    { id: 'p', wallId: 'a', at: 2, width: 0.9, kind: 'door', sill: 0, height: 2.1 },
    { id: 'j', wallId: 'c', at: 2, width: 1.2, kind: 'window', sill: 0.9, height: 1.2 },
  ],
  rooms: [{ id: 'r', name: 'Kamar', points: [[0, 0], [4, 0], [4, 3], [0, 3]] }],
  furniture: [{ id: 'f', kind: 'bed2', pos: [2, 1.5], rot: 0 }],
}

const get = (rows: ReturnType<typeof quantities>, item: string) => rows.find((r) => r.item.startsWith(item))!

describe('volume material', () => {
  it('luas dinding bersih = kotor dikurangi bukaan', () => {
    const rows = quantities(base)
    expect(get(rows, 'Panjang dinding').qty).toBe(14)
    const net = 14 * 3 - (0.9 * 2.1 + 1.2 * 1.2)
    expect(get(rows, 'Luas dinding bersih').qty).toBeCloseTo(net)
    expect(get(rows, 'Bata').qty).toBe(Math.ceil(net * 70 * 1.05))
    expect(get(rows, 'Cat').qty).toBe(Math.ceil((net * 2 * 2) / 10))
  })

  it('lantai keramik dan jumlah ubin, bukaan dan furnitur dihitung', () => {
    const rows = quantities(base)
    expect(get(rows, 'Keramik 60×60').qty).toBe(12) // nama material lantai
    expect(rows.find((r) => r.item.startsWith('Keramik 60×60 cm'))!.qty).toBe(Math.ceil((12 * 1.05) / 0.36))
    expect(get(rows, 'Pintu').qty).toBe(1)
    expect(get(rows, 'Jendela').qty).toBe(1)
    expect(get(rows, 'Kasur').qty).toBe(1)
  })

  it('koefisien bisa diubah, dinding bata tanpa cat', () => {
    const rows = quantities({ ...base, wallFinish: 'bata' }, { ...DEFAULT_COEF, bricksPerM2: 8.3, waste: 0 })
    expect(rows.find((r) => r.item.startsWith('Cat'))).toBeUndefined()
    expect(get(rows, 'Bata').qty).toBe(Math.ceil(get(rows, 'Luas dinding bersih').qty * 8.3))
  })

  it('per lantai, dan CSV memakai titik koma serta desimal koma', () => {
    const { project, id } = addLevel(base)
    const p = { ...project, walls: [...project.walls, { ...W('e', [0, 0], [2, 0]), level: id }] }
    const rows = quantities(p)
    expect([...new Set(rows.map((r) => r.level))]).toEqual(['Lantai 1', 'Lantai 2'])
    const csv = toCsv(rows)
    expect(csv.startsWith('﻿Lantai;Kelompok;Item;Jumlah;Satuan;Keterangan')).toBe(true)
    expect(csv).toContain('Lantai 2;Dinding;Panjang dinding (as);2;m;')
    expect(csv).toMatch(/;\d+,\d+;m²;/)
  })
})
