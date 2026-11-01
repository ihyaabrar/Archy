import { describe, expect, it } from 'vitest'
import { emptyProject, type Project } from './project'
import { flights, footing, slabHoles, stairProgress, walkBlockers } from './stairs'
import { blocked, move } from './walk'
import { buildPieces } from './mesh'
import { STAIR_STEPS, U_FIRST } from './furniture'

// Dua lantai, ruangan 6 × 6 di keduanya. Tangga 1 × 4,2 di tengah, kaki di selatan (y besar), puncak di utara.
const room: [number, number][] = [[0, 0], [6, 0], [6, 6], [0, 6]]
const base: Project = {
  ...emptyProject(),
  levels: [
    { id: 'L1', name: 'Lantai 1', elevation: 0 },
    { id: 'L2', name: 'Lantai 2', elevation: 3.2 },
  ],
  rooms: [
    { id: 'r1', name: 'Bawah', points: room, level: 'L1' },
    { id: 'r2', name: 'Atas', points: room, level: 'L2' },
  ],
  furniture: [{ id: 's', kind: 'stairs', pos: [3, 3], rot: 0, level: 'L1' }],
}

describe('tangga antar lantai', () => {
  it('tangga di lantai teratas bukan penghubung', () => {
    expect(flights(base)).toHaveLength(1)
    expect(flights({ ...base, furniture: [{ ...base.furniture[0], level: 'L2' }] })).toHaveLength(0)
  })

  it('kemajuan 0 di kaki, 1 di puncak, juga setelah diputar', () => {
    const [fl] = flights(base)
    expect(stairProgress(fl, [3, 5.1])).toBeCloseTo(0)
    expect(stairProgress(fl, [3, 0.9])).toBeCloseTo(1)
    expect(stairProgress(fl, [5, 3])).toBeNull()
    const [turned] = flights({ ...base, furniture: [{ ...base.furniture[0], rot: 90 }] })
    // Diputar 90°: kaki di barat (x kecil), puncak di timur.
    expect(stairProgress(turned, [0.9, 3])).toBeCloseTo(0)
    expect(stairProgress(turned, [5.1, 3])).toBeCloseTo(1)
  })

  it('pelat atas berlubang setapak tangga; pelat bawah tidak', () => {
    expect(slabHoles(base, 'L2', room)).toHaveLength(1)
    expect(slabHoles(base, 'L1', room)).toHaveLength(0)
  })

  it('tinggi naik rata dan lantai berpindah di tengah tangga', () => {
    expect(footing(base, 'L1', [3, 5.1]).y).toBeCloseTo(0)
    expect(footing(base, 'L1', [3, 3])).toEqual({ level: 'L2', y: 1.6 })
    expect(footing(base, 'L1', [3, 3.5]).level).toBe('L1')
    expect(footing(base, 'L2', [1, 1])).toEqual({ level: 'L2', y: 3.2 })
  })

  it('naik dari kaki sampai lantai atas, tapi tidak jatuh ke lubang dari samping', () => {
    const l1 = walkBlockers(base, 'L1')
    expect(blocked([3, 3], l1)).toBe(false) // tangga bisa diinjak
    expect(move([3, 5.5], [3, 4], l1)[1]).toBeCloseTo(4)
    const l2 = walkBlockers(base, 'L2')
    expect(move([5, 3], [3, 3], l2)[0]).toBeGreaterThan(3.5) // tertahan pagar sisi lubang (tepi di x = 3,5)
    expect(move([3, 0.3], [3, 1.2], l2)[1]).toBeCloseTo(1.2) // masuk dari tepi puncak
  })

  describe('tangga U dengan bordes', () => {
    // Tapak 2,2 × 3 di tengah ruangan: x 1,9–4,1, y 1,5–4,5. Bordes 1,1 m di sisi utara (y 1,5–2,6).
    const u: Project = { ...base, furniture: [{ id: 'u', kind: 'stairsU', pos: [3, 3], rot: 0, level: 'L1' }] }
    const [fl] = flights(u)

    it('naik di lengan kanan, datar di bordes, naik lagi di lengan kiri sampai puncak di selatan', () => {
      expect(stairProgress(fl, [3.5, 4.49])).toBeCloseTo(0, 1)
      expect(stairProgress(fl, [3, 2])).toBeCloseTo(U_FIRST / STAIR_STEPS)
      expect(stairProgress(fl, [2.5, 4.49])).toBeCloseTo(1, 1)
      expect(stairProgress(fl, [3.5, 3.5])!).toBeLessThan(stairProgress(fl, [3.5, 3])!)
      // Di bordes masih lantai bawah, di ujung lengan kiri sudah lantai atas.
      expect(footing(u, 'L1', [3, 2]).level).toBe('L1')
      expect(footing(u, 'L1', [2.5, 4.4]).level).toBe('L2')
    })

    it('17 anak tangga plus bordes, lubang pelat seluas tapak', () => {
      expect(buildPieces(u).filter((x) => x.wallId === 'u')).toHaveLength(STAIR_STEPS + 1)
      expect(slabHoles(u, 'L2', room)).toHaveLength(1)
    })

    it('pagar tengah: tidak bisa pindah lengan menyamping, tapi bisa naik dari kaki', () => {
      const segs = walkBlockers(u, 'L1')
      expect(blocked([3.55, 3.5], segs)).toBe(false) // di tengah lengan kanan, jauh dari pagar
      const to = move([3.55, 3.5], [2.45, 3.5], segs)
      expect(to[0]).toBeGreaterThan(3) // tertahan pagar tengah di x = 3
      expect(move([3.55, 5.2], [3.55, 4.2], segs)[1]).toBeCloseTo(4.2) // masuk dari kaki
    })
  })
})
