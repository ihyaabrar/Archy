import { describe, expect, it } from 'vitest'
import { elevationSheets, elevationSvg, roofPlanSvg, sectionSheets } from './elevation'
import { sectionCuts, workSheets } from './drawing'
import { emptyProject, type Project } from './project'
import { SAMPLE, SAMPLE_SITE } from './sample'

// Kotak 8 × 6 m dengan jendela di dinding selatan.
const W = (id: string, a: [number, number], b: [number, number]) => ({ id, a, b, thickness: 0.2, height: 3 })
const box: Project = {
  ...emptyProject(),
  walls: [W('n', [0, 0], [8, 0]), W('e', [8, 0], [8, 6]), W('s', [8, 6], [0, 6]), W('w', [0, 6], [0, 0])],
  openings: [{ id: 'j', wallId: 's', at: 4, width: 2, kind: 'window', sill: 0.9, height: 1.2 }],
}

describe('tampak dan potongan', () => {
  it('yang dekat digambar terakhir: kaca dinding selatan tertutup dinding utara di tampak utara', () => {
    const wallRect = "fill='#f3eee3' stroke='#2a2420' stroke-width='0.012'"
    const south = elevationSvg(box, 'selatan', 'Kotak')!.svg
    const north = elevationSvg(box, 'utara', 'Kotak')!.svg
    expect(south.indexOf('#c9d8db')).toBeGreaterThan(south.indexOf(wallRect)) // kaca di atas dinding belakang
    expect(north.indexOf('#c9d8db')).toBeLessThan(north.lastIndexOf(wallRect)) // dinding utara menutup kaca
  })

  it('empat tampak, ketinggian ±0.00 dan puncak dinding, judul di-escape', () => {
    const sheets = elevationSheets(box, 'A & B')
    expect(sheets.map((s) => s.title)).toEqual(['A & B, Tampak Selatan', 'A & B, Tampak Timur', 'A & B, Tampak Utara', 'A & B, Tampak Barat'])
    expect(sheets[0].svg).toContain('±0.00')
    expect(sheets[0].svg).toContain('+3.00')
    expect(sheets[0].svg).toContain('A &#38; B')
  })

  it('potongan: dinding yang terpotong digambar hitam selebar tebalnya', () => {
    const [a] = sectionSheets(box, 'Kotak', { x: [0, 8], y: [0, 6] })
    // Potongan A di y = 3 memotong dinding barat dan timur (tebal 0,2 m).
    expect(a.svg.match(/width='0.2' height='3' fill='#2a2420'/g)).toHaveLength(2)
  })

  it('garis potong tidak berimpit dengan dinding sejajar', () => {
    const { a, b } = sectionCuts(SAMPLE, SAMPLE_SITE.L1.axes)
    for (const w of SAMPLE.walls) {
      if (Math.abs(w.a[0] - w.b[0]) < 0.01) expect(Math.abs(w.a[0] - b!)).toBeGreaterThan(0.3)
      if (Math.abs(w.a[1] - w.b[1]) < 0.01) expect(Math.abs(w.a[1] - a!)).toBeGreaterThan(0.3)
    }
  })

  it('rumah contoh: dua potongan, potongan memuat pelat lantai 2 yang terpotong', () => {
    const cuts = sectionSheets(SAMPLE, 'Contoh', SAMPLE_SITE.L1.axes)
    expect(cuts.map((c) => c.title)).toEqual(['Contoh, Potongan A-A', 'Contoh, Potongan B-B', 'Contoh, Denah Atap'])
    expect(cuts[0].svg).toContain('+3.20')
    expect(elevationSheets(emptyProject(), 'Kosong')).toEqual([])
  })

  it('denah atap: pelana punya dua bidang, masing-masing satu panah dan label kemiringan', () => {
    const plan = roofPlanSvg({ ...box, roof: { type: 'pelana', pitch: 35, overhang: 0.5, material: 'genteng', ridge: 'auto' } }, 'Kotak')!
    expect(plan.svg.match(/>35°</g)).toHaveLength(2)
    const flat = roofPlanSvg(box, 'Kotak')!
    expect(flat.svg).toContain('ATAP DATAR')
  })

  it('lembar kerja untuk cetak: satu per lantai, ukuran fisik 1:100, judul lantai', () => {
    const sheets = workSheets(SAMPLE, 'Contoh', SAMPLE_SITE)
    expect(sheets.map((s) => s.title)).toEqual(['Lantai 1', 'Lantai 2'])
    expect(sheets[0].svg).toMatch(/width='[\d.]+cm'/)
    expect(sheets[0].svg).toContain('Contoh, Denah Lantai 1')
    expect(sheets[0].svg).toContain('P1') // kode pintu ikut tercetak
    expect(workSheets(emptyProject(), 'Kosong')).toEqual([])
  })
})
