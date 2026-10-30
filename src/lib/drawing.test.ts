import { describe, expect, it } from 'vitest'
import { dimensionLabel, planSvg } from './drawing'
import { emptyProject, type Project } from './project'

const room: Project['rooms'][number] = { id: 'r', name: 'Dapur & <Saji>', points: [[0, 0], [4, 0], [4, 3], [0, 3]] }

describe('gambar denah', () => {
  it('label ukuran di luar ruangan', () => {
    const top = dimensionLabel([0, 0], [4, 0], 0.3, { rooms: [room] })!
    expect(top.y).toBeLessThan(0) // dinding atas: label di atas, bukan di dalam ruangan
    const bottom = dimensionLabel([4, 3], [0, 3], 0.3, { rooms: [room] })!
    expect(bottom.y).toBeGreaterThan(3)
    expect(bottom.angle).toBeCloseTo(0) // teks tidak terbalik
  })

  it('SVG ekspor: skala 1:100 dan nama ruangan di-escape', () => {
    const p: Project = { ...emptyProject(), walls: [{ id: 'w', a: [0, 0], b: [4, 0], thickness: 0.15, height: 3 }], rooms: [room] }
    const out = planSvg(p, 'Rumah Uji')!
    expect(out.svg).toContain(`width='${out.width}cm'`)
    expect(out.svg).toContain('Dapur &#38; &#60;Saji&#62;')
    expect(out.svg).not.toContain('<Saji>')
    expect(planSvg(emptyProject(), 'x')).toBeNull()
  })
})
