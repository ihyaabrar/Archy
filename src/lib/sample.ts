import type { Opening, Point, Project, Room, Wall } from './project'
import type { Furniture } from './furniture'
import type { Site } from './drawing'

// Denah rumah contoh untuk lembar gambar di halaman depan: selalu sama, tidak ikut proyek pengguna.
// Rumah tropis satu lantai ±400 m² dengan taman tengah. Program ruang mengikuti kebiasaan rumah di Indonesia:
// zona privat di utara (kamar utama dengan walk-in closet dan KM ber-bathtub, dua kamar anak, KM anak),
// zona servis di barat (cuci-jemur, kamar dan KM ART, dapur kotor, gudang, pantry), zona publik di selatan
// (foyer, ruang tamu, mushola, KM tamu), ruang keluarga dan ruang makan terbuka ke taman tengah lewat dinding kaca.
// Ukuran mengacu patokan umum: kamar utama ≥ 3,5 × 4 m, KM dengan bathtub ≥ 2,5 × 3 m, carport 2 mobil ±6 × 5 m.
// As struktur: x 0 / 6 / 10 / 17 / 24, y 0 / 5 / 9 / 14 / 19. Utara = atas gambar, pintu masuk dari selatan.

const EXT = 0.25
const INT = 0.15
const H = 3.2

type Spec = { kind: 'door' | 'window'; at: number; width: number; style?: Opening['style']; sill?: number; height?: number }
const D = (at: number, width = 0.9, style?: Opening['style']): Spec => ({ kind: 'door', at, width, style })
const W = (at: number, width = 1.2, style?: Opening['style'], sill = 0.9, height = 1.4): Spec => ({ kind: 'window', at, width, style, sill, height })
// Kaca dari lantai ke plafon ke arah taman tengah.
const G = (at: number, width = 2): Spec => W(at, width, 'fixed', 0.1, 2.6)
const HIGH = (at: number, width = 0.6): Spec => W(at, width, 'louvre', 1.6, 0.6)

const walls: Wall[] = []
const openings: Opening[] = []
// Dinding dari a ke b, bukaan ditulis dengan koordinat mutlak (x untuk dinding mendatar, y untuk dinding tegak).
function wall(id: string, a: Point, b: Point, thickness: number, ...specs: Spec[]) {
  walls.push({ id, a, b, thickness, height: H })
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

// Mendatar
wall('h0', [0, 0], [24, 0], EXT, W(1.5, 1.5, 'louvre'), W(4.5, 0.8), W(8, 1.6), HIGH(11.25), W(14.75, 1.6), W(19, 1.6), W(22, 1.6))
wall('h3a', [3, 3], [6, 3], INT)
wall('h3b', [10, 3], [12.5, 3], INT, D(11.25, 0.7))
wall('h5a', [0, 5], [10, 5], INT, D(1.5, 0.9), D(8, 0.9))
wall('h5b', [12.5, 5], [24, 5], INT, D(18.5, 0.9))
wall('h65', [10, 6.5], [15.5, 6.5], INT, G(11.5), G(14))
wall('h7', [3, 7], [6, 7], INT, D(4.5, 0.8))
wall('h9a', [0, 9], [6, 9], INT, D(1.5, 0.8), D(4.5, 1.0, 'sliding'))
wall('h9b', [17, 9], [24, 9], INT)
wall('h14c', [0, 14], [6, 14], EXT, D(1.5, 0.9))
wall('h14a', [6, 14], [17, 14], INT, D(9.25, 0.9), G(11.5), G(14.25), D(16.25, 0.9))
wall('h14b', [17, 14], [24, 14], EXT, W(21.5, 1.6))
wall('h165', [6, 16.5], [8.5, 16.5], INT)
wall('h17', [17, 17], [19.5, 17], EXT, W(18.25, 0.8))
wall('h19', [6, 19], [17, 19], EXT, D(8, 1.4, 'double'), W(12, 2), W(15, 2))
// Tegak
wall('v0', [0, 0], [0, 14], EXT, D(2.5, 0.9), D(8.4, 0.9), W(11.5, 1.8))
wall('v0c', [0, 14], [0, 19], EXT)
wall('v3', [3, 0], [3, 9], INT, D(1.5, 0.8), D(4, 0.7), D(8, 0.8))
wall('v6a', [6, 0], [6, 5], INT)
wall('v6b', [6, 5], [6, 19], INT, D(11.5, 2.4, 'sliding'))
wall('v85', [8.5, 14], [8.5, 16.5], INT, D(16, 0.7))
wall('v10a', [10, 0], [10, 5], INT)
wall('v10b', [10, 6.5], [10, 14], INT, G(8), D(10.75, 2, 'sliding'), G(13, 1.4))
wall('v10c', [10, 14], [10, 19], INT, D(16.5, 1.2, 'double'))
wall('v125', [12.5, 0], [12.5, 5], INT, D(4, 0.9))
wall('v155', [15.5, 6.5], [15.5, 14], INT, G(8.5), D(10.25, 1.2, 'sliding'), G(12.5))
wall('v17a', [17, 0], [17, 14], INT, D(5.75, 0.9), D(11.5, 0.9))
wall('v17b', [17, 14], [17, 17], INT, D(15.5, 0.8))
wall('v195', [19.5, 14], [19.5, 17], EXT)
wall('v20', [20, 5], [20, 9], INT, D(7, 0.8))
wall('v24', [24, 0], [24, 14], EXT, W(2.5, 1.6), HIGH(7, 0.8), W(11.5, 1.6))

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const room = (id: string, name: string, points: Point[], floor?: Room['floor']): Room => ({ id, name, points, ...(floor && { floor }) })

const rooms: Room[] = [
  room('cuci', 'Cuci / Jemur', rect(0, 0, 3, 5), 'beton'),
  room('art', 'Kamar ART', rect(3, 0, 6, 3)),
  room('kmart', 'KM ART', rect(3, 3, 6, 5)),
  room('anak1', 'Kamar Anak 1', rect(6, 0, 10, 5), 'kayu'),
  room('kmanak', 'KM Anak', rect(10, 0, 12.5, 3)),
  room('anak2', 'Kamar Anak 2', rect(12.5, 0, 17, 5), 'kayu'),
  room('utama', 'Kamar Utama', rect(17, 0, 24, 5), 'kayu'),
  room('selasar', 'Selasar', [[10, 3], [12.5, 3], [12.5, 5], [17, 5], [17, 14], [15.5, 14], [15.5, 6.5], [6, 6.5], [6, 5], [10, 5]], 'teraso'),
  room('wic', 'Walk-in Closet', rect(17, 5, 20, 9), 'kayu'),
  room('kmutama', 'KM Utama', rect(20, 5, 24, 9)),
  room('kotor', 'Dapur Kotor', rect(0, 5, 3, 9)),
  room('gudang', 'Gudang', rect(3, 5, 6, 7), 'beton'),
  room('pantry', 'Pantry', rect(3, 7, 6, 9)),
  room('makan', 'Dapur & Makan', rect(0, 9, 6, 14), 'teraso'),
  room('keluarga', 'Ruang Keluarga', rect(6, 6.5, 10, 14), 'kayu'),
  room('kerja', 'Ruang Kerja', rect(17, 9, 24, 14), 'kayu'),
  room('kmtamu', 'KM Tamu', rect(6, 14, 8.5, 16.5)),
  room('foyer', 'Foyer', [[8.5, 14], [10, 14], [10, 19], [6, 19], [6, 16.5], [8.5, 16.5]], 'teraso'),
  room('tamu', 'Ruang Tamu', rect(10, 14, 17, 19), 'teraso'),
  room('mushola', 'Mushola', rect(17, 14, 19.5, 17), 'kayu'),
  room('carport', 'Carport', rect(0, 14, 6, 19), 'beton'),
  room('teras', 'Teras', rect(6.5, 19, 10, 21.4), 'beton'),
]

// rot: 0 = sisi belakang (sandaran, kepala kasur) ke utara, 90 ke timur, 180 ke selatan, 270 ke barat.
const f = (id: string, kind: Furniture['kind'], x: number, y: number, rot = 0): Furniture => ({ id, kind, pos: [x, y], rot })
const furniture: Furniture[] = [
  f('f1', 'bed1', 8, 1.15),
  f('f2', 'wardrobe', 9.6, 3.6, 90),
  f('f3', 'desk', 6.45, 2.6, 270),
  f('f4', 'toilet', 10.45, 0.5),
  f('f5', 'sink', 11.5, 0.4),
  f('f6', 'shower', 12.0, 2.5),
  f('f7', 'bed1', 14.75, 1.15),
  f('f8', 'wardrobe', 16.6, 3.6, 90),
  f('f9', 'desk', 12.95, 2.0, 270),
  f('f10', 'bed2', 20.5, 1.15),
  f('f11', 'desk', 17.45, 2.6, 270),
  f('f12', 'armchair', 23.3, 4.2, 90),
  f('f13', 'wardrobe', 17.4, 7.7, 270),
  f('f14', 'wardrobe', 18.6, 8.6, 180),
  f('f15', 'bathtub', 23.45, 6.9),
  f('f16', 'shower', 20.6, 8.4),
  f('f17', 'toilet', 22.2, 8.5, 180),
  f('f18', 'sink', 21.2, 5.35),
  f('f19', 'sink', 22.1, 5.35),
  f('f20', 'sink', 0.35, 1.0, 270),
  f('f21', 'bed1', 5.4, 1.1),
  f('f22', 'toilet', 5.55, 4.6, 180),
  f('f23', 'shower', 5.4, 3.55),
  f('f24', 'kitchen', 0.4, 6.4, 270),
  f('f25', 'fridge', 5.55, 7.6, 90),
  f('f26', 'kitchen', 0.4, 11.5, 270),
  f('f27', 'dining', 3.4, 11.6, 90),
  f('f28', 'sofa', 8, 13.4, 180),
  f('f29', 'armchair', 6.6, 9.4, 270),
  f('f30', 'armchair', 6.6, 10.4, 270),
  f('f31', 'sofa', 13.5, 18.5, 180),
  f('f32', 'armchair', 11.0, 17.8, 270),
  f('f33', 'armchair', 16.4, 17.6, 90),
  f('f34', 'desk', 21, 13.6, 180),
  f('f35', 'wardrobe', 22.5, 9.35),
  f('f36', 'armchair', 18.2, 10.2, 270),
  f('f37', 'toilet', 6.6, 14.5),
  f('f38', 'sink', 7.8, 14.35),
]

export const SAMPLE_NAME = 'Rumah Taman Tengah'

export const SAMPLE: Project = { version: 1, walls, openings, rooms, furniture }

// Tapak: hanya untuk lembar gambar (tidak masuk model 3D). Taman tengah 5,5 × 7,5 m dengan kolam ikan dan pohon,
// taman depan dengan jalan setapak batu, mobil di carport, kolom carport, dan garis batas lahan.
export const SAMPLE_SITE: Site = {
  axes: { x: [0, 6, 10, 17, 24], y: [0, 5, 9, 14, 19] },
  // Rumput digambar dulu, perkerasan dan teras menimpanya.
  lawns: [rect(10, 6.5, 15.5, 14), rect(-1, 19, 25, 24), [[19.5, 14], [24, 14], [24, 19], [17, 19], [17, 17], [19.5, 17]]],
  paving: [rect(0, 19, 6, 24), rect(7.6, 21.4, 8.9, 24)],
  pools: [[[11, 9.6], [13.6, 9.6], [13.6, 11.2], [14.4, 11.2], [14.4, 13.2], [11, 13.2]]],
  stones: [[10.7, 10.75], [10.7, 9.75], [11.4, 8.95], [12.4, 8.95], [13.4, 9.2], [14.3, 9.75], [14.9, 10.3]],
  trees: [
    { at: [14.55, 8.35], r: 0.8 },
    { at: [2, 22.3], r: 1.3 },
    { at: [12.5, 21.8], r: 1.6 },
    { at: [16.5, 22.6], r: 1.1 },
    { at: [21.5, 16.5], r: 1.6 },
    { at: [23.2, 21.6], r: 1.2 },
  ],
  cars: [
    { at: [1.6, 16.6], rot: 0 },
    { at: [4.4, 16.6], rot: 0 },
  ],
  columns: [[0.15, 18.85], [5.85, 18.85]],
  labels: [
    { at: [12.4, 7.5], text: 'Taman Tengah', sub: '41.3 m² · 5.50 × 7.50' },
    { at: [12.6, 11.5], text: 'Kolam Ikan', sub: 'kedalaman 0.60' },
  ],
  boundary: rect(-1, -1, 25, 24),
}
