// Katalog furnitur: ukuran umum di Indonesia (meter), simbol 2D ala gambar kerja, dan jejak untuk tabrakan.
// Koordinat lokal: pusat di (0,0), lebar w di sumbu x, dalam d di sumbu y. Sisi "belakang" (sandaran, kepala kasur, tangki) di -y.

import type { Point } from './project'

export const CATALOG = {
  bed2: { label: 'Kasur 160×200', group: 'Kamar', w: 1.6, d: 2.0, h: 0.5 },
  bed1: { label: 'Kasur 100×200', group: 'Kamar', w: 1.0, d: 2.0, h: 0.5 },
  wardrobe: { label: 'Lemari', group: 'Kamar', w: 1.2, d: 0.6, h: 2.0 },
  desk: { label: 'Meja kerja', group: 'Kamar', w: 1.2, d: 0.6, h: 0.75 },
  sofa: { label: 'Sofa 3 dudukan', group: 'Ruang tamu', w: 2.0, d: 0.9, h: 0.8 },
  armchair: { label: 'Kursi santai', group: 'Ruang tamu', w: 0.8, d: 0.8, h: 0.8 },
  dining: { label: 'Meja makan 6 kursi', group: 'Ruang makan', w: 1.6, d: 0.9, h: 0.75 },
  kitchen: { label: 'Kitchen set', group: 'Dapur', w: 2.4, d: 0.6, h: 0.9 },
  fridge: { label: 'Kulkas', group: 'Dapur', w: 0.7, d: 0.7, h: 1.8 },
  toilet: { label: 'Kloset duduk', group: 'Kamar mandi', w: 0.4, d: 0.7, h: 0.4 },
  sink: { label: 'Wastafel', group: 'Kamar mandi', w: 0.6, d: 0.45, h: 0.85 },
  shower: { label: 'Area shower', group: 'Kamar mandi', w: 0.9, d: 0.9, h: 0.05 },
  bathtub: { label: 'Bak mandi', group: 'Kamar mandi', w: 0.75, d: 1.7, h: 0.55 },
  vanity: { label: 'Meja rias', group: 'Kamar', w: 1.0, d: 0.45, h: 0.75 },
  tv: { label: 'Meja TV', group: 'Ruang tamu', w: 1.8, d: 0.45, h: 0.5 },
  washer: { label: 'Mesin cuci', group: 'Servis', w: 0.6, d: 0.6, h: 0.85 },
  plant: { label: 'Tanaman pot', group: 'Luar', w: 0.5, d: 0.5, h: 1.2 },
  // Kanopi: h = tinggi pasang. Sisi belakang (-y) menempel dinding, dua tiang di sisi depan.
  canopy: { label: 'Kanopi', group: 'Luar', w: 3.0, d: 2.0, h: 2.7 },
  tree: { label: 'Pohon', group: 'Luar', w: 3.0, d: 3.0, h: 5.0 },
  car: { label: 'Mobil', group: 'Luar', w: 1.8, d: 4.5, h: 1.5 },
  column: { label: 'Kolom 30×30', group: 'Struktur', w: 0.3, d: 0.3, h: 3.0 },
  // Tangga naik ke arah -y (sisi "belakang"), 17 anak tangga untuk tinggi antar lantai 3,2 m.
  stairs: { label: 'Tangga lurus', group: 'Struktur', w: 1.0, d: 4.2, h: 3.2 },
  // Tangga U: naik di separuh kanan dari +y ke bordes di -y, lalu balik di separuh kiri sampai +y.
  stairsU: { label: 'Tangga U dengan bordes', group: 'Struktur', w: 2.2, d: 3.0, h: 3.2 },
} as const

export const STAIR_STEPS = 17
// Tangga U: jumlah anak tangga lengan pertama (sebelum bordes) dan dalam bordes (meter).
export const U_FIRST = 8
export const uLanding = (w: number, d: number) => Math.min(w / 2, d / 2)

export type FurnitureKind = keyof typeof CATALOG
// rot dalam derajat, searah jarum jam di denah. w/d opsional: ukuran khusus, kalau kosong pakai ukuran katalog.
export type Furniture = { id: string; kind: FurnitureKind; pos: Point; rot: number; w?: number; d?: number; level?: string }

export const dims = (f: Pick<Furniture, 'kind' | 'w' | 'd'>) => ({ ...CATALOG[f.kind], w: f.w ?? CATALOG[f.kind].w, d: f.d ?? CATALOG[f.kind].d })

export const isKind = (k: unknown): k is FurnitureKind => typeof k === 'string' && k in CATALOG

// Titik lokal ke koordinat denah.
export function toPlan(f: Furniture, [x, y]: Point): Point {
  const r = (f.rot * Math.PI) / 180
  return [f.pos[0] + x * Math.cos(r) - y * Math.sin(r), f.pos[1] + x * Math.sin(r) + y * Math.cos(r)]
}

export function footprint(f: Furniture): Point[] {
  const { w, d } = dims(f)
  return ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as Point[]).map((p) => toPlan(f, p))
}

const rect = (x0: number, y0: number, x1: number, y1: number) => `M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`
const circle = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`

// Garis-garis simbol (path SVG di koordinat lokal). Garis luar selalu ada; detail menunjukkan jenis dan arah.
export function symbol(kind: FurnitureKind, w: number = CATALOG[kind].w, d: number = CATALOG[kind].d): string[] {
  const x = w / 2
  const y = d / 2
  const outline = rect(-x, -y, x, y)
  switch (kind) {
    case 'bed2':
      return [outline, rect(-x + 0.1, -y + 0.1, -0.05, -y + 0.45), rect(0.05, -y + 0.1, x - 0.1, -y + 0.45), `M ${-x} ${-y + 0.6} H ${x}`]
    case 'bed1':
      return [outline, rect(-x + 0.1, -y + 0.1, x - 0.1, -y + 0.45), `M ${-x} ${-y + 0.6} H ${x}`]
    case 'wardrobe':
      return [outline, `M ${-x} ${-y} L ${x} ${y} M ${x} ${-y} L ${-x} ${y}`]
    case 'desk':
      return [outline, rect(-0.25, y - 0.05, 0.25, y + 0.4)]
    case 'sofa':
      return [outline, `M ${-x} ${-y + 0.25} H ${x}`, `M ${-x + 0.2} ${-y + 0.25} V ${y} M ${x - 0.2} ${-y + 0.25} V ${y}`, `M ${-0.3} ${-y + 0.25} V ${y} M 0.3 ${-y + 0.25} V ${y}`]
    case 'armchair':
      return [outline, `M ${-x} ${-y + 0.2} H ${x}`, `M ${-x + 0.15} ${-y + 0.2} V ${y} M ${x - 0.15} ${-y + 0.2} V ${y}`]
    case 'dining': {
      const chairs = [-0.5, 0, 0.5].flatMap((cx) => [rect(cx - 0.2, -y - 0.45, cx + 0.2, -y - 0.05), rect(cx - 0.2, y + 0.05, cx + 0.2, y + 0.45)])
      return [outline, ...chairs]
    }
    case 'kitchen':
      return [outline, rect(-x + 0.25, -y + 0.1, -x + 0.85, y - 0.1), circle(x - 0.55, -0.12, 0.1), circle(x - 0.25, -0.12, 0.1), circle(x - 0.55, 0.15, 0.08), circle(x - 0.25, 0.15, 0.08)]
    case 'fridge':
      return [outline, `M ${-x} ${-y} L ${x} ${y}`, `M ${-x} ${y - 0.08} H ${x}`]
    case 'toilet':
      return [rect(-x, -y, x, -y + 0.2), ellipse(0, 0.1, 0.18, 0.25)]
    case 'sink':
      return [outline, ellipse(0, 0.04, 0.2, 0.14), circle(0, -y + 0.07, 0.025)]
    case 'shower':
      return [outline, `M ${-x} ${-y} L ${x} ${y} M ${x} ${-y} L ${-x} ${y}`, circle(0, 0, 0.04)]
    case 'stairs': {
      // Garis anak tangga + panah arah naik (konvensi gambar kerja), dari kaki tangga (+y) ke atas (-y).
      const steps = Array.from({ length: STAIR_STEPS - 1 }, (_, k) => {
        const yy = y - ((k + 1) * d) / STAIR_STEPS
        return `M ${-x} ${yy} H ${x}`
      })
      return [outline, ...steps, `M 0 ${y - 0.15} V ${-y + 0.2} M -0.12 ${-y + 0.35} L 0 ${-y + 0.2} L 0.12 ${-y + 0.35}`]
    }
    case 'vanity':
      return [outline, rect(-0.3, -y, 0.3, -y + 0.04), circle(0, y + 0.25, 0.18)]
    case 'tv':
      return [outline, rect(-0.6, -y + 0.05, 0.6, -y + 0.1)]
    case 'washer':
      return [outline, circle(0, 0.03, 0.2), `M ${-x} ${-y + 0.1} H ${x}`]
    case 'plant':
      return [circle(0, 0, Math.min(x, y)), circle(0, 0, Math.min(x, y) * 0.5), `M ${-x * 0.7} 0 H ${x * 0.7} M 0 ${-y * 0.7} V ${y * 0.7}`]
    case 'tree': {
      // Tajuk bergelombang dan ranting, sama dengan pohon di lembar tapak.
      const r = Math.min(x, y)
      let crown = ''
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * Math.PI * 2
        const [px, py] = [Math.cos(t) * r, Math.sin(t) * r]
        crown += i === 0 ? `M ${px} ${py}` : ` A ${r * 0.32} ${r * 0.32} 0 0 1 ${px} ${py}`
      }
      const spokes = [0, 1, 2, 3, 4, 5].map((i) => {
        const t = (i / 6) * Math.PI * 2 + 0.3
        return `M 0 0 L ${Math.cos(t) * r * 0.6} ${Math.sin(t) * r * 0.6}`
      })
      return [crown, ...spokes, circle(0, 0, 0.08)]
    }
    case 'car':
      return [
        `M ${-x} ${-y + 0.35} Q ${-x} ${-y} ${-x + 0.35} ${-y} H ${x - 0.35} Q ${x} ${-y} ${x} ${-y + 0.35} V ${y - 0.35} Q ${x} ${y} ${x - 0.35} ${y} H ${-x + 0.35} Q ${-x} ${y} ${-x} ${y - 0.35} Z`,
        `M ${-x + 0.15} ${-y * 0.4} Q 0 ${-y * 0.52} ${x - 0.15} ${-y * 0.4} L ${x - 0.2} ${y * 0.4} Q 0 ${y * 0.47} ${-x + 0.2} ${y * 0.4} Z`,
      ]
    case 'column':
      return [outline] // diisi hitam (poché) di denah, lihat .furn-col
    case 'canopy':
      // Benda di atas kepala: garis putus-putus (lihat .furn-over), silang menandai bidang atap, dua tiang di depan.
      return [outline, `M ${-x} ${-y} L ${x} ${y} M ${x} ${-y} L ${-x} ${y}`, rect(-x, y - 0.1, -x + 0.1, y), rect(x - 0.1, y - 0.1, x, y)]
    case 'stairsU': {
      const L = uLanding(w, d)
      const run = d - L
      const n2 = STAIR_STEPS - U_FIRST
      const treads = [
        ...Array.from({ length: U_FIRST - 1 }, (_, k) => `M 0 ${y - ((k + 1) * run) / U_FIRST} H ${x}`),
        ...Array.from({ length: n2 - 1 }, (_, k) => `M ${-x} ${-y + L + ((k + 1) * run) / n2} H 0`),
      ]
      // Panah naik: lengan kanan ke bordes, menyeberang, lengan kiri ke puncak.
      const arrow = `M ${x / 2} ${y - 0.15} V ${-y + L / 2} H ${-x / 2} V ${y - 0.2} M ${-x / 2 - 0.12} ${y - 0.35} L ${-x / 2} ${y - 0.2} L ${-x / 2 + 0.12} ${y - 0.35}`
      return [outline, `M 0 ${y} V ${-y + L}`, `M ${-x} ${-y + L} H ${x}`, ...treads, arrow]
    }
    case 'bathtub':
      return [outline, `M ${-x + 0.08} ${-y + 0.3} Q ${-x + 0.08} ${y - 0.08} 0 ${y - 0.08} Q ${x - 0.08} ${y - 0.08} ${x - 0.08} ${-y + 0.3} Q ${x - 0.08} ${-y + 0.08} 0 ${-y + 0.08} Q ${-x + 0.08} ${-y + 0.08} ${-x + 0.08} ${-y + 0.3} Z`]
  }
}

// Kelompok untuk daftar pilihan di panel, mengikuti urutan katalog.
export const GROUPS = Object.entries(CATALOG).reduce<Record<string, FurnitureKind[]>>((acc, [k, v]) => {
  ;(acc[v.group] ??= []).push(k as FurnitureKind)
  return acc
}, {})
