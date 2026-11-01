// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { calibrate, loadUnderlay, openUnderlay, setUnderlay, useUnderlay, type Underlay } from './underlay'

const u: Underlay = { src: 'data:image/jpeg;base64,AAAA', aspect: 0.5, x: 0, y: 0, width: 10, opacity: 0.5 }

describe('gambar latar jiplak', () => {
  it('kalibrasi dua titik: skala berubah, titik pertama tetap di tempat', () => {
    // Garis 2 m di gambar sebenarnya 3 m: gambar membesar 1,5 kali dari titik (2, 2).
    const c = calibrate(u, [2, 2], [4, 2], 3)
    expect(c.width).toBeCloseTo(15)
    expect(c.x).toBeCloseTo(-1)
    expect(c.y).toBeCloseTo(-1)
    expect(calibrate(u, [1, 1], [1, 1], 3)).toBe(u) // garis nol tidak mengubah apa-apa
  })

  it('tersimpan per proyek; data rusak atau bukan gambar ditolak', () => {
    openUnderlay('a')
    setUnderlay(u)
    openUnderlay('b')
    expect(useUnderlay.getState().underlay).toBeNull()
    openUnderlay('a')
    expect(useUnderlay.getState().underlay).toEqual(u)
    localStorage.setItem('denahin:latar:x', JSON.stringify({ ...u, src: 'javascript:alert(1)' }))
    expect(loadUnderlay('x')).toBeNull()
    localStorage.setItem('denahin:latar:y', '{rusak')
    expect(loadUnderlay('y')).toBeNull()
    setUnderlay(null)
    expect(loadUnderlay('a')).toBeNull()
  })
})
