import { describe, expect, it } from 'vitest'
import { blueprintSvg, openingCodes } from './drawing'
import { parseProject, polygonArea } from './project'
import { SAMPLE, SAMPLE_SITE } from './sample'

describe('denah rumah contoh di halaman depan', () => {
  it('data contoh lolos validasi proyek, jadi bisa dibuka di editor', () => {
    expect(parseProject(JSON.parse(JSON.stringify(SAMPLE)))).toEqual(SAMPLE)
  })

  it('setiap bukaan muat di dindingnya dan tidak saling menimpa', () => {
    for (const w of SAMPLE.walls) {
      const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
      const spans = SAMPLE.openings
        .filter((o) => o.wallId === w.id)
        .map((o) => [o.at - o.width / 2, o.at + o.width / 2])
        .sort((a, b) => a[0] - b[0])
      spans.forEach(([s0, s1], i) => {
        expect(s0, `${w.id} mulai`).toBeGreaterThanOrEqual(0)
        expect(s1, `${w.id} ujung`).toBeLessThanOrEqual(len)
        if (i) expect(s0, `${w.id} tumpang tindih`).toBeGreaterThan(spans[i - 1][1])
      })
    }
  })

  it('ruangan tidak saling tumpang tindih (jumlah luas = luas gabungan grid 0,25 m)', () => {
    const inRoom = (x: number, y: number, pts: [number, number][]) => {
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }
    for (let x = 0.125; x < 24; x += 0.25)
      for (let y = 0.125; y < 21; y += 0.25) expect(SAMPLE.rooms.filter((r) => inRoom(x, y, r.points)).length, `${x},${y}`).toBeLessThanOrEqual(1)
    expect(SAMPLE.rooms.every((r) => polygonArea(r.points) > 3)).toBe(true)
  })

  it('bukaan sejenis berbagi kode, pintu P dan jendela J dihitung terpisah', () => {
    const codes = openingCodes(SAMPLE.openings)
    expect(codes.get('h0-0')).toBe('J1')
    expect(codes.get('h0-2')).toBe(codes.get('h0-4')) // jendela kamar 1,6 m
    expect([...codes.values()].filter((c) => c.startsWith('P')).length).toBeGreaterThan(0)
    expect(new Set(codes.values()).size).toBeLessThan(SAMPLE.openings.length)
  })

  it('lembar lengkap: as dari tapak, tanda potongan, pola lantai, tapak, kode di luar dinding luar', () => {
    const svg = blueprintSvg(SAMPLE, SAMPLE_SITE)!
    expect(svg.match(/r='0.3'/g)).toHaveLength((5 + 5) * 2)
    expect(svg.match(/r='0.28'/g)).toHaveLength(4)
    expect(svg).toContain('>24.00<')
    expect(svg).toContain('>19.00<')
    expect(svg).toContain("url(#pola-kayu)")
    expect(svg).toContain('TAMAN TENGAH')
    expect(svg).toContain('4.00 × 5.00') // Kamar Anak 1
    // Jendela ruang tamu di dinding selatan (y = 19, ada teras di depannya): kodenya tetap di luar rumah.
    const tags = svg.match(/<rect x='[\d.]+' y='([\d.]+)' width='0.48'/g)!.map((t) => +t.split("y='")[1].split("'")[0])
    expect(tags.filter((y) => y > 18 && y < 19)).toHaveLength(0)
  })
})
