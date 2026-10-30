// Material lantai dan dinding. Tekstur 3D digambar dengan kode di kanvas (tanpa file gambar),
// skala 1 tekstur = 1 meter, jadi motif tampil seukuran aslinya.

export const FLOORS = {
  keramik: { label: 'Keramik 60×60', plan: '#e9e2d3', base: '#e8e3da' },
  kayu: { label: 'Parket kayu', plan: '#e6d3b3', base: '#b98b5e' },
  teraso: { label: 'Teraso', plan: '#ece6da', base: '#e4dccd' },
  beton: { label: 'Beton ekspos', plan: '#ddd8cf', base: '#a9a49b' },
} as const

export const WALLS = {
  cat: { label: 'Cat putih', base: '#f3eee3' },
  bata: { label: 'Bata ekspos', base: '#b5654a' },
  beton: { label: 'Beton ekspos', base: '#b8b3aa' },
} as const

export type FloorKey = keyof typeof FLOORS
export type WallKey = keyof typeof WALLS
export const DEFAULT_FLOOR: FloorKey = 'keramik'
export const DEFAULT_WALL: WallKey = 'cat'

export const isFloor = (k: unknown): k is FloorKey => typeof k === 'string' && k in FLOORS
type RoofMaterial = 'genteng' | 'metal' | 'beton'

export const isWall = (k: unknown): k is WallKey => typeof k === 'string' && k in WALLS

// Warna dasar atap (sama dengan ROOF_MATERIALS di roof.ts; ditaruh di sini supaya modul tekstur tidak bergantung pada geometri atap).
const ROOFS = { metal: '#5d6b70', beton: '#7f7a74' }

// Acak berbenih: tekstur sama setiap kali dibuat, tidak berkedip saat render ulang.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

const SIZE = 512 // piksel per meter

function speckle(g: CanvasRenderingContext2D, r: () => number, n: number, colors: string[], size: [number, number]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)]
    const s = size[0] + r() * (size[1] - size[0])
    g.fillRect(r() * SIZE, r() * SIZE, s, s)
  }
}

// Menggambar satu ubin 1×1 m. Dipanggil di browser saja (butuh canvas).
export type TextureKey = FloorKey | `wall:${WallKey}` | `roof:${RoofMaterial}`

export function paint(kind: TextureKey): HTMLCanvasElement {
  const c = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE })
  const g = c.getContext('2d')!
  const r = rng(kind.length * 9973)
  switch (kind) {
    case 'keramik': {
      g.fillStyle = FLOORS.keramik.base
      g.fillRect(0, 0, SIZE, SIZE)
      speckle(g, r, 1500, ['#e1dbd0', '#efeae2'], [1, 3])
      // Nat tiap 60 cm: 1 m tidak habis dibagi 60 cm, jadi pola diulang per 1,2 m lewat dua ubin per sisi tekstur.
      g.strokeStyle = '#cfc7b8'
      g.lineWidth = 3
      for (const t of [0, 0.5]) {
        g.beginPath()
        g.moveTo(t * SIZE, 0)
        g.lineTo(t * SIZE, SIZE)
        g.moveTo(0, t * SIZE)
        g.lineTo(SIZE, t * SIZE)
        g.stroke()
      }
      break
    }
    case 'kayu': {
      // Papan 16 cm, sambungan ujung acak, serat tipis.
      const plank = SIZE * 0.16
      for (let x = 0; x < SIZE; x += plank) {
        let y = -r() * SIZE
        while (y < SIZE) {
          const len = SIZE * (0.6 + r() * 0.6)
          const tone = 150 + Math.floor(r() * 40)
          g.fillStyle = `rgb(${tone + 35}, ${tone}, ${tone - 50})`
          g.fillRect(x, y, plank, len)
          g.strokeStyle = 'rgba(70, 45, 25, 0.12)'
          g.lineWidth = 1
          for (let k = 0; k < 5; k++) {
            g.beginPath()
            const gx = x + r() * plank
            g.moveTo(gx, y)
            g.bezierCurveTo(gx + 4, y + len / 3, gx - 4, y + (2 * len) / 3, gx, y + len)
            g.stroke()
          }
          g.fillStyle = 'rgba(60, 40, 20, 0.45)'
          g.fillRect(x, y, plank, 2)
          y += len
        }
        g.fillStyle = 'rgba(60, 40, 20, 0.5)'
        g.fillRect(x, 0, 2, SIZE)
      }
      break
    }
    case 'teraso':
      g.fillStyle = FLOORS.teraso.base
      g.fillRect(0, 0, SIZE, SIZE)
      speckle(g, r, 2600, ['#a39a8c', '#c9bfae', '#7d766c', '#d8cbb4', '#f6f1e8'], [2, 7])
      break
    case 'beton':
    case 'wall:beton':
      g.fillStyle = kind === 'beton' ? FLOORS.beton.base : WALLS.beton.base
      g.fillRect(0, 0, SIZE, SIZE)
      speckle(g, r, 6000, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)'], [2, 10])
      if (kind === 'wall:beton') {
        // Lubang bekas tie-rod bekisting tiap 60 cm.
        g.fillStyle = 'rgba(60,55,50,0.35)'
        for (const x of [0.2, 0.8]) for (const y of [0.25, 0.75]) g.fillRect(x * SIZE - 5, y * SIZE - 5, 10, 10)
      }
      break
    case 'wall:bata': {
      // Bata 23×5,5 cm dengan nat 1 cm, susunan setengah bata.
      g.fillStyle = '#d8cfc0'
      g.fillRect(0, 0, SIZE, SIZE)
      const bh = SIZE * 0.065
      const bw = SIZE * 0.24
      for (let row = 0, y = 0; y < SIZE; row++, y += bh) {
        for (let x = row % 2 ? -bw / 2 : 0; x < SIZE; x += bw) {
          const t = Math.floor(r() * 30)
          g.fillStyle = `rgb(${165 + t}, ${88 + t / 2}, ${64 + t / 3})`
          g.fillRect(x + 3, y + 3, bw - 6, bh - 6)
        }
      }
      break
    }
    case 'roof:genteng': {
      // Genteng tanah liat: baris tiap 33 cm (arah v = naik lereng), lebar 21 cm, tiap genteng melengkung (gelap di tepi).
      const rowH = SIZE * 0.33
      const tileW = SIZE * 0.21
      for (let y = 0; y < SIZE; y += rowH) {
        for (let x = 0; x < SIZE + tileW; x += tileW) {
          const tone = Math.floor(r() * 26)
          const grad = g.createLinearGradient(x, 0, x + tileW, 0)
          grad.addColorStop(0, `rgb(${120 + tone}, ${52 + tone / 2}, ${36})`)
          grad.addColorStop(0.5, `rgb(${178 + tone}, ${92 + tone / 2}, ${62})`)
          grad.addColorStop(1, `rgb(${120 + tone}, ${52 + tone / 2}, ${36})`)
          g.fillStyle = grad
          g.fillRect(x, y, tileW, rowH)
        }
        g.fillStyle = 'rgba(40, 18, 10, 0.45)' // bayangan tumpang tindih baris di atasnya
        g.fillRect(0, y + rowH - 6, SIZE, 6)
      }
      break
    }
    case 'roof:metal': {
      // Genteng metal pasir: undakan tiap 35 cm, alur tiap 20 cm, permukaan berbintik.
      g.fillStyle = ROOFS.metal
      g.fillRect(0, 0, SIZE, SIZE)
      speckle(g, r, 5000, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.1)'], [1, 3])
      for (let x = 0; x < SIZE; x += SIZE * 0.2) {
        g.fillStyle = 'rgba(0,0,0,0.18)'
        g.fillRect(x, 0, 4, SIZE)
      }
      for (let y = 0; y < SIZE; y += SIZE * 0.35) {
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(0, y, SIZE, 5)
        g.fillStyle = 'rgba(255,255,255,0.12)'
        g.fillRect(0, y + 5, SIZE, 3)
      }
      break
    }
    case 'roof:beton': {
      // Genteng beton datar 33 × 42 cm, nat gelap.
      g.fillStyle = ROOFS.beton
      g.fillRect(0, 0, SIZE, SIZE)
      speckle(g, r, 4000, ['rgba(255,255,255,0.07)', 'rgba(0,0,0,0.08)'], [1, 4])
      g.fillStyle = 'rgba(30,28,26,0.45)'
      for (let y = 0; y < SIZE; y += SIZE * 0.33) g.fillRect(0, y, SIZE, 5)
      for (let row = 0, y = 0; y < SIZE; row++, y += SIZE * 0.33)
        for (let x = row % 2 ? SIZE * 0.21 : 0; x < SIZE; x += SIZE * 0.42) g.fillRect(x, y, 3, SIZE * 0.33)
      break
    }
    case 'wall:cat':
      g.fillStyle = WALLS.cat.base
      g.fillRect(0, 0, SIZE, SIZE)
      speckle(g, r, 1200, ['rgba(0,0,0,0.025)'], [2, 5])
      break
  }
  return c
}

// Ukuran ulang motif (meter). Keramik digambar dua ubin per sisi, jadi satu tekstur = 1,2 m.
export const repeatSize = (kind: TextureKey) => (kind === 'keramik' ? 1.2 : 1)
