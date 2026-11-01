import { describe, expect, it } from 'vitest'
import { blueprintSvg, openingCodes } from './drawing'
import { onLevel, parseProject, polygonArea, type Point } from './project'
import { inPolygon } from './walk'
import { flights, slabHoles } from './stairs'
import { LEVELS, OPEN_PAIRS, OUTDOOR, SAMPLE, SAMPLE_SITE } from './sample'

const roomAt = (level: string, q: Point) => SAMPLE.rooms.find((r) => r.level === level && inPolygon(q, r.points))

describe('rumah contoh dua lantai', () => {
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
        expect(s0, `${w.id} mulai`).toBeGreaterThanOrEqual(0.05)
        expect(s1, `${w.id} ujung`).toBeLessThanOrEqual(len - 0.05)
        if (i) expect(s0, `${w.id} tumpang tindih`).toBeGreaterThan(spans[i - 1][1])
      })
    }
  })

  it('ruangan satu lantai tidak saling tumpang tindih', () => {
    for (const { id } of LEVELS)
      for (let x = 0.125; x < 13; x += 0.25)
        for (let y = 0.125; y < 16.5; y += 0.25)
          expect(SAMPLE.rooms.filter((r) => r.level === id && inPolygon([x, y], r.points)).length, `${id} ${x},${y}`).toBeLessThanOrEqual(1)
  })

  // Dinding bolong: tepi ruangan tertutup yang tidak berdinding. Boleh terbuka hanya ke ruang luar
  // (carport, teras, balkon, jemur) atau ke pasangan ruang yang memang denah terbuka.
  it('tidak ada dinding bolong', () => {
    const holes: string[] = []
    for (const r of SAMPLE.rooms) {
      if (OUTDOOR.includes(r.id)) continue
      const walls = SAMPLE.walls.filter((w) => w.level === r.level)
      r.points.forEach((a, i) => {
        const b = r.points[(i + 1) % r.points.length]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        for (let t = 0.05; t < len; t += 0.1) {
          const q: Point = [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]
          const onWall = walls.some((w) => {
            const [x0, x1] = [Math.min(w.a[0], w.b[0]), Math.max(w.a[0], w.b[0])]
            const [y0, y1] = [Math.min(w.a[1], w.b[1]), Math.max(w.a[1], w.b[1])]
            return q[0] >= x0 - 1e-6 && q[0] <= x1 + 1e-6 && q[1] >= y0 - 1e-6 && q[1] <= y1 + 1e-6
          })
          if (onWall) continue
          // Ruang di seberang tepi.
          const n: Point = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
          const other = [roomAt(r.level!, [q[0] + n[0] * 0.05, q[1] + n[1] * 0.05]), roomAt(r.level!, [q[0] - n[0] * 0.05, q[1] - n[1] * 0.05])].find((o) => o && o.id !== r.id)
          const ok = other && (OUTDOOR.includes(other.id) || OPEN_PAIRS.some((p) => p.includes(r.id) && p.includes(other.id)))
          if (!ok) holes.push(`${r.name} di ${q.map((v) => v.toFixed(2))} ke ${other?.name ?? 'luar'}`)
        }
      })
    }
    expect([...new Set(holes)].slice(0, 5)).toEqual([])
  })

  it('tangga naik dari Lantai 1 ke Lantai 2 dan melubangi pelat hall', () => {
    const [fl] = flights(SAMPLE)
    expect(fl).toMatchObject({ from: 'L1', to: 'L2' })
    const hall2 = SAMPLE.rooms.find((r) => r.id === 'hall2')!
    expect(slabHoles(SAMPLE, 'L2', hall2.points)).toHaveLength(1)
  })

  it('void: tidak ada pelat lantai 2 di atas ruang keluarga bagian utara', () => {
    expect(roomAt('L2', [3, 6])).toBeUndefined()
    expect(roomAt('L1', [3, 6])?.id).toBe('keluarga')
  })

  it('luas lantai sesuai rencana (lihat docs/rumah-contoh.md)', () => {
    const area = (level: string, outdoor: boolean) =>
      SAMPLE.rooms.filter((r) => r.level === level && OUTDOOR.includes(r.id) === outdoor).reduce((s, r) => s + polygonArea(r.points), 0)
    expect(area('L1', false)).toBeCloseTo(171, 2)
    expect(area('L2', false)).toBeCloseTo(170.75, 2)
    expect(area('L1', true) + area('L2', true)).toBeCloseTo(66.25, 2)
  })

  it('kode bukaan dan lembar kerja tiap lantai', () => {
    const codes = openingCodes(SAMPLE.openings)
    expect(new Set(codes.values()).size).toBeLessThan(SAMPLE.openings.length)
    for (const { id } of LEVELS) {
      const svg = blueprintSvg(onLevel(SAMPLE, id), SAMPLE_SITE[id])!
      expect(svg.match(/r='0.3'/g), id).toHaveLength((4 + 5) * 2)
      expect(svg, id).toContain('>13.00<')
      expect(svg, id).toContain('>16.50<')
    }
    expect(blueprintSvg(onLevel(SAMPLE, 'L2'), SAMPLE_SITE.L2)).toContain('VOID')
    expect(blueprintSvg(onLevel(SAMPLE, 'L1'), SAMPLE_SITE.L1)).toContain('TAMAN DEPAN')
  })
})
