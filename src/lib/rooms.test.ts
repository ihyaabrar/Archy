import { describe, expect, it } from 'vitest'
import { faces, newRoomShapes } from './rooms'
import { polygonArea, type Point } from './project'

const W = (a: Point, b: Point) => ({ a, b })
const box = [W([0, 0], [8, 0]), W([8, 0], [8, 5]), W([8, 5], [0, 5]), W([0, 5], [0, 0])]
const areas = (fs: Point[][]) => fs.map((f) => +polygonArea(f).toFixed(2)).sort((x, y) => x - y)

describe('deteksi ruangan', () => {
  it('kotak tertutup = satu ruangan, bidang luar dibuang', () => {
    expect(areas(faces(box))).toEqual([40])
  })

  it('dinding sekat dengan sambungan T membagi jadi dua ruangan', () => {
    // Sekat x = 3 dari dinding atas ke bawah; ujung sekat menempel di tengah dinding atas/bawah (sambungan T).
    expect(areas(faces([...box, W([3, 0], [3, 5])]))).toEqual([15, 25])
  })

  it('dinding silang membagi jadi empat', () => {
    expect(areas(faces([...box, W([4, 0], [4, 5]), W([0, 2], [8, 2])]))).toEqual([8, 8, 12, 12]) // 4 × 2 dan 4 × 3
  })

  it('dinding yang belum menutup tidak jadi ruangan; ujung buntu di dalam ruangan tidak mengganggu', () => {
    expect(faces(box.slice(0, 3))).toHaveLength(0)
    expect(areas(faces([...box, W([3, 0], [3, 2])]))).toEqual([40])
  })

  it('ruangan yang sudah ada tidak dibuat ulang', () => {
    const existing = [{ name: 'Kiri', points: [[0, 0], [3, 0], [3, 5], [0, 5]] as Point[] }]
    expect(areas(newRoomShapes([...box, W([3, 0], [3, 5])], existing))).toEqual([25])
  })
})
