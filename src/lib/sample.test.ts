import { describe, expect, it } from 'vitest'
import { blueprintSvg, openingCodes } from './drawing'
import { parseProject } from './project'
import { SAMPLE } from './sample'

describe('denah rumah contoh di halaman depan', () => {
  it('data contoh lolos validasi proyek, jadi bisa dibuka di editor', () => {
    expect(parseProject(JSON.parse(JSON.stringify(SAMPLE)))).toEqual(SAMPLE)
  })

  it('bukaan sejenis berbagi kode, pintu P dan jendela J dihitung terpisah', () => {
    const codes = openingCodes(SAMPLE.openings)
    expect(codes.get('j1')).toBe('J1')
    expect(codes.get('j4')).toBe(codes.get('j1')) // sama-sama jendela 1,5 m
    expect(codes.get('p1')).toBe('P1')
    expect(codes.get('p3')).toBe(codes.get('p5')) // pintu kamar 0,8 m
    expect(new Set(codes.values()).size).toBeLessThan(SAMPLE.openings.length)
  })

  it('lembar lengkap: gelembung as di dua ujung, tanda potongan A dan B, kode di sisi luar dinding luar', () => {
    const svg = blueprintSvg(SAMPLE)!
    // 5 as x dan 4 as y, masing-masing dua gelembung.
    expect(svg.match(/r='0.3'/g)).toHaveLength((5 + 4) * 2)
    expect(svg.match(/r='0.28'/g)).toHaveLength(4)
    expect(svg).toContain('>12.00<')
    expect(svg).toContain('>10.00<')
    // Jendela ruang tamu (dinding selatan y = 10, ada teras di luarnya): kode tetap di luar rumah.
    const tag = svg.match(/<rect x='([\d.]+)' y='([\d.]+)' width='0.48'/g)!.map((t) => +t.split("y='")[1].split("'")[0])
    expect(tag.filter((y) => y > 9 && y < 10)).toHaveLength(0)
  })
})
