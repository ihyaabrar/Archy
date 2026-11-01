import type { Level, Opening, Point, Project, Room, Wall } from './project'
import type { WallKey } from './materials'
import type { Furniture } from './furniture'
import type { Site } from './drawing'

// Denah rumah contoh untuk lembar gambar di halaman depan: selalu sama, tidak ikut proyek pengguna.
// Rumah tropis dua lantai di lahan 15 × 24,5 m. Bangunan 13 × 16,5 m, KDB ±58 %.
// Lantai 1: publik dan servis (carport, teras, foyer, ruang tamu, ruang keluarga dengan void, dapur, kamar tamu, mushola, ART).
// Lantai 2: privat (kamar utama dengan KM dan walk-in closet, dua kamar anak, ruang santai, balkon depan, area jemur).
// As struktur: x 0 / 6 / 9,5 / 13, y 0 / 4,5 / 8 / 11 / 16,5. Utara = atas gambar, jalan di selatan.
// Rencana lengkap: docs/rumah-contoh.md.

const EXT = 0.2
const INT = 0.12
const RAIL = 0.08 // pagar balkon, void, dan lubang tangga: dinding rendah 1 m
const FENCE = 0.15 // pagar depan 1,6 m
const H = 3

export const LEVELS: Level[] = [
  { id: 'L1', name: 'Lantai 1', elevation: 0 },
  { id: 'L2', name: 'Lantai 2', elevation: 3.2 },
]

type Spec = { kind: 'door' | 'window'; at: number; width: number; style?: Opening['style']; sill?: number; height?: number }
const D = (at: number, width = 0.9, style?: Opening['style']): Spec => ({ kind: 'door', at, width, style })
const W = (at: number, width = 1.2, style?: Opening['style'], sill = 0.9, height = 1.4): Spec => ({ kind: 'window', at, width, style, sill, height })
const HIGH = (at: number, width = 0.6): Spec => W(at, width, 'louvre', 1.6, 0.6)
// Kaca mati lantai ke plafon (void, ruang tamu).
const G = (at: number, width = 2): Spec => W(at, width, 'fixed', 0.1, 2.6)

const walls: Wall[] = []
const openings: Opening[] = []
// Dinding dari a ke b, bukaan ditulis dengan koordinat mutlak (x untuk dinding mendatar, y untuk dinding tegak).
function wall(level: string, id: string, a: Point, b: Point, thickness: number, ...specs: Spec[]) {
  walls.push({ id, a, b, thickness, height: thickness === RAIL ? 1 : thickness === FENCE ? 1.6 : H, level })
  const k = a[1] === b[1] ? 0 : 1
  specs.forEach((s, i) =>
    openings.push({
      id: `${id}-${i}`,
      wallId: id,
      at: Math.abs(s.at - a[k]),
      width: s.width,
      kind: s.kind,
      sill: s.sill ?? 0,
      height: s.height ?? 2.2,
      ...(s.style && { style: s.style }),
    }),
  )
}
type Args = [id: string, a: Point, b: Point, thickness: number, ...specs: Spec[]]
const w1 = (...a: Args) => wall('L1', ...a)
const w2 = (...a: Args) => wall('L2', ...a)
// Pagar kaca: satu panel kaca mati di antara dua tiang 10 cm, rel atas 5 cm.
const glass = (a: Point, b: Point): Spec => {
  const k = a[1] === b[1] ? 0 : 1
  return W((a[k] + b[k]) / 2, Math.round((Math.abs(b[k] - a[k]) - 0.2) * 100) / 100, 'fixed', 0.1, 0.85)
}

// ---------- Lantai 1 ----------
// Keliling
w1('a0', [0, 0], [13, 0], EXT, W(3, 2.4), W(7.75, 1.2, 'louvre'), W(10.5, 0.8), HIGH(12.25))
w1('a13', [13, 0], [13, 16.5], EXT, HIGH(1.5), W(5.5, 1.6), HIGH(9.5, 0.6), W(13.75, 2.4))
w1('a165', [9.5, 16.5], [13, 16.5], EXT, W(11.25, 2.4))
w1('a0w', [0, 0], [0, 11], EXT, W(2.25, 1.6), W(7.75, 2.4))
w1('a0c', [0, 11], [0, 16.5], EXT) // dinding batas carport ke tetangga
// Dalam
w1('b25', [6, 2.5], [9.5, 2.5], INT, D(7.75, 0.9))
w1('b3', [9.5, 3], [13, 3], INT)
w1('b8', [9.5, 8], [13, 8], INT)
w1('b11a', [0, 11], [6, 11], INT, D(1.5, 0.9))
w1('b11b', [6, 11], [9.5, 11], INT, D(8.3, 1.6, 'double'))
w1('b11c', [9.5, 11], [13, 11], INT, D(12.25, 0.7))
w1('b135', [6, 13.5], [9.5, 13.5], EXT, D(7.75, 1.4, 'double'))
w1('c6a', [6, 0], [6, 2.5], INT, D(1.25, 0.8))
w1('c6b', [6, 6.3], [6, 11], INT) // dinding di belakang tangga
w1('c6c', [6, 11], [6, 13.5], INT, D(12.25, 0.9))
w1('c95', [9.5, 0], [9.5, 16.5], INT, D(1.3, 0.8), D(5, 0.9), D(9.5, 0.8), D(12.25, 1.2, 'double'), W(15, 1.6))
w1('c115a', [11.5, 0], [11.5, 3], INT, D(1.5, 0.7))
w1('c115b', [11.5, 8], [11.5, 11], INT)

// ---------- Lantai 2 ----------
w2('d0a', [0, 0], [6, 0], EXT, W(3, 2.4))
w2('d0b', [6, 0], [9.5, 0], RAIL)
w2('d0c', [9.5, 0], [13, 0], EXT, W(11.25, 1.6))
w2('d0w', [0, 0], [0, 16.5], EXT, W(2.25, 1.6), G(6.25, 2.4), HIGH(9.5), W(13.75, 2.4))
w2('d13', [13, 0], [13, 14.5], EXT, W(2.25, 1.2), W(6.5, 1.2), HIGH(9.75), W(12.75, 1.6))
w2('d13r', [13, 14.5], [13, 16.5], RAIL, glass([13, 14.5], [13, 16.5]))
w2('d165a', [0, 16.5], [6, 16.5], EXT, W(3, 2.4))
w2('d165b', [6, 16.5], [13, 16.5], RAIL, glass([6, 16.5], [13, 16.5]))
w2('e25', [6, 2.5], [9.5, 2.5], INT, D(7.75, 0.9))
w2('e45a', [0, 4.5], [6, 4.5], INT, G(3, 3))
w2('e45b', [9.5, 4.5], [13, 4.5], INT)
w2('e8', [0, 8], [6, 8], INT)
w2('e85', [9.5, 8.5], [13, 8.5], INT)
w2('e11a', [0, 11], [6, 11], INT, D(2.4, 0.8), D(4.5, 0.8))
w2('e11b', [9.5, 11], [13, 11], INT)
w2('e145', [6, 14.5], [13, 14.5], INT, D(7.75, 2.4, 'sliding'), D(11.25, 2.4, 'sliding'))
w2('f6a', [6, 0], [6, 4.5], INT, D(3.5, 0.9))
w2('f6v', [6, 4.5], [6, 8], RAIL, glass([6, 4.5], [6, 8])) // pagar void
w2('f6b', [6, 8], [6, 11], INT)
w2('f6c', [6, 11], [6, 16.5], INT, D(12.5, 0.9), D(15.5, 1.6, 'sliding'))
w2('f3', [3, 8], [3, 11], INT)
w2('f95', [9.5, 0], [9.5, 11], INT, D(3.5, 0.9), D(6.5, 0.9), D(9.75, 0.8))
// Pagar lubang tangga (tangga naik ke utara, tiba di y 6,3).
w2('g71', [7.15, 6.3], [7.15, 10.5], RAIL, glass([7.15, 6.3], [7.15, 10.5]))
w2('g105', [6, 10.5], [7.15, 10.5], RAIL, glass([6, 10.5], [7.15, 10.5]))

// Pagar depan di garis batas lahan, celahnya pintu pagar mobil (x 0–6) dan pejalan kaki (x 7,1–8,4).
w1('p1', [-1, 21.5], [0, 21.5], FENCE)
w1('p2', [6, 21.5], [7.1, 21.5], FENCE)
w1('p3', [8.4, 21.5], [14, 21.5], FENCE)
w1('p4', [-1, 16.5], [-1, 21.5], FENCE)
w1('p5', [14, 16.5], [14, 21.5], FENCE)

// Aksen fasad depan: bata ekspos di dinding batas carport, ruang tamu, dan pagar; beton ekspos di pintu masuk dan kamar utama.
const FINISH: Record<string, WallKey> = { a0c: 'bata', a165: 'bata', p1: 'bata', p2: 'bata', p3: 'bata', p4: 'bata', p5: 'bata', b135: 'beton', d165a: 'beton' }
for (const w of walls) if (FINISH[w.id]) w.finish = FINISH[w.id]

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const room = (level: string, id: string, name: string, points: Point[], floor?: Room['floor']): Room => ({ id, name, points, level, ...(floor && { floor }) })

const rooms: Room[] = [
  // Lantai 1
  room('L1', 'makan', 'Dapur & Makan', rect(0, 0, 6, 4.5), 'teraso'),
  room('L1', 'keluarga', 'Ruang Keluarga', rect(0, 4.5, 6, 11), 'kayu'),
  room('L1', 'kotor', 'Dapur Kotor & Cuci', rect(6, 0, 9.5, 2.5)),
  room('L1', 'hall1', 'Hall & Tangga', rect(6, 2.5, 9.5, 11), 'teraso'),
  room('L1', 'art', 'Kamar ART', rect(9.5, 0, 11.5, 3)),
  room('L1', 'kmart', 'KM ART', rect(11.5, 0, 13, 3)),
  room('L1', 'tamu2', 'Kamar Tamu', rect(9.5, 3, 13, 8), 'kayu'),
  room('L1', 'mushola', 'Mushola', rect(9.5, 8, 11.5, 11), 'kayu'),
  room('L1', 'kmtamu', 'KM Tamu', rect(11.5, 8, 13, 11)),
  room('L1', 'carport', 'Carport', rect(0, 11, 6, 16.5), 'beton'),
  room('L1', 'foyer', 'Foyer', rect(6, 11, 9.5, 13.5), 'teraso'),
  room('L1', 'teras', 'Teras', rect(6, 13.5, 9.5, 16.5), 'beton'),
  room('L1', 'tamu', 'Ruang Tamu', rect(9.5, 11, 13, 16.5), 'teraso'),
  // Lantai 2
  room('L2', 'kerja', 'Ruang Kerja', rect(0, 0, 6, 4.5), 'kayu'),
  room('L2', 'jemur', 'Area Jemur', rect(6, 0, 9.5, 2.5), 'beton'),
  room('L2', 'hall2', 'Hall', rect(6, 2.5, 9.5, 11), 'teraso'),
  room('L2', 'anak1', 'Kamar Anak 1', rect(9.5, 0, 13, 4.5), 'kayu'),
  room('L2', 'anak2', 'Kamar Anak 2', rect(9.5, 4.5, 13, 8.5), 'kayu'),
  room('L2', 'kmanak', 'KM Anak', rect(9.5, 8.5, 13, 11)),
  room('L2', 'kmutama', 'KM Utama', rect(0, 8, 3, 11)),
  room('L2', 'wic', 'Walk-in Closet', rect(3, 8, 6, 11), 'kayu'),
  room('L2', 'utama', 'Kamar Utama', rect(0, 11, 6, 16.5), 'kayu'),
  room('L2', 'santai', 'Ruang Santai', rect(6, 11, 13, 14.5), 'kayu'),
  room('L2', 'balkon', 'Balkon', rect(6, 14.5, 13, 16.5), 'kayu'),
]

// Ruang luar dan sambungan ruang tanpa dinding (denah terbuka). Dipakai tes "tidak ada dinding bolong".
export const OUTDOOR = ['carport', 'teras', 'jemur', 'balkon']
export const OPEN_PAIRS = [
  ['makan', 'keluarga'],
  ['makan', 'hall1'],
  ['keluarga', 'hall1'],
  ['hall2', 'santai'],
]

// rot: 0 = sisi belakang (sandaran, kepala kasur) ke utara, 90 ke timur, 180 ke selatan, 270 ke barat.
const f = (level: string, id: string, kind: Furniture['kind'], x: number, y: number, rot = 0): Furniture => ({ id, kind, pos: [x, y], rot, level })
const furniture: Furniture[] = [
  // Lantai 1
  f('L1', 'k1', 'kitchen', 3, 0.35),
  f('L1', 'k2', 'fridge', 0.45, 0.45),
  f('L1', 'k3', 'dining', 3, 2.6),
  f('L1', 'k4', 'sofa', 0.5, 7.75, 270),
  f('L1', 'k5', 'armchair', 3.4, 6.2, 90),
  f('L1', 'k6', 'armchair', 3.4, 9.3, 90),
  f('L1', 'k7', 'kitchen', 7.75, 0.35),
  f('L1', 'k8', 'stairs', 6.6, 8.4),
  f('L1', 'k9', 'bed1', 10.95, 1.95),
  f('L1', 'k10', 'toilet', 12.25, 0.45),
  f('L1', 'k11', 'shower', 12.3, 2.4),
  f('L1', 'k12', 'bed2', 11.9, 5.2, 90),
  f('L1', 'k13', 'wardrobe', 11.25, 7.6, 180),
  f('L1', 'k14', 'toilet', 12.6, 8.5, 90),
  f('L1', 'k15', 'sink', 11.75, 9.6, 270),
  f('L1', 'k16', 'sofa', 11.25, 16.05, 180),
  f('L1', 'k17', 'armchair', 10.0, 13.5, 270),
  f('L1', 'k18', 'armchair', 12.5, 13.5, 90),
  // Lantai 2
  f('L2', 'm1', 'desk', 3, 0.4),
  f('L2', 'm2', 'armchair', 1, 3.4, 270),
  f('L2', 'm3', 'bed1', 11.25, 1.1),
  f('L2', 'm4', 'wardrobe', 12.6, 3.6, 90),
  f('L2', 'm5', 'bed1', 11.9, 6.5, 90),
  f('L2', 'm6', 'desk', 10.0, 5.3, 270),
  f('L2', 'm7', 'bathtub', 12.0, 9.75, 90),
  f('L2', 'm8', 'toilet', 10.0, 10.55, 180),
  f('L2', 'm9', 'sink', 10.0, 8.85),
  f('L2', 'm10', 'shower', 0.55, 8.55),
  f('L2', 'm11', 'toilet', 2.55, 8.45),
  f('L2', 'm12', 'sink', 0.33, 10.2, 270),
  f('L2', 'm13', 'wardrobe', 3.35, 9.5, 270),
  f('L2', 'm14', 'wardrobe', 5.65, 9.5, 90),
  f('L2', 'm15', 'bed2', 3, 15.4, 180),
  f('L2', 'm16', 'desk', 0.4, 12.4, 270),
  f('L2', 'm17', 'sofa', 9.5, 11.55),
  f('L2', 'm18', 'armchair', 12.4, 12.75, 90),
]

export const SAMPLE_NAME = 'Rumah Tropis Dua Lantai'

export const SAMPLE: Project = {
  version: 1,
  walls,
  openings,
  rooms,
  furniture,
  levels: LEVELS,
  roof: { type: 'pelana', pitch: 30, overhang: 1, material: 'genteng', ridge: 'auto' },
}

const AXES = { x: [0, 6, 9.5, 13], y: [0, 4.5, 8, 11, 16.5] }
const LOT = rect(-1, -3, 14, 21.5) // lahan 15 × 24,5 m

// Tapak per lantai (hanya untuk lembar gambar, tidak masuk model 3D).
export const SAMPLE_SITE: Record<string, Site> = {
  L1: {
    axes: AXES,
    boundary: LOT,
    // Rumput dulu, perkerasan menimpanya.
    lawns: [rect(-1, 16.5, 14, 21.5), rect(-1, -3, 14, 0), rect(13, 0, 14, 16.5)],
    paving: [rect(0, 16.5, 6, 21.5), rect(7.1, 16.5, 8.4, 21.5)],
    trees: [
      { at: [11.5, 19.2], r: 1.5 },
      { at: [2.5, -1.6], r: 1.2 },
      { at: [9, -1.7], r: 1.1 },
    ],
    cars: [
      { at: [1.6, 13.8], rot: 0 },
      { at: [4.4, 13.8], rot: 0 },
    ],
    columns: [[0.1, 16.4], [5.9, 16.4], [6.1, 16.4]],
    gates: [
      { a: [0, 21.5], b: [6, 21.5] },
      { a: [7.1, 21.5], b: [8.4, 21.5] },
    ],
    labels: [
      { at: [10.5, 20.6], text: 'Taman Depan' },
      { at: [6.5, -1.5], text: 'Taman Belakang' },
    ],
  },
  L2: {
    axes: AXES,
    boundary: LOT,
    voids: [rect(0, 4.5, 6, 8)],
    labels: [{ at: [3, 6.1], text: 'Void', sub: 'terbuka ke R. Keluarga' }],
  },
}
