// Gambar latar untuk dijiplak (foto atau scan denah lama). Disimpan di browser per proyek, bukan di dalam
// proyek: foto bisa ratusan KB dan akan membengkakkan tautan bagikan serta file cadangan.
// Posisi dalam meter denah: x, y = pojok kiri atas, width = lebar gambar di dunia nyata.

import { create } from 'zustand'

export type Underlay = { src: string; aspect: number; x: number; y: number; width: number; opacity: number; hidden?: boolean }

const key = (projectId: string) => `denahin:latar:${projectId}`

export function loadUnderlay(projectId: string): Underlay | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(projectId)) ?? 'null')
    return raw && typeof raw.src === 'string' && raw.src.startsWith('data:image/') && raw.width > 0 && raw.aspect > 0 ? raw : null
  } catch {
    return null
  }
}

type State = { projectId: string | null; underlay: Underlay | null; error: string | null }
export const useUnderlay = create<State>(() => ({ projectId: null, underlay: null, error: null }))

export function openUnderlay(projectId: string | null) {
  useUnderlay.setState({ projectId, underlay: projectId ? loadUnderlay(projectId) : null, error: null })
}

export function setUnderlay(u: Underlay | null) {
  const { projectId } = useUnderlay.getState()
  useUnderlay.setState({ underlay: u, error: null })
  if (!projectId) return
  try {
    if (u) localStorage.setItem(key(projectId), JSON.stringify(u))
    else localStorage.removeItem(key(projectId))
  } catch {
    useUnderlay.setState({ error: 'Penyimpanan browser penuh: gambar latar hanya ada sampai halaman ditutup.' })
  }
}

// Foto diperkecil ke sisi terpanjang 2000 px dan disimpan sebagai JPEG, cukup tajam untuk dijiplak
// dan tetap kecil untuk penyimpanan browser (batas umum 5 MB).
export async function readImage(file: File): Promise<{ src: string; aspect: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Pilih file gambar (JPG atau PNG). PDF dan DXF belum didukung.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) })
    const g = canvas.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { src: canvas.toDataURL('image/jpeg', 0.8), aspect: img.naturalHeight / img.naturalWidth }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Kalibrasi dua titik: jarak sebenarnya antara dua titik di gambar mengubah lebar gambar,
// dengan titik pertama tetap di tempat.
export function calibrate(u: Underlay, a: [number, number], b: [number, number], meters: number): Underlay {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (!(d > 0) || !(meters > 0)) return u
  const k = meters / d
  return { ...u, width: u.width * k, x: a[0] - (a[0] - u.x) * k, y: a[1] - (a[1] - u.y) * k }
}
