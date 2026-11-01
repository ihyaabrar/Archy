// Bentuk 3D furnitur dari balok-balok sederhana, cukup untuk membaca jenis dan skala ruang saat room tour.
// Koordinat lokal sama dengan simbol 2D (furniture.ts): x sepanjang lebar, z sepanjang dalam (= y lokal denah),
// sisi belakang di -z. y = tinggi dari lantai. Ukuran mengikuti w/d/h, jadi ukuran khusus tetap proporsional.

import type { FurnitureKind } from './furniture'

// Warna bahan: netral dan redup supaya tidak bersaing dengan material dinding dan lantai.
export const TONES = {
  wood: '#a98563',
  fabric: '#8e9088',
  white: '#efebe3',
  dark: '#4a4440',
  body: '#d6c8b0',
  leaf: '#7d8c63',
  clay: '#a5654a',
  canopy: '#b9c6c8', // polikarbonat/kaca buram
} as const
export type Tone = keyof typeof TONES

// Balok lokal: pusat (x, y, z) dan ukuran (sx, sy, sz).
export type Block = { x: number; y: number; z: number; sx: number; sy: number; sz: number; tone: Tone }

const box = (x: number, y0: number, z: number, sx: number, sy: number, sz: number, tone: Tone): Block => ({ x, y: y0 + sy / 2, z, sx, sy, sz, tone })

// Kursi makan menghadap ke arah `face` (+1 = menghadap +z): dudukan 42 cm, sandaran di sisi luar.
function chair(x: number, z: number, face: 1 | -1): Block[] {
  return [box(x, 0, z, 0.4, 0.45, 0.4, 'wood'), box(x, 0.45, z - face * 0.18, 0.4, 0.45, 0.04, 'wood')]
}

function table(w: number, d: number, h: number): Block[] {
  const leg = (sx: 1 | -1, sz: 1 | -1) => box(sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 0.05, h - 0.03, 0.05, 'wood')
  return [box(0, h - 0.03, 0, w, 0.03, d, 'wood'), leg(-1, -1), leg(1, -1), leg(-1, 1), leg(1, 1)]
}

export function blocks(kind: FurnitureKind, w: number, d: number, h: number): Block[] {
  const x = w / 2
  const z = d / 2
  switch (kind) {
    case 'bed2':
    case 'bed1': {
      const pillows = kind === 'bed2' ? [-w / 4, w / 4] : [0]
      return [
        box(0, 0, 0, w, h * 0.55, d, 'wood'),
        box(0, h * 0.55, 0.03, w - 0.04, h * 0.45, d - 0.1, 'white'),
        box(0, 0, -z + 0.03, w, 1.0, 0.06, 'wood'), // kepala kasur
        ...pillows.map((px) => box(px, h, -z + 0.27, Math.min(0.6, w / pillows.length - 0.1), 0.1, 0.35, 'white')),
      ]
    }
    case 'wardrobe':
      // Badan lemari dan dua daun pintu yang sedikit menonjol di depan.
      return [box(0, 0, -0.01, w, h, d - 0.02, 'wood'), box(-x / 2, 0.05, z - 0.01, x - 0.02, h - 0.1, 0.02, 'body'), box(x / 2, 0.05, z - 0.01, x - 0.02, h - 0.1, 0.02, 'body')]
    case 'desk':
      return [...table(w, d, h), ...chair(0, z + 0.22, -1)]
    case 'dining':
      return [...table(w, d, h), ...[-0.5, 0, 0.5].flatMap((cx) => [...chair(cx, -z - 0.25, 1), ...chair(cx, z + 0.25, -1)])]
    case 'sofa':
    case 'armchair': {
      const arm = Math.min(0.2, w / 5)
      return [
        box(0, 0, 0.05, w - 2 * arm, 0.42, d - 0.1, 'fabric'), // dudukan
        box(0, 0, -z + 0.1, w, h, 0.2, 'fabric'), // sandaran
        box(-x + arm / 2, 0, 0.05, arm, 0.6, d - 0.1, 'fabric'),
        box(x - arm / 2, 0, 0.05, arm, 0.6, d - 0.1, 'fabric'),
      ]
    }
    case 'kitchen':
      // Kabinet bawah dan meja dapur yang sedikit menjorok ke depan.
      return [box(0, 0, -0.02, w, h - 0.04, d - 0.04, 'white'), box(0, h - 0.04, 0, w, 0.04, d, 'dark')]
    case 'fridge':
      return [box(0, 0, 0, w, h, d, 'white'), box(x - 0.08, h * 0.45, z + 0.015, 0.03, 0.4, 0.03, 'dark')]
    case 'toilet':
      return [box(0, 0, -z + 0.1, w, h + 0.35, 0.2, 'white'), box(0, 0, 0.08, w * 0.85, h, d - 0.25, 'white')]
    case 'sink':
      return [box(0, 0, -z + 0.1, 0.16, h - 0.15, 0.16, 'white'), box(0, h - 0.15, 0, w, 0.15, d, 'white')]
    case 'bathtub': {
      const t = 0.07
      return [
        box(0, 0, 0, w, 0.1, d, 'white'),
        box(-x + t / 2, 0, 0, t, h, d, 'white'),
        box(x - t / 2, 0, 0, t, h, d, 'white'),
        box(0, 0, -z + t / 2, w - 2 * t, h, t, 'white'),
        box(0, 0, z - t / 2, w - 2 * t, h, t, 'white'),
      ]
    }
    case 'shower':
      return [box(0, 0, 0, w, h, d, 'white')]
    case 'vanity':
      return [...table(w, d, h), box(0, h, -z + 0.03, 0.6, 0.8, 0.03, 'white')]
    case 'tv':
      return [box(0, 0, 0, w, h, d, 'wood'), box(0, h, -z + 0.08, Math.min(1.25, w - 0.2), 0.72, 0.05, 'dark')]
    case 'washer':
      return [box(0, 0, 0, w, h, d, 'white'), box(0, h * 0.35, z, w * 0.55, w * 0.55, 0.02, 'dark')]
    case 'plant':
      return [box(0, 0, 0, w * 0.6, 0.4, d * 0.6, 'clay'), box(0, 0.4, 0, w, h - 0.4, d, 'leaf')]
    case 'tree':
      // Batang dan dua lapis tajuk.
      return [box(0, 0, 0, 0.25, h * 0.45, 0.25, 'wood'), box(0, h * 0.35, 0, w * 0.75, h * 0.4, d * 0.75, 'leaf'), box(0, h * 0.6, 0, w * 0.5, h * 0.35, d * 0.5, 'leaf')]
    case 'car':
      return [box(0, 0.15, 0, w, h * 0.45, d, 'dark'), box(0, 0.15 + h * 0.45, 0.2, w - 0.2, h * 0.4, d * 0.5, 'canopy')]
    case 'column':
      return [box(0, 0, 0, w, h, d, 'white')]
    case 'canopy':
      // Atap tipis miring 5 % ke depan di atas tinggi pasang, dua tiang besi di sudut depan.
      return [box(0, h, 0, w, 0.06, d, 'canopy'), box(-x + 0.05, 0, z - 0.05, 0.08, h, 0.08, 'dark'), box(x - 0.05, 0, z - 0.05, 0.08, h, 0.08, 'dark')]
    case 'stairs':
    case 'stairsU':
      return [] // dibuat terpisah di mesh.ts (anak tangga mengikuti tinggi antar lantai)
  }
}
