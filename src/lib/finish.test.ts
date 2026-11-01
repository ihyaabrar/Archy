import { describe, expect, it } from 'vitest'
import { emptyProject, finishOf, parseProject, type Project } from './project'
import { quantities } from './quantities'

const base: Project = {
  ...emptyProject(),
  wallFinish: 'cat',
  walls: [
    { id: 'a', a: [0, 0], b: [4, 0], thickness: 0.15, height: 3 },
    { id: 'b', a: [4, 0], b: [4, 2], thickness: 0.15, height: 3, finish: 'bata' },
  ],
}

describe('material per dinding', () => {
  it('dinding tanpa finish ikut material bangunan', () => {
    expect(finishOf(base, base.walls[0])).toBe('cat')
    expect(finishOf(base, base.walls[1])).toBe('bata')
  })

  it('volume finishing dipisah per material, cat hanya untuk dinding cat', () => {
    const rows = quantities(base).filter((r) => r.item === 'Luas bidang finishing (dua sisi)')
    expect(rows.map((r) => [r.note, r.qty])).toEqual([
      ['Cat putih', 24],
      ['Bata ekspos', 12],
    ])
    expect(quantities(base).filter((r) => r.item === 'Cat (perkiraan)')).toHaveLength(1)
  })

  it('validasi menolak material dinding yang tidak dikenal', () => {
    expect(() => parseProject({ ...base, walls: [{ ...base.walls[0], finish: 'emas' }] })).toThrow('material dinding')
  })
})
