import type { Opening, Point, Project, Room, Wall } from './project'
import type { Furniture } from './furniture'

// Denah rumah contoh untuk lembar gambar di halaman depan: selalu sama, tidak ikut proyek pengguna.
// Rumah satu lantai 12 × 10 m dengan teras di depan (selatan = bawah gambar). As: x 0 / 4 / 6,5 / 9 / 12, y 0 / 3,5 / 7 / 10.
// Bisa dibuka di editor sebagai proyek baru lewat tombol di halaman depan.

const EXT = 0.2
const INT = 0.12
const H = 3

const wall = (id: string, a: Point, b: Point, thickness = INT): Wall => ({ id, a, b, thickness, height: H })
const door = (id: string, wallId: string, at: number, width = 0.8, style?: Opening['style']): Opening => ({ id, wallId, at, width, kind: 'door', sill: 0, height: 2.1, ...(style && { style }) })
const win = (id: string, wallId: string, at: number, width = 1.2, sill = 0.9, height = 1.2): Opening => ({ id, wallId, at, width, kind: 'window', sill, height })
const room = (id: string, name: string, x0: number, y0: number, x1: number, y1: number, floor?: Room['floor']): Room => ({
  id,
  name,
  points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
  ...(floor && { floor }),
})
const item = (id: string, kind: Furniture['kind'], x: number, y: number, rot = 0): Furniture => ({ id, kind, pos: [x, y], rot })

export const SAMPLE_NAME = 'Rumah Contoh'

export const SAMPLE: Project = {
  version: 1,
  walls: [
    wall('n', [0, 0], [12, 0], EXT),
    wall('e', [12, 0], [12, 10], EXT),
    wall('s', [12, 10], [0, 10], EXT),
    wall('w', [0, 10], [0, 0], EXT),
    wall('y35', [0, 3.5], [12, 3.5]),
    wall('y7', [0, 7], [12, 7]),
    wall('x4a', [4, 0], [4, 3.5]),
    wall('x65', [6.5, 0], [6.5, 3.5]),
    wall('x9a', [9, 0], [9, 3.5]),
    wall('x9b', [9, 3.5], [9, 7]),
    wall('x4c', [4, 7], [4, 10]),
    wall('x9c', [9, 7], [9, 10]),
  ],
  openings: [
    // Utara: jendela kamar dan kamar mandi.
    win('j1', 'n', 2, 1.5),
    win('j2', 'n', 5.25, 0.6, 1.6, 0.5),
    win('j3', 'n', 7.75),
    win('j4', 'n', 10.5, 1.5),
    // Timur dan barat.
    win('j5', 'e', 1.75),
    win('j6', 'e', 5.25),
    win('j7', 'w', 1.5, 1.5),
    win('j8', 'w', 4.75, 1.5),
    win('j9', 'w', 8.25),
    // Selatan (dari x = 12 ke 0): pintu garasi, pintu utama ganda, jendela ruang tamu dan ruang kerja.
    door('p1', 's', 1.5, 2.6, 'sliding'),
    door('p2', 's', 4.6, 1.2, 'double'),
    win('j10', 's', 6.6, 1.5),
    win('j11', 's', 10, 1.5),
    // Dalam.
    door('p3', 'y35', 3),
    door('p4', 'y35', 5.25, 0.7),
    door('p5', 'y35', 7.75),
    door('p6', 'y35', 10.5),
    door('p7', 'x9b', 1.75, 0.9, 'sliding'),
    door('p8', 'y7', 2),
    door('p9', 'y7', 5.6, 1.2, 'double'),
    door('p10', 'y7', 10.5),
  ],
  rooms: [
    room('r1', 'Kamar Utama', 0, 0, 4, 3.5, 'kayu'),
    room('r2', 'KM / WC', 4, 0, 6.5, 3.5),
    room('r3', 'Kamar 2', 6.5, 0, 9, 3.5, 'kayu'),
    room('r4', 'Kamar 3', 9, 0, 12, 3.5, 'kayu'),
    room('r5', 'Ruang Keluarga', 0, 3.5, 9, 7, 'teraso'),
    room('r6', 'Dapur', 9, 3.5, 12, 7),
    room('r7', 'Ruang Kerja', 0, 7, 4, 10, 'kayu'),
    room('r8', 'Ruang Tamu', 4, 7, 9, 10, 'teraso'),
    room('r9', 'Garasi', 9, 7, 12, 10, 'beton'),
    room('r10', 'Teras', 4, 10, 9, 11.8, 'beton'),
  ],
  furniture: [
    item('f1', 'bed2', 2, 1.15),
    item('f2', 'wardrobe', 0.75, 3.05, 180),
    item('f3', 'toilet', 4.4, 0.5),
    item('f4', 'sink', 6.05, 0.4),
    item('f5', 'shower', 5.95, 2.85),
    item('f6', 'bed1', 7.75, 1.1),
    item('f7', 'bed1', 10.5, 1.1),
    item('f8', 'desk', 11.3, 2.8, 90),
    item('f9', 'sofa', 0.55, 5.25, 270),
    item('f10', 'armchair', 2.3, 5.25, 90),
    item('f11', 'dining', 6.8, 5.25),
    item('f12', 'kitchen', 11.6, 5.25, 90),
    item('f13', 'fridge', 9.5, 6.55, 180),
    item('f14', 'desk', 2, 9.6, 180),
    item('f15', 'sofa', 4.55, 8.5, 270),
    item('f16', 'armchair', 8.4, 8.5, 90),
  ],
}
