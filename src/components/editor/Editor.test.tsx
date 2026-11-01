// @vitest-environment jsdom
// Tes komponen editor: dirender utuh di jsdom, dijalankan lewat event seperti pengguna (klik kanvas, tombol, keyboard).
// Tampilan 3D tidak ikut (WebGL tidak ada di jsdom); logikanya dites di src/lib.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Editor } from './Editor'
import { useProject } from '@/lib/store'
import { emptyProject } from '@/lib/project'

// Link Next butuh router aplikasi; di sini cukup tautan biasa.
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }))

// Tampilan awal editor: 1 m = 50 px, titik (0, 0) di piksel (80, 80).
const px = (m: number) => 80 + m * 50
const canvas = () => screen.getByRole('application')
const click = (x: number, y: number) => {
  fireEvent.pointerDown(canvas(), { clientX: px(x), clientY: px(y), button: 0, pointerId: 1, pointerType: 'mouse' })
  fireEvent.pointerUp(canvas(), { clientX: px(x), clientY: px(y), button: 0, pointerId: 1, pointerType: 'mouse' })
}
const key = (k: string, opts: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(window, { key: k, ...opts })
const walls = () => useProject.getState().project.walls

beforeEach(() => {
  act(() => useProject.getState().replace(emptyProject()))
  render(<Editor />)
})
afterEach(cleanup)

describe('editor denah', () => {
  it('menggambar dinding berurutan dengan alat Dinding', () => {
    click(0, 0)
    click(4, 0)
    click(4, 3)
    expect(walls().map((w) => [w.a, w.b])).toEqual([
      [[0, 0], [4, 0]],
      [[4, 0], [4, 3]],
    ])
  })

  it('memilih dinding, membaginya dari inspector, lalu Ctrl+Z mengurungkan', () => {
    click(0, 0)
    click(4, 0)
    key('Escape')
    key('v')
    fireEvent.pointerDown(document.querySelector('g.wall')!, { clientX: px(2), clientY: px(0), button: 0, pointerId: 1 })
    fireEvent.pointerUp(canvas(), { clientX: px(2), clientY: px(0), button: 0, pointerId: 1 })
    expect(screen.getByRole('heading', { name: 'Dinding' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bagi di tengah' }))
    expect(walls()).toHaveLength(2)
    expect(walls()[0].b).toEqual([2, 0])
    key('z', { ctrlKey: true })
    expect(walls()).toHaveLength(1)
  })

  it('angka di luar batas ditolak dan tidak masuk ke denah', () => {
    click(0, 0)
    click(4, 0)
    key('Escape')
    key('v')
    fireEvent.pointerDown(document.querySelector('g.wall')!, { clientX: px(2), clientY: px(0), button: 0, pointerId: 1 })
    fireEvent.pointerUp(canvas(), { clientX: px(2), clientY: px(0), button: 0, pointerId: 1 })
    const thick = screen.getByLabelText('Tebal (m)') as HTMLInputElement
    fireEvent.change(thick, { target: { value: '5' } })
    expect(screen.getByText(/Isi angka 0.05 sampai 1/)).toBeTruthy()
    fireEvent.blur(thick)
    expect(walls()[0].thickness).toBe(0.15)
    fireEvent.change(thick, { target: { value: '0,2' } })
    fireEvent.blur(thick)
    expect(walls()[0].thickness).toBe(0.2)
  })

  it('alat Teks menaruh catatan yang isinya diubah dari inspector', () => {
    key('t')
    click(1, 1)
    const input = screen.getByLabelText('Isi') as HTMLInputElement
    expect(document.activeElement).toBe(input) // catatan baru langsung siap diketik
    fireEvent.change(input, { target: { value: 'Taman' } })
    fireEvent.blur(input)
    expect(useProject.getState().project.notes).toMatchObject([{ a: [1, 1], text: 'Taman' }])
  })

  it('keyboard saja: menggambar dinding dengan panah dan Enter', () => {
    const c = canvas()
    c.focus()
    const press = (k: string, opts: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(c, { key: k, ...opts })
    // Kursor mulai di (0, 0) karena denah masih kosong; 0,25 m per langkah, Shift 1 m.
    press('Enter')
    press('ArrowRight', { shiftKey: true })
    press('ArrowRight', { shiftKey: true })
    press('ArrowRight')
    press('Enter')
    expect(walls().map((w) => [w.a, w.b])).toEqual([[[0, 0], [2.25, 0]]])
    expect(screen.getByText(/Titik ditaruh di x 2,25/)).toBeTruthy()
  })

  it('keyboard saja: memilih dengan ] lalu menggeser dengan panah, diumumkan ke pembaca layar', () => {
    click(0, 0)
    click(4, 0)
    key('Escape')
    key('v')
    const c = canvas()
    c.focus()
    fireEvent.keyDown(c, { key: ']' })
    expect(screen.getByText(/Dinding 4,00 m dipilih/)).toBeTruthy()
    fireEvent.keyDown(c, { key: 'ArrowDown', shiftKey: true })
    expect(walls()[0].a).toEqual([0, 0.5])
    expect(screen.getByText(/digeser 0,50 m/)).toBeTruthy()
    // Tanpa pilihan, panah tidak mengubah denah (menggeser tampilan saja).
    key('Escape')
    fireEvent.keyDown(c, { key: 'ArrowDown' })
    expect(walls()[0].a).toEqual([0, 0.5])
  })

  it('alat Ukur membuat garis ukur dari dua klik', () => {
    key('m')
    click(0, 2)
    click(3, 2)
    expect(useProject.getState().project.notes).toMatchObject([{ a: [0, 2], b: [3, 2] }])
    expect(screen.getByText('Panjang 3.00 m')).toBeTruthy()
  })
})
